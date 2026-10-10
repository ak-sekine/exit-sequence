import test from 'node:test'
import assert from 'node:assert/strict'
import { renderMap, initialVisited } from '../src/automap.ts'
import { DUNGEON_MAP, INITIAL_PLAYER } from '../src/dungeon.ts'
import { character } from '../src/character.ts'
import { createGame, advanceTurn } from '../src/game.ts'
import type { EnemyDetection } from '../src/senses.ts'
const map = Array(20).fill('#'.repeat(20))
const player = character({ x: 5, y: 5, facing: 0 })
const sight = (facing: 0 | 1 | 2 | 3 = 0): EnemyDetection => ({ enemyId: 'e', kind: 'sight', position: { x: 6, y: 4 }, facing, distance: 1 })
const hearing: EnemyDetection = { enemyId: 'h', kind: 'hearing', position: { x: 4, y: 6 }, direction: 'backLeft', distance: 1 }
const draw = (detections: readonly EnemyDetection[] = [], center = { x: 5, y: 5 }) => renderMap(map, player, initialVisited(player), [], center, detections)
const markers = (svg: string) => [...svg.matchAll(/<(?:path|circle) data-map-enemy="[^"]+"[^>]*>/g)].map(m => m[0])
test('sight arrows use enemy absolute compass direction and detected coordinates', () => {
  for (const facing of [0, 1, 2, 3] as const) {
    const marker = markers(draw([sight(facing)]))[0]!
    assert.match(marker, new RegExp(`translate\\(184 76\\) rotate\\(${facing * 90}\\)`))
    assert.match(marker, /fill="#fb7185"/)
    assert.match(marker, /d="M0,-8 L6,6 L0,3 L-6,6 Z"/)
  }
})
test('hearing is an unadorned circle with no facing; unseen enemies absent', () => {
  assert.equal(markers(draw()).length, 0)
  const marker = markers(draw([hearing]))[0]!
  assert.match(marker, /^<circle/); assert.match(marker, /cx="136" cy="124" r="7"/)
  assert.match(marker, /fill="none" stroke="#fb7185" stroke-width="2"/)
  assert.doesNotMatch(marker, /facing|rotate|transform| d=/)
  assert.equal(markers(draw([sight(), hearing])).length, 2)
})
test('markers do not reveal unvisited terrain or change player, walls or doors', () => {
  const before = draw(), after = draw([sight(), hearing])
  assert.equal(after.replace(/<(?:path|circle) data-map-enemy="[^"]+"[^>]*>/g, ''), before)
  assert.equal((after.match(/data-map-cell=/g) ?? []).length, 1)
  assert.ok(after.indexOf('data-map-enemy') < after.indexOf('data-map-arrow'))
  const overlap = draw([{ ...hearing, position: player }])
  assert.ok(overlap.indexOf('data-map-enemy') < overlap.indexOf('data-map-arrow'))
})
test('viewport hides distant detections and scroll transforms the retained snapshot', () => {
  const distant = { ...sight(), position: { x: 18, y: 18 } }
  assert.equal(markers(draw([distant])).length, 0)
  assert.match(markers(draw([distant], { x: 18, y: 18 }))[0]!, /translate\(160 100\)/)
  assert.match(markers(draw([sight()], { x: 6, y: 4 }))[0]!, /translate\(160 100\)/)
})
const corridor = ['##########']
const enemy = { ...character({ x: 3, y: 0, facing: 3 }), id: 'e', destination: null }
test('current turn snapshots prioritize sight, then hearing, then discard lost detection', () => {
  const initial = { ...createGame(), player: character({ x: 0, y: 0, facing: 0 }), enemies: [enemy] }
  assert.deepEqual(initial.detections, [])
  const seen = advanceTurn(initial, 'right', () => 0, corridor, [])
  assert.equal(seen.detections.length, 1)
  assert.deepEqual(seen.detections[0], { enemyId: 'e', kind: 'sight', position: { x: 2, y: 0 }, facing: 3, distance: 2 })
  const heard = advanceTurn(seen, 'down', () => 0, corridor, [])
  assert.equal(heard.detections[0]!.kind, 'hearing')
  assert.equal('facing' in heard.detections[0]!, false)
  assert.deepEqual(heard.detections[0]!.position, { x: 1, y: 0 })
  // Stop hearing and keep the enemy behind the player: old logs must not leak it.
  const lost = advanceTurn({ ...heard, enemies: [{ ...enemy, x: 5, facing: 1, destination: null }] }, 'left', () => .25, corridor, [])
  assert.deepEqual(lost.detections, [])
  assert.ok(lost.logs.some(log => typeof log !== 'string'))
  assert.deepEqual(seen.detections[0]!.position, { x: 2, y: 0 })
})
test('multiple IDs, invalid action and game over preserve snapshots correctly', () => {
  const initial = { ...createGame(), player: character({ x: 0, y: 0, facing: 0 }), enemies: [enemy, { ...enemy, id: 'second', x: 4 }] }
  const next = advanceTurn(initial, 'right', () => 0, corridor, [])
  assert.deepEqual(next.detections.map(d => d.enemyId), ['e', 'second'])
  assert.equal(advanceTurn(next, 'a', () => 0, corridor, []), next)
  const caught = advanceTurn({ ...next, enemies: [{ ...enemy, x: 1 }] }, 'up', () => 0, corridor, [])
  assert.ok(caught.gameOver)
  for (const action of ['up', 'left', 'right', 'down', 'a'] as const) assert.equal(advanceTurn(caught, action), caught)
})

test('sample wall and door geometry stays identical with enemy markers', () => {
  const visited = new Set(['2,11', '1,11', '2,10'])
  const baseline = renderMap(DUNGEON_MAP, INITIAL_PLAYER, visited)
  const marked = renderMap(DUNGEON_MAP, INITIAL_PLAYER, visited, undefined, undefined, [hearing])
  assert.match(baseline, /data-map-wall=/); assert.match(baseline, /data-map-door=/)
  assert.equal(marked.replace(/<(?:path|circle) data-map-enemy="[^"]+"[^>]*>/g, ''), baseline)
})
