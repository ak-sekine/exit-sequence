import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ZONE1_EVENTS } from '../src/expansion-content/zone1.ts'
import { EXPECTED_ZONE2_EVENT_IDS, ZONE2_EVENT_BATCHES, ZONE2_EVENTS } from '../src/expansion-content/zone2.ts'
import {
  createExpansionGame, continueExpansionAfterResult, resolveExpansionAction, successChanceFor,
  toExpansionGameView, validateEventCatalog,
  type Condition, type ExpansionEventDefinition, type ExpansionGameState, type OutcomeDefinition,
} from '../src/expansion-engine.ts'
import { createSeededRandom, type RandomSource } from '../src/game.ts'

interface DesignEvent {
  id: string; zone: number; name: string; category: 'normal' | 'linked';
  actionDirections: string[]; requires: Array<Record<string, unknown>>;
  guarantee: { needed: boolean; condition: string; reason: string };
  phase3Status: string; followUpEventIds: string[]; stateChange: string;
}
const catalog = JSON.parse(readFileSync(new URL('../docs/event-catalog.json', import.meta.url), 'utf8')) as { events: DesignEvent[] }
const designed = catalog.events.filter(event => event.zone === 2)
const fixed: RandomSource = () => 0
const neutral = (text = 'fixture result'): OutcomeDefinition => ({ text, powerDelta: 0 })
const fixtureAction = (id: string) => ({ id, label: id, detail: '後続条件の確認用fixture', baseChance: 100, success: neutral(), failure: neutral() })
const fixture = (id: string, condition: Condition, sourceId: string): ExpansionEventDefinition => {
  const predicate = { explanation: `明示的テストfixture: ${id}`, all: [condition] }
  return {
    id, title: id, description: 'Phase 2本文ではなく、区画3以降の状態引き継ぎ検査専用fixtureです。', zone: 3,
    availableWhen: predicate, guarantee: { when: predicate, priority: 100, reason: `テストfixture ${id} の条件が成立しました。` },
    relatedEventIds: [sourceId], actions: [fixtureAction('a'), fixtureAction('b'), fixtureAction('c')],
  }
}
const fixtures = [
  fixture('test-fixture-alarm-disabled', { kind: 'facility', facilityId: 'alarm-disabled' }, 'waste-alarm-relay'),
  fixture('test-fixture-coolant-diverted', { kind: 'facility', facilityId: 'coolant-diverted' }, 'waste-coolant-diverter'),
  fixture('test-fixture-ventilation-shutter', { kind: 'facility', facilityId: 'ventilation-shutter' }, 'waste-vent-shutter'),
  fixture('test-fixture-aux-power', { kind: 'facility', facilityId: 'aux-power' }, 'waste-aux-switch'),
  fixture('test-fixture-copper-fuse', { kind: 'item', itemId: 'copper-fuse' }, 'waste-fuse-salvage'),
  { id: 'test-fixture-zone3-fallback', title: 'test fallback', description: '状態不成立時の通常候補', zone: 3 as const,
    actions: [fixtureAction('a'), fixtureAction('b'), fixtureAction('c')] },
]
const EVENTS = [...ZONE1_EVENTS, ...ZONE2_EVENTS, ...fixtures]

const catalogCondition = (requirement: Record<string, unknown>): Condition => {
  if (requirement.kind === 'item') return { kind: 'item', itemId: requirement.id as never, ...(requirement.present === false ? { present: false } : {}) }
  if (requirement.kind === 'facility') return { kind: 'facility', facilityId: requirement.id as never, ...(requirement.active === false ? { active: false } : {}) }
  if (requirement.kind === 'history-tag') return { kind: 'history-tag', tag: requirement.id as string }
  if (requirement.kind === 'npc-status') return { kind: 'npc-status', npcId: requirement.id as never, status: requirement.status as never }
  throw new Error(`Unhandled Phase 2 condition: ${JSON.stringify(requirement)}`)
}
function atEvent(eventId: string, options: Partial<Pick<ExpansionGameState, 'inventory' | 'facilities' | 'npcStatuses' | 'history'>> = {}, tile = 20): ExpansionGameState {
  const start = createExpansionGame(fixed, 221, EVENTS)
  return {
    ...start, ...options, position: tile,
    currentEvent: { tile, zone: tile <= 20 ? 1 : 2, eventId, appearanceReason: 'content test fixture' },
    pendingNextEvent: null,
    usedEventIds: [...ZONE1_EVENTS.map(event => event.id), ...(tile > 20 ? [eventId] : [])],
  }
}
function resolveAt(eventId: string, actionIndex: number, roll: number, state = atEvent(eventId)) {
  return resolveExpansionAction(state, actionIndex, roll, EVENTS, fixed)
}
function withTestPowerMaintenance(events: readonly ExpansionEventDefinition[]): ExpansionEventDefinition[] {
  // Explicit test fixture: retain the real game state effects but neutralize energy cost
  // so all 40 positions can be traversed. Production events and game power rules are untouched.
  return events.map(event => ({ ...event, actions: event.actions.map(action => ({
    ...action,
    success: { ...action.success, powerDelta: 0 },
    failure: { ...action.failure, powerDelta: 0 },
  })) as unknown as ExpansionEventDefinition['actions'] }))
}

test('zone 2 matches all 40 Phase 2 IDs, names, categories, action directions, and four 10-event batches', () => {
  assert.equal(ZONE2_EVENTS.length, 40)
  assert.deepEqual(ZONE2_EVENT_BATCHES.map(batch => batch.length), [10, 10, 10, 10])
  assert.deepEqual(ZONE2_EVENTS.map(event => event.id), EXPECTED_ZONE2_EVENT_IDS)
  assert.deepEqual(ZONE2_EVENTS.map(event => event.id), designed.map(event => event.id))
  assert.equal(new Set([...ZONE1_EVENTS, ...ZONE2_EVENTS].map(event => event.id)).size, 80)
  assert.equal(designed.filter(event => event.category === 'normal').length, 30)
  assert.equal(designed.filter(event => event.category === 'linked').length, 10)

  for (const event of ZONE2_EVENTS) {
    const design = designed.find(item => item.id === event.id)!
    assert.equal(event.zone, 2)
    assert.equal(event.title, design.name, `${event.id} title`)
    assert.deepEqual(event.actions.map(action => action.label), design.actionDirections, `${event.id} action directions`)
    assert.deepEqual(event.followUpEventIds ?? [], design.followUpEventIds, `${event.id} follow-up IDs`)
    assert.ok(event.description.trim())
    assert.ok(event.availableWhen?.explanation.trim())
    assert.equal(event.actions.length, 3)
    assert.equal(new Set(event.actions.map(action => action.id)).size, 3)
    assert.deepEqual(event.availableWhen?.all ?? [], design.requires.map(catalogCondition), `${event.id} availability must preserve every AND requirement`)
    assert.equal(Boolean(event.guarantee), design.guarantee.needed, `${event.id} guarantee`)
    if (event.guarantee) {
      assert.deepEqual(event.guarantee.when.all ?? [], event.availableWhen?.all ?? [], `${event.id} guarantee and availability conditions must match`)
      assert.ok(event.guarantee.reason.trim())
    }
    for (const action of event.actions) {
      assert.ok(Number.isInteger(action.baseChance) && action.baseChance >= 0 && action.baseChance <= 100)
      assert.ok(action.label.trim() && action.detail.trim())
      for (const outcome of [action.success, action.failure]) {
        assert.ok(outcome.text.trim())
        assert.ok(Number.isInteger(outcome.powerDelta))
      }
    }
  }
  const results = ZONE2_EVENTS.flatMap(event => event.actions.flatMap(action => [action.success.text, action.failure.text]))
  assert.equal(results.length, 240)
  assert.equal(new Set(results).size, 240, 'all success and failure narration is unique')
  validateEventCatalog(EVENTS)
})

test('service key is required, guarantees the hatch, gives 100% in view and resolution, then records use and consumption', () => {
  const source = resolveAt('deep-key-cache', 2, 0)
  assert.deepEqual(source.inventory, ['service-key'])
  assert.equal(source.pendingNextEvent?.eventId, 'waste-key-hatch')
  assert.match(source.pendingNextEvent!.appearanceReason, /保守鍵/)
  const hatch = continueExpansionAfterResult(source)
  assert.deepEqual(hatch.inventory, ['service-key'])
  assert.equal(toExpansionGameView(hatch, EVENTS).inventory.includes('service-key'), true)
  assert.equal(toExpansionGameView(hatch, EVENTS).currentEvent.id, 'waste-key-hatch')
  const keyAction = ZONE2_EVENTS.find(event => event.id === 'waste-key-hatch')!.actions[0]
  assert.equal(successChanceFor(hatch, keyAction).percent, 100)
  assert.equal(toExpansionGameView(hatch, EVENTS).currentEvent.actions[0]!.successChance, 100)
  const opened = resolveExpansionAction(hatch, 0, 99, EVENTS, fixed)
  assert.equal(opened.history.at(-1)?.success, true)
  assert.match(opened.history.at(-1)!.text, /鍵がぴたり.*開いた/)
  assert.equal(opened.history.at(-1)?.powerChange, -1)
  assert.deepEqual(opened.inventory, [])
  assert.deepEqual(opened.itemHistory.slice(-2).map(item => [item.kind, item.itemId, item.eventId]), [
    ['used', 'service-key', 'waste-key-hatch'], ['consumed', 'service-key', 'waste-key-hatch'],
  ])
  assert.ok(opened.history.at(-1)!.consequenceText.some(text => text.includes('成功率は100%')))

  const missedKey = resolveAt('deep-key-cache', 2, 99)
  assert.equal(missedKey.inventory.includes('service-key'), false)
  assert.notEqual(missedKey.pendingNextEvent?.eventId, 'waste-key-hatch')
  assert.ok(missedKey.pendingNextEvent?.zone === 2)
  assert.ok(!missedKey.pendingNextEvent.appearanceReason.includes('保守鍵を所持'))
  const unavailable = EVENTS.find(event => event.id === 'waste-key-hatch')!
  assert.equal(unavailable.availableWhen?.all?.length, 1)
  assert.equal(unavailable.guarantee?.when.all?.length, 1)
})

test('zone 1 alarm map, coolant number, and vent map unlock the matching zone 2 event and zone 2 state reaches later fixtures', () => {
  const alarmRoute = resolveAt('deep-alarm-map', 0, 0)
  assert.equal(alarmRoute.facilities['alarm-route'], true)
  assert.equal(alarmRoute.pendingNextEvent?.eventId, 'waste-alarm-relay')
  assert.match(alarmRoute.pendingNextEvent!.appearanceReason, /警報線図/)
  const alarmStopped = resolveAt('waste-alarm-relay', 0, 0, {
    ...continueExpansionAfterResult(alarmRoute), position: 40,
    currentEvent: { tile: 40, zone: 2, eventId: 'waste-alarm-relay', appearanceReason: 'test' },
    pendingNextEvent: null,
  })
  assert.equal(alarmStopped.facilities['alarm-disabled'], true)
  assert.equal(alarmStopped.pendingNextEvent?.eventId, 'test-fixture-alarm-disabled')

  const coolantInfo = resolveAt('deep-coolant-label', 0, 0)
  assert.equal(coolantInfo.history.at(-1)?.tags.includes('coolant-label'), true)
  assert.equal(coolantInfo.pendingNextEvent?.eventId, 'waste-coolant-diverter')
  const coolantRouted = resolveAt('waste-coolant-diverter', 0, 0, {
    ...continueExpansionAfterResult(coolantInfo), position: 40,
    currentEvent: { tile: 40, zone: 2, eventId: 'waste-coolant-diverter', appearanceReason: 'test' },
    pendingNextEvent: null,
  })
  assert.equal(coolantRouted.facilities['coolant-diverted'], true)
  assert.equal(coolantRouted.pendingNextEvent?.eventId, 'test-fixture-coolant-diverted')
  const noCoolantNote = atEvent('waste-coolant-diverter', { history: [] })
  assert.notEqual(resolveExpansionAction(noCoolantNote, 0, 0, EVENTS, fixed).history.at(-1)?.successChance, 100)
  assert.equal(ZONE2_EVENTS.find(event => event.id === 'waste-coolant-diverter')!.availableWhen?.all?.[0]?.kind, 'history-tag')

  const ventInfo = resolveAt('deep-vent-sketch', 0, 0)
  assert.equal(ventInfo.history.at(-1)?.tags.includes('vent-map'), true)
  assert.equal(ventInfo.pendingNextEvent?.eventId, 'waste-vent-shutter')
  const ventOpened = resolveAt('waste-vent-shutter', 0, 0, {
    ...continueExpansionAfterResult(ventInfo), position: 40,
    currentEvent: { tile: 40, zone: 2, eventId: 'waste-vent-shutter', appearanceReason: 'test' },
    pendingNextEvent: null,
  })
  assert.equal(ventOpened.facilities['ventilation-shutter'], true)
  assert.equal(ventOpened.pendingNextEvent?.eventId, 'test-fixture-ventilation-shutter')

  for (const [eventId, itemId, fixtureId] of [
    ['waste-aux-switch', undefined, 'test-fixture-aux-power'],
    ['waste-fuse-salvage', 'copper-fuse', 'test-fixture-copper-fuse'],
  ] as const) {
    const successIndex = eventId === 'waste-aux-switch' ? 0 : 0
    const resulting = resolveAt(eventId, successIndex, 0, atEvent(eventId, { inventory: [] }, 40))
    assert.equal(resulting.pendingNextEvent?.eventId, fixtureId)
    if (itemId) assert.ok(resulting.inventory.includes(itemId))
    else assert.equal(resulting.facilities['aux-power'], true)
    if (itemId) assert.deepEqual(resulting.itemHistory.at(-1), { kind: 'acquired', itemId, eventId, tile: 40 })
  }
  const noFuse = resolveAt('waste-fuse-salvage', 0, 99, atEvent('waste-fuse-salvage', {}, 40))
  assert.equal(noFuse.inventory.includes('copper-fuse'), false)
  assert.notEqual(noFuse.pendingNextEvent?.eventId, 'test-fixture-copper-fuse')
  const noAuxPower = resolveAt('waste-aux-switch', 0, 99, atEvent('waste-aux-switch', {}, 40))
  assert.equal(noAuxPower.facilities['aux-power'], false)
  assert.notEqual(noAuxPower.pendingNextEvent?.eventId, 'test-fixture-aux-power')
})

test('alarm, coolant, and vent links remain unavailable without their source states', () => {
  const alarmMiss = resolveAt('deep-alarm-map', 0, 99)
  assert.equal(alarmMiss.facilities['alarm-route'], false)
  assert.notEqual(alarmMiss.pendingNextEvent?.eventId, 'waste-alarm-relay')
  const ventMiss = resolveAt('deep-vent-sketch', 0, 99)
  assert.equal(ventMiss.history.at(-1)?.tags.includes('vent-map'), false)
  assert.notEqual(ventMiss.pendingNextEvent?.eventId, 'waste-vent-shutter')
  const coolantMiss = resolveAt('deep-coolant-label', 0, 99)
  assert.equal(coolantMiss.history.at(-1)?.tags.includes('coolant-label'), false)
  assert.notEqual(coolantMiss.pendingNextEvent?.eventId, 'waste-coolant-diverter')

  const zone3WithoutNote = atEvent('waste-coolant-diverter', {}, 40)
  const noCondition = resolveExpansionAction(zone3WithoutNote, 1, 0, EVENTS, fixed)
  assert.equal(noCondition.pendingNextEvent?.eventId, 'test-fixture-zone3-fallback')
})

test('Momo and Nori reunite only after rescue, remember the specific rescue, and repay with a result effect', () => {
  for (const [npcId, sourceId, returnId] of [
    ['momo', 'npc-momo-first', 'npc-momo-return'], ['nori', 'npc-nori-first', 'npc-nori-return'],
  ] as const) {
    const reunited = resolveAt(sourceId, 0, 0)
    assert.equal(reunited.npcStatuses[npcId], 'rescued')
    assert.equal(reunited.pendingNextEvent?.eventId, returnId)
    const returnState = continueExpansionAfterResult(reunited)
    const returnEvent = ZONE2_EVENTS.find(event => event.id === returnId)!
    assert.equal(returnState.currentEvent.eventId, returnId)
    assert.ok(returnEvent.description.includes(npcId === 'momo' ? '工具棚の下' : '測定値'))
    const repaid = resolveExpansionAction(returnState, 0, 0, EVENTS, fixed)
    assert.equal(repaid.npcStatuses[npcId], 'repaid')
    assert.ok(repaid.history.at(-1)!.powerChange > 0)
    assert.ok(repaid.history.at(-1)!.text.includes(npcId === 'momo' ? '工具棚' : '前の測定'))
    assert.ok(repaid.history.at(-1)!.tags.includes(`${npcId}-repaid`))

    for (const status of ['rescue-failed', 'encountered'] as const) {
      const state = atEvent('deep-whisper-fan', { npcStatuses: { ...atEvent('deep-whisper-fan').npcStatuses, [npcId]: status } })
      const next = resolveExpansionAction(state, 0, 0, EVENTS, fixed)
      assert.notEqual(next.pendingNextEvent?.eventId, returnId, `${npcId} ${status} must not reunite`)
      assert.equal(ZONE2_EVENTS.find(event => event.id === returnId)!.availableWhen?.all?.[0]?.kind, 'npc-status')
    }
  }
})

test('zone 2 runs through both 20-tile sections without duplicate IDs, with seeded event and outcome reproducibility', () => {
  const contentForRun = withTestPowerMaintenance([...ZONE1_EVENTS, ...ZONE2_EVENTS, ...fixtures])
  const play = () => {
    const random = createSeededRandom(314159)
    let state = createExpansionGame(random, 314159, contentForRun)
    const events: string[] = []
    const results: string[] = []
    while (state.position <= 40 && state.status === 'playing') {
      events.push(state.currentEvent.eventId)
      assert.equal(state.currentEvent.zone, state.position <= 20 ? 1 : 2)
      const result = resolveExpansionAction(state, 0, 0, contentForRun, random)
      results.push(`${result.history.at(-1)?.eventId}:${result.history.at(-1)?.success}:${result.history.at(-1)?.text}`)
      state = continueExpansionAfterResult(result)
    }
    return { events, results, state }
  }
  const first = play()
  const second = play()
  assert.equal(first.events.length, 40)
  assert.equal(new Set(first.events.slice(0, 20)).size, 20)
  assert.equal(new Set(first.events.slice(20)).size, 20)
  assert.equal(new Set(first.events).size, 40)
  assert.equal(first.state.position, 41)
  assert.equal(first.state.power, 20, 'test-only power maintenance fixture keeps all 40 steps alive')
  assert.deepEqual(first.events, second.events)
  assert.deepEqual(first.results, second.results)
})

test('zone 1 semantic review remains pending and zone 2 content is implemented but awaits human review', () => {
  assert.ok(catalog.events.filter(event => event.zone === 1).every(event => event.phase3Status === '要確認'))
  assert.ok(designed.every(event => event.phase3Status === '要確認'))
})
