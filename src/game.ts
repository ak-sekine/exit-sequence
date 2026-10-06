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
export const conditionNames = { power: '帰還船用電力（電力管理区）', control: '発進管制解除（管制区）', repair: '帰還船修理（研究区の部品 → 整備区）', food: '食糧確保（倉庫区）' }
export const taskInfo: Record<Task, { room: Room; label: string; cost: number }> = {
  power: { room: '電力管理', label: '帰還船へ配電する', cost: 1 },
  control: { room: '管制', label: '発進管制を解除する', cost: 1 },
  repair: { room: '整備', label: '帰還船を修理する', cost: 2 },
  parts: { room: '研究', label: '修理部品を回収する', cost: 1 },
  food: { room: '倉庫', label: '食糧を回収する', cost: 1 },
  medical: { room: '医療', label: '予備バッテリーを回収', cost: 0 },
  observe: { room: '観測', label: '不要設備を停止する', cost: 0 },
  launch: { room: '発着', label: '帰還船を発進する', cost: 0 },
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
  statusLines() {
    return [`LOCATION : ${this.state.location}区`, `ENERGY : ${this.state.energy} / ${this.state.maxEnergy}`, 'RETURN STATUS',
      ...Object.entries(conditionNames).map(([key, name]) => `${this.state.conditions[key as keyof State['conditions']] ? 'READY' : 'NOT READY'} : ${name}`)]
  }
  taskDone(task: Task) {
    const s = this.state
    if (task === 'parts') return s.items.includes('修理部品') || s.conditions.repair
    if (task === 'medical' || task === 'observe') return s.supplies[task]
    if (task === 'launch') return false
    return s.conditions[task]
  }
  private spend(cost: number, log: string[]) {
    if (cost) { this.state.energy = Math.max(0, this.state.energy - cost); log.push(`ENERGY -${cost} → ${this.state.energy} / 20`) }
    if (this.state.energy <= 0) {
      this.state.status = 'over'; this.state.encounter = false
      log.push('GAME OVER', 'AI：スーツ電力が尽きた。最初から再試行できる。')
      return false
    }
    return true
  }
  private world(log: string[], suppressEncounter: boolean) {
    const s = this.state
    if (this.random() < 0.3) {
      const [a, b] = this.pick(edges), key = edgeKey(a, b), old = s.passages[key]!
      const transitions: Record<Passage, readonly Passage[]> = { NORMAL: ['DARK'], DARK: ['NORMAL', 'BLOCKED'], BLOCKED: ['DARK', 'CLOSED'], CLOSED: ['BLOCKED'] }
      const value = this.pick(transitions[old])
      // Limit simultaneous damage for the small ENERGY budget.
      if ((old !== 'NORMAL' || Object.values(s.passages).filter(p => p !== 'NORMAL').length < 6) && this.changePassage(key, value)) {
        log.push(`AI：通路更新 ${a}区 ↔ ${b}区：${old} → ${value}`)
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
    if (s.encounter) log.push('防災ロボットを発見。人間認証に失敗している。', 'AI：対処を選択。隠れる80%／ENERGY 1、強行突破60%／ENERGY 2。失敗時は追加ENERGY 1。逃走は通路コスト。')
  }
  act(action: Action): string[] {
    const s = this.state, log: string[] = []
    if (s.status !== 'playing') return log
    const response = action.type === 'hide' || action.type === 'force' || action.type === 'flee'
    if (s.encounter !== response) return ['AI：現在の状況で選べない行動。']
    if (action.type === 'move' || action.type === 'flee' || action.type === 'camera') {
      if (!neighbors(s.location).includes(action.target)) return ['AI：直接接続していない区画。']
      if (action.type !== 'camera') {
        const passage = this.passage(s.location, action.target)
        if (passage === 'CLOSED') return ['隔壁が閉鎖されている。CLOSED：移動不可。ENERGY消費なし。']
        log.push(`${action.target}区へ${action.type === 'flee' ? '逃走' : '移動'}。`,
          { NORMAL: '非常灯の下を歩く。スーツの生命維持を使用した。', DARK: '通路照明が停止している。スーツ照明を使用した。', BLOCKED: '瓦礫で通行困難。パワーアシストで突破した。' }[passage])
        if (!this.spend(costs[passage], log)) return log
        s.location = action.target
      } else if (!this.spend(1, log)) return log
    } else if (action.type === 'task') {
      const task = action.task, info = taskInfo[task]
      if (info.room !== s.location || this.taskDone(task)) return ['AI：この設備操作は実行できない。']
      if (task === 'repair' && !s.items.includes('修理部品')) return ['AI：修理部品がない。研究区で回収してほしい。ENERGY消費なし。']
      if (task === 'launch' && !this.ready()) return ['AI：帰還条件が不足している。', ...this.statusLines()]
      log.push(info.label + '。')
      if (!this.spend(info.cost, log)) return log
      if (task === 'medical' || task === 'observe') {
        s.supplies[task] = true
        const before = s.energy; s.energy = Math.min(s.maxEnergy, s.energy + 6)
        log.push(`ENERGY +${s.energy - before}（補給 +6／上限20）→ ${s.energy} / 20。使用済み。`)
      } else if (task === 'parts') { s.items.push('修理部品'); log.push('修理部品を取得。整備区で使用できる。') }
      else if (task === 'launch') { s.status = 'clear'; log.push('GAME CLEAR', '帰還船が月面を離れた。地球への航路を確保。', 'AI：帰還準備完了。基地の修理請求書は後回しにする。') }
      else {
        s.conditions[task] = true
        if (task === 'food') { s.items.push('食糧'); log.push('食糧を取得。帰還まで保持する。') }
        if (task === 'repair') { s.items = s.items.filter(item => item !== '修理部品'); log.push('修理部品を使用。船体修理完了。') }
        log.push('帰還条件達成：' + conditionNames[task])
      }
    } else {
      const hide = action.type === 'hide'
      log.push(hide ? '遮蔽物に隠れる。' : '防災ロボットの妨害を突破する。')
      if (!this.spend(hide ? 1 : 2, log)) return log
      if (this.random() < (hide ? 0.8 : 0.6)) log.push('対処成功。防災ロボットをやり過ごした。')
      else { log.push('対処失敗。スーツ防護を使用し、離脱した。'); if (!this.spend(1, log)) return log }
    }
    // Exactly one turn per accepted world action. Fatal costs stop before results/world.
    // Camera captures AFTER world update; response actions suppress this update's encounter.
    s.turn++
    s.encounter = false
    if (s.status === 'playing') {
      this.world(log, response)
      if (action.type === 'camera') {
        const feed: Feed = { destination: action.target, passage: this.passage(s.location, action.target), enemy: s.enemy === action.target, turn: s.turn }
        s.feeds[`${s.location}:${action.target}`] = feed
        log.push('CAMERA FEED（最新・世界更新後）', `${action.target}区方面`, `敵：${feed.enemy ? '防災ロボットあり' : 'なし'}`, `通路：${feed.passage}`, `推定 ENERGY：${feed.passage === 'CLOSED' ? '移動不可' : costs[feed.passage]}`)
      }
      if (s.location === '発着') log.push(this.ready() ? 'AI：帰還4条件達成。設備から発進できる。' : 'AI：帰還条件不足。設備から条件を確認できる。')
    }
    return log
  }
}
