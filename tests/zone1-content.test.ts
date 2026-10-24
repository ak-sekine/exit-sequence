import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  ZONE1_EVENTS, EXPECTED_ZONE1_EVENT_IDS,
} from '../src/expansion-content/zone1.ts'
import {
  createExpansionGame, resolveExpansionAction, validateEventCatalog,
  type ActionDefinition, type ExpansionEventDefinition, type ExpansionGameState,
} from '../src/expansion-engine.ts'
import { createSeededRandom, type RandomSource } from '../src/game.ts'

const catalog = JSON.parse(readFileSync(new URL('../docs/event-catalog.json', import.meta.url), 'utf8')) as {
  events: Array<{ id: string; zone: number; name: string; phase3Status: string; followUpEventIds: string[] }>
}
const designedZone1 = catalog.events.filter(event => event.zone === 1)
const fixedRandom: RandomSource = () => 0
const neutralOutcome = { text: 'テスト用の通過結果。', powerDelta: 0 }
const neutralAction = (id: string): ActionDefinition => ({
  id, label: id, detail: 'テスト用の選択肢', baseChance: 100,
  success: neutralOutcome, failure: neutralOutcome,
})
const fixture = (id: string, sourceId: string, condition: NonNullable<ExpansionEventDefinition['availableWhen']>): ExpansionEventDefinition => ({
  id, zone: 2, title: id, description: 'テストfixture。Phase 2本文イベントではありません。',
  availableWhen: condition,
  guarantee: { when: condition, priority: 10, reason: '対応する成功状態を検出したテストfixtureです。' },
  relatedEventIds: [sourceId],
  actions: [neutralAction('a'), neutralAction('b'), neutralAction('c')],
})
const followUps: readonly ExpansionEventDefinition[] = [
  fixture('test-followup-alarm-route', 'deep-alarm-map', { explanation: '記録した配線図のテスト。', all: [{ kind: 'facility', facilityId: 'alarm-route' }] }),
  fixture('test-followup-coolant-label', 'deep-coolant-label', { explanation: '控えた配管番号のテスト。', all: [{ kind: 'history-tag', tag: 'coolant-label' }] }),
  fixture('test-followup-service-key', 'deep-key-cache', { explanation: '保守鍵のテスト。', all: [{ kind: 'item', itemId: 'service-key' }] }),
  fixture('test-followup-shaft-brace', 'deep-shaft-wheel', { explanation: '安全爪のテスト。', all: [{ kind: 'facility', facilityId: 'shaft-braced' }] }),
  fixture('test-followup-signal-mark', 'deep-signal-foil', { explanation: '反射角のテスト。', all: [{ kind: 'facility', facilityId: 'signal-mark' }] }),
  fixture('test-followup-vent-map', 'deep-vent-sketch', { explanation: '換気模型のテスト。', all: [{ kind: 'history-tag', tag: 'vent-map' }] }),
  ...([
    ['momo', 'npc-momo-return'], ['nori', 'npc-nori-return'],
    ['goro', 'npc-goro-return'], ['chiri', 'npc-chiri-return'],
  ] as const).map(([npcId, id]) => fixture(id, `npc-${npcId}-first`, {
    explanation: '救出済みのNPCが再会に来ました。', all: [{ kind: 'npc-status' as const, npcId, status: 'rescued' as const }],
  })),
  {
    id: 'zone2-fallback-fixture', zone: 2, title: '通常経路fixture', description: 'Phase 3動作確認専用。',
    actions: [neutralAction('a'), neutralAction('b'), neutralAction('c')],
  },
]
const allTestEvents = [...ZONE1_EVENTS, ...followUps]

function atEvent(eventId: string): ExpansionGameState {
  const start = createExpansionGame(fixedRandom, 901, allTestEvents)
  const event = ZONE1_EVENTS.find(candidate => candidate.id === eventId)
  assert.ok(event)
  return {
    ...start, position: 20, currentEvent: { tile: 20, zone: 1, eventId, appearanceReason: 'content fixture' },
    usedEventIds: [...ZONE1_EVENTS.map(candidate => candidate.id)],
  }
}

function complete(eventId: string, actionIndex: number, roll: number): ExpansionGameState {
  const event = ZONE1_EVENTS.find(candidate => candidate.id === eventId)
  assert.ok(event)
  const current = atEvent(eventId)
  return resolveExpansionAction(current, actionIndex, roll, allTestEvents, fixedRandom)
}

test('zone 1 content exactly matches the Phase 2 roster and each event has three complete, distinct actions', () => {
  const actualIds = ZONE1_EVENTS.map(event => event.id)
  assert.deepEqual(actualIds, EXPECTED_ZONE1_EVENT_IDS)
  assert.deepEqual(actualIds, designedZone1.map(event => event.id))
  assert.equal(new Set(actualIds).size, 40)
  for (const event of ZONE1_EVENTS) {
    const design = designedZone1.find(candidate => candidate.id === event.id)!
    assert.equal(event.title, design.name, `name mismatch for ${event.id}`)
    assert.equal(event.zone, 1)
    assert.equal(event.actions.length, 3)
    assert.deepEqual(event.followUpEventIds ?? [], design.followUpEventIds)
    assert.deepEqual(event.actions.map(action => action.label), design.actionDirections, `Phase 2 action direction mismatch for ${event.id}`)
    assert.ok(event.description.trim())
    assert.ok(event.availableWhen?.explanation.trim())
    assert.equal(new Set(event.actions.map(action => action.id)).size, 3)
    for (const action of event.actions) {
      assert.ok(Number.isInteger(action.baseChance) && action.baseChance >= 0 && action.baseChance <= 100)
      assert.ok(action.label.trim() && action.detail.trim())
      assert.ok(action.success.text.trim() && action.failure.text.trim())
      assert.ok(Number.isInteger(action.success.powerDelta) && Number.isInteger(action.failure.powerDelta))
    }
  }
  const resultTexts = ZONE1_EVENTS.flatMap(event => event.actions.flatMap(action => [action.success.text, action.failure.text]))
  assert.equal(new Set(resultTexts).size, resultTexts.length, 'result narration must not be reused')
  validateEventCatalog(ZONE1_EVENTS)
})

test('Phase 2 state links are set only by the intended successful choices', () => {
  const keyFound = complete('deep-key-cache', 0, 0)
  const keyMissed = complete('deep-key-cache', 0, 99)
  assert.deepEqual(keyFound.inventory, ['service-key'])
  assert.equal(keyMissed.inventory.includes('service-key'), false)
  assert.equal(keyFound.pendingNextEvent?.eventId, 'test-followup-service-key')
  assert.equal(keyMissed.pendingNextEvent?.eventId, 'zone2-fallback-fixture')

  for (const [id, flag, actionIndex] of [
    ['deep-alarm-map', 'alarm-route', 0], ['deep-shaft-wheel', 'shaft-braced', 1], ['deep-signal-foil', 'signal-mark', 1],
  ] as const) {
    const success = complete(id, actionIndex, 0)
    const failure = complete(id, actionIndex, 99)
    assert.equal(success.facilities[flag], true, `${id} success must set ${flag}`)
    assert.equal(failure.facilities[flag], false, `${id} failure must not set ${flag}`)
  }
  for (const [id, tag, actionIndex] of [
    ['deep-coolant-label', 'coolant-label', 0], ['deep-vent-sketch', 'vent-map', 0],
  ] as const) {
    const success = complete(id, actionIndex, 0)
    const failure = complete(id, actionIndex, 99)
    assert.equal(success.history.at(-1)?.tags.includes(tag), true)
    assert.equal(failure.history.at(-1)?.tags.includes(tag), false)
  }
  const links = [
    ['deep-alarm-map', 'test-followup-alarm-route', 0], ['deep-coolant-label', 'test-followup-coolant-label', 0],
    ['deep-shaft-wheel', 'test-followup-shaft-brace', 1], ['deep-signal-foil', 'test-followup-signal-mark', 1],
    ['deep-vent-sketch', 'test-followup-vent-map', 0],
  ] as const
  for (const [id, followUpId, actionIndex] of links) {
    assert.equal(complete(id, actionIndex, 0).pendingNextEvent?.eventId, followUpId, `${id} should reach its test fixture`)
    assert.equal(complete(id, actionIndex, 99).pendingNextEvent?.eventId, 'zone2-fallback-fixture', `${id} failure should use the normal route`)
  }
})

test('zone 1 event draw keeps the same-seed behavior and never duplicates a choice in its first 20 tiles', () => {
  const first = createExpansionGame(createSeededRandom(314159), 314159, ZONE1_EVENTS)
  const second = createExpansionGame(createSeededRandom(314159), 314159, ZONE1_EVENTS)
  assert.equal(first.currentEvent.eventId, second.currentEvent.eventId)
  assert.equal(first.currentEvent.appearanceReason, second.currentEvent.appearanceReason)
  assert.ok(ZONE1_EVENTS.some(event => event.id === first.currentEvent.eventId))
})

test('NPC rescue, rescue failure, and leaving them are separate states; only rescued NPCs trigger reunion fixtures', () => {
  const npcEventIds = [
    ['momo', 'npc-momo-first'], ['nori', 'npc-nori-first'],
    ['goro', 'npc-goro-first'], ['chiri', 'npc-chiri-first'],
  ] as const
  for (const [npcId, firstId] of npcEventIds) {
    const reunited = complete(firstId, 0, 0)
    const failedRescue = complete(firstId, 0, 99)
    const leaveIndex = npcId === 'goro' ? 1 : 2
    const leftBehind = complete(firstId, leaveIndex, 0)
    assert.equal(reunited.npcStatuses[npcId], 'rescued')
    assert.equal(reunited.pendingNextEvent?.eventId, `npc-${npcId}-return`)
    assert.equal(failedRescue.npcStatuses[npcId], 'rescue-failed')
    assert.equal(failedRescue.pendingNextEvent?.eventId, 'zone2-fallback-fixture')
    assert.equal(leftBehind.npcStatuses[npcId], 'encountered')
    assert.equal(leftBehind.pendingNextEvent?.eventId, 'zone2-fallback-fixture')
  }
})

test('zone 1 statuses remain pending semantic review until a human review is recorded', () => {
  assert.ok(designedZone1.every(event => event.phase3Status === '要確認'))
})
