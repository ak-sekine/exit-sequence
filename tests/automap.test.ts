import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cellKey, initialVisited, recordMovement, renderMap } from '../src/automap.ts'
import { DUNGEON_MAP, INITIAL_PLAYER, move, passDoor } from '../src/dungeon.ts'

test('history records successful movement and door passage once, never turns or failures', () => {
  let player = INITIAL_PLAYER
  const visited = initialVisited(player)
  assert.deepEqual([...visited], ['2,4'])
  const step = (direction: 'up' | 'left' | 'down' | 'right') => {
    const result = move(DUNGEON_MAP, player, direction)
    recordMovement(visited, player, result.player); player = result.player
  }
  step('left'); step('up'); step('right')
  assert.equal(visited.size, 1)
  step('up'); step('up'); step('up'); step('up')
  assert.equal(visited.size, 4)
  const result = passDoor(DUNGEON_MAP, player)!
  recordMovement(visited, player, result.player); player = result.player
  assert.equal(visited.size, 5); assert.ok(visited.has(cellKey(player)))
  step('down')
  const back = passDoor(DUNGEON_MAP, player)!
  recordMovement(visited, player, back.player)
  assert.equal(visited.size, 5)
})

test('map draws only visited floors, square cells and a north-fixed direction arrow', () => {
  const visited = initialVisited(INITIAL_PLAYER)
  const svg = renderMap(DUNGEON_MAP, INITIAL_PLAYER, visited)
  assert.equal((svg.match(/data-map-cell=/g) ?? []).length, 1)
  assert.ok(svg.includes('data-map-cell="2,4" data-current="true"'))
  assert.ok(svg.includes('width="32" height="32"')); assert.ok(svg.includes('↑'))
  assert.ok(!svg.includes('data-door')); assert.ok(!svg.includes('data-wall'))
  const explored = new Set(['2,4', '2,3', '3,1', '0,0'])
  const north = renderMap(DUNGEON_MAP, INITIAL_PLAYER, explored)
  assert.ok(north.includes('x="128" y="100"'))
  assert.ok(!north.includes('data-map-cell="0,0"'))
  for (const [facing, arrow] of ['↑', '→', '↓', '←'].entries()) {
    const output = renderMap(DUNGEON_MAP, { ...INITIAL_PLAYER, facing: facing as 0 | 1 | 2 | 3 }, explored)
    assert.ok(output.includes(`>${arrow}</text>`))
    assert.equal(output.replace(`>${arrow}</text>`, '>↑</text>'), north)
  }
})
