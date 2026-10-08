import { test } from 'node:test'
import assert from 'node:assert/strict'
import { t, itemDescription } from '../src/i18n.ts'
import { Game } from '../src/game.ts'
import { rooms, edges, edgeKey, distance, passable } from '../src/map.ts'
import type { Room } from '../src/map.ts'
import { placements, facilities, escapeItems } from '../src/items.ts'
import { escapeRoute, escapeSeed, seededRandom } from './escape-route.ts'

const blocked = [['医療', '管制'], ['電力管理', '蓄電'], ['研究', '整備'], ['計測', '前室']] as const
const dark = [['観測', '中継'], ['計測', '資材']] as const

test('fresh start uses 28/40, only one short decoy, and exact prototype placements', () => {
  const g = new Game(() => 0)
  assert.equal(g.state.energy, 28); assert.equal(g.state.maxEnergy, 40)
  assert.deepEqual(g.state.items, ['short-decoy'])
  assert.deepEqual(placements, {
    医療: ['battery', 'local-key'], 観測: ['remote-decoy'], 中継: ['predictor'], 倉庫: ['food'],
    管制: ['key', 'long-decoy'], 電力管理: ['map', 'remote-key'], 蓄電: ['power', 'battery'],
    研究: ['parts'], 整備: ['override'], 計測: ['sensor'], 隔壁: ['controller'], 資材: ['short-decoy'],
  })
  assert.deepEqual(facilities, { 観測: ['camera'], 管制: ['camera', 'alarm'], 電力管理: ['charger'], 隔壁: ['bulkhead'], 発着: ['ship'] })
  for (const item of ['predictor', 'local-key'] as const) assert.equal(g.canAct({ type: 'use', item }), false)
})

test('four fixed BLOCKED and two DARK edges leave every cell reachable with cycles and alternate routes', () => {
  const g = new Game(() => 0)
  for (const [a, b] of edges) assert.equal(g.passage(a, b), blocked.some(([x, y]) => edgeKey(x, y) === edgeKey(a, b)) ? 'BLOCKED' : dark.some(([x, y]) => edgeKey(x, y) === edgeKey(a, b)) ? 'DARK' : 'NORMAL')
  assert.ok(g.connected()); assert.equal(edges.filter(([a, b]) => passable(g.passage(a, b))).length, 20)
  // More than 15 open edges in a connected 16-cell graph guarantees multiple cycles.
  g.state.items.push('local-key', 'remote-key', 'override', 'controller')
  g.state.knownEdges = edges.map(([a, b]) => edgeKey(a, b))
  for (const [a, b] of blocked) {
    g.state.location = a
    assert.ok(!g.available(a).includes(b)); assert.ok(!g.available(b).includes(a))
    const before = structuredClone(g.state)
    for (const closed of [false, true]) for (const item of ['local-key', 'remote-key', 'override'] as const) {
      const action = { type: 'use', item, edge: edgeKey(a, b), closed } as const
      assert.equal(g.canAct(action), false); g.act(action); assert.deepEqual(g.state, before)
    }
    assert.equal(g.canAct({ type: 'install', item: 'controller', edge: edgeKey(a, b) }), false)
  }
})

function sample(room: Room, roll: number, player: Room = '居住', isolate = false) {
  let draws = 0
  const g = new Game(() => { draws++; return roll })
  g.state.enemy = room; g.state.robotNext = room; g.state.location = player
  if (isolate) for (const next of g.available(room)) g.state.passages[edgeKey(room, next)] = 'CLOSED'
  const before = draws
  g.act({ type: 'wait' }) // consume a committed wait and draw exactly one next action
  return { next: g.state.robotNext, draws: draws - before, g }
}

test('normal patrol waits below 0.1, distributes remaining 90% equally using one draw and ignores player', () => {
  for (const room of ['計測', '管制', '倉庫'] as const) {
    const counts = new Map<Room, number>()
    for (let i = 0; i < 1000; i++) {
      // Midpoints avoid unstable floating-point boundaries at direction bucket edges.
      const roll = (i + 0.5) / 1000, a = sample(room, roll), b = sample(room, roll, '中継')
      assert.equal(a.draws, 1); assert.equal(b.next, a.next)
      assert.ok(distance(room, a.next) <= 1)
      assert.ok(a.next === room || passable(a.g.passage(room, a.next)))
      counts.set(a.next, (counts.get(a.next) ?? 0) + 1)
    }
    assert.equal(counts.get(room), 100)
    const available = new Game(() => 0).available(room)
    assert.equal(counts.size, available.length + 1)
    for (const next of available) assert.equal(counts.get(next), 900 / available.length)
    assert.equal(sample(room, 0.099999999).next, room)
    assert.notEqual(sample(room, 0.1).next, room)
    assert.notEqual(sample(room, 0.100000001).next, room)
    assert.notEqual(sample(room, 0.999999999).next, room)
    const isolated = sample(room, 0.5, '居住', true)
    assert.equal(isolated.next, room); assert.equal(isolated.draws, 0)
  }
})

test('reusable predictor costs 3 and its prediction matches each next normal action', () => {
  const g = new Game(() => 0.05)
  g.state.items.push('predictor')
  for (let i = 0; i < 2; i++) {
    const energy = g.state.energy
    g.act({ type: 'use', item: 'predictor' }); assert.equal(g.state.energy, energy - 3)
    const next = g.state.prediction!.next
    g.act({ type: 'wait' }); assert.equal(g.state.enemy, next)
    assert.ok(g.state.items.includes('predictor'))
  }
})

test('both batteries and fixed charger provide +8 and truncate at 40', () => {
  for (const room of ['医療', '蓄電'] as const) for (const energy of [20, 35, 40]) {
    const g = new Game(() => 0.05)
    g.state.location = room; g.act({ type: 'collect', item: 'battery' }); g.state.energy = energy
    g.act({ type: 'use', item: 'battery' }); assert.equal(g.state.energy, Math.min(40, energy + 8))
    assert.ok(!g.state.items.includes('battery'))
  }
  for (const energy of [20, 35, 40]) {
    const g = new Game(() => 0.05); g.state.location = '電力管理'; g.state.energy = energy
    g.act({ type: 'facility', facility: 'charger' }); assert.equal(g.state.energy, Math.min(40, energy + 8))
    assert.equal(g.state.chargerUsed, true)
  }
})

test('ja/en complete a normal-operation escape route from untouched initial state', () => {
  for (const language of ['ja', 'en'] as const) {
    const g = new Game(seededRandom(escapeSeed))
    for (const action of escapeRoute) {
      assert.ok(g.canAct(action), JSON.stringify(action))
      const before = structuredClone(g.state)
      g.act(action, language)
      assert.equal(g.state.encounter, false); assert.notEqual(g.state.status, 'over')
      if (action.type === 'camera') assert.equal(g.state.energy, before.energy - (action.fixed ? 2 : 4))
      if (action.type === 'use' && action.item === 'predictor') assert.equal(g.state.energy, before.energy - 3)
      if (before.prediction?.turn === before.turn) assert.equal(g.state.enemy, before.prediction.next)
      if (action.type === 'use' && action.item === 'battery' || action.type === 'facility' && action.facility === 'charger') assert.equal(g.state.energy, Math.min(40, before.energy + 8))
    }
    assert.ok(escapeItems.every(item => g.state.items.includes(item)))
    assert.equal(g.state.location, '発着'); assert.equal(g.state.status, 'clear')
    assert.equal(g.state.energy, 17); assert.equal(g.state.turn, 39)
    g.restart(); assert.equal(g.state.status, 'playing'); assert.equal(g.state.energy, 28)
    assert.deepEqual(g.state.items, ['short-decoy']); assert.equal(g.state.retreatUsed, false)
    assert.equal(g.state.feed, null); assert.equal(g.state.prediction, null); assert.equal(g.state.chargerUsed, false)
    assert.deepEqual(g.state.installations, [])
  }
})

test('ja/en intro and HELP show the current costs and supply amount', () => {
  for (const language of ['ja', 'en'] as const) {
    assert.match(t('introStatus', language), /28 \/ 40/)
    assert.match(t('predictionHelp', language), /ENERGY 3/)
    assert.match(t('cameraHelp', language), /ENERGY 4/)
    assert.match(t('cameraHelp', language), /(?:固定端末|fixed terminal) ?2/)
    assert.match(itemDescription('battery', language), /ENERGY \+8/)
  }
})
