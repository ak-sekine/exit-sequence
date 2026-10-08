import './style.css'
import { Game, narrative } from './game.ts'
import { initialLanguage, saveLanguage, t } from './i18n.ts'
import type { Language } from './i18n.ts'
const app = document.querySelector<HTMLDivElement>('#app')!
const game = new Game()
let language: Language = initialLanguage()
let started = false, menuOpen = false
let menuView: 'root' | 'language' = 'root'
// Snapshot prose when choices are confirmed. Changing language never replays an action.
const history: { state: typeof game.state; input?: { ja: string; en: string }; result?: { ja: string; en: string } }[] = []
const terminal = document.createElement('main')
terminal.className = 'terminal'
const heading = document.createElement('h1'); heading.textContent = 'EXIT SEQUENCE'
const log = document.createElement('div'); log.className = 'terminal-log'; log.tabIndex = 0
log.setAttribute('role', 'log')
const actions = document.createElement('div'); actions.className = 'terminal-actions'
const header = document.createElement('header'); header.className = 'terminal-header'
const menuButton = document.createElement('button'); menuButton.className = 'menu-toggle'
menuButton.type = 'button'; menuButton.innerHTML = '<span aria-hidden="true">≡</span>'
menuButton.setAttribute('aria-controls', 'language-menu')
const menu = document.createElement('div'); menu.id = 'language-menu'; menu.className = 'language-menu'; menu.setAttribute('role', 'group')
header.append(heading, menuButton, menu)
terminal.append(header, log, actions); app.append(terminal)
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
  const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.disabled = typing
  if (id) b.dataset.choice = id
  b.addEventListener('click', () => { if (!typing) run() }); parent.append(b)
}
function start() { game.restart(); history.length = 0; history.push({ state: structuredClone(game.state) }); started = true; closeMenu(); render(true) }
function choose(id: string) {
  const transition = game.choose(id)
  if (!transition) return
  history.push({ state: transition.after, input: transition.choice.label, result: transition.result })
  closeMenu(); render(true)
}
function changeLanguage(value: Language) {
  const scrollTop = log.scrollTop
  language = value; saveLanguage(value); closeMenu(); render()
  // Retranslate snapshot history without moving the reader to the newest scene.
  log.scrollTop = scrollTop; menuButton.focus()
}
function closeMenu(restoreFocus = false) {
  menuOpen = false; menuView = 'root'; renderMenu()
  if (restoreFocus) menuButton.focus()
}
function renderMenu() {
  menuButton.disabled = typing
  menuButton.setAttribute('aria-label', t('menu', language))
  menuButton.setAttribute('aria-expanded', String(menuOpen))
  menu.setAttribute('aria-label', t('language', language))
  menu.hidden = !menuOpen; menu.replaceChildren()
  if (!menuOpen) return
  if (menuView === 'root') button(`${t('language', language)} >`, () => {
    menuView = 'language'; renderMenu(); menu.querySelector('button')?.focus()
  }, menu)
  else {
    button('日本語', () => changeLanguage('ja'), menu)
    button('English', () => changeLanguage('en'), menu)
  }
}
menuButton.addEventListener('click', () => {
  if (typing) return
  if (menuOpen) closeMenu()
  else { menuOpen = true; menuView = 'root'; renderMenu() }
})
document.addEventListener('pointerdown', event => {
  if (menuOpen && event.target instanceof Node && !menu.contains(event.target) && !menuButton.contains(event.target)) {
    closeMenu(menu.contains(document.activeElement))
  }
})
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuOpen) { event.preventDefault(); closeMenu(true) }
})
function renderControls() {
  actions.replaceChildren()
  if (!started) button(t('start', language), start, actions)
  else if (game.state.status !== 'playing') button(t('restart', language), start, actions)
  else for (const choice of game.choices()) button(choice.label[language], () => choose(choice.id), actions, choice.id)
  renderMenu()
}
function render(animate = false) {
  document.documentElement.lang = language
  log.setAttribute('aria-label', t('log', language)); actions.setAttribute('aria-label', t('choices', language))
  const lines = !started ? [t('intro', language)] : history.flatMap(entry => [
    ...(entry.input ? [`> ${entry.input[language]}`, entry.result![language]] : []), ...narrative(entry.state, language),
  ])
  output(lines, animate); renderControls()
  // Controls change the log's available height; scroll after their layout settles.
  if (!typing) log.scrollTop = log.scrollHeight
}
render()
