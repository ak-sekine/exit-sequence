import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ZONE1_EVENTS } from '../src/expansion-content/zone1.ts'
import { ZONE2_EVENTS } from '../src/expansion-content/zone2.ts'
import { EXPECTED_ZONE3_EVENT_IDS, ZONE3_EVENT_BATCHES, ZONE3_EVENTS } from '../src/expansion-content/zone3.ts'
import {
  continueExpansionAfterResult, createExpansionGame, ITEMS, resolveExpansionAction, successChanceFor,
  toExpansionGameView, validateEventCatalog,
  type Condition, type ExpansionEventDefinition, type ExpansionGameState, type OutcomeDefinition,
} from '../src/expansion-engine.ts'
import { createSeededRandom, type RandomSource } from '../src/game.ts'

interface DesignEvent {
  id: string; zone: number; name: string; category: 'normal' | 'linked';
  actionDirections: string[]; requires: Array<Record<string, unknown>>;
  guarantee: { needed: boolean; condition: string; reason: string };
  followUpEventIds: string[]; stateChange: string;
}
const catalog = JSON.parse(readFileSync(new URL('../docs/event-catalog.json', import.meta.url), 'utf8')) as { events: DesignEvent[] }
const designed = catalog.events.filter(event => event.zone === 3)
const fixed: RandomSource = () => 0
const neutral = (text = '明示的テストfixtureの結果'): OutcomeDefinition => ({ text, powerDelta: 0 })
const fixtureAction = (id: string) => ({ id, label: id, detail: '区画4への進行確認専用fixture', baseChance: 100, success: neutral(`${id}成功`), failure: neutral(`${id}失敗`) })
const zone4Fallback: ExpansionEventDefinition = {
  id: 'test-fixture-zone4-fallback', title: 'zone 4 fallback fixture', description: 'テスト専用。Phase 2本文や制作数に含めない。', zone: 4,
  actions: [fixtureAction('fixture-a'), fixtureAction('fixture-b'), fixtureAction('fixture-c')],
}
const EVENTS = [...ZONE1_EVENTS, ...ZONE2_EVENTS, ...ZONE3_EVENTS, zone4Fallback]

const catalogCondition = (requirement: Record<string, unknown>): Condition => {
  if (requirement.kind === 'item') return { kind: 'item', itemId: requirement.id as never, ...(requirement.present === false ? { present: false } : {}) }
  if (requirement.kind === 'facility') return { kind: 'facility', facilityId: requirement.id as never, ...(requirement.active === false ? { active: false } : {}) }
  if (requirement.kind === 'history-tag') return { kind: 'history-tag', tag: requirement.id as string }
  if (requirement.kind === 'npc-status') return { kind: 'npc-status', npcId: requirement.id as never, status: requirement.status as never }
  throw new Error(`Unhandled Phase 2 requirement: ${JSON.stringify(requirement)}`)
}

function atEvent(
  eventId: string,
  options: Partial<Pick<ExpansionGameState, 'inventory' | 'facilities' | 'npcStatuses' | 'history'>> = {},
  tile = 41,
): ExpansionGameState {
  const start = createExpansionGame(fixed, 332, EVENTS)
  const allPriorEvents = [...ZONE1_EVENTS, ...ZONE2_EVENTS].map(event => event.id)
  return {
    ...start, ...options, position: tile,
    currentEvent: { tile, zone: tile <= 20 ? 1 : tile <= 40 ? 2 : 3, eventId, appearanceReason: 'content test fixture' },
    pendingNextEvent: null,
    usedEventIds: [...allPriorEvents, ...(tile > 40 ? [eventId] : [])],
  }
}

function resolveAt(eventId: string, actionIndex: number, roll: number, state = atEvent(eventId)) {
  return resolveExpansionAction(state, actionIndex, roll, EVENTS, fixed)
}

function withTestPowerMaintenance(events: readonly ExpansionEventDefinition[]): ExpansionEventDefinition[] {
  // Test-only: keep all 60 positions playable without changing production energy costs.
  return events.map(event => ({ ...event, actions: event.actions.map(action => ({
    ...action,
    success: { ...action.success, powerDelta: 0 },
    failure: { ...action.failure, powerDelta: 0 },
  })) as unknown as ExpansionEventDefinition['actions'] }))
}

test('zone 3 matches the 40 catalog IDs, names, categories, action directions, requirements, and four 10-event batches', () => {
  assert.equal(ZONE3_EVENTS.length, 40)
  assert.deepEqual(ZONE3_EVENT_BATCHES.map(batch => batch.length), [10, 10, 10, 10])
  assert.deepEqual(ZONE3_EVENTS.map(event => event.id), EXPECTED_ZONE3_EVENT_IDS)
  assert.deepEqual(ZONE3_EVENTS.map(event => event.id), designed.map(event => event.id))
  assert.equal(new Set([...ZONE1_EVENTS, ...ZONE2_EVENTS, ...ZONE3_EVENTS].map(event => event.id)).size, 120)
  assert.equal(designed.filter(event => event.category === 'normal').length, 30)
  assert.equal(designed.filter(event => event.category === 'linked').length, 10)

  for (const event of ZONE3_EVENTS) {
    const design = designed.find(item => item.id === event.id)!
    assert.equal(event.zone, 3)
    assert.equal(event.title, design.name, `${event.id} title`)
    assert.deepEqual(event.actions.map(action => action.label), design.actionDirections, `${event.id} actions`)
    assert.deepEqual(event.followUpEventIds ?? [], design.followUpEventIds, `${event.id} follow-up IDs`)
    assert.ok(event.description.trim())
    assert.ok(event.availableWhen?.explanation.trim())
    assert.equal(event.actions.length, 3)
    assert.equal(new Set(event.actions.map(action => action.id)).size, 3)
    assert.deepEqual(event.availableWhen?.all ?? [], design.requires.map(catalogCondition), `${event.id} requirements`)
    assert.equal(Boolean(event.guarantee), design.guarantee.needed, `${event.id} guarantee`)
    if (event.guarantee) {
      assert.deepEqual(event.guarantee.when.all ?? [], event.availableWhen?.all ?? [], `${event.id} guarantee conditions`)
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
  const resultTexts = ZONE3_EVENTS.flatMap(event => event.actions.flatMap(action => [action.success.text, action.failure.text]))
  assert.equal(resultTexts.length, 240)
  assert.equal(new Set(resultTexts).size, 240, 'zone 3 has 240 distinct success/failure result texts')
  validateEventCatalog(EVENTS)
})

test('copper fuse from zone 2 guarantees the assembly jig and installs at 100%, consuming the fuse and restoring aux power', () => {
  const recovered = resolveAt('waste-fuse-salvage', 0, 0, atEvent('waste-fuse-salvage', {}, 40))
  assert.ok(recovered.inventory.includes('copper-fuse'))
  assert.equal(recovered.pendingNextEvent?.eventId, 'production-fuse-jig')
  assert.match(recovered.pendingNextEvent!.appearanceReason, /銅線ヒューズ/)
  const jig = continueExpansionAfterResult(recovered)
  const installAction = ZONE3_EVENTS.find(event => event.id === 'production-fuse-jig')!.actions[0]
  assert.equal(successChanceFor(jig, installAction).percent, 100)
  assert.equal(toExpansionGameView(jig, EVENTS).currentEvent.actions[0]!.successChance, 100)
  const installed = resolveExpansionAction(jig, 0, 99, EVENTS, fixed)
  assert.equal(installed.history.at(-1)?.success, true)
  assert.equal(installed.facilities['aux-power'], true)
  assert.ok(!installed.inventory.includes('copper-fuse'))
  assert.deepEqual(installed.itemHistory.slice(-2).map(item => [item.kind, item.itemId, item.eventId]), [
    ['used', 'copper-fuse', 'production-fuse-jig'], ['consumed', 'copper-fuse', 'production-fuse-jig'],
  ])
  assert.ok(installed.history.at(-1)?.consequenceText.some(text => text.includes('成功率は100%')))
  assert.ok(ZONE3_EVENTS.find(event => event.id === 'production-fuse-jig')!.followUpEventIds?.includes('ops-powered-lift'))

  const missed = resolveAt('waste-fuse-salvage', 0, 99, atEvent('waste-fuse-salvage', {}, 40))
  assert.ok(!missed.inventory.includes('copper-fuse'))
  assert.notEqual(missed.pendingNextEvent?.eventId, 'production-fuse-jig')
  const bypass = resolveAt('production-fuse-jig', 2, 0, atEvent('production-fuse-jig', { inventory: ['copper-fuse'] }, 41))
  assert.equal(bypass.inventory.includes('copper-fuse'), true)
  assert.equal(bypass.facilities['aux-power'], false)
})

test('stopped zone 2 alarm reserves the quiet way event; alarm-disabled is required for its appearance', () => {
  const alarmState = atEvent('waste-alarm-relay', { facilities: { ...atEvent('waste-alarm-relay').facilities, 'alarm-disabled': true } }, 40)
  const next = resolveExpansionAction(alarmState, 0, 0, EVENTS, fixed)
  assert.equal(next.pendingNextEvent?.eventId, 'mutant-quiet-way')
  assert.match(next.pendingNextEvent!.appearanceReason, /警報/)
  const quietWay = continueExpansionAfterResult(next)
  assert.equal(quietWay.currentEvent.eventId, 'mutant-quiet-way')
  assert.equal(resolveAt('mutant-quiet-way', 0, 99, atEvent('mutant-quiet-way', {}, 41)).history.at(-1)?.success, false)

  const noAlarm = resolveExpansionAction(atEvent('waste-alarm-relay', {}, 40), 0, 99, EVENTS, fixed)
  assert.notEqual(noAlarm.pendingNextEvent?.eventId, 'mutant-quiet-way')
})

test('Chiri, Goro, and Pico reunite only when rescued and record repayment on successful follow-up', () => {
  for (const [npcId, eventId, firstEvent] of [
    ['chiri', 'npc-chiri-return', 'npc-chiri-first'],
    ['goro', 'npc-goro-return', 'npc-goro-first'],
    ['pico', 'npc-pico-return', 'npc-pico-first'],
  ] as const) {
    const npcStatuses = { ...atEvent('waste-key-hatch', {}, 40).npcStatuses, [npcId]: 'rescued' as const }
    const entered = resolveExpansionAction(atEvent('waste-key-hatch', { npcStatuses }, 40), 0, 0, EVENTS, fixed)
    assert.equal(entered.pendingNextEvent?.eventId, eventId)
    const returnState = continueExpansionAfterResult(entered)
    assert.equal(returnState.currentEvent.eventId, eventId)
    assert.ok(ZONE3_EVENTS.find(event => event.id === eventId)!.relatedEventIds?.includes(firstEvent))
    const repaid = resolveExpansionAction(returnState, 0, 0, EVENTS, fixed)
    assert.equal(repaid.npcStatuses[npcId], 'repaid')

    for (const status of ['unmet', 'encountered', 'rescue-failed'] as const) {
      const blockedStatuses = { ...npcStatuses, [npcId]: status }
      const blocked = resolveExpansionAction(atEvent('waste-key-hatch', { npcStatuses: blockedStatuses }, 40), 0, 0, EVENTS, fixed)
      assert.notEqual(blocked.pendingNextEvent?.eventId, eventId, `${npcId} ${status}`)
    }
  }
})

test('Jin, Ren, and Peta record rescue success, rescue failure, or a deliberate encounter without reunion state', () => {
  for (const [npcId, eventId] of [['jin', 'npc-jin-first'], ['lens', 'npc-lens-first'], ['peta', 'npc-peta-first']] as const) {
    const rescued = resolveAt(eventId, 0, 0)
    assert.equal(rescued.npcStatuses[npcId], 'rescued')
    const failed = resolveAt(eventId, 0, 99)
    assert.equal(failed.npcStatuses[npcId], 'rescue-failed')
    const encountered = resolveAt(eventId, 2, 0)
    assert.equal(encountered.npcStatuses[npcId], 'encountered')
    assert.notEqual(encountered.pendingNextEvent?.eventId, `${eventId.replace('-first', '-return')}`)
  }
})

test('access code and route card are acquired only when read; the route card is reusable by catalog design', () => {
  const code = resolveAt('production-access-code', 0, 0)
  assert.ok(code.inventory.includes('access-code'))
  assert.deepEqual(code.itemHistory.at(-1), { kind: 'acquired', itemId: 'access-code', eventId: 'production-access-code', tile: 41 })
  const noCode = resolveAt('production-access-code', 0, 99)
  assert.ok(!noCode.inventory.includes('access-code'))
  const route = resolveAt('production-route-card', 1, 0)
  assert.ok(route.inventory.includes('route-card'))
  assert.equal(toExpansionGameView(route, EVENTS).inventory.includes('route-card'), true)
  assert.equal(ITEMS['route-card'].reusable, true)
  const noRoute = resolveAt('production-route-card', 2, 0)
  assert.ok(!noRoute.inventory.includes('route-card'))
})

test('zones 1–3 complete 60 distinct positions in order and reproduce event/result sequences for the same seed', () => {
  const contentForRun = withTestPowerMaintenance(EVENTS)
  const play = () => {
    const random = createSeededRandom(314160)
    let state = createExpansionGame(random, 314160, contentForRun)
    const events: string[] = []
    const outcomes: string[] = []
    while (state.position <= 60 && state.status === 'playing') {
      events.push(state.currentEvent.eventId)
      assert.equal(state.currentEvent.zone, Math.floor((state.position - 1) / 20) + 1)
      const result = resolveExpansionAction(state, 0, 0, contentForRun, random)
      outcomes.push(`${result.history.at(-1)?.eventId}:${result.history.at(-1)?.success}:${result.history.at(-1)?.text}`)
      state = continueExpansionAfterResult(result)
    }
    return { events, outcomes, state }
  }
  const first = play()
  const second = play()
  assert.equal(first.events.length, 60)
  assert.equal(new Set(first.events).size, 60)
  for (let zone = 1; zone <= 3; zone++) {
    const inZone = first.events.slice((zone - 1) * 20, zone * 20)
    assert.equal(inZone.length, 20)
    assert.equal(new Set(inZone).size, 20)
  }
  assert.equal(first.state.position, 61)
  assert.equal(first.state.power, 20, 'test-only power maintenance fixture preserves test energy')
  assert.deepEqual(first.events, second.events)
  assert.deepEqual(first.outcomes, second.outcomes)
})

test('zone 1 and zone 2 semantic review remains pending; zone 3 also awaits human review', () => {
  assert.ok(catalog.events.filter(event => event.zone <= 3).every(event => event.phase3Status === '要確認'))
})
