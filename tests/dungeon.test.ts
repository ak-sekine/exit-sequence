import test from 'node:test'
import assert from 'node:assert/strict'
import { DUNGEON_MAP as map, DOORS, INITIAL_PLAYER, move, isFloor, passDoor, doorBetween } from '../src/dungeon.ts'
import { renderDungeon } from '../src/renderer.ts'
test('T junction route, blocking and rotation', () => {
  let player = INITIAL_PLAYER
  assert.deepEqual(player, { x: 2, y: 4, facing: 0 })
  assert.equal(map.length, 5); assert.ok(map.every(row => row.length === 5))
  for (let i = 0; i < 3; i++) player = move(map, player, 'up').player
  assert.deepEqual(player, { x: 2, y: 1, facing: 0 })
  assert.equal(move(map, player, 'up').message, 'blocked')
  assert.deepEqual(move(map, player, 'up').player, player)
  assert.ok(renderDungeon(map, player).includes('data-door="true"'))
  player = move(map, player, 'left').player
  for (let i = 0; i < 2; i++) player = move(map, player, 'up').player
  assert.deepEqual(player, { x: 0, y: 1, facing: 3 })
  assert.equal(move(map, player, 'up').message, 'blocked')
  player = move(map, player, 'down').player
  assert.deepEqual(player, { x: 0, y: 1, facing: 1 })
  const before = player
  for (let i = 0; i < 4; i++) player = move(map, player, 'right').player
  assert.deepEqual(player, before)
  assert.equal(passDoor(map, player), null)
})
test('closed boundary traverses in both directions with unchanged facing', () => {
  const junction = { x: 2, y: 1, facing: 0 } as const
  const entering = passDoor(map, junction)!
  assert.deepEqual(entering, { player: { x: 2, y: 0, facing: 0 }, message: 'enteredRoom' })
  for (const facing of [0, 1, 3] as const) assert.equal(move(map, { ...entering.player, facing }, 'up').message, 'blocked')
  const south = move(map, entering.player, 'down').player
  assert.ok(renderDungeon(map, south).includes('data-door="true"'))
  assert.equal(move(map, south, 'up').message, 'blocked')
  assert.deepEqual(passDoor(map, south), { player: { x: 2, y: 1, facing: 2 }, message: 'returnedCorridor' })
  assert.deepEqual(Object.keys(DOORS[0]!).sort(), ['from', 'to'])
  assert.equal(doorBetween(DOORS, { x: 2, y: 0 }, junction), DOORS[0])
})
test('custom maps and door boundaries use common movement and rendering', () => {
  assert.equal(isFloor(map, 0, 0), false)
  assert.equal(isFloor(map, -1, 0), false)
  assert.equal(isFloor(map, 2, 5), false)
  const custom = ['##'], player = { x: 0, y: 0, facing: 1 } as const
  const doors = [{ from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }]
  assert.equal(move(custom, player, 'up').player.x, 1)
  assert.equal(move(custom, player, 'up', doors).message, 'blocked')
  assert.equal(passDoor(custom, player, doors)!.player.x, 1)
  assert.ok(renderDungeon(custom, player, doors).includes('data-door="true"'))
  for (const facing of [0, 1, 2, 3] as const) {
    const svg = renderDungeon(['#'], { ...player, facing })
    assert.ok(svg.includes('<polygon fill="var(--dungeon-background, #030806)"'))
    assert.ok(!/NaN|Infinity/.test(svg))
  }
})
