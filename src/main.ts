import './style.css'
import { Game, narrative } from './game.ts'
import { initialLanguage, saveLanguage, t } from './i18n.ts'
import type { Language } from './i18n.ts'
const app = document.querySelector<HTMLDivElement>('#app')!
const game = new Game()
let language: Language = initialLanguage()
type Panel = 'story' | 'status' | 'inventory' | 'knowledge' | 'settings' | 'help'
let panel: Panel = 'story', started = false
// Snapshot prose when choices are confirmed. Changing language never replays an action.
const history: { state: typeof game.state; input?: { ja: string; en: string }; result?: { ja: string; en: string } }[] = []
const terminal = document.createElement('main')
terminal.className = 'terminal'
const heading = document.createElement('h1'); heading.textContent = 'EXIT SEQUENCE'
const log = document.createElement('div'); log.className = 'terminal-log'; log.tabIndex = 0
log.setAttribute('role', 'log')
const actions = document.createElement('div'); actions.className = 'terminal-actions'
const navigation = document.createElement('nav'); navigation.className = 'terminal-navigation'
terminal.append(heading, log, actions, navigation); app.append(terminal)
let typingTimer: ReturnType<typeof setTimeout> | undefined, typing = false
let finishAnimation: (() => void) | undefined
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
function stopTyping() { if (typingTimer) clearTimeout(typingTimer); typingTimer = undefined; typing = false; finishAnimation = undefined; log.setAttribute('aria-busy', 'false') }
function output(lines: string[], animate = false) {
  stopTyping(); log.replaceChildren()
  const paragraphs = lines.map(value => { const p = document.createElement('p'); p.textContent = value; log.append(p); return p })
  if (!animate || reducedMotion.matches) { log.scrollTop = log.scrollHeight; return }
  // Animate only the newest scene; previous history remains readable.
  const count = narrative(game.state, language).length
  const targets = paragraphs.slice(-count), contents = targets.map(p => Array.from(p.textContent ?? ''))
  targets.forEach(p => { p.textContent = '' })
  typing = true; log.setAttribute('aria-busy', 'true')
  let line = 0, letter = 0
  finishAnimation = () => { targets.forEach((p, i) => { p.textContent = contents[i]!.join('') }); stopTyping(); renderControls(); log.scrollTop = log.scrollHeight }
  function tick() {
    if (line >= targets.length) { stopTyping(); renderControls(); return }
    targets[line]!.textContent += contents[line]![letter++] ?? ''
    if (letter >= contents[line]!.length) { line++; letter = 0 }
    log.scrollTop = log.scrollHeight; typingTimer = setTimeout(tick, 5)
  }
  tick()
}
log.addEventListener('click', () => finishAnimation?.())
reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) finishAnimation?.() })
function button(label: string, run: () => void, parent: HTMLElement, id?: string) {
  const b = document.createElement('button'); b.textContent = label; b.disabled = typing
  if (id) b.dataset.choice = id
  b.addEventListener('click', () => { if (!typing) run() }); parent.append(b)
}
function start() { game.restart(); history.length = 0; history.push({ state: structuredClone(game.state) }); started = true; panel = 'story'; render(true) }
function choose(id: string) {
  const transition = game.choose(id)
  if (!transition) return
  history.push({ state: transition.after, input: transition.choice.label, result: transition.result })
  render(true)
}
function changeLanguage(value: Language) { language = value; saveLanguage(value); render() }
function open(value: Panel) { panel = value; render() }
function renderControls() {
  actions.replaceChildren(); navigation.replaceChildren()
  if (panel !== 'story') {
    if (panel === 'settings') {
      button('日本語', () => changeLanguage('ja'), actions)
      button('English', () => changeLanguage('en'), actions)
    }
    button(t('back', language), () => open('story'), actions)
  } else if (!started) button(t('start', language), start, actions)
  else if (game.state.status !== 'playing') button(t('restart', language), start, actions)
  else for (const choice of game.choices()) button(choice.label[language], () => choose(choice.id), actions, choice.id)
  for (const name of ['status', 'inventory', 'knowledge', 'help', 'settings'] as const) button(t(name, language), () => open(name), navigation)
}
function render(animate = false) {
  document.documentElement.lang = language
  log.setAttribute('aria-label', t('log', language)); actions.setAttribute('aria-label', t('choices', language))
  let lines: string[]
  if (panel === 'story') lines = !started ? [t('intro', language)] : history.flatMap(entry => [
    ...(entry.input ? [`> ${entry.input[language]}`, entry.result![language]] : []), ...narrative(entry.state, language),
  ])
  else if (panel === 'help') lines = [t('help', language), t('helpText', language)]
  else if (panel === 'settings') lines = [t('settings', language), t('language', language), language === 'ja' ? '日本語' : 'English']
  else lines = [t(panel, language), ...game.read(panel, language)]
  if (lines.length === 1 && panel !== 'story') lines.push(t('empty', language))
  output(lines, animate && panel === 'story'); renderControls()
  // Controls change the log's available height; scroll after their layout settles.
  if (!typing) log.scrollTop = log.scrollHeight
}
render()
