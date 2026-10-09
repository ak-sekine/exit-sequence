import { levels } from './levels.ts'
import { vectors } from './model.ts'
import type { Direction, Entity, EntityKind, GameState, Level, Position } from './model.ts'

export function createState(stageIndex = 0, level: Level = levels[stageIndex]!): GameState {
  if (!level) throw new Error('Unknown stage')
  return { ...structuredClone(level), stageIndex, turns: 0, status: 'playing', message: 'ready', clearBy: null }
}
export function terrainAt(state: Level, position: Position) {
  return state.terrain[position.y]?.[position.x]
}
export interface PushResult { state: GameState; moved: string[]; fallen: EntityKind[] }

// One transaction for every entity kind. Validate the entire chain before changing it.
// Returns null on obstruction; the input state is never modified.
export function push(state: GameState, entityId: string, direction: Direction): PushResult | null {
  const actor = state.entities.find(e => e.id === entityId)
  if (!actor) return null
  const delta = vectors[direction]
  const chain: Entity[] = [actor]
  let current = actor
  while (true) {
    const destination = { x: current.x + delta.x, y: current.y + delta.y }
    const terrain = terrainAt(state, destination)
    if (!terrain || terrain === 'wall') return null
    const next = state.entities.find(e => e.x === destination.x && e.y === destination.y)
    if (!next) break
    chain.push(next)
    current = next
  }
  const moved = chain.map(e => e.id)
  const fallen: EntityKind[] = []
  const entities = state.entities.flatMap(entity => {
    if (!moved.includes(entity.id)) return [{ ...entity }]
    const next = { ...entity, x: entity.x + delta.x, y: entity.y + delta.y }
    if (terrainAt(state, next) === 'hole') { fallen.push(entity.kind); return [] }
    return [next]
  })
  return { state: { ...state, entities }, moved, fallen }
}

function resolve(state: GameState, source: 'player' | 'robot'): GameState {
  const player = state.entities.find(e => e.kind === 'player')
  if (!player) return { ...state, status: 'fail', message: 'fail' }
  if (terrainAt(state, player) === 'goal') {
    const status = state.stageIndex === levels.length - 1 ? 'all-clear' : 'clear'
    return { ...state, status, message: status, clearBy: source }
  }
  return state
}
function applyMessage(result: PushResult): GameState {
  const message = result.fallen.includes('robot') ? 'robot-fell' : result.fallen.includes('box') ? 'box-fell' : result.moved.length > 1 ? 'pushed' : 'moved'
  return { ...result.state, message }
}
export function robotTurn(state: GameState): PushResult | null {
  const robot = state.entities.find(e => e.kind === 'robot')
  const player = state.entities.find(e => e.kind === 'player')
  if (!robot || !player) return null
  const candidates: Direction[] = []
  if (robot.x !== player.x) candidates.push(robot.x < player.x ? 'right' : 'left')
  if (robot.y !== player.y) candidates.push(robot.y < player.y ? 'down' : 'up')
  for (const direction of candidates) {
    const result = push(state, robot.id, direction)
    if (result) return result
  }
  return null
}

// Successful input = player phase, terminal check, one robot phase, terminal check.
// Falling ends a phase immediately, so a missing player never receives a robot turn.
export function step(state: GameState, direction: Direction): GameState {
  if (state.status !== 'playing') return state
  const player = state.entities.find(e => e.kind === 'player')
  const result = player && push(state, player.id, direction)
  if (!result) return state
  let next = resolve({ ...applyMessage(result), turns: state.turns + 1 }, 'player')
  if (next.status !== 'playing') return next
  const robot = robotTurn(next)
  if (robot) {
    // Preserve the player phase's useful feedback when the robot only walks.
    const robotState = robot.moved.length > 1 || robot.fallen.length ? applyMessage(robot) : robot.state
    next = resolve(robotState, 'robot')
  }
  return next
}

export class Game {
  state: GameState
  private history: GameState[] = []
  constructor() { this.state = createState() }
  get undoCount() { return this.history.length }
  move(direction: Direction): boolean {
    const next = step(this.state, direction)
    if (next === this.state) return false
    this.history.push(structuredClone(this.state))
    this.state = next
    return true
  }
  undo(): boolean {
    const previous = this.history.pop()
    if (!previous) return false
    this.state = previous
    return true
  }
  restart() { this.state = createState(this.state.stageIndex); this.history = [] }
  nextStage(): boolean {
    if (this.state.status !== 'clear' || this.state.stageIndex >= levels.length - 1) return false
    this.state = createState(this.state.stageIndex + 1); this.history = []
    return true
  }
  playAgain() { this.state = createState(); this.history = [] }
}
