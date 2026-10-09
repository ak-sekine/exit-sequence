import test from 'node:test'
import assert from 'node:assert/strict'
import { createState, Game, push, robotTurn, step, terrainAt } from '../src/game.ts'
import { defineLevel, levels } from '../src/levels.ts'
import type { Direction, EntityKind, GameState } from '../src/model.ts'

function fixture(rows: string[]) { return createState(0, defineLevel(rows)) }
function entity(state: GameState, kind: EntityKind) { return state.entities.find(e => e.kind === kind)! }
function moved(rows: string[], kind: EntityKind = 'player', direction: Direction = 'right') {
  const state = fixture(rows), before = structuredClone(state)
  const result = push(state, entity(state, kind).id, direction)
  assert.deepEqual(state, before, 'push never mutates its input')
  return result
}
const corridor = (middle: string) => ['########', middle, '#.....G#', '########']

test('PLAYER moves exactly one square on floor', () => {
  const state = fixture(corridor('#@.....#'))
  const next = step(state, 'right')
  assert.equal(entity(next, 'player').x, 2)
  assert.equal(next.turns, 1); assert.equal(next.status, 'playing')
})
test('WALL and board edge stop movement without mutation', () => {
  const wall = fixture(corridor('#@#....#'))
  assert.equal(step(wall, 'right'), wall)
  const edge = fixture(['@..G'])
  assert.equal(step(edge, 'left'), edge)
})
for (const [symbol, kind] of [['B', 'box'], ['R', 'robot']] as const) test(`PLAYER pushes ${kind}`, () => {
  const result = moved(corridor(`#@${symbol}....#`))!
  assert.equal(result.moved.length, 2)
  assert.equal(entity(result.state, 'player').x, 2)
  assert.equal(entity(result.state, kind).x, 3)
})
test('PLAYER → BOX → ROBOT uses one push transaction', () => {
  const result = moved(corridor('#@BR...#'))!
  assert.deepEqual(result.state.entities.map(e => [e.kind, e.x]), [['player', 2], ['box', 3], ['robot', 4]])
})
test('ROBOT → BOX → PLAYER can all move in a chain', () => {
  const state = fixture(corridor('#RB@...#'))
  const result = robotTurn(state)!
  assert.deepEqual(result.state.entities.map(e => [e.kind, e.x]), [['robot', 2], ['box', 3], ['player', 4]])
})
test('BOX can use the same push implementation', () => {
  const result = moved(corridor('#B@R...#'), 'box')!
  assert.deepEqual(result.state.entities.map(e => e.x), [2, 3, 4])
})
test('wall behind the chain blocks the entire transaction', () => {
  const state = fixture(corridor('#@BR#..#')), before = structuredClone(state)
  assert.equal(push(state, entity(state, 'player').id, 'right'), null)
  assert.equal(step(state, 'right'), state); assert.deepEqual(state, before)
})
for (const [symbol, kind] of [['B', 'box'], ['R', 'robot']] as const) test(`${kind} disappears in HOLE, hole remains`, () => {
  const result = moved(corridor(`#@${symbol}O...#`))!
  assert.equal(result.state.entities.some(e => e.kind === kind), false)
  assert.deepEqual(result.fallen, [kind])
  assert.equal(terrainAt(result.state, { x: 3, y: 1 }), 'hole')
})
test('PLAYER into HOLE fails immediately and does not activate robot', () => {
  const state = fixture(corridor('#@O.R..#')), next = step(state, 'right')
  assert.equal(next.status, 'fail'); assert.equal(next.turns, 1)
  assert.equal(next.entities.some(e => e.kind === 'player'), false)
  assert.deepEqual(entity(next, 'robot'), entity(state, 'robot'))
  assert.equal(step(next, 'left'), next)
})
test('PLAYER moves to GOAL: CLEAR before robot acts', () => {
  const state = fixture(['#######', '#@G.R.#', '#######'])
  const next = step(state, 'right')
  assert.equal(next.status, 'clear'); assert.equal(next.clearBy, 'player')
  assert.deepEqual(entity(next, 'robot'), entity(state, 'robot'))
})
test('ROBOT pushes PLAYER onto GOAL during a real turn', () => {
  const state = fixture(['#######', '#..@..#', '#RB.G.#', '#######'])
  const next = step(state, 'down')
  assert.equal(next.status, 'clear'); assert.equal(next.clearBy, 'robot')
  assert.deepEqual([entity(next, 'player').x, entity(next, 'player').y], [4, 2])
})
test('ROBOT pushes PLAYER into HOLE: FAIL', () => {
  const state = fixture(['#######', '#..@G.#', '#RB.O.#', '#######'])
  const next = step(state, 'down')
  assert.equal(next.status, 'fail'); assert.equal(next.entities.some(e => e.kind === 'player'), false)
})
for (const [symbol, kind] of [['B', 'box'], ['R', 'robot']] as const) test(`${kind} on GOAL is floor and is not CLEAR`, () => {
  const state = fixture(['#######', `#@${symbol}G..#`, '#######'])
  const result = push(state, entity(state, 'player').id, 'right')!
  assert.equal(terrainAt(result.state, entity(result.state, kind)), 'goal')
  assert.equal(result.state.status, 'playing')
  const next = step(state, 'right')
  assert.equal(next.status, 'playing')
})
test('successful PLAYER input activates ROBOT once; blocked input activates none', () => {
  const state = fixture(['########', '#@#....#', '#.....R#', '#G.....#', '########'])
  assert.equal(step(state, 'right'), state)
  const next = step(state, 'down')
  assert.equal(entity(next, 'robot').x, 5); assert.equal(entity(next, 'robot').y, 2)
  assert.equal(next.turns, 1)
})
test('ROBOT is deterministic: horizontal first, vertical fallback, aligned vertical, both blocked', () => {
  const horizontal = fixture(['########', '#..@...#', '#R.....#', '#G.....#', '########'])
  const before = structuredClone(horizontal)
  const a = robotTurn(horizontal)!, b = robotTurn(horizontal)!
  assert.deepEqual(a, b); assert.deepEqual(horizontal, before)
  assert.deepEqual([entity(a.state, 'robot').x, entity(a.state, 'robot').y], [2, 2])
  const fallback = fixture(['########', '#..@...#', '#R#....#', '#G.....#', '########'])
  assert.deepEqual([entity(robotTurn(fallback)!.state, 'robot').x, entity(robotTurn(fallback)!.state, 'robot').y], [1, 1])
  const aligned = fixture(['#####', '#@..#', '#...#', '#R.G#', '#####'])
  assert.equal(entity(robotTurn(aligned)!.state, 'robot').y, 2)
  const blocked = fixture(['#######', '#..@..#', '###...#', '#R#G..#', '#######'])
  assert.equal(robotTurn(blocked), null)
})
test('ROBOT may itself fall into a hole while approaching', () => {
  const state = fixture(['#######', '#RO.@G#', '#######'])
  const next = robotTurn(state)!
  assert.equal(next.state.entities.some(e => e.kind === 'robot'), false)
  assert.equal(terrainAt(next.state, { x: 2, y: 1 }), 'hole')
})
test('UNDO stores complete pre-turn state including removed objects; repeated UNDO reaches start', () => {
  const game = new Game(); game.state = fixture(['########', '#......#', '#.@BB.O#', '#.....G#', '########']); const initial = structuredClone(game.state)
  const states = [initial]
  for (const direction of ['right', 'right', 'up'] as const) {
    assert.equal(game.move(direction), true); states.push(structuredClone(game.state))
  }
  assert.equal(game.state.entities.filter(e => e.kind === 'box').length, 1)
  for (let i = states.length - 2; i >= 0; i--) { assert.equal(game.undo(), true); assert.deepEqual(game.state, states[i]) }
  assert.equal(game.undoCount, 0); assert.equal(game.undo(), false)
})
test('blocked input adds no undo entry; state snapshots are independent', () => {
  const game = new Game(); game.state = fixture(['########', '#......#', '#.@....#', '#.....G#', '########'])
  game.move('up'); game.move('up')
  const before = structuredClone(game.state)
  assert.equal(game.move('up'), false); assert.deepEqual(game.state, before); assert.equal(game.undoCount, 1)
  game.state.terrain[1]![1] = 'wall'
  game.undo(); assert.equal(game.state.terrain[1]![1], 'floor')
  assert.equal(levels[0]!.terrain[1]![1], 'floor')
})
test('FAIL supports UNDO and RESTART without advancing time', () => {
  const game = new Game(); game.state = fixture(['########', '#.@....#', '#......#', '#......#', '#.O...G#', '########'])
  game.move('down'); game.move('down'); const before = structuredClone(game.state)
  game.move('down'); assert.equal(game.state.status, 'fail')
  game.undo(); assert.deepEqual(game.state, before)
  game.move('down'); game.restart(); assert.deepEqual(game.state, createState()); assert.equal(game.undoCount, 0)
})
test('RESTART resets the current stage, NEXT STAGE requires CLEAR, final ALL CLEAR and PLAY AGAIN', () => {
  const game = new Game(); assert.equal(game.nextStage(), false)
  game.state.status = 'clear'; assert.equal(game.nextStage(), true)
  assert.equal(game.state.stageIndex, 1); game.move('down'); game.restart()
  assert.deepEqual(game.state, createState(1)); assert.equal(game.undoCount, 0)
  game.state.status = 'clear'; game.nextStage()
  assert.equal(game.state.stageIndex, 2)
  game.state = createState(2, defineLevel(['#######', '#..@..#', '#RB.G.#', '#######']))
  const before = structuredClone(game.state); game.move('down')
  assert.equal(game.state.status, 'all-clear'); assert.equal(game.state.clearBy, 'robot')
  assert.equal(game.nextStage(), false); assert.equal(game.move('left'), false)
  game.undo(); assert.deepEqual(game.state, before)
  game.move('down'); game.playAgain(); assert.deepEqual(game.state, createState()); assert.equal(game.undoCount, 0)
})
test('level definitions validate one player/goal, rectangular maps, and at most one robot', () => {
  for (const rows of [['@RG', 'R..'], ['@@G'], ['@..'], ['@G?'], ['@G', '.']]) assert.throws(() => defineLevel(rows))
  assert.equal(levels.length, 3)
  for (const level of levels) { assert.equal(level.terrain.length, 8); assert.equal(level.terrain[0]!.length, 8); assert.ok(level.entities.filter(e => e.kind === 'robot').length <= 1) }
})
