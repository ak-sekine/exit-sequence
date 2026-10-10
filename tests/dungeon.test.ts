import test from 'node:test'
import assert from 'node:assert/strict'
import { DUNGEON_MAP as map, DOORS, INITIAL_PLAYER, move, isFloor, passDoor, doorBetween, VECTORS } from '../src/dungeon.ts'
import { renderDungeon } from '../src/renderer.ts'
import type { Facing } from '../src/dungeon.ts'
import { explore } from './exploration.ts'

test('16×16 map has a blocked perimeter and valid initial floor', () => {
  assert.equal(map.length, 16)
  assert.ok(map.every(row => row.length === 16 && /^[ #]+$/.test(row)))
  assert.ok(map[0]!.trim() === '' && map[15]!.trim() === '')
  assert.ok(map.every(row => row[0] === ' ' && row[15] === ' '))
  assert.deepEqual(INITIAL_PLAYER, { x: 2, y: 14, facing: 0 })
  assert.ok(isFloor(map, INITIAL_PLAYER.x, INITIAL_PLAYER.y))
})
test('all floors are reachable using move and passDoor input transitions', () => {
  const { routes, states } = explore()
  const floors = map.flatMap((row, y) => [...row].flatMap((cell, x) => cell === '#' ? [`${x},${y}`] : []))
  const unreachable = floors.filter(key => !routes.has(key))
  assert.deepEqual(unreachable, [], `Unreachable floor coordinates: ${unreachable.join('; ')}`)
  assert.equal(states.size, floors.length * 4)
  assert.ok(explore(map, INITIAL_PLAYER, undefined, false).routes.size < floors.length, 'A must be required to reach some floors')
  // Regression: adjacent floors behind a door are unreachable without A.
  assert.equal(explore(['##'], { x: 0, y: 0, facing: 1 }, [{ from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }], false).routes.size, 1)
  console.log(`Reachability: ${routes.size}/${floors.length} floors, ${states.size} position/facing states`)
})
test('every unique door joins floors and passes both ways only with A', () => {
  assert.ok(DOORS.length >= 4 && DOORS.length <= 6)
  const boundaries = new Set<string>()
  for (const door of DOORS) {
    assert.equal(Math.abs(door.from.x - door.to.x) + Math.abs(door.from.y - door.to.y), 1)
    const key = [JSON.stringify(door.from), JSON.stringify(door.to)].sort().join(':')
    assert.ok(!boundaries.has(key), `Duplicate door: ${key}`); boundaries.add(key)
    for (const [from, to, message] of [[door.from, door.to, 'enteredRoom'], [door.to, door.from, 'returnedCorridor']] as const) {
      assert.ok(isFloor(map, from.x, from.y)); assert.ok(isFloor(map, to.x, to.y))
      const facing = VECTORS.findIndex(v => v.x === to.x - from.x && v.y === to.y - from.y) as Facing
      const player = { ...from, facing }
      assert.equal(doorBetween(DOORS, from, to), door)
      assert.equal(move(map, player, 'up').message, 'blocked')
      assert.deepEqual(move(map, player, 'up').player, player)
      assert.deepEqual(passDoor(map, player), { player: { ...to, facing }, message })
      assert.ok(renderDungeon(map, player).includes('data-door="true"'))
    }
  }
})
test('sample route, walls and rotations keep existing semantics', () => {
  let player = INITIAL_PLAYER
  for (let i = 0; i < 3; i++) player = move(map, player, 'up').player
  assert.deepEqual(player, { x: 2, y: 11, facing: 0 })
  assert.equal(move(map, player, 'up').message, 'blocked')
  player = move(map, player, 'left').player
  player = move(map, player, 'up').player
  assert.deepEqual(player, { x: 1, y: 11, facing: 3 })
  assert.equal(move(map, player, 'up').message, 'blocked')
  assert.equal(passDoor(map, player), null)
  const before = player
  for (let i = 0; i < 4; i++) player = move(map, player, 'right').player
  assert.deepEqual(player, before)
})
test('3D rendering stays finite at every floor and facing', () => {
  for (const key of explore().routes.keys()) {
    const [x, y] = key.split(',').map(Number)
    for (const facing of [0, 1, 2, 3] as const) {
      const svg = renderDungeon(map, { x: x!, y: y!, facing })
      assert.ok(svg.includes('data-wall='), key)
      assert.ok(!/NaN|Infinity/.test(svg), `${key},${facing}`)
    }
  }
})
test('custom maps and door boundaries use common movement and rendering', () => {
  assert.equal(isFloor(map, 0, 0), false)
  assert.equal(isFloor(map, -1, 0), false)
  assert.equal(isFloor(map, 2, 16), false)
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
