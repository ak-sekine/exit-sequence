import './style.css'
import { DUNGEON_MAP, INITIAL_PLAYER, move, passDoor } from './dungeon.ts'
import type { Cell, Direction, Player } from './dungeon.ts'
import { clampMapCenter, initialVisited, recordMovement, renderMap, scrollMap } from './automap.ts'
import { renderDungeon } from './renderer.ts'
import { initialLanguage, t } from './i18n.ts'
import type { Language, Message } from './i18n.ts'

let player: Player = INITIAL_PLAYER
let language: Language = initialLanguage()
let menuOpen = false
let view: '3d' | '2d' = '3d'
let mapCenter: Cell = clampMapCenter(DUNGEON_MAP, player)
const visited = initialVisited(player)
const logs: Message[] = ['ready']
const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `<main class="terminal">
  <header><h1>EXIT SEQUENCE</h1><button class="menu-toggle" aria-controls="language-menu" aria-expanded="false">≡</button>
    <div id="language-menu" class="language-menu" hidden><button data-language="ja">日本語</button><button data-language="en">English</button></div>
  </header>
  <div class="dungeon-row">
    <section class="dungeon" role="img"></section>
    <section class="status"><dl><div class="status-item"><dt class="direction-label"></dt><dd class="direction-value" aria-live="polite" aria-atomic="true"></dd></div></dl></section>
  </div>
  <section class="log" role="log" aria-live="polite" aria-relevant="additions" tabindex="0"></section>
  <div class="controls"><div class="directions"><span class="controls-mode"></span><button data-direction="up">↑</button><button data-direction="left">←</button><button data-direction="down">↓</button><button data-direction="right">→</button></div>
  <div class="actions"><button data-action="b">B</button><button data-action="a">A</button></div></div>
</main>`
function element<T extends HTMLElement>(selector: string) { return app.querySelector<T>(selector)! }
const dungeon = element('.dungeon'), log = element('.log')
const menu = element('.language-menu'), menuButton = element('.menu-toggle')
function renderMenu() {
  menu.hidden = !menuOpen
  menuButton.setAttribute('aria-expanded', String(menuOpen))
  menuButton.setAttribute('aria-label', t('menu', language))
  for (const button of menu.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.language === language))
}
function closeMenu(focus = false) { menuOpen = false; renderMenu(); if (focus) menuButton.focus() }
function appendLog(message: Message) {
  const entry = document.createElement('p'); entry.textContent = t(message, language); log.append(entry)
  log.scrollTop = log.scrollHeight
}
function render() {
  document.documentElement.lang = language
  dungeon.innerHTML = view === '3d' ? renderDungeon(DUNGEON_MAP, player) : renderMap(DUNGEON_MAP, player, visited, undefined, mapCenter)
  dungeon.dataset.view = view
  dungeon.dataset.centerX = String(mapCenter.x); dungeon.dataset.centerY = String(mapCenter.y)
  element('.controls-mode').textContent = t(view === '2d' ? 'mapControls' : 'playerControls', language)
  for (const button of app.querySelectorAll<HTMLButtonElement>('[data-action="a"]')) button.disabled = view === '2d'
  element('[data-action="b"]').setAttribute('aria-label', t(view === '3d' ? 'showMap' : 'showDungeon', language))
  element('[data-action="b"]').setAttribute('aria-pressed', String(view === '2d'))
  dungeon.dataset.x = String(player.x); dungeon.dataset.y = String(player.y); dungeon.dataset.facing = String(player.facing)
  dungeon.setAttribute('aria-label', `${t(view === '3d' ? 'dungeon' : 'map', language)} (${player.x}, ${player.y}) ${['N', 'E', 'S', 'W'][player.facing]}`)
  element('.direction-label').textContent = t('direction', language)
  element('.direction-value').textContent = t((['north', 'east', 'south', 'west'] as const)[player.facing], language)
  log.setAttribute('aria-label', t('log', language))
  for (const button of app.querySelectorAll<HTMLButtonElement>('[data-direction]')) {
    const key = view === '2d' ? `scroll${button.dataset.direction}` as Message : button.dataset.direction as Direction
    button.setAttribute('aria-label', t(key, language)); button.title = t(key, language)
  }
  renderMenu()
}
function act(direction: Direction) {
  if (view === '2d') {
    mapCenter = scrollMap(DUNGEON_MAP, mapCenter, direction)
    closeMenu(); render(); return
  }
  const result = move(DUNGEON_MAP, player, direction)
  recordMovement(visited, player, result.player)
  player = result.player; logs.push(result.message)
  closeMenu(); render(); appendLog(result.message)
}
for (const button of app.querySelectorAll<HTMLButtonElement>('[data-direction]')) button.addEventListener('click', () => act(button.dataset.direction as Direction))
element('[data-action="a"]').addEventListener('click', () => {
  if (view === '2d') return
  const result = passDoor(DUNGEON_MAP, player)
  if (!result) return
  recordMovement(visited, player, result.player)
  player = result.player; logs.push(result.message)
  closeMenu(); render(); appendLog(result.message)
})
element('[data-action="b"]').addEventListener('click', () => {
  if (view === '3d') mapCenter = clampMapCenter(DUNGEON_MAP, player)
  view = view === '3d' ? '2d' : '3d'
  render()
})
menuButton.addEventListener('click', () => { menuOpen = !menuOpen; renderMenu() })
for (const button of menu.querySelectorAll<HTMLButtonElement>('button')) button.addEventListener('click', () => {
  language = button.dataset.language as Language
  closeMenu(true); render(); log.replaceChildren(); logs.forEach(appendLog)
})
document.addEventListener('pointerdown', event => {
  if (menuOpen && event.target instanceof Node && !menu.contains(event.target) && !menuButton.contains(event.target)) closeMenu(menu.contains(document.activeElement))
})
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuOpen) { event.preventDefault(); closeMenu(true); return }
  if (menuOpen) return
  const keys: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }
  const direction = keys[event.key]
  if (direction) { event.preventDefault(); act(direction) }
})
render(); appendLog('ready')
