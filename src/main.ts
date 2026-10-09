import './style.css'
import { DUNGEON_MAP, INITIAL_PLAYER, move, passDoor } from './dungeon.ts'
import type { Direction, Player } from './dungeon.ts'
import { renderDungeon } from './renderer.ts'
import { initialLanguage, t } from './i18n.ts'
import type { Language, Message } from './i18n.ts'

let player: Player = INITIAL_PLAYER
let language: Language = initialLanguage()
let menuOpen = false
const logs: Message[] = ['ready']
const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `<main class="terminal">
  <header><h1>EXIT SEQUENCE</h1><button class="menu-toggle" aria-controls="language-menu" aria-expanded="false">≡</button>
    <div id="language-menu" class="language-menu" hidden><button data-language="ja">日本語</button><button data-language="en">English</button></div>
  </header>
  <section class="dungeon" role="img"></section>
  <section class="log" role="log" aria-live="polite" aria-relevant="additions" tabindex="0"></section>
  <div class="controls"><div class="directions"><button data-direction="up">↑</button><button data-direction="left">←</button><button data-direction="down">↓</button><button data-direction="right">→</button></div>
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
  dungeon.innerHTML = renderDungeon(DUNGEON_MAP, player)
  dungeon.dataset.x = String(player.x); dungeon.dataset.y = String(player.y); dungeon.dataset.facing = String(player.facing)
  dungeon.setAttribute('aria-label', `${t('dungeon', language)} (${player.x}, ${player.y}) ${['N', 'E', 'S', 'W'][player.facing]}`)
  log.setAttribute('aria-label', t('log', language))
  for (const button of app.querySelectorAll<HTMLButtonElement>('[data-direction]')) button.setAttribute('aria-label', t(button.dataset.direction as Direction, language))
  renderMenu()
}
function act(direction: Direction) {
  const result = move(DUNGEON_MAP, player, direction)
  player = result.player; logs.push(result.message)
  closeMenu(); render(); appendLog(result.message)
}
for (const button of app.querySelectorAll<HTMLButtonElement>('[data-direction]')) button.addEventListener('click', () => act(button.dataset.direction as Direction))
element('[data-action="a"]').addEventListener('click', () => {
  const result = passDoor(DUNGEON_MAP, player)
  if (!result) return
  player = result.player; logs.push(result.message)
  closeMenu(); render(); appendLog(result.message)
})
// B remains an enabled native button with no game action.
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
