import './style.css'
import { Game, taskInfo, conditionNames } from './game'
import type { Action, Task } from './game'
import { costs, descriptions, neighbors } from './map'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('App element was not found')
const game = new Game()
type Menu = 'start' | 'main' | 'move' | 'camera' | 'equipment' | 'inventory' | 'encounter' | 'flee' | 'end'
type Option = { label: string; inputLabel?: string; submenu?: Menu; run?: () => void; disabled?: boolean; help?: () => string[]; helpInput?: string; cancel?: boolean }
let menu: Menu = 'start', page = 0
let helpMode = false
const pendingInput: string[] = []
const terminal = document.createElement('main')
terminal.className = 'terminal'
const log = document.createElement('div')
log.className = 'terminal-log'
log.setAttribute('role', 'log')
log.setAttribute('aria-label', 'ゲームログ')
log.tabIndex = 0
let prompt: HTMLDivElement | null = null
// Prototype tuning value, not a fixed release specification.
const TYPEWRITER_INTERVAL_MS = 5
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const logQueue: string[] = []
let isTyping = false
let typingTimer: ReturnType<typeof setTimeout> | null = null
let activeLine: HTMLDivElement | null = null
let characters: string[] = [], characterPosition = 0
function appendImmediate(...lines: string[]) {
  prompt?.remove()
  prompt = null
  for (const text of lines) {
    const line = document.createElement('div')
    line.className = 'terminal-line'
    line.textContent = text
    log.append(line)
  }
  log.scrollTop = log.scrollHeight
}
function finishTyping() {
  if (typingTimer !== null) clearTimeout(typingTimer)
  typingTimer = null
  activeLine = null
  characters = []; characterPosition = 0
  isTyping = false
  log.setAttribute('aria-busy', 'false')
  render()
}
function typeNextCharacter() {
  typingTimer = null
  while (!activeLine && logQueue.length) {
    characters = Array.from(logQueue.shift()!)
    characterPosition = 0
    appendImmediate('')
    activeLine = log.lastElementChild as HTMLDivElement
    if (!characters.length) activeLine = null
  }
  if (!activeLine) { finishTyping(); return }
  activeLine.textContent += characters[characterPosition++]!
  log.scrollTop = log.scrollHeight
  if (characterPosition === characters.length) activeLine = null
  if (!activeLine && !logQueue.length) { finishTyping(); return }
  typingTimer = setTimeout(typeNextCharacter, TYPEWRITER_INTERVAL_MS)
}
function appendLog(...lines: string[]) {
  if (!lines.length) return
  if (reducedMotion.matches) { appendImmediate(...lines); return }
  logQueue.push(...lines)
  if (isTyping) return
  showPrompt(false)
  isTyping = true
  log.setAttribute('aria-busy', 'true')
  render()
  typingTimer = setTimeout(typeNextCharacter, TYPEWRITER_INTERVAL_MS)
}
function skipTyping() {
  if (!isTyping) return
  if (typingTimer !== null) clearTimeout(typingTimer)
  if (activeLine) activeLine.textContent += characters.slice(characterPosition).join('')
  appendImmediate(...logQueue.splice(0))
  finishTyping()
}
log.addEventListener('click', skipTyping)
reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) skipTyping() })
function showPrompt(waiting: boolean) {
  if (!waiting || isTyping) { prompt?.remove(); prompt = null; return }
  if (prompt) return
  appendImmediate('>')
  prompt = log.lastElementChild as HTMLDivElement
}
function confirmInput(label: string, path = pendingInput) {
  showPrompt(true)
  prompt!.textContent = `> ${[...path, label].join(' ')}`
  prompt = null
  appendImmediate('')
}
const actions = document.createElement('div')
actions.className = 'terminal-actions'
actions.setAttribute('role', 'group')
function button(label: string, run: () => void) {
  const element = document.createElement('button')
  element.type = 'button'
  element.textContent = label
  element.addEventListener('click', () => { if (!isTyping && !element.disabled) run() })
  return element
}
function open(nextMenu: Menu) {
  menu = nextMenu; page = 0
  if (!parent()) pendingInput.length = 0
  render()
  const first = actions.querySelector<HTMLButtonElement>('button:not(:disabled)')
  const focusTarget = first ?? (parent() ? back : log)
  focusTarget.focus({ preventScroll: true })
}
function act(action: Action) {
  appendLog(...game.act(action))
  const s = game.state
  open(s.status !== 'playing' ? 'end' : s.encounter ? 'encounter' : 'main')
}
function restart() {
  if (typingTimer !== null) clearTimeout(typingTimer)
  typingTimer = null
  logQueue.length = 0
  activeLine = null
  characters = []; characterPosition = 0
  isTyping = false
  game.restart()
  appendLog('EXIT SEQUENCE', 'SYSTEM ONLINE', 'AI：基地は致命的損傷を受けた。恒久復旧は不可能。帰還船で地球へ帰還する。',
    '電力管理区で給電、管制区でロック解除、研究区の部品を整備区で使用、倉庫区で食糧確保。4条件を満たして発着区へ。',
    '医療区と観測区で各1回、ENERGY +6。監視は1ルート／ENERGY 1。情報は次の行動で古くなる。', 'ENERGY 20 / 20。現在地：居住区。', descriptions.居住)
  open('main')
}
function itemHelp(item: string): string[] {
  return [item === '食糧' ? '食糧：帰還用物資。帰還まで保持する。' : '修理部品：整備区の設備で使用する。']
}
function taskHelp(task: Task): string[] {
  const s = game.state, info = taskInfo[task]
  const effects: Record<Task, string> = {
    power: '帰還船用電力を確保する。', control: '発進管制ロックを解除する。',
    repair: '修理部品を消費して帰還船を修理する。', parts: '修理部品を取得する。', food: '帰還まで保持する食糧を取得する。',
    medical: 'ENERGY +6（上限20）。1回のみ。', observe: 'ENERGY +6（上限20）。1回のみ。', launch: '帰還船を発進し、GAME CLEARとなる。',
  }
  return [info.label, `ENERGY：${info.cost}`, `実行済み：${game.taskDone(task) ? 'はい' : 'いいえ'}`,
    task === 'repair' ? `前提条件：修理部品（${s.items.includes('修理部品') ? '所持' : '不足'}）` : task === 'launch' ? '前提条件：帰還4条件の達成' : `前提条件：${info.room}区の設備`,
    effects[task], ...(task === 'launch' ? Object.entries(conditionNames).filter(([key]) => !s.conditions[key as keyof typeof s.conditions]).map(([, name]) => `不足：${name}`) : [])]
}
function options(): Option[] {
  const list = menuOptions()
  if (parent()) list.push({ label: 'キャンセル', cancel: true, run: () => { pendingInput.pop(); open(parent()!) } })
  return list
}
function menuOptions(): Option[] {
  const s = game.state
  if (menu === 'start') return [{ label: 'ゲーム開始', run: restart }]
  if (menu === 'end') return [{ label: '最初から', run: restart }, { label: '最終状態確認', run: () => appendLog(...game.statusLines()) }]
  if (menu === 'main') return [
    { label: '周囲を見る', run: () => appendLog(`${s.location}区`, descriptions[s.location]) },
    { label: '移動 >', submenu: 'move' },
    { label: '監視 >', submenu: 'camera' },
    { label: '設備 >', submenu: 'equipment' },
    { label: '持ち物 >', submenu: 'inventory' },
    { label: '状態確認', run: () => appendLog(...game.statusLines()) },
  ]
  if (menu === 'encounter') return [
    { label: '隠れる', help: () => ['成功率：80%', 'ENERGY：1', '失敗時：追加ENERGY 1を消費して離脱する。'], run: () => act({ type: 'hide' }) },
    { label: '強行突破', help: () => ['成功率：60%', 'ENERGY：2', '失敗時：追加ENERGY 1を消費して離脱する。'], run: () => act({ type: 'force' }) },
    { label: '逃げる >', submenu: 'flee' },
  ]
  if (menu === 'inventory') return s.items.length ? s.items.map(item => ({ label: item, helpInput: `持ち物 ${item}`, help: () => itemHelp(item), run: () => appendLog(...itemHelp(item)) })) : [{ label: '持ち物なし', run: () => {}, disabled: true }]
  if (menu === 'equipment') {
    const tasks = (Object.keys(taskInfo) as Task[]).filter(task => taskInfo[task].room === s.location)
    const result: Option[] = tasks.map(task => {
      const info = taskInfo[task], done = game.taskDone(task)
      return { label: info.label, helpInput: `設備 ${info.label}`, help: () => taskHelp(task), disabled: done || (task === 'launch' && !game.ready()), run: () => act({ type: 'task', task }) }
    })
    if (s.location === '発着') result.push({ label: '帰還条件を確認', run: () => appendLog(...game.statusLines()) })
    return result.length ? result : [{ label: '操作できる設備なし', run: () => {}, disabled: true }]
  }
  return neighbors(s.location).map(target => {
    if (menu === 'camera') return { label: `${target}区`, helpInput: `監視 ${target}区`, help: () => ['ENERGY：1', '選択した1ルートだけを確認する。', '通路状態・敵情報・推定ENERGYを世界更新後に取得する。', '情報は次の有効な世界行動で古くなる。', 'このHELPでは監視を実行しない。'], run: () => act({ type: 'camera', target }) }
    const closed = game.passage(s.location, target) === 'CLOSED'
    const fleeing = menu === 'flee'
    return { label: `${target}区`, disabled: closed, helpInput: `${fleeing ? '逃げる' : '移動'} ${target}区`, help: () => {
      const freshness = game.freshness(s.location, target)
      const feed = s.feeds[`${s.location}:${target}`]
      return [
      `${target}区へのルート`, `情報の鮮度：${freshness}`, `状態：${closed ? 'CLOSED（現在移動不可）' : feed?.passage ?? 'UNKNOWN / 未確認'}`,
      `推定ENERGY：${closed ? '移動不可' : feed ? feed.passage === 'CLOSED' ? '取得時点では移動不可' : costs[feed.passage] : 'UNKNOWN / 未確認（1〜3）'}`,
      `敵情報：${feed ? feed.enemy ? 'あり（取得時点）' : 'なし（取得時点）' : 'UNKNOWN / 未確認'}`,
      ...(freshness === '古い' ? ['古い情報は現在の安全性を保証しない。'] : []),
      ...(fleeing ? ['逃走成功率：100%。選択した通路の移動コストを使用する。'] : []),
    ] }, run: () => act({ type: fleeing ? 'flee' : 'move', target }) }
  })
}
function parent(): Menu | null {
  if (menu === 'flee') return 'encounter'
  return ['move', 'camera', 'equipment', 'inventory'].includes(menu) ? 'main' : null
}
const navigation = document.createElement('nav')
navigation.className = 'action-navigation'
navigation.setAttribute('aria-label', '選択肢のページ操作')
const back = button('戻る', () => {
  const nextMenu = parent(), previousMenu = menu
  if (!nextMenu) return
  pendingInput.pop()
  open(nextMenu)
  const index = { move: 1, camera: 2, equipment: 3, inventory: 4, flee: 2 }[previousMenu as 'move' | 'camera' | 'equipment' | 'inventory' | 'flee']
  actions.querySelectorAll<HTMLButtonElement>('button')[index]?.focus({ preventScroll: true })
})
back.className = 'back-button'
back.setAttribute('aria-label', '親メニューへ戻る')
const previous = button('＜', () => { if (page > 0) { page--; render() } })
previous.setAttribute('aria-label', '前のページ')
const next = button('＞', () => { if (page + 1 < Math.ceil(options().length / 6)) { page++; render() } })
next.setAttribute('aria-label', '次のページ')
const indicator = document.createElement('span')
indicator.className = 'action-page-indicator'
indicator.setAttribute('aria-live', 'polite')
const pageNavigation = document.createElement('div')
pageNavigation.className = 'page-navigation'
pageNavigation.append(previous, indicator, next)
const help = button('HELP', () => { helpMode = !helpMode; render() })
help.setAttribute('aria-label', 'HELPモード')
navigation.append(back, pageNavigation, help)
function render() {
  const list = options(), count = Math.max(1, Math.ceil(list.length / 6))
  page = Math.min(page, count - 1)
  actions.replaceChildren()
  const names: Record<Menu, string> = { start: 'ゲーム開始', main: '行動を選択', move: '移動先', camera: '監視ルート', equipment: '設備', inventory: '持ち物', encounter: '遭遇対処', flee: '逃走先', end: '終了' }
  actions.setAttribute('aria-label', `${names[menu]}：${page + 1} / ${count}ページ`)
  for (let slot = 0; slot < 6; slot++) {
    const option = list[page * 6 + slot]
    if (option) {
      const element = button(option.label, () => {
        const inputLabel = option.inputLabel ?? option.label.split('\n')[0].replace(/ >$/, '')
        if (helpMode && option.help) {
          confirmInput(`HELP ${option.helpInput ?? inputLabel}`, [])
          appendLog(...option.help())
        } else if (option.submenu) {
          pendingInput.push(inputLabel)
          open(option.submenu)
        } else {
          confirmInput(inputLabel, option.cancel ? [] : pendingInput)
          option.run?.()
        }
        const nextOptions = options()
        showPrompt(nextOptions.some(option => !option.disabled) || !!parent() || nextOptions.length > 6)
      })
      const lines = option.label.split('\n')
      element.replaceChildren(...lines.map((text, index) => {
        const line = document.createElement('span')
        line.className = index === 0 ? 'option-title' : 'option-detail'
        line.textContent = text
        return line
      }))
      element.disabled = isTyping || (!!option.disabled && !(helpMode && option.help))
      actions.append(element)
    } else {
      const empty = document.createElement('span')
      empty.className = 'inventory-empty'
      empty.setAttribute('aria-hidden', 'true')
      actions.append(empty)
    }
  }
  indicator.textContent = `${page + 1} / ${count}`
  help.disabled = isTyping
  help.className = helpMode ? 'help-button help-active' : 'help-button'
  help.setAttribute('aria-pressed', String(helpMode))
  back.disabled = isTyping || !parent(); previous.disabled = isTyping || page === 0; next.disabled = isTyping || page === count - 1
  showPrompt(list.some(option => !option.disabled) || !!parent() || count > 1)
}
terminal.append(log, actions, navigation)
app.append(terminal)
appendLog('EXIT SEQUENCE', 'コアループ検証用プロトタイプ', 'ゲーム開始を選択してください。')
render()
