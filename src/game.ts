import { t, roomName, itemName, facilityName } from './i18n.ts'
import type { Language } from './i18n.ts'
import { costs, edgeKey, edges, neighbors, rooms, initialKnowledge, passable, distance, direction, knownRoom, cellCode, baseMapLines, coordinates } from './map.ts'
import type { Passage, Room, Knowledge } from './map.ts'
import { itemSpecs, escapeItems, placements, facilities } from './items.ts'
import type { ItemId, Facility, Installation } from './items.ts'
export type Random = () => number
export type Action =
  | { type: 'move'; target: Room }
  | { type: 'retreat'; target: Room }
  | { type: 'collect'; item: ItemId }
  | { type: 'camera'; fixed?: boolean }
  | { type: 'use'; item: ItemId; target?: Room; edge?: string; closed?: boolean }
  | { type: 'install'; item: Installation['item']; edge?: string }
  | { type: 'activate'; id: number; closed?: boolean }
  | { type: 'facility'; facility: Facility; target?: Room; edge?: string; closed?: boolean }
  | { type: 'self-lure' }
  | { type: 'wait' }
  | { type: 'give-up' }
export type Feed = { enemy: Room; passages: Record<string, Passage>; turn: number }
export type Prediction = { current: Room; next: Room; turn: number }
export interface State {
  location: Room; energy: number; maxEnergy: number; turn: number
  passages: Record<string, Passage>; enemy: Room; robotNext: Room
  knowledge: Record<Room, Knowledge>; knownEdges: string[]
  items: ItemId[]; ground: Partial<Record<Room, ItemId[]>>; installations: Installation[]
  feed: Feed | null; prediction: Prediction | null
  lure: { target: Room; remaining: number } | null
  bulkheads: Record<string, { restoresAt: number; previous: Passage }>
  chargerUsed: boolean; retreatUsed: boolean
  status: 'playing' | 'over' | 'clear'; encounter: boolean
}
export class Game {
  state!: State
  private random: Random
  constructor(random: Random = Math.random) { this.random = random; this.restart() }
  private pick<T>(values: readonly T[]): T { return values[Math.min(values.length - 1, Math.floor(this.random() * values.length))]! }
  restart() {
    this.state = {
      location: '居住', energy: 40, maxEnergy: 40, turn: 0,
      passages: Object.fromEntries(edges.map(([a, b]) => [edgeKey(a, b), 'NORMAL'])),
      enemy: this.pick(['研究', '資材', '通信'] as const), robotNext: '研究',
      knowledge: initialKnowledge(), knownEdges: neighbors('居住').map(room => edgeKey('居住', room)),
      items: ['predictor', 'short-decoy', 'local-key'], ground: structuredClone(placements) as State['ground'], installations: [],
      feed: null, prediction: null, lure: null, bulkheads: {}, chargerUsed: false, retreatUsed: false,
      status: 'playing', encounter: false,
    }
    // Fixed dark passages add cost choices without random topology failures.
    this.state.passages[edgeKey('観測', '中継')] = 'DARK'
    this.state.passages[edgeKey('計測', '資材')] = 'DARK'
    this.state.robotNext = this.nextRobot()
  }
  passage(a: Room, b: Room) { return this.state.passages[edgeKey(a, b)] }
  available(room: Room) { return neighbors(room).filter(next => passable(this.passage(room, next))) }
  connected() { return rooms.every(room => this.pathDistance(this.state.location, room) !== Infinity) }
  private pathDistance(from: Room, to: Room) {
    const distances = new Map<Room, number>([[from, 0]]), queue = [from]
    for (const room of queue) {
      if (room === to) return distances.get(room)!
      for (const next of this.available(room)) if (!distances.has(next)) { distances.set(next, distances.get(room)! + 1); queue.push(next) }
    }
    return Infinity
  }
  private nextRobot(): Room {
    const s = this.state, origin = coordinates(s.enemy)
    const rank = (room: Room) => {
      const point = coordinates(room)
      return point.y < origin.y ? 0 : point.x > origin.x ? 1 : point.y > origin.y ? 2 : 3
    }
    const options = this.available(s.enemy).sort((a, b) => rank(a) - rank(b))
    if (s.lure) {
      if (s.enemy === s.lure.target) return s.enemy
      const remaining = this.pathDistance(s.enemy, s.lure.target)
      // Stable N/E/S/W order is the prototype tie-break, never a teleport.
      return options.find(room => this.pathDistance(room, s.lure!.target) < remaining) ?? s.enemy
    }
    // Uniform among open neighbors AND one wait candidate. No tracking or previous-cell bias.
    return this.pick([...options, s.enemy])
  }
  private discover(room: Room) {
    const s = this.state
    s.knowledge[room] = 'visited'
    for (const next of neighbors(room)) {
      if (s.knowledge[next] === 'unexplored') s.knowledge[next] = 'connected'
      const key = edgeKey(room, next)
      if (!s.knownEdges.includes(key)) s.knownEdges.push(key)
    }
  }
  label(room: Room, language: Language = 'ja') { return knownRoom(room, this.state.knowledge, language) }
  mapLines(language: Language = 'ja') { return baseMapLines(this.state.location, this.state.knowledge, this.state.knownEdges, language) }
  guideLines(language: Language = 'ja') {
    const lines = rooms.filter(room => this.state.knowledge[room] === 'visited' && facilities[room]?.length).map(room => `${roomName(room, language)} : ${facilities[room]!.map(id => facilityName(id, language)).join(', ')}`)
    return [t('facilityGuide', language), ...(lines.length ? lines : [t('noneKnown', language)])]
  }
  ready() { return escapeItems.every(item => this.state.items.includes(item)) }
  statusLines(language: Language = 'ja') {
    return [t('locationStatus', language, roomName(this.state.location, language)), t('energyStatus', language, this.state.energy, this.state.maxEnergy), t('returnStatus', language),
      ...escapeItems.map(item => t('conditionStatus', language, t(this.state.items.includes(item) ? 'ready' : 'notReady', language), itemName(item, language)))]
  }
  freshness(record: { turn: number } | null): 'unchecked' | 'fresh' | 'stale' { return !record ? 'unchecked' : record.turn === this.state.turn ? 'fresh' : 'stale' }
  warningLines(language: Language = 'ja', origin = this.state.location): string[] {
    const d = distance(origin, this.state.enemy)
    if (d === 0) return [t('robotEncounter', language), t('encounterInstructions', language)]
    return d <= 2 ? [t(d === 1 ? 'warning1' : 'warning2', language, direction(origin, this.state.enemy, language))] : []
  }
  feedLines(language: Language = 'ja') {
    const feed = this.state.feed
    return !feed ? [t('cameraEmpty', language)] : [
      ...edges.filter(([a, b]) => a === this.state.location || b === this.state.location).map(([a, b]) => `${cellCode(a)}–${cellCode(b)} : ${feed.passages[edgeKey(a, b)]}`),
      t('cameraFeed', language, t(this.freshness(feed), language), roomName(feed.enemy, language), cellCode(feed.enemy)),
    ]
  }
  predictionLines(language: Language = 'ja') {
    const p = this.state.prediction
    return !p ? [t('unchecked', language)] : [t('prediction', language, t(this.freshness(p), language), roomName(p.current, language), cellCode(p.current), roomName(p.next, language), cellCode(p.next))]
  }
  private spend(cost: number, log: string[], language: Language) {
    if (cost) { this.state.energy = Math.max(0, this.state.energy - cost); log.push(t('energySpent', language, cost, this.state.energy)) }
    if (this.state.energy <= 0) { this.over(log, language, false); return false }
    return true
  }
  private over(log: string[], language: Language, robot: boolean) {
    this.state.status = 'over'; this.state.encounter = false
    log.push(t(robot ? 'robotFatal' : 'suitPowerDepleted', language), t('gameOver', language))
  }
  private encounter(log: string[], language: Language) {
    this.state.encounter = true
    log.push(...this.warningLines(language))
    if (this.state.retreatUsed || !this.available(this.state.location).length || this.state.energy <= 2) this.over(log, language, true)
  }
  private revise(log: string[], language: Language) {
    if (this.state.prediction) log.push(t('predictionRevised', language))
    this.state.prediction = null
    this.state.robotNext = this.nextRobot()
  }
  private lure(target: Room, duration: number, log: string[], language: Language) {
    this.state.lure = { target, remaining: duration }
    log.push(t('lureResult', language, this.label(target, language), duration))
    this.revise(log, language)
  }
  private bulkhead(key: string, closed: boolean, log: string[], language: Language) {
    const s = this.state
    if (closed) {
      const previous = s.bulkheads[key]?.previous ?? s.passages[key]
      s.passages[key] = 'CLOSED'
      s.bulkheads[key] = { previous, restoresAt: s.turn + 3 }
    } else {
      s.passages[key] = s.bulkheads[key]?.previous ?? 'NORMAL'
      delete s.bulkheads[key]
    }
    log.push(t('bulkChanged', language, this.edgeLabel(key), s.passages[key]))
    this.revise(log, language)
  }
  edgeLabel(key: string) { return key.split(':').map(room => cellCode(room as Room)).join('–') }
  private advanceDurations(log: string[], language: Language) {
    const s = this.state
    if (s.lure && --s.lure.remaining <= 0) s.lure = null
    for (const [key, bulk] of Object.entries(s.bulkheads)) if (s.turn >= bulk.restoresAt) {
      s.passages[key] = bulk.previous; delete s.bulkheads[key]
      log.push(t('bulkRestored', language, this.edgeLabel(key)))
    }
  }
  private world(log: string[], language: Language) {
    const s = this.state
    s.turn++
    // Entering an occupied cell triggers encounter BEFORE the robot can leave it.
    if (s.enemy === s.location) { this.advanceDurations(log, language); this.encounter(log, language); return }
    // A committed next move is consumed once. Topology/lure actions revise it first.
    if (s.robotNext === s.enemy || this.available(s.enemy).includes(s.robotNext)) s.enemy = s.robotNext
    // Restore after this turn's movement: closure protects exactly three robot updates.
    this.advanceDurations(log, language)
    if (s.enemy === s.location) { this.encounter(log, language); return }
    s.robotNext = this.nextRobot()
    log.push(...this.warningLines(language))
  }
  private charge(log: string[], language: Language) {
    const s = this.state, before = s.energy
    s.energy = Math.min(s.maxEnergy, s.energy + 12)
    log.push(t('chargeResult', language), t('supplyResult', language, s.energy - before, s.energy))
  }
  // Shared by execution and confirmation. Invalid actions must not spend, progress or draw RNG.
  canAct(action: Action): boolean {
    const s = this.state
    if (s.status !== 'playing') return false
    if (s.encounter) return action.type === 'give-up' || action.type === 'retreat' && !s.retreatUsed && this.available(s.location).includes(action.target)
    if (action.type === 'give-up' || action.type === 'retreat') return false
    if (action.type === 'move') return this.available(s.location).includes(action.target)
    if (action.type === 'collect') return !!s.ground[s.location]?.includes(action.item)
    if (action.type === 'camera') return !action.fixed || !!facilities[s.location]?.includes('camera')
    if (action.type === 'wait') return true
    if (action.type === 'self-lure') return this.pathDistance(s.enemy, s.location) !== Infinity
    if (action.type === 'facility') {
      if (!facilities[s.location]?.includes(action.facility)) return false
      if (action.facility === 'charger') return !s.chargerUsed
      if (action.facility === 'ship') return this.ready()
      if (action.facility === 'alarm') return !!action.target && this.targetKnown(action.target) && this.pathDistance(s.enemy, action.target) !== Infinity
      if (action.facility === 'bulkhead') return this.validEdge(action.edge, true)
      return true
    }
    if (action.type === 'install') return s.items.includes(action.item) && (action.item !== 'controller' || this.validEdge(action.edge, true))
    if (action.type === 'activate') return s.installations.some(device => device.id === action.id
      && (device.item !== 'remote-decoy' || this.pathDistance(s.enemy, device.room) !== Infinity)
      && (device.item !== 'controller' || this.validEdge(device.edge, false)))
    if (!s.items.includes(action.item)) return false
    const spec = itemSpecs[action.item]
    if (spec.kind === 'deployable' || spec.effect === 'escape' || spec.effect === 'map') return false
    if (spec.effect === 'lure') return !!action.target && this.targetKnown(action.target) && distance(s.location, action.target) <= spec.range && distance(s.location, s.enemy) <= spec.range && this.pathDistance(s.enemy, action.target) !== Infinity
    if (spec.effect === 'bulkhead') return this.validEdge(action.edge, action.item === 'local-key')
    return true
  }
  targetKnown(room: Room) { return this.state.knowledge[room] !== 'unexplored' }
  private validEdge(key: string | undefined, local: boolean) {
    return !!key && this.state.knownEdges.includes(key) && (!local || key.split(':').includes(this.state.location)) && this.state.passages[key] !== 'BLOCKED'
  }
  act(action: Action, language: Language = 'ja'): string[] {
    const s = this.state, log: string[] = []
    if (!this.canAct(action)) return [t(action.type === 'move' && neighbors(s.location).includes(action.target) && !passable(this.passage(s.location, action.target)) ? 'passageClosed' : 'actionUnavailable', language)]
    if (action.type === 'give-up') { this.over(log, language, true); return log }
    if (action.type === 'retreat') {
      if (!this.spend(2, log, language)) return log
      s.retreatUsed = true; s.turn++
      if (this.random() >= 0.25) { this.over(log, language, true); return log }
      s.location = action.target; this.discover(action.target); s.encounter = false
      // One last rescue: robot remains in the encounter cell for this turn only.
      this.advanceDurations(log, language)
      s.robotNext = this.nextRobot()
      log.push(t('retreatResult', language, roomName(action.target, language)), ...this.warningLines(language))
      return log
    }
    const cost = action.type === 'move' ? costs[this.passage(s.location, action.target)]
      : action.type === 'camera' ? action.fixed ? 1 : 2
      : action.type === 'use' ? itemSpecs[action.item].cost
      : action.type === 'activate' ? itemSpecs[s.installations.find(device => device.id === action.id)!.item].cost
      : action.type === 'facility' ? action.facility === 'camera' || action.facility === 'alarm' || action.facility === 'bulkhead' ? 1 : 0
      : action.type === 'wait' ? 1 : 0
    if (!this.spend(cost, log, language)) return log
    if (action.type === 'move') {
      const discovered = s.knowledge[action.target] !== 'visited' && s.knowledge[action.target] !== 'mapped'
      log.push(t(this.passage(s.location, action.target) === 'DARK' ? 'darkWalk' : 'walk', language), discovered ? t('movementUnknown', language) : t('movementResult', language, roomName(action.target, language)))
      s.location = action.target; this.discover(action.target)
      if (discovered) log.push(t('discovered', language, roomName(action.target, language)))
    } else if (action.type === 'collect') {
      s.ground[s.location]!.splice(s.ground[s.location]!.indexOf(action.item), 1); s.items.push(action.item)
      log.push(t('collected', language, itemName(action.item, language)))
      if (action.item === 'map') {
        for (const room of rooms) if (s.knowledge[room] !== 'visited') s.knowledge[room] = 'mapped'
        s.knownEdges = edges.map(([a, b]) => edgeKey(a, b))
        log.push(t('mapCollected', language))
      }
    } else if (action.type === 'use') {
      const spec = itemSpecs[action.item]
      if (spec.effect === 'lure') this.lure(action.target!, spec.duration, log, language)
      if (spec.effect === 'bulkhead') this.bulkhead(action.edge!, action.closed ?? true, log, language)
      if (spec.effect === 'battery') this.charge(log, language)
      if (spec.consumable) s.items.splice(s.items.indexOf(action.item), 1)
    } else if (action.type === 'install') {
      s.items.splice(s.items.indexOf(action.item), 1)
      s.installations.push({ id: Math.max(0, ...s.installations.map(device => device.id)) + 1, item: action.item, room: s.location, ...(action.edge ? { edge: action.edge } : {}) })
      log.push(t('installed', language, itemName(action.item, language), roomName(s.location, language)))
    } else if (action.type === 'activate') {
      const device = s.installations.find(device => device.id === action.id)!
      if (device.item === 'remote-decoy') this.lure(device.room, 5, log, language)
      if (device.item === 'controller') this.bulkhead(device.edge!, action.closed ?? true, log, language)
    } else if (action.type === 'self-lure') this.lure(s.location, 2, log, language)
    else if (action.type === 'wait') log.push(t('waitResult', language))
    else if (action.type === 'facility') {
      if (action.facility === 'alarm') this.lure(action.target!, 4, log, language)
      if (action.facility === 'bulkhead') this.bulkhead(action.edge!, action.closed ?? true, log, language)
      if (action.facility === 'charger') { s.chargerUsed = true; this.charge(log, language) }
      if (action.facility === 'ship') { s.status = 'clear'; s.turn++; log.push(t('launchResult', language), t('launchAI', language), t('gameClear', language)); return log }
    }
    this.world(log, language)
    if (s.status !== 'playing' || s.encounter) return log
    if (action.type === 'camera' || action.type === 'facility' && action.facility === 'camera') {
      s.feed = { enemy: s.enemy, passages: { ...s.passages }, turn: s.turn }
      log.push(...this.feedLines(language))
    }
    if (action.type === 'use' && action.item === 'predictor') {
      s.prediction = { current: s.enemy, next: s.robotNext, turn: s.turn }
      log.push(...this.predictionLines(language))
    }
    if (action.type === 'activate') {
      const device = s.installations.find(device => device.id === action.id)!
      if (device.item === 'sensor') log.push(...(distance(device.room, s.enemy) <= 1 ? [t('sensorFeed', language, roomName(s.enemy, language), cellCode(s.enemy))] : [t('sensorOutside', language)]))
    }
    return log
  }
}
