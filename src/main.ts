import './style.css'
import { Game } from './game.ts'
import { levels } from './levels.ts'
import { initialLanguage, t } from './i18n.ts'
import type { Language } from './i18n.ts'
import type { Direction, EntityKind, Terrain } from './model.ts'

const game = new Game()
let language: Language = initialLanguage()
let menuOpen = false
const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `<main class="terminal">
  <header><h1>EXIT SEQUENCE</h1><button class="menu-toggle" aria-controls="language-menu" aria-expanded="false">≡</button>
    <div id="language-menu" class="language-menu" hidden><button data-language="ja">日本語</button><button data-language="en">English</button></div>
  </header>
  <div class="status-line"><div class="stage"></div><p class="message" role="status" aria-live="polite" aria-atomic="true"></p></div>
  <section class="playfield"><div class="board" role="img"></div><div class="legend"></div></section>
  <div class="rules"></div>
  <div class="controls">
    <div class="directions"><button data-direction="up">↑</button><button data-direction="left">←</button><button data-direction="down">↓</button><button data-direction="right">→</button></div>
    <div class="tools"><button data-action="undo">UNDO</button><button data-action="restart">RESTART</button></div>
    <button class="advance" data-action="next" hidden>NEXT STAGE</button>
  </div>
</main>`
function element<T extends HTMLElement>(selector: string) { return app.querySelector<T>(selector)! }
const board = element<HTMLDivElement>('.board')
const menu = element<HTMLDivElement>('.language-menu')
const menuButton = element<HTMLButtonElement>('.menu-toggle')
const advance = element<HTMLButtonElement>('.advance')
const entitySymbols: Record<EntityKind, string> = { player: '@', robot: 'R', box: 'B' }
const terrainSymbols: Record<Terrain, string> = { floor: '.', wall: '#', hole: 'O', goal: 'G' }
function renderMenu() {
  menu.hidden = !menuOpen
  menuButton.setAttribute('aria-expanded', String(menuOpen))
  menuButton.setAttribute('aria-label', t('menu', language))
  for (const button of menu.querySelectorAll<HTMLButtonElement>('button')) button.setAttribute('aria-pressed', String(button.dataset.language === language))
}
function closeMenu(focus = false) { menuOpen = false; renderMenu(); if (focus) menuButton.focus() }
function render() {
  const state = game.state
  document.documentElement.lang = language
  element('.stage').textContent = `STAGE ${state.stageIndex + 1} / ${levels.length}`
  board.replaceChildren()
  board.style.setProperty('--columns', String(state.terrain[0]!.length))
  const rows: string[] = []
  state.terrain.forEach((row, y) => {
    let symbols = ''
    row.forEach((terrain, x) => {
      const entity = state.entities.find(e => e.x === x && e.y === y)
      const cell = document.createElement('span')
      const symbol = entity ? entitySymbols[entity.kind] : terrainSymbols[terrain]
      cell.textContent = symbol
      cell.className = `cell ${terrain} ${entity?.kind ?? ''}`
      cell.dataset.x = String(x); cell.dataset.y = String(y)
      // Mark terrain beneath entities without changing their identifying symbols.
      cell.title = entity ? `${entitySymbols[entity.kind]} ${entity.kind.toUpperCase()} / ${terrain.toUpperCase()}` : terrain.toUpperCase()
      if (terrain === 'goal' && entity) cell.dataset.onGoal = 'true'
      cell.setAttribute('aria-hidden', 'true')
      board.append(cell)
      symbols += symbol
    })
    rows.push(symbols)
  })
  board.setAttribute('aria-label', `${t('board', language)}\n${rows.join('\n')}`)
  element('.legend').textContent = t('legend', language)
  element('.rules').textContent = t('rules', language)
  element('.message').textContent = t(state.message, language)
  for (const button of app.querySelectorAll<HTMLButtonElement>('[data-direction]')) {
    button.disabled = state.status !== 'playing'
    button.setAttribute('aria-label', t(button.dataset.direction as Direction, language))
  }
  element<HTMLButtonElement>('[data-action="undo"]').disabled = !game.undoCount
  element('.directions').hidden = state.status !== 'playing'
  advance.hidden = state.status !== 'clear' && state.status !== 'all-clear'
  advance.textContent = t(state.status === 'all-clear' ? 'again' : 'next', language)
  renderMenu()
}
function move(direction: Direction) {
  closeMenu()
  if (!game.move(direction) && game.state.status === 'playing') {
    // Feedback is UI-only: failed moves never change state, history, or robot position.
    element('.message').textContent = t('blocked', language)
    return
  }
  render()
}
for (const button of app.querySelectorAll<HTMLButtonElement>('[data-direction]')) button.addEventListener('click', () => move(button.dataset.direction as Direction))
element('[data-action="undo"]').addEventListener('click', () => { game.undo(); closeMenu(); render() })
element('[data-action="restart"]').addEventListener('click', () => { game.restart(); closeMenu(); render() })
advance.addEventListener('click', () => {
  if (game.state.status === 'all-clear') game.playAgain()
  else game.nextStage()
  closeMenu(); render()
})
menuButton.addEventListener('click', () => { menuOpen = !menuOpen; renderMenu() })
for (const button of menu.querySelectorAll<HTMLButtonElement>('button')) button.addEventListener('click', () => {
  language = button.dataset.language as Language
  closeMenu(true); render()
})
document.addEventListener('pointerdown', event => {
  if (menuOpen && event.target instanceof Node && !menu.contains(event.target) && !menuButton.contains(event.target)) closeMenu(menu.contains(document.activeElement))
})
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuOpen) { event.preventDefault(); closeMenu(true); return }
  if (menuOpen || event.target instanceof HTMLButtonElement && menu.contains(event.target)) return
  const keys: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }
  const direction = keys[event.key]
  if (direction) { event.preventDefault(); move(direction) }
})
render()
