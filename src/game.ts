import { character } from './character.ts'
import type { Character } from './character.ts'
import { angleDifference, cellAt, cellKey, DOORS, DOOR_INTERACT_ANGLE, DOOR_INTERACT_DISTANCE, DUNGEON_MAP, headingTo, INITIAL_PLAYER, moveWithCollision, PLAYER_RADIUS, PLAYER_SPEED, sameCell, wrapAngle } from './dungeon.ts'
import type { Cell, Door, DungeonMap, Player, Point } from './dungeon.ts'
import { ENEMY_RADIUS, ENEMY_SPEED, ENEMY_THINK_INTERVAL, INITIAL_ENEMY } from './enemy.ts'
import type { Enemy } from './enemy.ts'
import { shortestPath, cellCenter } from './pathfinding.ts'
import { doorSegment } from './dungeon.ts'
import { hear, movementSound, see } from './senses.ts'
import type { EnemyDetection, SoundEvent } from './senses.ts'
import type { Message } from './i18n.ts'

export const MAX_SIMULATION_STEP = 0.05
export const PLAYER_FIELD_OF_VIEW = Math.PI * 0.43
const PLAYER_NOISE_DURATION = 0.45
const ENEMY_NOISE_DURATION = 0.4
const PLAYER_ENEMY_CONTACT = PLAYER_RADIUS + ENEMY_RADIUS
const EVENT_COOLDOWN: Partial<Record<Message, number>> = {
  doorAhead: 5,
  enemyDetected: 3,
  enemySpotted: 3,
  heardMovement: 2.5,
}

export type GameEvent = Readonly<{ id: number; key: Message; time: number }>
export type MovementInput = Readonly<{ forward: number; strafe: number }>
export type GameState = Readonly<{
  player: Character
  enemies: readonly Enemy[]
  openDoors: readonly boolean[]
  visited: ReadonlySet<string>
  detections: readonly EnemyDetection[]
  time: number
  gameOver: boolean
  events: readonly GameEvent[]
  eventCooldowns: Readonly<Partial<Record<Message, number>>>
  nextEventId: number
  thinkTimer: number
  playerNoise: SoundEvent | null
  playerNoiseTime: number
  enemyNoise: SoundEvent | null
  enemyNoiseTime: number
}>

export type GameOptions = Readonly<{
  player?: Player
  enemies?: readonly Enemy[]
  openDoors?: readonly boolean[]
  doors?: readonly Door[]
}>

function addEvent(state: GameState, key: Message): GameState {
  const until = state.eventCooldowns[key] ?? -Infinity
  if (state.time < until) return state
  return {
    ...state,
    events: [...state.events, { id: state.nextEventId, key, time: state.time }].slice(-2),
    eventCooldowns: { ...state.eventCooldowns, [key]: state.time + (EVENT_COOLDOWN[key] ?? 0.8) },
    nextEventId: state.nextEventId + 1,
  }
}

export function createGame(options: GameOptions = {}): GameState {
  const player = character(options.player ?? INITIAL_PLAYER)
  const doors = options.doors ?? DOORS
  const opened = options.openDoors ?? Array.from({ length: doors.length }, () => false)
  return {
    player,
    enemies: options.enemies ?? [INITIAL_ENEMY],
    openDoors: [...opened],
    visited: new Set([cellKey(cellAt(player))]),
    detections: [],
    time: 0,
    gameOver: false,
    events: [{ id: 0, key: 'ready', time: 0 }],
    eventCooldowns: { ready: Infinity },
    nextEventId: 1,
    thinkTimer: 0,
    playerNoise: null,
    playerNoiseTime: 0,
    enemyNoise: null,
    enemyNoiseTime: 0,
  }
}

export function rotatePlayer(state: GameState, delta: number): GameState {
  if (state.gameOver || !Number.isFinite(delta) || delta === 0) return state
  return { ...state, player: { ...state.player, heading: wrapAngle(state.player.heading + delta) } }
}

function contact(player: Point, enemies: readonly Enemy[]): boolean {
  return enemies.some(enemy => Math.hypot(player.x - enemy.x, player.y - enemy.y) <= PLAYER_ENEMY_CONTACT)
}

function setGameOver(state: GameState): GameState {
  return state.gameOver ? state : addEvent({ ...state, gameOver: true }, 'gameOver')
}

function doorTarget(player: Player, doors: readonly Door[]): { index: number; distance: number } | null {
  let best: { index: number; distance: number } | null = null
  for (let index = 0; index < doors.length; index++) {
    const [a, b] = doorSegment(doors[index]!)
    const target = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    const dx = target.x - player.x, dy = target.y - player.y
    const distance = Math.hypot(dx, dy)
    if (distance > DOOR_INTERACT_DISTANCE || Math.abs(angleDifference(player.heading, headingTo(dx, dy))) > DOOR_INTERACT_ANGLE) continue
    if (!best || distance < best.distance) best = { index, distance }
  }
  return best
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const length2 = dx * dx + dy * dy
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length2))
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy))
}

export function interact(state: GameState, map: DungeonMap = DUNGEON_MAP, doors: readonly Door[] = map === DUNGEON_MAP ? DOORS : []): GameState {
  if (state.gameOver) return state
  const target = doorTarget(state.player, doors)
  if (!target) return state
  const openDoors = [...state.openDoors]
  const opening = !openDoors[target.index]
  if (!opening) {
    const [a, b] = doorSegment(doors[target.index]!)
    const occupied = distanceToSegment(state.player, a, b) < PLAYER_RADIUS + 0.025 ||
      state.enemies.some(enemy => distanceToSegment(enemy, a, b) < ENEMY_RADIUS + 0.025)
    if (occupied) return addEvent(state, 'doorJammed')
  }
  openDoors[target.index] = opening
  const next = {
    ...state,
    openDoors,
    playerNoise: { sourceId: 'player', position: { x: state.player.x, y: state.player.y } },
    playerNoiseTime: PLAYER_NOISE_DURATION,
  }
  return addEvent(next, opening ? 'doorOpened' : 'doorClosed')
}

function chooseDestination(enemy: Enemy, state: GameState, map: DungeonMap, doors: readonly Door[], random: () => number): Cell | null {
  const cells = shortestPath(map, cellAt(enemy), cellAt(state.player), doors, state.openDoors)
  if (cells && cells.length) return cellAt(state.player)
  const reachable: Cell[] = []
  for (let y = 0; y < map.length; y++) for (let x = 0; x < (map[y]?.length ?? 0); x++) {
    if (!map[y]![x] || map[y]![x] !== '#') continue
    const path = shortestPath(map, cellAt(enemy), { x, y }, doors, state.openDoors)
    if (path?.length && (x !== Math.floor(enemy.x) || y !== Math.floor(enemy.y))) reachable.push({ x, y })
  }
  if (!reachable.length) return null
  const index = Math.max(0, Math.min(reachable.length - 1, Math.floor(random() * reachable.length)))
  return reachable[index]!
}

function planEnemy(enemy: Enemy, state: GameState, map: DungeonMap, doors: readonly Door[], random: () => number): Enemy {
  const visual = see(map, enemy, state.player, doors, state.openDoors, enemy.vision)
  const audible = visual ? null : state.playerNoiseTime > 0 ? hear(enemy, state.playerNoise, enemy.hearing) : null
  let destination = enemy.destination
  let alerted = enemy.alerted
  if (visual || audible) {
    destination = cellAt(visual?.position ?? audible!.position)
    alerted = true
  } else if (destination && sameCell(cellAt(enemy), destination)) {
    destination = null
    alerted = false
  }
  if (!destination) destination = chooseDestination(enemy, state, map, doors, random)
  if (!destination) return { ...enemy, destination: null, route: [], alerted: false }
  const path = shortestPath(map, cellAt(enemy), destination, doors, state.openDoors) ?? []
  const route = path.map(cellCenter)
  return { ...enemy, destination, route, alerted }
}

function moveEnemy(enemy: Enemy, player: Character, dt: number, map: DungeonMap, doors: readonly Door[], openDoors: readonly boolean[]): Enemy {
  let x = enemy.x, y = enemy.y, heading = enemy.heading
  let route = [...enemy.route]
  let remaining = ENEMY_SPEED * dt
  for (let i = 0; i < 8 && remaining > 1e-5; i++) {
    let target = route[0]
    if (!target && enemy.alerted && enemy.destination && sameCell(cellAt(enemy), enemy.destination)) target = player
    if (!target) break
    const dx = target.x - x, dy = target.y - y, distance = Math.hypot(dx, dy)
    if (distance < 0.025) {
      if (route.length) { route.shift(); continue }
      break
    }
    heading = headingTo(dx, dy)
    const travel = Math.min(remaining, distance)
    const moved = moveWithCollision(map, { x, y }, dx / distance * travel, dy / distance * travel, ENEMY_RADIUS, doors, openDoors)
    const actual = Math.hypot(moved.x - x, moved.y - y)
    if (actual < 1e-5) break
    x = moved.x; y = moved.y; remaining -= actual
    if (distance <= actual + 0.025 && route.length) route.shift()
  }
  return { ...enemy, x, y, heading, route }
}

function think(state: GameState, map: DungeonMap, doors: readonly Door[], random: () => number): GameState {
  const enemies = state.enemies.map(enemy => planEnemy(enemy, state, map, doors, random))
  const spotted = enemies.some(enemy => enemy.alerted) && !state.enemies.some(enemy => enemy.alerted)
  let next: GameState = { ...state, enemies }
  if (spotted) next = addEvent(next, 'enemySpotted')
  return next
}

function refreshDetections(state: GameState, map: DungeonMap, doors: readonly Door[]): GameState {
  const detections: EnemyDetection[] = []
  for (const enemy of state.enemies) {
    const sight = see(map, state.player, enemy, doors, state.openDoors, state.player.vision, PLAYER_FIELD_OF_VIEW)
    const hearing = sight ? null : state.enemyNoiseTime > 0 ? hear(state.player, state.enemyNoise, state.player.hearing) : null
    const detection = sight ?? hearing
    if (detection) detections.push({ ...detection, enemyId: enemy.id })
  }
  const becameVisible = detections.some(item => item.kind === 'sight') && !state.detections.some(item => item.kind === 'sight')
  const becameAudible = detections.some(item => item.kind === 'hearing') && state.detections.length === 0
  let next: GameState = { ...state, detections }
  if (becameVisible) next = addEvent(next, 'enemyDetected')
  else if (becameAudible) next = addEvent(next, 'heardMovement')
  return next
}

function faceDoor(state: GameState, doors: readonly Door[]): GameState {
  if (!doorTarget(state.player, doors)) return state
  return addEvent(state, 'doorAhead')
}

export function stepGame(
  original: GameState,
  input: MovementInput,
  elapsedSeconds: number,
  map: DungeonMap = DUNGEON_MAP,
  doors: readonly Door[] = map === DUNGEON_MAP ? DOORS : [],
  random: () => number = Math.random,
): GameState {
  if (original.gameOver || !Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return original
  const dt = Math.min(elapsedSeconds, MAX_SIMULATION_STEP)
  let state: GameState = {
    ...original,
    time: original.time + dt,
    playerNoiseTime: Math.max(0, original.playerNoiseTime - dt),
    enemyNoiseTime: Math.max(0, original.enemyNoiseTime - dt),
    playerNoise: original.playerNoiseTime > dt ? original.playerNoise : null,
    enemyNoise: original.enemyNoiseTime > dt ? original.enemyNoise : null,
  }
  let forward = Number.isFinite(input.forward) ? input.forward : 0
  let strafe = Number.isFinite(input.strafe) ? input.strafe : 0
  const magnitude = Math.hypot(forward, strafe)
  if (magnitude > 1) { forward /= magnitude; strafe /= magnitude }
  const dx = (Math.sin(state.player.heading) * forward + Math.cos(state.player.heading) * strafe) * PLAYER_SPEED * dt
  const dy = (-Math.cos(state.player.heading) * forward + Math.sin(state.player.heading) * strafe) * PLAYER_SPEED * dt
  const before = state.player
  const moved = moveWithCollision(map, before, dx, dy, PLAYER_RADIUS, doors, state.openDoors)
  const player: Character = { ...before, ...moved }
  const playerNoise = movementSound('player', before, player)
  if (playerNoise) state = { ...state, playerNoise, playerNoiseTime: PLAYER_NOISE_DURATION }
  const visited = cellAt(before).x === cellAt(player).x && cellAt(before).y === cellAt(player).y
    ? state.visited : new Set([...state.visited, cellKey(cellAt(player))])
  state = { ...state, player, visited }
  if (contact(player, state.enemies)) return setGameOver(state)

  state = faceDoor(state, doors)
  let thinkTimer = state.thinkTimer + dt
  while (thinkTimer >= ENEMY_THINK_INTERVAL) {
    state = think(state, map, doors, random)
    thinkTimer -= ENEMY_THINK_INTERVAL
  }
  state = { ...state, thinkTimer }

  const movedEnemies: Enemy[] = []
  let enemyNoise: SoundEvent | null = null
  for (const enemy of state.enemies) {
    const movedEnemy = moveEnemy(enemy, state.player, dt, map, doors, state.openDoors)
    movedEnemies.push(movedEnemy)
    enemyNoise = movementSound(movedEnemy.id, enemy, movedEnemy) ?? enemyNoise
    if (Math.hypot(movedEnemy.x - state.player.x, movedEnemy.y - state.player.y) <= PLAYER_ENEMY_CONTACT) {
      movedEnemies.push(...state.enemies.slice(movedEnemies.length))
      state = { ...state, enemies: movedEnemies }
      state = setGameOver(state)
      return state
    }
  }
  state = {
    ...state,
    enemies: movedEnemies,
    enemyNoise: enemyNoise ?? state.enemyNoise,
    enemyNoiseTime: enemyNoise ? ENEMY_NOISE_DURATION : state.enemyNoiseTime,
  }
  return refreshDetections(state, map, doors)
}
