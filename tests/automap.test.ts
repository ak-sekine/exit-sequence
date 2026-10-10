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

const count = (svg: string, kind: string) => (svg.match(new RegExp(`data-map-${kind}=`, 'g')) ?? []).length
const edge = (svg: string, kind: string, key: string) => svg.match(new RegExp(`<path data-map-${kind}="${key}"[^>]*>`))?.[0]
test('24px filled floors, black unknown space, no uniform borders and compact arrows', () => {
  const svg = renderMap(DUNGEON_MAP, INITIAL_PLAYER, initialVisited(INITIAL_PLAYER))
  assert.equal(count(svg, 'cell'), 1)
  assert.ok(svg.includes('width="24" height="24" fill="#245c38"'))
  assert.ok(svg.includes('width="320" height="200" fill="#000"'))
  assert.equal(count(svg, 'wall'), 3); assert.equal(count(svg, 'door'), 0)
  assert.equal(edge(svg, 'wall', '2,3.5'), undefined)
  assert.ok(!/<rect[^>]*stroke=/.test(svg))
  for (const facing of [0, 1, 2, 3] as const) {
    assert.ok(renderMap(DUNGEON_MAP, { ...INITIAL_PLAYER, facing }, initialVisited(INITIAL_PLAYER)).includes(`translate(160 100) rotate(${facing * 90})`))
  }
  const connected = renderMap(['##'], { x: 0, y: 0, facing: 0 }, new Set(['0,0', '1,0', '9,9']))
  assert.equal(count(connected, 'cell'), 2); assert.equal(count(connected, 'wall'), 6)
  assert.equal(edge(connected, 'wall', '0.5,0'), undefined)
  assert.ok(connected.includes('fill="#123c24"'))
})
test('each wall follows actual floor boundaries including unknown neighbors and map edges', () => {
  const svg = renderMap([' # ', '## ', '   '], { x: 1, y: 1, facing: 0 }, new Set(['1,1']))
  assert.equal(count(svg, 'wall'), 2)
  assert.ok(edge(svg, 'wall', '1.5,1')); assert.ok(edge(svg, 'wall', '1,1.5'))
  assert.equal(count(svg, 'cell'), 1)
  assert.equal(count(renderMap(['#'], { x: 0, y: 0, facing: 0 }, new Set(['0,0'])), 'wall'), 4)
})
test('doors are distinct, symmetric, deduplicated and discovered only next to visited floors', () => {
  for (const [map, doors, key] of [
    [['##'], [{ from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }], '0.5,0'],
    [['#', '#'], [{ from: { x: 0, y: 0 }, to: { x: 0, y: 1 } }], '0,0.5'],
  ] as const) {
    // Compare canonical geometry with either visited cell iterated first.
    const a = doors[0].from, b = doors[0].to
    const player = { ...a, facing: 0 } as const
    const first = renderMap(map, player, new Set([cellKey(a)]), doors)
    const second = renderMap(map, { ...b, facing: 0 }, new Set([cellKey(b)]), doors)
    const normalize = (s: string) => s.match(/d="([^"]+)"/)![1]!.match(/M/g)?.length
    assert.equal(normalize(edge(first, 'door', key)!), 4)
    assert.equal(normalize(edge(second, 'door', key)!), 4)
    const both = renderMap(map, player, new Set([cellKey(a), cellKey(b)]), doors)
    assert.equal(count(both, 'door'), 1); assert.equal(edge(both, 'wall', key), undefined)
    const reversed = renderMap(map, player, new Set([cellKey(b), cellKey(a)]), doors)
    assert.equal(edge(both, 'door', key), edge(reversed, 'door', key))
    assert.equal(count(first, 'cell'), 1)
  }
  const player = { x: 2, y: 1, facing: 0 } as const
  const a = renderMap(DUNGEON_MAP, player, new Set(['2,1', '2,0']))
  const b = renderMap(DUNGEON_MAP, player, new Set(['2,0', '2,1']))
  assert.equal(edge(a, 'door', '2,0.5'), edge(b, 'door', '2,0.5'))
  assert.equal(count(renderMap(DUNGEON_MAP, INITIAL_PLAYER, initialVisited(INITIAL_PLAYER)), 'door'), 0)
})
test('expanded history uses 24px coordinates and oversized axes follow the player', () => {
  const map = Array.from({ length: 20 }, () => '#'.repeat(20))
  const visited = new Set(Array.from({ length: 20 }, (_, i) => `${i},${i}`))
  const svg = renderMap(map, { x: 10, y: 10, facing: 1 }, visited)
  assert.ok(svg.includes('data-map-cell="10,10" data-current="true"><rect x="148" y="88"'))
  assert.ok(svg.includes('data-map-cell="11,11"><rect x="172" y="112"'))
  assert.ok(!svg.includes('data-map-cell="0,0"'))
  assert.equal(visited.size, 20)
})
