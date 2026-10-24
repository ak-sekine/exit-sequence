/**
 * Data driven engine for the planned 100 tile game. This is intentionally not
 * wired into main.ts until the full 200 event roster and UI are ready.
 */
import { createSeededRandom, type RandomSource } from './game.ts'

export const EXPANSION_TOTAL_TILES = 100
export const EXPANSION_TILES_PER_ZONE = 20
export const EXPANSION_ZONE_COUNT = 5
export const EXPANSION_INITIAL_POWER = 20
export const EXPANSION_MAX_POWER = 20
export const DEFAULT_INVENTORY_CAPACITY = 3

export type ZoneId = 1 | 2 | 3 | 4 | 5
export type ItemId = 'service-key' | 'copper-fuse'
export type FacilityId = 'aux-power' | 'alarm-disabled' | 'lift-powered' | 'safety-rail' | 'alarm-route' | 'shaft-braced' | 'signal-mark' | 'coolant-diverted' | 'ventilation-shutter'
export type NpcId = 'momo' | 'nori' | 'goro' | 'chiri' | 'kabo' | 'pico'
export type NpcStatus = 'unmet' | 'encountered' | 'rescued' | 'rescue-failed' | 'repaid'
export type ItemHistoryKind = 'acquired' | 'used' | 'consumed' | 'already-held' | 'capacity-full'

export interface Predicate {
  readonly all?: readonly Condition[]
  /** Short player-facing reason shown when this predicate affects play. */
  readonly explanation: string
}

export type Condition =
  | { readonly kind: 'item'; readonly itemId: ItemId; readonly present?: boolean }
  | { readonly kind: 'facility'; readonly facilityId: FacilityId; readonly active?: boolean }
  | { readonly kind: 'npc-status'; readonly npcId: NpcId; readonly status: NpcStatus }
  | { readonly kind: 'history-tag'; readonly tag: string }

export interface OutcomeDefinition {
  readonly text: string
  readonly powerDelta: number
  readonly items?: readonly ItemId[]
  readonly facilities?: Partial<Record<FacilityId, boolean>>
  readonly npcStatuses?: Partial<Record<NpcId, NpcStatus>>
  readonly historyTags?: readonly string[]
}

export interface ProbabilityRule {
  readonly when: Predicate
  readonly percent: number
  readonly reason: string
}

export interface ActionDefinition {
  readonly id: string
  readonly label: string
  readonly detail: string
  readonly baseChance: number
  readonly chanceRules?: readonly ProbabilityRule[]
  /** An optional item boosts the action when held; it never blocks the normal route. */
  readonly useItem?: { readonly itemId: ItemId; readonly consume?: 'attempt' | 'success' | 'failure' | 'never' }
  readonly success: OutcomeDefinition
  readonly failure: OutcomeDefinition
}

export interface ExpansionEventDefinition {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly zone: ZoneId
  readonly availableWhen?: Predicate
  /** Guaranteed events are excluded from ordinary draws and reserved for their zone. */
  readonly guarantee?: { readonly when: Predicate; readonly priority: number; readonly reason: string }
  readonly actions: readonly [ActionDefinition, ActionDefinition, ActionDefinition]
  readonly illustration?: string
  readonly relatedEventIds?: readonly string[]
  /** Phase 2 links that this event can establish for later zones. Metadata only. */
  readonly followUpEventIds?: readonly string[]
}

export interface ItemHistoryEntry {
  readonly kind: ItemHistoryKind
  readonly itemId: ItemId
  readonly eventId: string
  readonly tile: number
}

export interface ExpansionHistoryEntry {
  readonly tile: number
  readonly zone: ZoneId
  readonly eventId: string
  readonly actionId: string
  readonly success: boolean
  readonly rollValue: number
  readonly successChance: number
  readonly chanceReason: string
  readonly text: string
  readonly powerBefore: number
  readonly powerAfter: number
  readonly powerChange: number
  readonly consequenceText: readonly string[]
  readonly tags: readonly string[]
}

export interface ExpansionEncounter {
  readonly tile: number
  readonly zone: ZoneId
  readonly eventId: string
  readonly appearanceReason: string
}

export interface ExpansionGameState {
  readonly seed: number
  readonly position: number
  readonly power: number
  readonly status: 'playing' | 'won' | 'lost'
  readonly currentEvent: ExpansionEncounter
  readonly pendingNextEvent: ExpansionEncounter | null
  readonly history: readonly ExpansionHistoryEntry[]
  readonly usedEventIds: readonly string[]
  readonly inventory: readonly ItemId[]
  readonly facilities: Readonly<Record<FacilityId, boolean>>
  readonly npcStatuses: Readonly<Record<NpcId, NpcStatus>>
  readonly itemHistory: readonly ItemHistoryEntry[]
  readonly inventoryCapacity: number
}

export interface ActionView extends ActionDefinition {
  readonly successChance: number
  readonly chanceReason: string
}

export interface ExpansionGameView {
  readonly position: number
  readonly totalTiles: number
  readonly zone: ZoneId
  readonly power: number
  readonly status: ExpansionGameState['status']
  readonly currentEvent: {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly appearanceReason: string
    readonly illustration?: string
    readonly actions: readonly ActionView[]
  }
  readonly inventory: readonly ItemId[]
  readonly facilities: Readonly<Record<FacilityId, boolean>>
  readonly npcStatuses: Readonly<Record<NpcId, NpcStatus>>
  readonly history: readonly ExpansionHistoryEntry[]
  readonly itemHistory: readonly ItemHistoryEntry[]
  readonly lastResult: ExpansionHistoryEntry | null
}

export const ITEMS: Readonly<Record<ItemId, { readonly name: string; readonly reusable: boolean }>> = {
  'service-key': { name: '廃棄区画の保守鍵', reusable: false },
  'copper-fuse': { name: '銅線ヒューズ', reusable: false },
}

export const FACILITIES: Readonly<Record<FacilityId, string>> = {
  'aux-power': '予備電源', 'alarm-disabled': '警報リレー', 'lift-powered': '昇降機電源',
  'safety-rail': '安全手すり', 'alarm-route': '警報線図', 'shaft-braced': '点検シャフト安全爪',
  'signal-mark': '外壁信号反射角', 'coolant-diverted': '冷却水分岐',
  'ventilation-shutter': '換気シャッター',
}

export const NPCS: Readonly<Record<NpcId, { readonly name: string; readonly appearance: string; readonly personality: string; readonly voice: string }>> = {
  momo: { name: 'モモ', appearance: '片耳のように曲がったアンテナと丸い作業アーム', personality: '心配性だが親切', voice: '語尾に「かも」を付けて小声で話す' },
  nori: { name: 'ノリ', appearance: '長い測距棒と額の水平器', personality: '怖がりだが几帳面', voice: '距離と「たぶん」を小声で添える' },
  goro: { name: 'ゴロ', appearance: '大きな運搬コンテナを頭にかぶる癖', personality: 'おしゃべりで陽気', voice: '大声で短い擬音を交える' },
  chiri: { name: 'チリ', appearance: '曲がったブラシを大事にする小型清掃ロボ', personality: '働き者で約束を守る', voice: '明るく「さっぱり」と言う' },
  kabo: { name: 'カボ', appearance: '緩衝材の山に埋まるほど大柄な梱包係ロボ', personality: '心配性だが梱包手順に詳しい', voice: '箱の中から慎重に短く返事をする' },
  pico: { name: 'ピコ', appearance: '小さな札貼りアームを持つ仕分けロボ', personality: '几帳面だが自分の名前札を貼りがち', voice: '札の番号を読み上げながら話す' },
}

const EMPTY_FACILITIES: Readonly<Record<FacilityId, boolean>> = {
  'aux-power': false, 'alarm-disabled': false, 'lift-powered': false, 'safety-rail': false,
  'alarm-route': false, 'shaft-braced': false, 'signal-mark': false,
  'coolant-diverted': false, 'ventilation-shutter': false,
}
const EMPTY_NPCS: Readonly<Record<NpcId, NpcStatus>> = { momo: 'unmet', nori: 'unmet', goro: 'unmet', chiri: 'unmet', kabo: 'unmet', pico: 'unmet' }

export function expansionZoneForTile(tile: number): ZoneId {
  if (!Number.isInteger(tile) || tile < 1 || tile > EXPANSION_TOTAL_TILES) throw new RangeError(`Invalid 100 tile position: ${tile}`)
  return (Math.floor((tile - 1) / EXPANSION_TILES_PER_ZONE) + 1) as ZoneId
}

function matches(state: ExpansionGameState, predicate?: Predicate): boolean {
  if (!predicate) return true
  return (predicate.all ?? []).every(condition => {
    switch (condition.kind) {
      case 'item': return state.inventory.includes(condition.itemId) === (condition.present ?? true)
      case 'facility': return state.facilities[condition.facilityId] === (condition.active ?? true)
      case 'npc-status': return state.npcStatuses[condition.npcId] === condition.status
      case 'history-tag': return state.history.some(entry => entry.tags.includes(condition.tag))
    }
  })
}

export function validateEventCatalog(events: readonly ExpansionEventDefinition[], options: { minimumPerZone?: number } = {}): void {
  const ids = new Set<string>()
  const byZone = new Map<ZoneId, number>([[1, 0], [2, 0], [3, 0], [4, 0], [5, 0]])
  const validatePredicate = (predicate: Predicate | undefined, owner: string): void => {
    if (predicate && !predicate.explanation.trim()) throw new Error(`Condition needs a player-facing explanation in ${owner}`)
    for (const condition of predicate?.all ?? []) {
      if (condition.kind === 'item' && !(condition.itemId in ITEMS)) throw new Error(`Unknown item ${condition.itemId} in ${owner}`)
      if (condition.kind === 'facility' && !(condition.facilityId in EMPTY_FACILITIES)) throw new Error(`Unknown facility ${condition.facilityId} in ${owner}`)
      if (condition.kind === 'npc-status' && (!(condition.npcId in NPCS) || !(['unmet', 'encountered', 'rescued', 'rescue-failed', 'repaid'] as string[]).includes(condition.status))) {
        throw new Error(`Unknown NPC or status in ${owner}`)
      }
      if (condition.kind === 'history-tag' && !condition.tag.trim()) throw new Error(`Empty history tag in ${owner}`)
      if (!(condition.kind === 'item' || condition.kind === 'facility' || condition.kind === 'npc-status' || condition.kind === 'history-tag')) {
        throw new Error(`Unknown condition kind in ${owner}`)
      }
    }
  }
  const validateOutcome = (outcome: OutcomeDefinition, owner: string): void => {
    if (!outcome.text.trim() || !Number.isInteger(outcome.powerDelta)) throw new Error(`Outcome needs result text and an integer power delta in ${owner}`)
    for (const itemId of outcome.items ?? []) if (!(itemId in ITEMS)) throw new Error(`Unknown item ${itemId} in ${owner}`)
    for (const facilityId of Object.keys(outcome.facilities ?? {})) if (!(facilityId in EMPTY_FACILITIES)) throw new Error(`Unknown facility ${facilityId} in ${owner}`)
    for (const [npcId, status] of Object.entries(outcome.npcStatuses ?? {})) {
      if (!(npcId in NPCS) || !(['unmet', 'encountered', 'rescued', 'rescue-failed', 'repaid'] as string[]).includes(status)) throw new Error(`Unknown NPC or status in ${owner}`)
    }
  }
  for (const event of events) {
    if (!event.id.trim() || ids.has(event.id)) throw new Error(`Duplicate or empty event ID: ${event.id}`)
    if (![1, 2, 3, 4, 5].includes(event.zone)) throw new Error(`Invalid zone for event ${event.id}`)
    ids.add(event.id)
    byZone.set(event.zone, byZone.get(event.zone)! + 1)
    if (!event.title.trim() || !event.description.trim()) throw new Error(`Event ${event.id} needs a title and description`)
    if (event.actions.length !== 3 || new Set(event.actions.map(action => action.id)).size !== 3) throw new Error(`Event ${event.id} must define three uniquely named actions`)
    if (event.guarantee && (!Number.isFinite(event.guarantee.priority) || !event.guarantee.reason.trim())) throw new Error(`Invalid guarantee definition for ${event.id}`)
    validatePredicate(event.availableWhen, event.id)
    validatePredicate(event.guarantee?.when, event.id)
    for (const action of event.actions) {
      if (!action.id.trim() || !action.label.trim() || !action.detail.trim()) throw new Error(`Action ${event.id}/${action.id} needs an ID, label, and detail`)
      if (!Number.isInteger(action.baseChance) || action.baseChance < 0 || action.baseChance > 100) throw new Error(`Invalid base chance for ${event.id}/${action.id}`)
      if (action.useItem && !(action.useItem.itemId in ITEMS)) throw new Error(`Unknown item ${action.useItem.itemId} in ${event.id}/${action.id}`)
      if (action.useItem?.consume && !(['attempt', 'success', 'failure', 'never'] as string[]).includes(action.useItem.consume)) throw new Error(`Invalid item consumption rule for ${event.id}/${action.id}`)
      validateOutcome(action.success, `${event.id}/${action.id}/success`)
      validateOutcome(action.failure, `${event.id}/${action.id}/failure`)
      for (const rule of action.chanceRules ?? []) {
        if (!Number.isInteger(rule.percent) || rule.percent < 0 || rule.percent > 100) throw new Error(`Invalid conditional chance for ${event.id}/${action.id}`)
        if (!rule.reason.trim()) throw new Error(`Conditional chance needs a reason for ${event.id}/${action.id}`)
        validatePredicate(rule.when, `${event.id}/${action.id}`)
      }
    }
    for (const relatedId of event.relatedEventIds ?? []) if (relatedId === event.id) throw new Error(`Event ${event.id} cannot relate to itself`)
  }
  for (const event of events) {
    for (const relatedId of event.relatedEventIds ?? []) if (!ids.has(relatedId)) throw new Error(`Unknown related event ${relatedId} from ${event.id}`)
  }
  if (options.minimumPerZone !== undefined) {
    for (const [zone, count] of byZone) {
      if (count < options.minimumPerZone) throw new Error(`Zone ${zone} has ${count} candidates; needs at least ${options.minimumPerZone}`)
    }
  }
  for (const zone of [1, 2, 3, 4, 5] as const) {
    const guaranteed = events.filter(event => event.zone === zone && event.guarantee).length
    if (guaranteed > EXPANSION_TILES_PER_ZONE) throw new Error(`Zone ${zone} reserves ${guaranteed} guaranteed events for only ${EXPANSION_TILES_PER_ZONE} tiles`)
  }
}

function pickEncounter(state: ExpansionGameState, events: readonly ExpansionEventDefinition[], random: RandomSource): ExpansionEncounter {
  const tile = state.position + 1
  const zone = expansionZoneForTile(tile)
  const unused = events.filter(event => event.zone === zone && !state.usedEventIds.includes(event.id))
  const dueGuarantees = unused
    .filter(event => event.guarantee && matches(state, event.guarantee.when))
    .sort((a, b) => b.guarantee!.priority - a.guarantee!.priority || a.id.localeCompare(b.id))
  const guaranteed = dueGuarantees[0]
  if (guaranteed) {
    if (!matches(state, guaranteed.availableWhen)) throw new Error(`Guarantee condition conflicts with availability condition for ${guaranteed.id}`)
    return { tile, zone, eventId: guaranteed.id, appearanceReason: guaranteed.guarantee!.reason }
  }
  const eligible = unused.filter(event => !event.guarantee && matches(state, event.availableWhen))
  if (eligible.length === 0) {
    const due = dueGuarantees.map(event => event.id).join(', ')
    throw new Error(`No unused eligible events for zone ${zone}, tile ${tile}${due ? ` (blocked guarantees: ${due})` : ''}`)
  }
  const value = random()
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('RandomSource must return a number in [0, 1)')
  const chosen = eligible[Math.floor(value * eligible.length)]!
  const conditionReason = chosen.availableWhen && matches(state, chosen.availableWhen) ? chosen.availableWhen.explanation : ''
  return { tile, zone, eventId: chosen.id, appearanceReason: conditionReason || 'この区画の候補から抽選されました。' }
}

export function createExpansionGame(
  random: RandomSource,
  seed: number,
  events: readonly ExpansionEventDefinition[],
  options: { inventoryCapacity?: number } = {},
): ExpansionGameState {
  validateEventCatalog(events)
  const inventoryCapacity = options.inventoryCapacity ?? DEFAULT_INVENTORY_CAPACITY
  if (!Number.isInteger(inventoryCapacity) || inventoryCapacity < 0) throw new RangeError('Inventory capacity must be a non-negative integer')
  const initial = {
    seed: seed >>> 0, position: 1, power: EXPANSION_INITIAL_POWER, status: 'playing' as const,
    currentEvent: { tile: 1, zone: 1 as const, eventId: '', appearanceReason: '探索を始めます。' },
    pendingNextEvent: null, history: [], usedEventIds: [], inventory: [],
    facilities: { ...EMPTY_FACILITIES }, npcStatuses: { ...EMPTY_NPCS }, itemHistory: [], inventoryCapacity,
  }
  const encounter = pickEncounter(initial, events, random)
  return { ...initial, currentEvent: encounter, usedEventIds: [encounter.eventId] }
}

export function successChanceFor(state: ExpansionGameState, action: ActionDefinition): { percent: number; reason: string } {
  for (const rule of action.chanceRules ?? []) if (matches(state, rule.when)) return { percent: rule.percent, reason: rule.reason }
  return { percent: action.baseChance, reason: `基本成功率 ${action.baseChance}%` }
}

function adjustPower(power: number, delta: number): number { return Math.max(0, Math.min(EXPANSION_MAX_POWER, power + delta)) }

export function resolveExpansionAction(
  state: ExpansionGameState,
  actionIndex: number,
  rollValue: number,
  events: readonly ExpansionEventDefinition[],
  random: RandomSource,
): ExpansionGameState {
  if (state.status !== 'playing' || state.pendingNextEvent) return state
  const event = events.find(candidate => candidate.id === state.currentEvent.eventId)
  if (!event) throw new Error(`Unknown event: ${state.currentEvent.eventId}`)
  const action = event.actions[actionIndex]
  if (!action) return state
  if (!Number.isInteger(rollValue) || rollValue < 0 || rollValue > 99) throw new RangeError('Slot roll must be an integer in [0, 99]')
  const chance = successChanceFor(state, action)
  const success = rollValue < chance.percent
  const outcome = success ? action.success : action.failure
  const itemHistory = [...state.itemHistory]
  let inventory = [...state.inventory]
  const consequenceText: string[] = []

  if (action.useItem && inventory.includes(action.useItem.itemId)) {
    const { itemId } = action.useItem
    const consumeWhen = action.useItem.consume ?? (ITEMS[itemId].reusable ? 'never' : 'attempt')
    const consume = consumeWhen === 'attempt' || (consumeWhen === 'success' && success) || (consumeWhen === 'failure' && !success)
    itemHistory.push({ kind: 'used', itemId, eventId: event.id, tile: state.position })
    consequenceText.push(`${ITEMS[itemId].name}を使用したため、成功率は${chance.percent}%です。`)
    if (consume) {
      inventory = inventory.filter(id => id !== itemId)
      itemHistory.push({ kind: 'consumed', itemId, eventId: event.id, tile: state.position })
      consequenceText.push(`${ITEMS[itemId].name}を使い切りました。`)
    }
  }

  for (const itemId of outcome.items ?? []) {
    if (inventory.includes(itemId)) {
      itemHistory.push({ kind: 'already-held', itemId, eventId: event.id, tile: state.position })
      consequenceText.push(`${ITEMS[itemId].name}はすでに持っています。`)
    } else if (inventory.length >= state.inventoryCapacity) {
      itemHistory.push({ kind: 'capacity-full', itemId, eventId: event.id, tile: state.position })
      consequenceText.push(`所持上限${state.inventoryCapacity}個のため、${ITEMS[itemId].name}は持ち帰れませんでした。`)
    } else {
      inventory.push(itemId)
      itemHistory.push({ kind: 'acquired', itemId, eventId: event.id, tile: state.position })
      consequenceText.push(`${ITEMS[itemId].name}を入手しました。`)
    }
  }

  const facilities = { ...state.facilities, ...outcome.facilities }
  for (const [facilityId, active] of Object.entries(outcome.facilities ?? {}) as [FacilityId, boolean][]) {
    consequenceText.push(`${FACILITIES[facilityId]}を${active ? '復旧' : '停止'}しました。`)
  }
  const npcStatuses = { ...state.npcStatuses, ...outcome.npcStatuses }
  for (const [npcId, status] of Object.entries(outcome.npcStatuses ?? {}) as [NpcId, NpcStatus][]) {
    consequenceText.push(`${NPCS[npcId].name}の状態: ${status}。`)
  }
  const powerAfter = adjustPower(state.power, outcome.powerDelta)
  const result: ExpansionHistoryEntry = {
    tile: state.position, zone: event.zone, eventId: event.id, actionId: action.id, success, rollValue,
    successChance: chance.percent, chanceReason: chance.reason, text: outcome.text,
    powerBefore: state.power, powerAfter, powerChange: powerAfter - state.power,
    consequenceText, tags: outcome.historyTags ?? [],
  }
  const history = [...state.history, result]
  if (powerAfter === 0) return { ...state, power: 0, status: 'lost', history, inventory, facilities, npcStatuses, itemHistory }
  if (state.position === EXPANSION_TOTAL_TILES) return { ...state, power: powerAfter, status: 'won', history, inventory, facilities, npcStatuses, itemHistory }
  const reserved = pickEncounter({ ...state, history, inventory, facilities, npcStatuses }, events, random)
  return { ...state, power: powerAfter, history, inventory, facilities, npcStatuses, itemHistory,
    usedEventIds: [...state.usedEventIds, reserved.eventId], pendingNextEvent: reserved }
}

/** Effects are committed by resolveExpansionAction; progression waits here for the player. */
export function continueExpansionAfterResult(state: ExpansionGameState): ExpansionGameState {
  if (state.status !== 'playing' || !state.pendingNextEvent) return state
  return { ...state, position: state.pendingNextEvent.tile, currentEvent: state.pendingNextEvent, pendingNextEvent: null }
}

export function toExpansionGameView(state: ExpansionGameState, events: readonly ExpansionEventDefinition[]): ExpansionGameView {
  const event = events.find(candidate => candidate.id === state.currentEvent.eventId)
  if (!event) throw new Error(`Unknown event: ${state.currentEvent.eventId}`)
  return {
    position: state.position, totalTiles: EXPANSION_TOTAL_TILES, zone: state.currentEvent.zone,
    power: state.power, status: state.status,
    currentEvent: {
      id: event.id, title: event.title, description: event.description,
      appearanceReason: state.currentEvent.appearanceReason, illustration: event.illustration,
      actions: event.actions.map(action => {
        const chance = successChanceFor(state, action)
        return { ...action, successChance: chance.percent, chanceReason: chance.reason }
      }),
    },
    inventory: [...state.inventory], facilities: { ...state.facilities }, npcStatuses: { ...state.npcStatuses },
    history: [...state.history], itemHistory: [...state.itemHistory], lastResult: state.history.at(-1) ?? null,
  }
}

const predicate = (explanation: string, ...all: Condition[]): Predicate => ({ explanation, all })
const action = (
  id: string, label: string, detail: string, baseChance: number,
  success: OutcomeDefinition, failure: OutcomeDefinition,
  extras: Pick<ActionDefinition, 'chanceRules' | 'useItem'> = {},
): ActionDefinition => ({ id, label, detail, baseChance, success, failure, ...extras })

/** Small development catalog only. It is not counted toward the final 200 events. */
export const EXPANSION_SAMPLE_EVENTS: readonly ExpansionEventDefinition[] = [
  {
    id: 'prototype-key-cache', title: '工具箱の奥の鍵', zone: 1,
    description: 'ひっくり返った工具箱を見つけた。小さな鍵が見える。ぼくの手、届くかな？',
    actions: [
      action('sort-carefully', '中身を仕分ける', '散らかった工具から鍵を探す', 75,
        { text: '鍵を発見！ ぼくの鑑定眼、今日は虫眼鏡いらず。', powerDelta: -1, items: ['service-key'], historyTags: ['key-found'] },
        { text: '工具箱の中身が雪崩れた。鍵は見つからないけど、通路は空いた。', powerDelta: -2 }),
      action('shake-box', '箱をそっと振る', '音を頼りに中身を探す', 54,
        { text: 'カラン！ 鍵が出てきた。箱も満足そうな音だ。', powerDelta: -1, items: ['service-key'], historyTags: ['key-found'] },
        { text: '箱の音で自分がびっくり。鍵は後回しにしよう。', powerDelta: -1 }),
      action('take-scrap', '手近な部品だけ拾う', '工具箱には深入りしない', 88,
        { text: '使えそうな部品を拾った気分。鍵は残して通路を進む。', powerDelta: 1 },
        { text: '部品は固着していた。欲張らず通路を進もう。', powerDelta: -1 }),
    ],
  },
  {
    id: 'prototype-key-hatch', title: '鍵穴のある保守ハッチ', zone: 2,
    description: '頑丈なハッチが通路をふさいでいる。保守用の鍵穴があるけれど、別の通り道も見つけられそうだ。',
    availableWhen: predicate('前の区画で保守鍵を見つけたため、このハッチが見つかりました。', { kind: 'item', itemId: 'service-key' }),
    guarantee: {
      when: predicate('保守鍵を所持しているため、ここでハッチを確実に見つけます。', { kind: 'item', itemId: 'service-key' }),
      priority: 10, reason: '前の区画で保守鍵を見つけたため、鍵穴のあるハッチが現れました。',
    },
    relatedEventIds: ['prototype-key-cache'],
    actions: [
      action('unlock', '保守鍵で開ける', '鍵を使い、内部の手回し機構を解放する', 57,
        { text: '鍵がぴたり！ ハッチの向こうに通路が続いている。', powerDelta: -1 },
        { text: '錠前が固くて回らない。鍵を持ったまま、脇の通路へ回ろう。', powerDelta: -2 },
        { chanceRules: [{ when: predicate('保守鍵を持っているため、錠前を確実に開けられます。', { kind: 'item', itemId: 'service-key' }), percent: 100, reason: '保守鍵を所持しているため 100%' }], useItem: { itemId: 'service-key', consume: 'attempt' } }),
      action('climb-over', '上の配管を越える', 'ハッチを使わず通過する', 66,
        { text: '配管の上を越えた。頭をぶつけずに済んだ、えらい！', powerDelta: -2 },
        { text: '配管は熱くて長居できない。脇へ降りて別の道を探そう。', powerDelta: -3 }),
      action('find-detour', '標識から迂回路を探す', '時間をかけて安全な道を探す', 82,
        { text: '床の矢印を発見。これを書いたロボット、字がきれいだ。', powerDelta: -2 },
        { text: '矢印は壁に向いていた。標識担当さん、あとで会議です。', powerDelta: -2 }),
    ],
  },
  {
    id: 'prototype-aux-switch', title: '予備電源の切替器', zone: 2,
    description: '休眠した切替器を発見。設備へ給電できれば、先の昇降機も動くかもしれない。',
    actions: [
      action('restore-aux', '端子をつなぎ直す', '配線を整えて予備系統を復旧する', 58,
        { text: '予備電源が復旧！ 奥の設備へランプが点いた。', powerDelta: -1, facilities: { 'aux-power': true }, historyTags: ['aux-power-restored'] },
        { text: '配線が熱を持った。無理はやめて、電源なしの道を探そう。', powerDelta: -3 }),
      action('salvage-fuse', 'ヒューズを回収する', '安全そうな部品だけ外す', 72,
        { text: '銅線ヒューズを回収。小さいけれど、役に立ちそう！', powerDelta: -1, items: ['copper-fuse'] },
        { text: 'ヒューズは端子に固着。切替器から手を離そう。', powerDelta: -2 }),
      action('leave-switch', '触らず通り過ぎる', '別の通路を探す', 94,
        { text: '設備をそっとして通れる足場を見つけた。', powerDelta: -1 },
        { text: '足場探しに少し時間がかかった。別の出口もありそうだ。', powerDelta: -2 }),
    ],
  },
  {
    id: 'prototype-powered-lift', title: '灯りの戻った昇降機', zone: 4,
    description: '停止中の昇降機だ。電源盤の状態を確かめよう。',
    availableWhen: predicate('以前に予備電源を復旧したため、昇降機の制御盤が起動しています。', { kind: 'facility', facilityId: 'aux-power' }),
    guarantee: {
      when: predicate('予備電源が復旧済みなので、この区画で昇降機を見つけます。', { kind: 'facility', facilityId: 'aux-power' }),
      priority: 10, reason: '以前、予備電源を復旧したため、昇降機の制御盤が起動しています。',
    },
    relatedEventIds: ['prototype-aux-switch'],
    actions: [
      action('ride-lift', '制御盤を起動する', '通電した昇降機で上階へ進む', 71,
        { text: '昇降機がすぐ動いた！ 移動中は立っているだけでいい。', powerDelta: 0 },
        { text: '昇降機が安全点検で止まった。横の階段から進もう。', powerDelta: -2 },
        { chanceRules: [{ when: predicate('予備電源を復旧しているため、昇降機は確実に動きます。', { kind: 'facility', facilityId: 'aux-power' }), percent: 100, reason: '予備電源の復旧済み設備があるため 100%' }] }),
      action('climb-stairs', '保守階段を登る', '昇降機を使わずに進む', 78,
        { text: '階段を登り切った。踊り場の手すりにお礼を言っておいた。', powerDelta: -2 },
        { text: '段差でつまずいた。手すりを使い、ゆっくり進み直そう。', powerDelta: -3 }),
      action('inspect-panel', '制御盤を調べる', '安全表示を確認する', 86,
        { text: '点検記録を読めた。危険な動かし方を避けて通れそう。', powerDelta: -1 },
        { text: '表示が古くて読めない。階段の方が分かりやすそうだ。', powerDelta: -1 }),
    ],
  },
  {
    id: 'prototype-momo-rescue', title: '整備ロボットのモモ', zone: 1,
    description: '倒れた小型ロボットが工具棚に挟まっている。曲がったアンテナが、弱々しく点滅した。',
    actions: [
      action('free-momo', '棚を持ち上げて救出', '支えを作って安全に引き出す', 62,
        { text: 'モモを救出！「たすかったかも……ありがとう」と小さな声がした。', powerDelta: -2, npcStatuses: { momo: 'rescued' }, historyTags: ['momo-rescued'] },
        { text: '棚がびくともしない。モモに「別の道を探すね」と約束した。', powerDelta: -3, npcStatuses: { momo: 'rescue-failed' }, historyTags: ['momo-rescue-failed'] }),
      action('stabilize-shelf', '棚を固定してから助ける', '工具で棚の傾きを止める', 74,
        { text: '棚を固定できた！ モモは自分で這い出し「助かったかも」と笑った。', powerDelta: -2, npcStatuses: { momo: 'rescued' }, historyTags: ['momo-rescued'] },
        { text: '固定具が折れた。モモはまだ棚の下だが、別経路へ進める。', powerDelta: -3, npcStatuses: { momo: 'rescue-failed' }, historyTags: ['momo-rescue-failed'] }),
      action('leave-supplies', '近くに工具を置いていく', '危険を避けて助けを残す', 91,
        { text: '工具を手の届く場所へ置いた。救出はできないけど、モモは使えそうだと頷いた。', powerDelta: -1, npcStatuses: { momo: 'encountered' } },
        { text: '工具棚が揺れて近づけない。安全な迂回路を探そう。', powerDelta: -1, npcStatuses: { momo: 'rescue-failed' } }),
    ],
  },
  {
    id: 'prototype-momo-thanks', title: '帰り道のモモ', zone: 5,
    description: '上層の通路で、曲がったアンテナのロボットが手を振っている。',
    availableWhen: predicate('前に救出したモモが、この区画まで来ています。', { kind: 'npc-status', npcId: 'momo', status: 'rescued' }),
    guarantee: {
      when: predicate('モモを救出していたため、再会イベントが発生します。', { kind: 'npc-status', npcId: 'momo', status: 'rescued' }),
      priority: 20, reason: '工具棚から救出したモモが追いつき、恩返しに来ました。',
    },
    relatedEventIds: ['prototype-momo-rescue'],
    actions: [
      action('accept-help', 'モモの案内を受ける', '覚えていてくれた近道を教わる', 68,
        { text: '「あのとき助けてもらったかも。今度はぼくが案内するね」とモモが先を照らした。', powerDelta: 2, npcStatuses: { momo: 'repaid' }, historyTags: ['momo-repaid'] },
        { text: 'モモの地図が上下逆だった！ それでも一緒なら道は見つかる。', powerDelta: -1, npcStatuses: { momo: 'repaid' }, historyTags: ['momo-repaid'] }),
      action('share-charge', '少し充電を分ける', '再会のお礼に電力を分け合う', 78,
        { text: 'モモと電力を分け合った。お礼の気持ちは満タンだ！', powerDelta: -1, npcStatuses: { momo: 'repaid' } },
        { text: '充電端子が合わなかった。笑って手を振り、先へ進もう。', powerDelta: -1, npcStatuses: { momo: 'repaid' } }),
      action('ask-directions', '出口の方向を聞く', '地上への道を教えてもらう', 89,
        { text: 'モモが出口を指さした。「あっちかも！」 ぼくたちは一緒に進む。', powerDelta: 0, npcStatuses: { momo: 'repaid' } },
        { text: '指さした先は清掃倉庫だった。出口探しは続くけど、心強い。', powerDelta: -1, npcStatuses: { momo: 'repaid' } }),
    ],
  },
]

export function createSeededExpansionGame(seed: number, events: readonly ExpansionEventDefinition[] = EXPANSION_SAMPLE_EVENTS): ExpansionGameState {
  return createExpansionGame(createSeededRandom(seed), seed, events)
}
