import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_INVENTORY_CAPACITY, EXPANSION_SAMPLE_EVENTS, EXPANSION_TILES_PER_ZONE,
  EXPANSION_TOTAL_TILES, createExpansionGame, continueExpansionAfterResult,
  expansionZoneForTile, resolveExpansionAction, successChanceFor, toExpansionGameView,
  validateEventCatalog,
} from '../src/expansion-engine.ts'
import { createSeededRandom } from '../src/game.ts'
import type { ActionDefinition, ExpansionEventDefinition, ExpansionGameState, ZoneId } from '../src/expansion-engine.ts'

const constant = (value: number) => () => value

function neutralAction(id: string): ActionDefinition {
  const outcome = { text: '通り抜けた。', powerDelta: 0 }
  return { id, label: id, detail: '通常の通り方', baseChance: 100, success: outcome, failure: outcome }
}

function neutralEvent(id: string, zone: ZoneId, extras: Partial<ExpansionEventDefinition> = {}): ExpansionEventDefinition {
  return {
    id, zone, title: id, description: 'テスト用の通常イベント。',
    actions: [neutralAction('a'), neutralAction('b'), neutralAction('c')], ...extras,
  }
}

const testEvents: readonly ExpansionEventDefinition[] = [
  ...EXPANSION_SAMPLE_EVENTS,
  ...([1, 2, 3, 4, 5] as const).map(zone => neutralEvent(`test-bridge-${zone}`, zone)),
]

function atEvent(eventId: string, tile: number, events = testEvents, changes: Partial<ExpansionGameState> = {}): ExpansionGameState {
  const initial = createExpansionGame(constant(0.99), 47, events)
  const event = events.find(candidate => candidate.id === eventId)
  assert.ok(event)
  return {
    ...initial, ...changes, position: tile,
    currentEvent: { tile, zone: event.zone, eventId, appearanceReason: 'テストfixture' },
    usedEventIds: [...new Set([...initial.usedEventIds, eventId])],
  }
}

function choose(state: ExpansionGameState, actionIndex: number, rollValue: number, events = testEvents) {
  return resolveExpansionAction(state, actionIndex, rollValue, events, constant(0))
}

function fullFixtureCatalog(): readonly ExpansionEventDefinition[] {
  return ([1, 2, 3, 4, 5] as const).flatMap(zone =>
    Array.from({ length: EXPANSION_TILES_PER_ZONE }, (_, index) => neutralEvent(`fixture-z${zone}-${index + 1}`, zone)))
}

function play(seed: number) {
  const events = fullFixtureCatalog()
  const random = createSeededRandom(seed)
  let state = createExpansionGame(random, seed, events)
  const sequence: string[] = []
  while (state.status === 'playing') {
    sequence.push(state.currentEvent.eventId)
    state = resolveExpansionAction(state, 0, 0, events, random)
    if (state.pendingNextEvent) state = continueExpansionAfterResult(state)
  }
  return { state, sequence }
}

test('100-tile zone boundaries cover five consecutive 20-tile zones', () => {
  assert.equal(EXPANSION_TOTAL_TILES, 100)
  assert.deepEqual([1, 20, 21, 40, 41, 60, 61, 80, 81, 100].map(expansionZoneForTile), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
  for (const tile of [0, 101]) assert.throws(() => expansionZoneForTile(tile), RangeError)
})

test('same seed yields the same complete 100-event play and no event ID repeats', () => {
  const first = play(0xead2026)
  const second = play(0xead2026)
  assert.deepEqual(first.sequence, second.sequence)
  assert.equal(first.sequence.length, 100)
  assert.equal(new Set(first.sequence).size, 100)
  assert.equal(first.state.status, 'won')
  assert.equal(first.state.position, 100)
})

test('catalog validation detects duplicate IDs, insufficient candidates, and guarantee overflow', () => {
  const duplicate = [neutralEvent('same', 1), neutralEvent('same', 2)]
  assert.throws(() => validateEventCatalog(duplicate), /Duplicate or empty event ID/)
  assert.throws(() => validateEventCatalog(testEvents, { minimumPerZone: 40 }), /Zone 1 has/)
  const crowded = Array.from({ length: 21 }, (_, index) => neutralEvent(`g${index}`, 1, {
    guarantee: { when: { explanation: 'always' }, priority: index, reason: 'Reserved.' },
  }))
  assert.throws(() => validateEventCatalog(crowded), /only 20 tiles/)
})

test('result effects commit once but position waits for explicit continue', () => {
  const before = atEvent('prototype-key-cache', 1)
  const result = choose(before, 0, 0)
  assert.deepEqual(result.inventory, ['service-key'])
  assert.equal(result.itemHistory.filter(entry => entry.kind === 'acquired').length, 1)
  assert.equal(result.position, 1)
  assert.ok(result.pendingNextEvent)
  assert.equal(choose(result, 0, 0), result)
  const continued = continueExpansionAfterResult(result)
  assert.equal(continued.position, 2)
  assert.equal(continued.pendingNextEvent, null)
})

test('item chain succeeds with a guaranteed hatch and 100 percent action chance, and remains optional without the item', () => {
  const zoneOne = [
    EXPANSION_SAMPLE_EVENTS.find(event => event.id === 'prototype-key-cache')!,
    ...Array.from({ length: 19 }, (_, index) => neutralEvent(`item-path-${index + 1}`, 1)),
  ]
  const events = [
    ...zoneOne,
    EXPANSION_SAMPLE_EVENTS.find(event => event.id === 'prototype-key-hatch')!,
    EXPANSION_SAMPLE_EVENTS.find(event => event.id === 'prototype-aux-switch')!,
  ]
  const reachZoneTwo = (retrieveKey: boolean) => {
    const initial = createExpansionGame(constant(0.99), 82, events)
    let state: ExpansionGameState = {
      ...initial, currentEvent: { tile: 1, zone: 1, eventId: 'prototype-key-cache', appearanceReason: 'fixture start' },
      usedEventIds: ['prototype-key-cache'],
    }
    state = choose(state, 0, retrieveKey ? 0 : 99, events)
    while (state.pendingNextEvent && state.pendingNextEvent.tile < 21) {
      state = continueExpansionAfterResult(state)
      state = choose(state, 0, 0, events)
    }
    return state
  }
  const atZoneTwo = reachZoneTwo(true)
  assert.equal(atZoneTwo.pendingNextEvent?.eventId, 'prototype-key-hatch')
  assert.match(atZoneTwo.pendingNextEvent!.appearanceReason, /保守鍵/)
  const hatchState = continueExpansionAfterResult(atZoneTwo)
  const hatch = events.find(event => event.id === 'prototype-key-hatch')!
  const unlock = hatch.actions[0]
  const shown = toExpansionGameView(hatchState, events).currentEvent.actions[0]
  assert.equal(successChanceFor(hatchState, unlock).percent, 100)
  assert.equal(shown.successChance, 100)
  assert.match(shown.chanceReason, /保守鍵/)
  const opened = choose(hatchState, 0, 99, events)
  assert.equal(opened.history.at(-1)?.success, true)
  assert.deepEqual(opened.inventory, [])
  assert.deepEqual(opened.itemHistory.slice(-2).map(entry => entry.kind), ['used', 'consumed'])

  const withoutKey = reachZoneTwo(false)
  assert.notEqual(withoutKey.pendingNextEvent?.eventId, 'prototype-key-hatch')
  assert.equal(withoutKey.inventory.includes('service-key'), false)
})

test('failed item retrieval does not unlock the later guaranteed event', () => {
  const failed = choose(atEvent('prototype-key-cache', 1), 0, 99)
  assert.equal(failed.history.at(-1)?.success, false)
  assert.equal(failed.inventory.includes('service-key'), false)
  assert.notEqual(failed.pendingNextEvent?.eventId, 'prototype-key-hatch')
})

test('restoring facility power guarantees the later lift and raises its chance to 100 percent', () => {
  const restored = choose(atEvent('prototype-aux-switch', 10), 0, 0)
  assert.equal(restored.facilities['aux-power'], true)
  assert.equal(restored.history.at(-1)?.consequenceText.some(text => text.includes('復旧')), true)

  const liftReserved = choose(atEvent('test-bridge-3', 60, testEvents, { facilities: { ...atEvent('test-bridge-3', 60).facilities, 'aux-power': true } }), 0, 0)
  assert.equal(liftReserved.pendingNextEvent?.eventId, 'prototype-powered-lift')
  const liftState = continueExpansionAfterResult(liftReserved)
  const liftView = toExpansionGameView(liftState, testEvents).currentEvent.actions[0]
  assert.equal(liftView.successChance, 100)
  assert.match(liftView.chanceReason, /予備電源/)
  assert.equal(choose(liftState, 0, 99).history.at(-1)?.success, true)

  const failed = choose(atEvent('prototype-aux-switch', 10), 0, 99)
  assert.equal(failed.facilities['aux-power'], false)
  const absent = choose(atEvent('test-bridge-3', 60), 0, 0)
  assert.notEqual(absent.pendingNextEvent?.eventId, 'prototype-powered-lift')
})

test('NPC rescue and rescue failure lead to different zone-five candidates', () => {
  const rescued = choose(atEvent('prototype-momo-rescue', 1), 0, 0)
  assert.equal(rescued.npcStatuses.momo, 'rescued')
  const reunion = choose(atEvent('test-bridge-4', 80, testEvents, { npcStatuses: { momo: 'rescued' } }), 0, 0)
  assert.equal(reunion.pendingNextEvent?.eventId, 'prototype-momo-thanks')
  assert.match(reunion.pendingNextEvent!.appearanceReason, /救出/)
  const returned = choose(continueExpansionAfterResult(reunion), 0, 0)
  assert.equal(returned.npcStatuses.momo, 'repaid')
  assert.ok(returned.history.at(-1)?.text.includes('助けてもらった'))

  const failed = choose(atEvent('prototype-momo-rescue', 1), 0, 99)
  assert.equal(failed.npcStatuses.momo, 'rescue-failed')
  const noReunion = choose(atEvent('test-bridge-4', 80, testEvents, { npcStatuses: { momo: 'rescue-failed' } }), 0, 0)
  assert.notEqual(noReunion.pendingNextEvent?.eventId, 'prototype-momo-thanks')
})

test('same-zone guarantees have deterministic priority and do not collide or repeat', () => {
  const condition = { explanation: 'prepared', all: [{ kind: 'history-tag' as const, tag: 'prepared' }] }
  const high = neutralEvent('test-reserved-high', 2, { guarantee: { when: condition, priority: 20, reason: 'Higher priority.' } })
  const low = neutralEvent('test-reserved-low', 2, { guarantee: { when: condition, priority: 10, reason: 'Lower priority.' } })
  const events = [...testEvents, high, low]
  const previous = atEvent('test-bridge-1', 20, events)
  const first = choose({ ...previous, history: [{
    tile: 19, zone: 1, eventId: 'prior', actionId: 'prior', success: true, rollValue: 0,
    successChance: 100, chanceReason: '', text: '', powerBefore: 20, powerAfter: 20,
    powerChange: 0, consequenceText: [], tags: ['prepared'],
  }] }, 0, 0, events)
  assert.equal(first.pendingNextEvent?.eventId, high.id)
  const second = choose(continueExpansionAfterResult(first), 0, 0, events)
  assert.equal(second.pendingNextEvent?.eventId, low.id)
  assert.equal(new Set(second.usedEventIds).size, second.usedEventIds.length)
})

test('success chance 0 and 100 use the same strict 00-99 slot rule', () => {
  const zeroChance = neutralEvent('zero-chance', 1, { actions: [
    { ...neutralAction('a'), baseChance: 0 }, neutralAction('b'), neutralAction('c'),
  ] })
  const state = atEvent(zeroChance.id, 100, [zeroChance])
  assert.equal(toExpansionGameView(state, [zeroChance]).currentEvent.actions[0].successChance, 0)
  assert.equal(choose(state, 0, 0, [zeroChance]).history.at(-1)?.success, false)
  assert.equal(choose(state, 1, 99, [zeroChance]).history.at(-1)?.success, true)
})

test('inventory capacity drops pickups cleanly, and candidate exhaustion is an explicit error', () => {
  const initial = createExpansionGame(constant(0), 7, EXPANSION_SAMPLE_EVENTS, { inventoryCapacity: 0 })
  assert.equal(initial.inventoryCapacity, 0)
  assert.equal(DEFAULT_INVENTORY_CAPACITY, 3)
  const noSpace = choose({ ...atEvent('prototype-key-cache', 1), inventoryCapacity: 0 }, 0, 0)
  assert.equal(noSpace.inventory.length, 0)
  assert.equal(noSpace.itemHistory.at(-1)?.kind, 'capacity-full')

  const oneCandidate = [neutralEvent('only-zone-one', 1)]
  assert.throws(() => choose(atEvent('only-zone-one', 20, oneCandidate), 0, 0, oneCandidate), /No unused eligible events for zone 2/)
})

test('item consumption can be conditioned on success or failure', () => {
  const action = {
    ...neutralAction('use-key'), baseChance: 50,
    useItem: { itemId: 'service-key' as const, consume: 'success' as const },
  }
  const event = neutralEvent('conditional-consumption', 1, { actions: [action, neutralAction('b'), neutralAction('c')] })
  const events = [event, neutralEvent('startup-candidate', 1)]
  const inventory = ['service-key'] as const
  const success = choose(atEvent(event.id, 100, events, { inventory }), 0, 0, events)
  assert.deepEqual(success.inventory, [])
  assert.deepEqual(success.itemHistory.map(entry => entry.kind), ['used', 'consumed'])

  const failure = choose(atEvent(event.id, 100, events, { inventory }), 0, 99, events)
  assert.deepEqual(failure.inventory, ['service-key'])
  assert.deepEqual(failure.itemHistory.map(entry => entry.kind), ['used'])
})

test('100-tile terminal rules preserve GAME OVER at zero and CLEAR with remaining power', () => {
  const events = fullFixtureCatalog()
  const clearState = atEvent('fixture-z5-20', 100, events, { power: 1 })
  const clear = choose(clearState, 0, 0, events)
  assert.equal(clear.status, 'won')
  assert.equal(clear.position, 100)
  assert.equal(clear.pendingNextEvent, null)

  const damaging = neutralEvent('last-step-drain', 5, { actions: [
    { ...neutralAction('a'), baseChance: 0, failure: { text: '電力切れ。', powerDelta: -1 } },
    neutralAction('b'), neutralAction('c'),
  ] })
  const gameOverEvents = [neutralEvent('early-1', 1), neutralEvent('early-2', 1), damaging]
  const gameOver = choose(atEvent(damaging.id, 100, gameOverEvents, { power: 1 }), 0, 99, gameOverEvents)
  assert.equal(gameOver.status, 'lost')
  assert.equal(gameOver.power, 0)
  assert.equal(gameOver.pendingNextEvent, null)
})

test('runtime catalog validation catches unknown state references in imported data', () => {
  const invalid = neutralEvent('bad-reference', 1, { actions: [
    { ...neutralAction('a'), useItem: { itemId: 'made-up-key' } as unknown as ActionDefinition['useItem'] },
    neutralAction('b'), neutralAction('c'),
  ] })
  assert.throws(() => validateEventCatalog([invalid]), /Unknown item made-up-key/)
})
