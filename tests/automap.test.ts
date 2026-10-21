import test from 'node:test'
import assert from 'node:assert/strict'
import { initialVisited, recordMovement, renderMap } from '../src/automap.ts'
import { DUNGEON_MAP, DOORS, INITIAL_PLAYER } from '../src/dungeon.ts'

test('automap reveals only visited floor cells and tracks continuous player cell changes', () => {
  const visited = initialVisited(INITIAL_PLAYER)
  assert.deepEqual([...visited], ['2,14'])
  const sameCell = recordMovement(visited, INITIAL_PLAYER, { x: 2.9, y: 14.1, heading: 1.3 })
  assert.equal(sameCell, visited)
  const next = recordMovement(visited, INITIAL_PLAYER, { x: 2.5, y: 13.5, heading: 1.3 })
  assert.equal(next.has('2,13'), true)
  assert.equal(visited.has('2,13'), false)

  const svg = renderMap(DUNGEON_MAP, { x: 2.5, y: 13.5, heading: 0.55 }, next, DOORS, [])
  assert.match(svg, /data-map-cell="2,14"/)
  assert.match(svg, /data-map-cell="2,13" data-current="true"/)
  assert.doesNotMatch(svg, /data-map-cell="2,12"/)
  assert.match(svg, /data-map-player="true"[^>]*rotate\(31\.512/)
})

test('map door marks include their current state without publishing unopened rooms', () => {
  const approach = new Set(['2,11'])
  const closed = renderMap(DUNGEON_MAP, INITIAL_PLAYER, approach, DOORS, Array(6).fill(false))
  const open = renderMap(DUNGEON_MAP, INITIAL_PLAYER, approach, DOORS, [true, false, false, false, false, false])
  assert.match(closed, /data-map-door="0" data-open="false"/)
  assert.match(open, /data-map-door="0" data-open="true"/)
  assert.doesNotMatch(closed, /data-map-cell="2,10"/)
  assert.doesNotMatch(closed, /data-map-cell="1,10"/)
})

test('detected enemies are the only enemy markers; unseen map geometry stays hidden', () => {
  const visited = new Set(['2,14'])
  const detection = { enemyId: 'enemy-1', kind: 'sight', position: { x: 12.5, y: 10.5 }, heading: 1.2, distance: 5 } as const
  const svg = renderMap(DUNGEON_MAP, INITIAL_PLAYER, visited, DOORS, Array(6).fill(false), [detection])
  assert.match(svg, /data-map-enemy="enemy-1" data-detection="sight"/)
  assert.match(svg, /data-map-enemy="enemy-1"[^>]*rotate\(68\.75493541569878\)/)
  assert.doesNotMatch(svg, /data-map-cell="12,10"/)
  assert.doesNotMatch(svg, /data-map-cell="11,10"/)
  assert.equal((svg.match(/data-map-enemy=/g) ?? []).length, 1)
})
