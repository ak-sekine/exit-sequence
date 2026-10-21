import test from 'node:test'
import assert from 'node:assert/strict'
import { canCross, canOccupy, cellAt, DOORS, DUNGEON_MAP, INITIAL_PLAYER, isFloor, locationKind, moveWithCollision, sameCell } from '../src/dungeon.ts'
import { reachableCells, shortestPath } from '../src/pathfinding.ts'

test('sample map retains its 16×16 floor plan and centered start location', () => {
  assert.equal(DUNGEON_MAP.length, 16)
  assert.ok(DUNGEON_MAP.every(row => row.length === 16 && /^[ #]+$/.test(row)))
  assert.equal(DUNGEON_MAP.flatMap(row => [...row]).filter(cell => cell === '#').length, 112)
  assert.deepEqual(INITIAL_PLAYER, { x: 2.5, y: 14.5, heading: 0 })
  assert.ok(isFloor(DUNGEON_MAP, ...Object.values(cellAt(INITIAL_PLAYER)) as [number, number]))
  assert.equal(isFloor(DUNGEON_MAP, -1, 0), false)
  assert.equal(isFloor(DUNGEON_MAP, 2, 16), false)
})

test('closed boundaries segment the original map and opening its doors restores exploration', () => {
  assert.equal(DOORS.length, 6)
  for (const door of DOORS) {
    assert.equal(Math.abs(door.from.x - door.to.x) + Math.abs(door.from.y - door.to.y), 1)
    assert.ok(isFloor(DUNGEON_MAP, door.from.x, door.from.y))
    assert.ok(isFloor(DUNGEON_MAP, door.to.x, door.to.y))
    assert.equal(canCross(DUNGEON_MAP, DOORS, [], door.from, door.to), false)
    assert.equal(canCross(DUNGEON_MAP, DOORS, Array(6).fill(true), door.from, door.to), true)
  }
  const start = cellAt(INITIAL_PLAYER)
  assert.ok(reachableCells(DUNGEON_MAP, start, DOORS).length < 111)
  assert.equal(reachableCells(DUNGEON_MAP, start, DOORS, Array(6).fill(true)).length, 111)
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (isFloor(DUNGEON_MAP, x, y)) {
    assert.ok(shortestPath(DUNGEON_MAP, start, { x, y }, DOORS, Array(6).fill(true)), `unreachable ${x},${y}`)
  }
})

test('continuous circular collision blocks walls and closed doors while sliding along a wall', () => {
  const map = ['     ', ' #   ', ' ##  ', '     ']
  const start = { x: 1.5, y: 1.5 }
  assert.equal(canOccupy(map, 2.05, 1.5, 0.2, [], []), false)
  const slid = moveWithCollision(map, start, 0.5, 0.42, 0.2, [], [])
  assert.ok(slid.x >= 1.78 && slid.x < 1.81)
  assert.ok(Math.abs(slid.y - 1.92) < 1e-10)

  const corridor = ['###']
  const door = [{ from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }]
  assert.equal(canOccupy(corridor, 1, 0.5, 0.2, door, []), false)
  assert.equal(canOccupy(corridor, 1, 0.5, 0.2, door, [true]), true)
  assert.ok(moveWithCollision(corridor, { x: 0.5, y: 0.5 }, 0.5, 0, 0.2, door, []).x < 0.81)
  assert.ok(moveWithCollision(corridor, { x: 0.5, y: 0.5 }, 0.5, 0, 0.2, door, [true]).x > 0.95)
})

test('room metadata applies only to authored room cells', () => {
  assert.equal(locationKind(DUNGEON_MAP, { x: 2.5, y: 10.5 }), 'room')
  assert.equal(locationKind(DUNGEON_MAP, { x: 2.5, y: 14.5 }), 'corridor')
  assert.equal(locationKind(DUNGEON_MAP, { x: 0.5, y: 0.5 }), null)
  assert.equal(locationKind(['###'], { x: 1.5, y: 0.5 }), 'corridor')
  assert.ok(sameCell(cellAt({ x: 4.1, y: 7.8 }), { x: 4, y: 7 }))
})
