import { t, roomName, taskLabels, conditionLabels } from './i18n.ts'
import type { Language } from './i18n.ts'
import { costs, edgeKey, edges, neighbors, rooms } from './map.ts'
import type { Passage, Room } from './map.ts'

export type Random = () => number
export type Task = 'power' | 'control' | 'repair' | 'parts' | 'food' | 'medical' | 'observe' | 'launch'
export type Action = { type: 'move' | 'camera' | 'flee'; target: Room } | { type: 'task'; task: Task } | { type: 'hide' | 'force' }
export type Feed = { destination: Room; passage: Passage; enemy: boolean; turn: number }
export interface State {
  location: Room; energy: number; maxEnergy: number; turn: number
  passages: Record<string, Passage>; enemy: Room; enemyPrevious: Room | null
  items: string[]; conditions: Record<'power' | 'control' | 'repair' | 'food', boolean>
  supplies: Record<'medical' | 'observe', boolean>; feeds: Record<string, Feed>
  status: 'playing' | 'over' | 'clear'; encounter: boolean
}
export const conditionNames = conditionLabels('ja')
export const taskInfo: Record<Task, { room: Room; label: string; cost: number }> = {
  power: { room: '電力管理', label: t('supplyPower', 'ja'), cost: 1 },
  control: { room: '管制', label: t('unlockControl', 'ja'), cost: 1 },
  repair: { room: '整備', label: t('repairShip', 'ja'), cost: 2 },
  parts: { room: '研究', label: t('collectParts', 'ja'), cost: 1 },
  food: { room: '倉庫', label: t('collectFood', 'ja'), cost: 1 },
  medical: { room: '医療', label: t('collectBattery', 'ja'), cost: 0 },
  observe: { room: '観測', label: t('shutDownSystem', 'ja'), cost: 0 },
  launch: { room: '発着', label: t('launchShip', 'ja'), cost: 0 },
}
export class Game {
  state!: State
  private random: Random
  constructor(random: Random = Math.random) { this.random = random; this.restart() }
  private pick<T>(values: readonly T[]): T { return values[Math.floor(this.random() * values.length)]! }
  restart() {
    this.state = {
      location: '居住', energy: 20, maxEnergy: 20, turn: 0,
      passages: Object.fromEntries(edges.map(([a, b]) => [edgeKey(a, b), 'NORMAL'])),
      enemy: this.pick(['研究', '整備', '管制'] as const), enemyPrevious: null,
      items: [], conditions: { power: false, control: false, repair: false, food: false },
      supplies: { medical: false, observe: false }, feeds: {}, status: 'playing', encounter: false,
    }
    // Four distinct candidates keep the initial map mostly usable. Reject disconnection.
    const candidates = [...edges]
    for (let i = 0; i < 4; i++) {
      const edge = this.pick(candidates)
      candidates.splice(candidates.indexOf(edge), 1)
      this.changePassage(edgeKey(...edge), this.pick(['DARK', 'BLOCKED', 'CLOSED'] as const))
    }
  }
  passage(a: Room, b: Room) { return this.state.passages[edgeKey(a, b)]! }
  connected() {
    const seen = new Set<Room>([this.state.location])
    const queue = [this.state.location]
    for (const room of queue) for (const next of neighbors(room)) {
      if (!seen.has(next) && this.passage(room, next) !== 'CLOSED') { seen.add(next); queue.push(next) }
    }
    return rooms.every(room => seen.has(room))
  }
  private changePassage(key: string, value: Passage) {
    const old = this.state.passages[key]!
    this.state.passages[key] = value
    if (!this.connected()) { this.state.passages[key] = old; return false }
    return old !== value
  }
  freshness(a: Room, b: Room): '未確認' | '最新' | '古い' {
    const feed = this.state.feeds[`${a}:${b}`]
    return !feed ? '未確認' : feed.turn === this.state.turn ? '最新' : '古い'
  }
  ready() { return Object.values(this.state.conditions).every(Boolean) }
  statusLines(language: Language = 'ja') {
    return [t('locationStatus', language, roomName(this.state.location, language)), t('energyStatus', language, this.state.energy, this.state.maxEnergy), t('returnStatus', language),
      ...Object.entries(conditionLabels(language)).map(([key, name]) => t('conditionStatus', language, t(this.state.conditions[key as keyof State['conditions']] ? 'ready' : 'notReady', language), name))]
  }
  taskDone(task: Task) {
    const s = this.state
    if (task === 'parts') return s.items.includes('修理部品') || s.conditions.repair
    if (task === 'medical' || task === 'observe') return s.supplies[task]
    if (task === 'launch') return false
    return s.conditions[task]
  }
  private spend(cost: number, log: string[], language: Language) {
    if (cost) { this.state.energy = Math.max(0, this.state.energy - cost); log.push(t('energySpent', language, cost, this.state.energy)) }
    if (this.state.energy <= 0) {
      this.state.status = 'over'; this.state.encounter = false
      log.push(t('gameOver', language), t('suitPowerDepleted', language))
      return false
    }
    return true
  }
  private world(log: string[], suppressEncounter: boolean, language: Language) {
    const s = this.state
    if (this.random() < 0.3) {
      const [a, b] = this.pick(edges), key = edgeKey(a, b), old = s.passages[key]!
      const transitions: Record<Passage, readonly Passage[]> = { NORMAL: ['DARK'], DARK: ['NORMAL', 'BLOCKED'], BLOCKED: ['DARK', 'CLOSED'], CLOSED: ['BLOCKED'] }
      const value = this.pick(transitions[old])
      // Limit simultaneous damage for the small ENERGY budget.
      if ((old !== 'NORMAL' || Object.values(s.passages).filter(p => p !== 'NORMAL').length < 6) && this.changePassage(key, value)) {
        log.push(t('passageUpdate', language, roomName(a, language), roomName(b, language), old, value))
      }
    }
    const options = neighbors(s.enemy).filter(room => this.passage(s.enemy, room) !== 'CLOSED')
    const onward = options.filter(room => room !== s.enemyPrevious)
    // Entering the robot's room interrupts patrol; do not let it silently walk away.
    if (options.length && (s.enemy !== s.location || suppressEncounter)) {
      const old = s.enemy
      s.enemy = this.pick(onward.length && this.random() < 0.8 ? onward : options)
      s.enemyPrevious = old
    }
    s.encounter = !suppressEncounter && s.enemy === s.location
    if (s.encounter) log.push(t('robotEncounter', language), t('encounterInstructions', language))
  }
  act(action: Action, language: Language = 'ja'): string[] {
    const s = this.state, log: string[] = []
    if (s.status !== 'playing') return log
    const response = action.type === 'hide' || action.type === 'force' || action.type === 'flee'
    if (s.encounter !== response) return [t('actionUnavailable', language)]
    if (action.type === 'move' || action.type === 'flee' || action.type === 'camera') {
      if (!neighbors(s.location).includes(action.target)) return [t('districtDisconnected', language)]
      if (action.type !== 'camera') {
        const passage = this.passage(s.location, action.target)
        if (passage === 'CLOSED') return [t('passageClosed', language)]
        log.push(t('movementResult', language, roomName(action.target, language), action.type === 'flee' ? t('fleeAction', language) : t('move', language)),
          { NORMAL: t('walkedUnderEmergencyLightsUsingSuitLife', language), DARK: t('passageLightsAreOffUsedSuitLighting', language), BLOCKED: t('debrisBlocksTheWayUsedPowerAssistance', language) }[passage])
        if (!this.spend(costs[passage], log, language)) return log
        s.location = action.target
      } else if (!this.spend(1, log, language)) return log
    } else if (action.type === 'task') {
      const task = action.task, info = taskInfo[task]
      if (info.room !== s.location || this.taskDone(task)) return [t('taskUnavailable', language)]
      if (task === 'repair' && !s.items.includes('修理部品')) return [t('repairPartsMissing', language)]
      if (task === 'launch' && !this.ready()) return [t('requirementsMissing', language), ...this.statusLines(language)]
      log.push(taskLabels(language)[task] + t('punctuation', language))
      if (!this.spend(info.cost, log, language)) return log
      if (task === 'medical' || task === 'observe') {
        s.supplies[task] = true
        const before = s.energy; s.energy = Math.min(s.maxEnergy, s.energy + 6)
        log.push(t('supplyResult', language, s.energy - before, s.energy))
      } else if (task === 'parts') { s.items.push('修理部品'); log.push(t('repairPartsCollectedUseThemInMaintenance', language)) }
      else if (task === 'launch') { s.status = 'clear'; log.push(t('gameClear', language), t('theReturnShipHasLeftTheMoon', language), t('aiDeparturePreparationsCompleteWeCanDeal', language)) }
      else {
        s.conditions[task] = true
        if (task === 'food') { s.items.push('食糧'); log.push(t('foodCollectedKeepItUntilDeparture', language)) }
        if (task === 'repair') { s.items = s.items.filter(item => item !== '修理部品'); log.push(t('repairPartsUsedHullRepairsComplete', language)) }
        log.push(t('returnRequirementMet', language) + conditionLabels(language)[task])
      }
    } else {
      const hide = action.type === 'hide'
      log.push(hide ? t('hidingBehindCover', language) : t('forcingPastTheSafetyRobot', language))
      if (!this.spend(hide ? 1 : 2, log, language)) return log
      if (this.random() < (hide ? 0.8 : 0.6)) log.push(t('successAvoidedTheSafetyRobot', language))
      else { log.push(t('failureUsedSuitProtectionToEscape', language)); if (!this.spend(1, log, language)) return log }
    }
    // Exactly one turn per accepted world action. Fatal costs stop before results/world.
    // Camera captures AFTER world update; response actions suppress this update's encounter.
    s.turn++
    s.encounter = false
    if (s.status === 'playing') {
      this.world(log, response, language)
      if (action.type === 'camera') {
        const feed: Feed = { destination: action.target, passage: this.passage(s.location, action.target), enemy: s.enemy === action.target, turn: s.turn }
        s.feeds[`${s.location}:${action.target}`] = feed
        log.push(t('cameraFeedFreshAfterWorldUpdate', language), t('cameraDirection', language, roomName(action.target, language)), t('cameraEnemy', language, feed.enemy ? t('safetyRobotPresent', language) : t('none', language)), t('cameraPassage', language, feed.passage), t('cameraCost', language, feed.passage === 'CLOSED' ? t('impassable', language) : costs[feed.passage]))
      }
      if (s.location === '発着') log.push(this.ready() ? t('launchReady', language) : t('launchNotReady', language))
    }
    return log
  }
}
