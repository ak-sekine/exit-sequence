import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Game } from '../src/game.ts'
import type { Action } from '../src/game.ts'
import { rooms, edges, edgeKey, neighbors, distance, coordinates, initialKnowledge, passable, cardinalDirections, neighborInDirection, directionBetween, direction } from '../src/map.ts'
import { escapeItems, facilities, itemSpecs } from '../src/items.ts'

function fixture(random = () => 0.999) { const game = new Game(random); game.state.enemy = '通信'; game.state.robotNext = '通信'; return game }
function robot(game: Game, room: typeof game.state.location) { game.state.enemy = room; game.state.robotNext = room }
function mapped(game: Game) { for (const room of rooms) game.state.knowledge[room] = 'mapped'; game.state.knownEdges = edges.map(([a, b]) => edgeKey(a, b)) }
const snapshot = (game: Game) => structuredClone(game.state)

test('4x4 has 16 cells, 24 unique reciprocal orthogonal edges and all objectives are reachable', () => {
  assert.equal(rooms.length, 16); assert.equal(new Set(rooms).size, 16)
  assert.equal(edges.length, 24); assert.equal(new Set(edges.map(([a, b]) => edgeKey(a, b))).size, 24)
  for (const [a, b] of edges) { assert.equal(distance(a, b), 1); assert.ok(neighbors(a).includes(b)); assert.ok(neighbors(b).includes(a)) }
  for (const room of rooms) { const g = fixture(); g.state.location = room; assert.ok(g.connected()) }
})

test('unknown names and connections accumulate by walking; map reveals static layout only', () => {
  const g = fixture(), s = g.state
  assert.deepEqual(s.knowledge, initialKnowledge()); assert.equal(s.knownEdges.length, 2)
  assert.equal(g.mapLines().join('').match(/\?/g)?.length, 15)
  assert.equal(g.label('医療'), '? (B1)'); assert.ok(!g.guideLines().join('').includes('管制'))
  g.act({ type: 'move', target: '医療' }); assert.equal(s.knowledge.医療, 'visited'); assert.ok(g.mapLines().join('').includes('医'))
  g.act({ type: 'move', target: '居住' }); assert.equal(s.knowledge.医療, 'visited')
  g.act({ type: 'move', target: '医療' })
  const before = snapshot(g); g.act({ type: 'collect', item: 'map' })
  assert.ok(rooms.every(room => ['visited', 'mapped'].includes(s.knowledge[room])))
  assert.equal(s.knownEdges.length, 24); assert.equal(g.mapLines().join('').includes('?'), false)
  assert.equal(s.feed, null); assert.equal(s.prediction, null); assert.equal(s.enemy, before.enemy)
  assert.deepEqual(s.passages, before.passages)
  assert.ok(!g.guideLines().join('').includes('管制')) // map alone never reveals facilities
  const lines = g.mapLines().join('\n'); assert.ok(!/CLOSED|DARK|ROBOT|ロボット/.test(lines))
})

test('all read-only information and canAct preserve full State and RNG', () => {
  const g = fixture(); g.act({ type: 'camera' }); const before = snapshot(g)
  ;(g as unknown as { random: () => number }).random = () => { throw Error('read consumed RNG') }
  for (const language of ['ja', 'en'] as const) {
    g.statusLines(language); g.mapLines(language); g.guideLines(language); g.warningLines(language); g.feedLines(language); g.predictionLines(language); g.freshness(g.state.feed)
    g.canAct({ type: 'wait' }); g.canAct({ type: 'use', item: 'predictor' })
  }
  assert.deepEqual(g.state, before)
})

test('rejected moves, missing items, wrong facilities and invalid installs never progress', () => {
  const g = fixture(), actions: Action[] = [
    { type: 'move', target: '発着' }, { type: 'collect', item: 'food' }, { type: 'use', item: 'long-decoy', target: '医療' },
    { type: 'facility', facility: 'ship' }, { type: 'facility', facility: 'camera' }, { type: 'camera', fixed: true },
    { type: 'install', item: 'controller', edge: 'invalid' }, { type: 'activate', id: 999 }, { type: 'retreat', target: '医療' },
  ]
  const before = snapshot(g)
  ;(g as unknown as { random: () => number }).random = () => { throw Error('rejection consumed RNG') }
  for (const action of actions) { assert.equal(g.canAct(action), false); g.act(action); assert.deepEqual(g.state, before) }
})

test('normal robot can wait and chooses only open neighbors, never tracks the player', () => {
  const g = fixture(); robot(g, '管制'); const previous = g.state.enemy
  g.act({ type: 'wait' }); assert.equal(g.state.enemy, previous)
  const candidates = [...g.available('管制'), '管制']
  const destinations = new Set<string>()
  for (let i = 0; i < candidates.length; i++) {
    const x = fixture(() => (i + 0.1) / candidates.length); robot(x, '管制')
    x.act({ type: 'wait' }); x.act({ type: 'wait' })
    destinations.add(x.state.enemy)
    assert.ok(candidates.includes(x.state.enemy))
    assert.ok(distance('管制', x.state.enemy) <= 1)
  }
  assert.equal(destinations.size, candidates.length)
})

test('10,000 robot updates never teleport or enter CLOSED/BLOCKED passages', () => {
  let seed = 29, waits = 0, moves = 0
  const g = fixture(() => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32 })
  for (const key of [edgeKey('居住', '医療'), edgeKey('整備', '通信')]) g.state.passages[key] = 'CLOSED'
  g.state.passages[edgeKey('電力管理', '蓄電')] = 'BLOCKED'
  for (let i = 0; i < 10000; i++) {
    g.state.location = rooms.find(room => distance(room, g.state.enemy) >= 4)!; g.state.energy = 40
    const from = g.state.enemy
    g.act({ type: 'camera' })
    const to = g.state.enemy
    assert.equal(g.state.status, 'playing'); assert.equal(g.state.encounter, false)
    if (from === to) waits++
    else { moves++; assert.ok(neighbors(from).includes(to)); assert.ok(passable(g.passage(from, to))) }
  }
  assert.ok(waits > 500); assert.ok(moves > 500)
})

test('distance 3+ is silent, distance 2 gives direction, 1 strong warning, 0 encounter', () => {
  const g = fixture()
  robot(g, '中継'); assert.deepEqual(g.warningLines(), [])
  robot(g, '観測'); assert.match(g.warningLines().join(''), /東.*距離2/)
  robot(g, '管制'); assert.match(g.warningLines().join(''), /南.*距離2/) // vertical wins diagonal
  robot(g, '医療'); assert.match(g.warningLines().join(''), /隣.*危険.*東.*距離1/s)
  robot(g, '居住'); assert.match(g.warningLines().join(''), /同一区画/)
  for (const [room, expected] of [['居住', 'NORTH'], ['整備', 'SOUTH'], ['電力管理', 'EAST'], ['倉庫', 'WEST']] as const) {
    g.state.location = '管制'; robot(g, room)
    // Habitation is a diagonal: vertical NORTH wins.
    assert.match(g.warningLines('en').join(''), new RegExp(expected))
  }
})

test('camera captures exact position after a world action; later record is stale and read-only', () => {
  const g = fixture()
  assert.equal(g.freshness(g.state.feed), 'unchecked')
  const knowledge = structuredClone(g.state.knowledge)
  const log = g.act({ type: 'camera' }, 'en')
  assert.equal(g.state.energy, 38); assert.equal(g.state.turn, 1)
  assert.equal(g.state.feed!.enemy, g.state.enemy); assert.equal(g.state.feed!.turn, 1)
  assert.match(log.join('\n'), /COMMS \(B4\)/); assert.equal(g.freshness(g.state.feed), 'fresh')
  assert.deepEqual(g.state.knowledge, knowledge)
  g.act({ type: 'wait' }); assert.equal(g.freshness(g.state.feed), 'stale')
  const before = snapshot(g); g.feedLines(); assert.deepEqual(g.state, before)
  g.state.location = '観測'; const energy = g.state.energy
  g.act({ type: 'camera', fixed: true }); assert.equal(g.state.energy, energy - 1)
})

test('prediction commits one next move including wait, and matches the next normal action', () => {
  for (const roll of [0, 0.3, 0.6, 0.99]) {
    const g = fixture(() => roll); robot(g, '資材')
    g.act({ type: 'use', item: 'predictor' })
    assert.equal(g.freshness(g.state.prediction), 'fresh')
    const predicted = g.state.prediction!.next
    g.predictionLines(); g.statusLines(); g.mapLines()
    g.act({ type: 'wait' }); assert.equal(g.state.enemy, predicted)
    assert.equal(g.freshness(g.state.prediction), 'stale')
  }
})

test('short lure succeeds deterministically, costs little and consumes once; invalid range is free', () => {
  const g = fixture(); mapped(g); robot(g, '観測')
  const before = snapshot(g); assert.equal(g.canAct({ type: 'use', item: 'short-decoy', target: '発着' }), false)
  g.act({ type: 'use', item: 'short-decoy', target: '発着' }); assert.deepEqual(g.state, before)
  g.act({ type: 'use', item: 'short-decoy', target: '管制' })
  assert.equal(g.state.enemy, '電力管理'); assert.equal(g.state.energy, 39)
  assert.ok(!g.state.items.includes('short-decoy')); assert.equal(g.state.lure!.remaining, 1)
  g.act({ type: 'wait' }); assert.equal(g.state.enemy, '管制'); assert.equal(g.state.lure, null)
})

test('long lure follows a shortest open route one cell per turn, then stays at target', () => {
  const g = fixture(); mapped(g); g.state.items.push('long-decoy'); robot(g, '発着')
  const previous = g.state.enemy; g.act({ type: 'use', item: 'long-decoy', target: '観測' })
  assert.equal(distance(previous, g.state.enemy), 1); assert.equal(distance(g.state.enemy, '観測'), 3)
  assert.equal(g.state.energy, 36)
  for (let i = 0; i < 3; i++) { const old = g.state.enemy; g.act({ type: 'wait' }); assert.equal(distance(old, g.state.enemy), 1) }
  assert.equal(g.state.enemy, '観測'); assert.ok(!g.state.items.includes('long-decoy'))
})

test('installed decoy stays at placement and can be activated repeatedly from elsewhere', () => {
  const g = fixture(); g.state.location = '観測'; g.state.items.push('remote-decoy'); robot(g, '資材')
  g.act({ type: 'install', item: 'remote-decoy' })
  assert.ok(!g.state.items.includes('remote-decoy')); assert.equal(g.state.installations[0]!.room, '観測')
  g.act({ type: 'move', target: '医療' })
  const old = g.state.enemy; g.act({ type: 'activate', id: 1 })
  assert.equal(distance(old, g.state.enemy), 1); assert.equal(g.state.lure!.target, '観測')
  assert.equal(g.state.lure!.remaining, 4); assert.equal(g.state.installations.length, 1)
  g.act({ type: 'activate', id: 1 }); assert.equal(g.state.installations.length, 1)
})

test('self lure fixes the use-time player cell and is dangerous at distance 1', () => {
  const g = fixture(); robot(g, '観測'); g.act({ type: 'self-lure' })
  assert.equal(g.state.enemy, '医療'); assert.equal(g.state.energy, 40); assert.equal(g.state.lure!.target, '居住')
  g.act({ type: 'move', target: '倉庫' }); assert.equal(g.state.enemy, '居住'); assert.equal(g.state.encounter, false)
  const danger = fixture(); robot(danger, '医療'); danger.act({ type: 'self-lure' }); assert.equal(danger.state.encounter, true)
})

test('closed bulkheads block both actors and restore after exactly 3 updates to former state', () => {
  const g = fixture(); mapped(g); robot(g, '管制'); g.state.robotNext = '医療'
  const edge = edgeKey('居住', '医療'); g.state.passages[edge] = 'DARK'
  g.act({ type: 'use', item: 'local-key', edge, closed: true })
  assert.equal(g.state.passages[edge], 'CLOSED'); assert.equal(g.state.bulkheads[edge]!.restoresAt, 3)
  const before = snapshot(g); g.act({ type: 'move', target: '医療' }); assert.deepEqual(g.state, before)
  assert.ok(!g.available('医療').includes('居住'))
  g.act({ type: 'wait' }); assert.equal(g.state.passages[edge], 'CLOSED')
  const log = g.act({ type: 'wait' }); assert.equal(g.state.passages[edge], 'DARK'); assert.equal(g.state.bulkheads[edge], undefined)
  assert.match(log.join(''), /自動復旧/)
})

test('bulkhead reroutes a lure and invalidates prediction without crossing the closed edge', () => {
  const g = fixture(); mapped(g); robot(g, '管制'); g.state.items.push('remote-key')
  g.state.lure = { target: '居住', remaining: 5 }; g.state.robotNext = '医療'
  g.state.prediction = { current: '管制', next: '医療', turn: 0 }
  const edge = edgeKey('管制', '医療')
  const log = g.act({ type: 'use', item: 'remote-key', edge, closed: true })
  assert.equal(g.state.enemy, '倉庫'); assert.equal(g.state.prediction, null); assert.match(log.join(''), /予測は無効/)
  assert.equal(g.state.energy, 36)
})

test('override is one-use and remote; controller remains bound to an adjacent edge after installation', () => {
  const g = fixture(); mapped(g); g.state.items.push('override', 'controller')
  const remote = edgeKey('前室', '発着'); g.act({ type: 'use', item: 'override', edge: remote, closed: true })
  assert.equal(g.state.energy, 40); assert.ok(!g.state.items.includes('override'))
  assert.equal(g.canAct({ type: 'install', item: 'controller', edge: remote }), false)
  const local = edgeKey('居住', '倉庫'); g.act({ type: 'install', item: 'controller', edge: local })
  assert.ok(!g.state.items.includes('controller')); g.act({ type: 'move', target: '医療' })
  g.act({ type: 'activate', id: 1, closed: true }); assert.equal(g.state.passages[local], 'CLOSED')
  g.act({ type: 'activate', id: 1, closed: false }); assert.equal(g.state.passages[local], 'NORMAL')
  assert.equal(g.state.installations[0]!.edge, local)
})

test('fixed equipment requires its district and provides strong lower-cost functions', () => {
  const g = fixture(); mapped(g)
  assert.equal(g.canAct({ type: 'facility', facility: 'alarm', target: '観測' }), false)
  g.state.location = '管制'; robot(g, '発着')
  g.act({ type: 'facility', facility: 'alarm', target: '観測' })
  assert.equal(g.state.energy, 39); assert.equal(g.state.lure!.target, '観測'); assert.equal(g.state.lure!.remaining, 3)
  g.state.location = '電力管理'; g.state.energy = 30
  g.act({ type: 'facility', facility: 'charger' }); assert.equal(g.state.energy, 40); assert.ok(g.state.chargerUsed)
  const before = snapshot(g); g.act({ type: 'facility', facility: 'charger' }); assert.deepEqual(g.state, before)
  assert.ok(Object.values(facilities).flat().includes('bulkhead'))
})

test('remote sensor stays installed and reports exact nearby position, never claims free global vision', () => {
  const g = fixture(); g.state.location = '計測'; g.state.items.push('sensor'); robot(g, '発着')
  g.act({ type: 'install', item: 'sensor' }); g.act({ type: 'move', target: '電力管理' })
  let log = g.act({ type: 'activate', id: 1 }, 'en'); assert.match(log.join(''), /No signal within distance 1/)
  robot(g, '資材'); log = g.act({ type: 'activate', id: 1 }, 'en'); assert.match(log.join(''), /CARGO \(D3\)/)
  assert.equal(g.state.installations[0]!.room, '計測'); assert.ok(!g.state.items.includes('sensor'))
})

test('battery is carried then consumed and capped; fatal costs stop before successful results/world', () => {
  const g = fixture(); g.state.location = '医療'; g.act({ type: 'collect', item: 'battery' })
  g.state.energy = 35; g.act({ type: 'use', item: 'battery' }); assert.equal(g.state.energy, 40); assert.ok(!g.state.items.includes('battery'))
  const over = fixture(); over.state.energy = 1; const log = over.act({ type: 'use', item: 'predictor' })
  assert.equal(over.state.status, 'over'); assert.equal(over.state.turn, 0); assert.equal(over.state.prediction, null)
  assert.equal(log.at(-1), 'GAME OVER')
})

test('entering an occupied cell or robot arrival triggers encounter before any escape by patrol', () => {
  const g = fixture(); robot(g, '医療'); g.state.robotNext = '観測'
  g.act({ type: 'move', target: '医療' }); assert.equal(g.state.enemy, '医療'); assert.equal(g.state.encounter, true)
  assert.equal(g.canAct({ type: 'camera' }), false); assert.equal(g.canAct({ type: 'use', item: 'predictor' }), false)
  const arrival = fixture(); robot(arrival, '医療'); arrival.state.robotNext = '居住'
  arrival.act({ type: 'wait' }); assert.equal(arrival.state.encounter, true)
})

test('emergency retreat succeeds only below 25%, is once per run, and otherwise GAME OVER', () => {
  let success = 0
  for (let i = 0; i < 100; i++) {
    const g = fixture(() => i / 100); robot(g, '居住'); g.state.encounter = true
    const log = g.act({ type: 'retreat', target: '医療' })
    assert.equal(g.state.retreatUsed, true); assert.equal(g.state.energy, 38); assert.equal(g.state.turn, 1)
    if (g.state.status === 'playing') { success++; assert.equal(g.state.location, '医療'); assert.equal(g.state.enemy, '居住'); assert.equal(g.state.knowledge.医療, 'visited') }
    else assert.equal(log.at(-1), 'GAME OVER')
  }
  assert.equal(success, 25)
  const g = fixture(() => 0.1); robot(g, '居住'); g.state.encounter = true
  g.act({ type: 'retreat', target: '医療' }); g.state.robotNext = '医療'
  g.act({ type: 'wait' }); assert.equal(g.state.status, 'over')
})

test('no open retreat route, low energy and surrender are fatal; clear requires supplies at ship', () => {
  for (const reason of ['sealed', 'low', 'surrender'] as const) {
    const g = fixture(); robot(g, '医療'); g.state.robotNext = '居住'
    if (reason === 'sealed') { robot(g, '居住'); for (const next of neighbors('居住')) g.state.passages[edgeKey('居住', next)] = 'CLOSED' }
    if (reason === 'low') g.state.energy = 3
    g.act({ type: 'wait' })
    if (reason === 'surrender') g.act({ type: 'give-up' })
    assert.equal(g.state.status, 'over')
  }
  const g = fixture(); g.state.location = '発着'; const before = snapshot(g)
  g.act({ type: 'facility', facility: 'ship' }); assert.deepEqual(g.state, before)
  g.state.items.push(...escapeItems)
  const enemy = g.state.enemy; g.act({ type: 'facility', facility: 'ship' }); assert.equal(g.state.status, 'clear'); assert.equal(g.state.enemy, enemy)
})

test('full item-first escape loop is playable without equipment Task prerequisites', () => {
  const g = fixture()
  const move = (target: typeof g.state.location) => { g.act({ type: 'move', target }); assert.equal(g.state.encounter, false); assert.equal(g.state.status, 'playing') }
  move('医療'); g.act({ type: 'collect', item: 'map' }); move('管制'); g.act({ type: 'collect', item: 'key' })
  move('電力管理'); move('蓄電'); g.act({ type: 'collect', item: 'power' }); move('電力管理'); move('管制'); move('倉庫')
  g.act({ type: 'collect', item: 'food' }); move('研究'); g.act({ type: 'collect', item: 'parts' }); move('整備'); move('計測'); move('前室'); move('発着')
  assert.ok(g.ready()); const log = g.act({ type: 'facility', facility: 'ship' }); assert.equal(log.at(-1), 'GAME CLEAR')
  assert.ok(escapeItems.every(item => g.state.items.includes(item)))
  g.restart(); assert.equal(g.state.status, 'playing'); assert.equal(g.state.retreatUsed, false); assert.equal(g.state.installations.length, 0); assert.equal(g.state.feed, null)
})

test('ja/en produce identical full State and RNG through randomized actions', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const rng = () => { let value = seed, draws = 0; return { next: () => { draws++; value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 2 ** 32 }, draws: () => draws } }
    const a = rng(), b = rng(), ja = new Game(a.next), en = new Game(b.next)
    for (let i = 0; i < 30; i++) {
      const s = ja.state
      const action: Action = s.encounter ? { type: 'retreat', target: ja.available(s.location)[0]! }
        : i % 5 === 0 ? { type: 'use', item: 'predictor' } : i % 5 === 1 ? { type: 'camera' } : { type: 'move', target: neighbors(s.location)[i % neighbors(s.location).length]! }
      ja.act(action, 'ja'); const log = en.act(action, 'en')
      assert.deepEqual(en.state, ja.state); assert.equal(a.draws(), b.draws())
      assert.ok(!/[\u3040-\u30ff\u3400-\u9fff]/u.test(log.join('')))
    }
  }
})

test('item taxonomy has distinct portable/deployable behavior and no weapons or combat State', () => {
  assert.equal(itemSpecs.predictor.kind, 'portable'); assert.equal(itemSpecs['remote-decoy'].kind, 'deployable')
  assert.equal(itemSpecs['short-decoy'].consumable, true); assert.equal(itemSpecs['long-decoy'].cost, 4)
  assert.ok(!('hp' in fixture().state)); assert.equal(escapeItems.length, 4)
  assert.deepEqual(coordinates('発着'), { x: 3, y: 3 })
})

test('unreachable self lure and BLOCKED installed controller are rejected without State/RNG changes', () => {
  const g = fixture(); mapped(g); g.state.items.push('controller')
  const key = edgeKey('居住', '医療'); g.act({ type: 'install', item: 'controller', edge: key })
  g.state.passages[key] = 'BLOCKED'; g.state.passages[edgeKey('居住', '倉庫')] = 'CLOSED'
  const before = snapshot(g)
  ;(g as unknown as { random: () => number }).random = () => { throw Error('invalid action consumed RNG') }
  for (const action of [{ type: 'self-lure' }, { type: 'activate', id: 1, closed: false }] as const) {
    assert.equal(g.canAct(action), false); g.act(action); assert.deepEqual(g.state, before)
  }
})

test('encounter interruption still restores an expired bulkhead and expires a lure on time', () => {
  const g = fixture(); robot(g, '居住'); g.state.turn = 2
  const key = edgeKey('居住', '医療')
  g.state.passages[key] = 'CLOSED'; g.state.bulkheads[key] = { previous: 'NORMAL', restoresAt: 3 }
  g.state.lure = { target: '観測', remaining: 1 }
  const log = g.act({ type: 'wait' })
  assert.equal(g.state.turn, 3); assert.equal(g.state.passages[key], 'NORMAL'); assert.equal(g.state.lure, null)
  assert.equal(g.state.encounter, true); assert.match(log.join(''), /自動復旧/)
})

test('movement and robot warning cardinal axes agree at every adjacent cell', () => {
  for (const from of rooms) for (const heading of cardinalDirections) {
    const target = neighborInDirection(from, heading)
    if (!target) continue
    assert.equal(directionBetween(from, target), heading)
    const g = fixture(); g.state.location = from; robot(g, target)
    for (const language of ['ja', 'en'] as const) {
      assert.ok(g.warningLines(language).join('').includes(direction(from, target, language)))
    }
  }
  assert.equal(neighborInDirection('居住', 'north'), undefined)
  assert.equal(neighborInDirection('居住', 'west'), undefined)
  assert.equal(neighborInDirection('居住', 'east'), '医療')
  assert.equal(neighborInDirection('居住', 'south'), '倉庫')
})
