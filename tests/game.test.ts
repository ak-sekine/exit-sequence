import test from 'node:test'
import assert from 'node:assert/strict'
import { character } from '../src/character.ts'
import { doorAnimationProgress } from '../src/animation.ts'
import { ENEMY_RADIUS, INITIAL_ENEMY } from '../src/enemy.ts'
import { DOORS, INITIAL_PLAYER, PLAYER_SPEED, wrapAngle } from '../src/dungeon.ts'
import { createGame, interact, rotatePlayer, stepGame } from '../src/game.ts'
import type { GameState } from '../src/game.ts'
import { shortestPath } from '../src/pathfinding.ts'

const e = (x: number, y: number, extras: Partial<GameState['enemies'][number]> = {}) => ({
  ...character({ x, y, heading: Math.PI * 1.5 }, 0, 0),
  id: 'fixture', destination: null, route: [], alerted: false, ...extras,
})

test('real-time free movement is frame-rate independent and keeps diagonal speed capped', () => {
  const map = Array(7).fill('#######') as string[]
  const initial = createGame({ player: { x: 3.5, y: 3.5, heading: 0 }, enemies: [], doors: [] })
  let at60 = initial, at30 = initial
  for (let i = 0; i < 60; i++) at60 = stepGame(at60, { forward: 1, strafe: 0 }, 1 / 60, map, [], () => 0.5)
  for (let i = 0; i < 30; i++) at30 = stepGame(at30, { forward: 1, strafe: 0 }, 1 / 30, map, [], () => 0.5)
  assert.ok(Math.abs(at60.player.y - at30.player.y) < 0.015)
  assert.ok(Math.abs((3.5 - at60.player.y) - PLAYER_SPEED) < 0.035)

  const diagonal = createGame({ player: { x: 3.5, y: 3.5, heading: 0 }, enemies: [], doors: [] })
  const straight = createGame({ player: { x: 3.5, y: 3.5, heading: 0 }, enemies: [], doors: [] })
  let diagonalNext = diagonal, straightNext = straight
  for (let i = 0; i < 20; i++) {
    diagonalNext = stepGame(diagonalNext, { forward: 1, strafe: 1 }, 0.05, map, [])
    straightNext = stepGame(straightNext, { forward: 1, strafe: 0 }, 0.05, map, [])
  }
  assert.ok(Math.abs(Math.hypot(diagonalNext.player.x - 3.5, diagonalNext.player.y - 3.5) - Math.hypot(straightNext.player.x - 3.5, straightNext.player.y - 3.5)) < 0.03)
})

test('heading rotates continuously through 360 degrees and wraps without inertia', () => {
  let state = createGame({ enemies: [] })
  for (let i = 0; i < 720; i++) state = rotatePlayer(state, Math.PI / 360)
  assert.ok(Math.abs(state.player.heading) < 1e-8 || Math.abs(state.player.heading - Math.PI * 2) < 1e-8)
  const previous = state.player.heading
  state = rotatePlayer(state, -0.8)
  assert.ok(Math.abs(state.player.heading - wrapAngle(previous - 0.8)) < 1e-10)
  assert.equal(rotatePlayer(state, 0), state)
})

test('enemies move while the player is idle and real-time contact ends the game', () => {
  const map = ['########']
  const patrol = {
    ...e(5.5, 0.5, { vision: 0, hearing: 0, destination: { x: 1, y: 0 } }),
    route: [{ x: 4.5, y: 0.5 }],
  }
  let state = createGame({ player: { x: 1.5, y: 0.5, heading: 0 }, enemies: [patrol], doors: [] })
  const initialX = state.enemies[0]!.x
  for (let i = 0; i < 20; i++) state = stepGame(state, { forward: 0, strafe: 0 }, 0.05, map, [], () => 0.5)
  assert.ok(state.enemies[0]!.x < initialX)
  assert.equal(state.gameOver, false)

  const touching = createGame({
    player: { x: 1.5, y: 0.5, heading: 0 },
    enemies: [e(1.5 + ENEMY_RADIUS, 0.5)], doors: [],
  })
  const caught = stepGame(touching, { forward: 0, strafe: 0 }, 1 / 60, map, [])
  assert.equal(caught.gameOver, true)
  assert.equal(caught.events.at(-1)?.key, 'gameOver')
  assert.equal(stepGame(caught, { forward: 1, strafe: 0 }, 0.05, map, []), caught)
})

test('enemy vision starts a chase and movement noise gives a last-known destination', () => {
  const map = ['##########']
  const player = { x: 1.5, y: 0.5, heading: Math.PI / 2 }
  const facing = e(5.5, 0.5, { heading: Math.PI * 1.5, vision: 8, hearing: 6 })
  let state = createGame({ player, enemies: [facing], doors: [] })
  for (let i = 0; i < 7; i++) state = stepGame(state, { forward: 0, strafe: 0 }, 0.05, map, [], () => 0.5)
  assert.equal(state.enemies[0]!.alerted, true)
  assert.deepEqual(state.enemies[0]!.destination, { x: 1, y: 0 })
  assert.ok(state.events.some(event => event.key === 'enemySpotted'))

  const listener = e(1.5, 0.5, { hearing: 8, vision: 0 })
  let heard = createGame({ player: { x: 4.5, y: 0.5, heading: Math.PI / 2 }, enemies: [listener], doors: [] })
  let heardSound = false
  for (let i = 0; i < 20; i++) {
    heard = stepGame(heard, { forward: 1, strafe: 0 }, 0.05, map, [], () => 0.5)
    heardSound ||= heard.detections.some(item => item.kind === 'hearing')
  }
  assert.equal(heard.enemies[0]!.alerted, true)
  assert.equal(heardSound, true)
})

test('A toggles an in-range forward door and state controls movement collision', () => {
  const map = ['###']
  const doors = [{ from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }]
  const start = createGame({ player: { x: 0.5, y: 0.5, heading: Math.PI / 2 }, enemies: [], doors })
  const open = interact(start, map, doors)
  assert.deepEqual(open.openDoors, [true])
  assert.deepEqual(open.doorMotions[0], { fromOpen: false, startedAt: 0 })
  assert.equal(doorAnimationProgress(open.openDoors[0]!, open.doorMotions[0], open.time), 0)
  assert.equal(open.events.at(-1)?.key, 'doorOpened')
  const closed = interact(open, map, doors)
  assert.deepEqual(closed.openDoors, [false])
  assert.deepEqual(closed.doorMotions[0], { fromOpen: true, startedAt: 0 })
  assert.equal(closed.events.at(-1)?.key, 'doorClosed')
  assert.equal(interact(start, map, doors).player.x, 0.5)

  let blocked = start
  for (let i = 0; i < 25; i++) blocked = stepGame(blocked, { forward: 1, strafe: 0 }, 0.05, map, doors)
  assert.ok(blocked.player.x < 0.81)
  let through = open
  for (let i = 0; i < 25; i++) through = stepGame(through, { forward: 1, strafe: 0 }, 0.05, map, doors)
  assert.ok(through.player.x > 1.5)
  assert.equal(shortestPath(map, { x: 0, y: 0 }, { x: 1, y: 0 }, doors, [false]), null)
  assert.deepEqual(shortestPath(map, { x: 0, y: 0 }, { x: 1, y: 0 }, doors, [true]), [{ x: 1, y: 0 }])
})

test('closed doors stop sight and contact checks do not alter the start layout', () => {
  assert.equal(INITIAL_ENEMY.x, 7.5)
  assert.equal(INITIAL_PLAYER.x, 2.5)
  const state = createGame()
  assert.equal(state.openDoors.filter(Boolean).length, 0)
  assert.equal(state.visited.has('2,14'), true)
  assert.equal(state.events[0]?.key, 'ready')
  assert.equal(DOORS.length, 6)
})
