import test from 'node:test'
import assert from 'node:assert/strict'
import { DUNGEON_MAP as map, INITIAL_PLAYER, move, isFloor } from '../src/dungeon.ts'
import { renderDungeon } from '../src/renderer.ts'
test('T junction route, blocking and rotation', () => {
  let player = INITIAL_PLAYER
  assert.deepEqual(player, { x: 2, y: 3, facing: 0 })
  const initial = renderDungeon(map, player)
  for (let i = 0; i < 3; i++) player = move(map, player, 'up').player
  assert.deepEqual(player, { x: 2, y: 0, facing: 0 })
  assert.equal(move(map, player, 'up').message, 'blocked')
  assert.deepEqual(move(map, player, 'up').player, player)
  const junction = renderDungeon(map, player)
  assert.notEqual(junction, initial)
  for (const side of ['left', 'right']) assert.ok(junction.includes(`data-opening="${side}" data-depth="0"`))
  assert.ok(junction.includes('data-wall="front" data-depth="0"'))
  player = move(map, player, 'left').player
  assert.deepEqual(player, { x: 2, y: 0, facing: 3 })
  for (let i = 0; i < 2; i++) player = move(map, player, 'up').player
  assert.deepEqual(player, { x: 0, y: 0, facing: 3 })
  assert.equal(move(map, player, 'up').message, 'blocked')
  player = move(map, player, 'down').player
  assert.deepEqual(player, { x: 0, y: 0, facing: 1 })
  const before = player
  for (let i = 0; i < 4; i++) player = move(map, player, 'right').player
  assert.deepEqual(player, before)
})
test('same floor data supports other maps and blocks spaces and bounds', () => {
  assert.equal(isFloor(map, 0, 1), false)
  assert.equal(isFloor(map, -1, 0), false)
  assert.equal(isFloor(map, 2, 4), false)
  assert.equal(move(['##'], { x: 0, y: 0, facing: 1 }, 'up').player.x, 1)
  const deadEnd = renderDungeon(['#'], { x: 0, y: 0, facing: 0 })
  assert.ok(!deadEnd.includes('data-opening'))
  assert.ok(deadEnd.includes('data-wall="front"'))
})
