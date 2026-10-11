import './style.css'
import { DUNGEON_MAP } from './dungeon.ts'
import { DOORS, VECTORS, doorBetween, isFloor } from './dungeon.ts'
import type { Cell, Direction } from './dungeon.ts'
import { clampMapCenter, initialVisited, recordMovement, renderMap, scrollMap } from './automap.ts'
import { renderDungeon } from './renderer.ts'
import { initialLanguage, t, translateLog } from './i18n.ts'
import type { Language } from './i18n.ts'
import { advanceTurn, createGame } from './game.ts'
import { commandText, menuOptions, pendingCommand, canGoBack, optionPage } from './commands.ts'
import type { MenuState, CommandId, HistoryEntry } from './commands.ts'
let game = createGame()
let player = game.player
let language: Language = initialLanguage()
let menuOpen = false
let ui: MenuState = 'normal'
let currentPage = 0
const history: HistoryEntry[] = game.logs.map(event => ({ kind: 'event', event }))
let view: '3d' | '2d' = '3d'
let mapCenter: Cell = clampMapCenter(DUNGEON_MAP, player)
const visited = initialVisited(player)

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
  <div class="controls"></div>
  <div class="operation-row">
    <button class="back-button" data-command="back"></button>
    <nav class="pagination"><button class="previous-page">＜</button><span class="page-number"></span><button class="next-page">＞</button></nav>
  </div>
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
let renderedHistoryLength = -1
let renderedLanguage: Language | undefined
function renderHistory(preserveScroll = false) {
  // UI-only operations keep existing log nodes and their scroll position.
  if (renderedHistoryLength === history.length && renderedLanguage === language) {
    element('.prompt').textContent = commandText(pendingCommand(ui), language)
    return
  }
  renderedHistoryLength = history.length
  renderedLanguage = language
  const scrollTop = log.scrollTop
  log.replaceChildren()
  for (const entry of history) {
    const line = document.createElement('p')
    line.dataset.kind = entry.kind
    line.textContent = entry.kind === 'command' ? commandText(entry.ids, language)
      : entry.kind === 'message' ? t(entry.message, language) : translateLog(entry.event, language)
    log.append(line)
  }
  const prompt = document.createElement('p')
  prompt.className = 'prompt'
  prompt.textContent = commandText(pendingCommand(ui), language)
  log.append(prompt)
  log.scrollTop = preserveScroll ? scrollTop : log.scrollHeight
}
function facingDoor() {
  const v = VECTORS[player.facing], target = { x: player.x + v.x, y: player.y + v.y }
  return isFloor(DUNGEON_MAP, player.x, player.y) && isFloor(DUNGEON_MAP, target.x, target.y)
    && !!doorBetween(DOORS, player, target)
}
function render(preserveScroll = false) {
  document.documentElement.lang = language
  dungeon.innerHTML = view === '3d' ? renderDungeon(DUNGEON_MAP, player) : renderMap(DUNGEON_MAP, player, visited, undefined, mapCenter, game.detections)
  dungeon.dataset.turn = String(game.turn); dungeon.dataset.gameOver = String(game.gameOver)
  dungeon.dataset.view = view
  dungeon.dataset.centerX = String(mapCenter.x); dungeon.dataset.centerY = String(mapCenter.y)
  dungeon.dataset.x = String(player.x); dungeon.dataset.y = String(player.y); dungeon.dataset.facing = String(player.facing)
  dungeon.setAttribute('aria-label', `${t(view === '3d' ? 'dungeon' : 'map', language)} (${player.x}, ${player.y}) ${['N', 'E', 'S', 'W'][player.facing]}`)
  element('.direction-label').textContent = t('direction', language)
  element('.direction-value').textContent = t((['north', 'east', 'south', 'west'] as const)[player.facing], language)
  log.setAttribute('aria-label', t('log', language))
  const controls = element('.controls')
  controls.replaceChildren()
  controls.dataset.menu = ui
  const page = optionPage(menuOptions(ui, facingDoor(), game.gameOver), currentPage)
  currentPage = page.page
  for (const option of page.slots) {
    if (!option) { const blank = document.createElement('div'); blank.className = 'empty-slot'; controls.append(blank); continue }
    const button = document.createElement('button')
    button.dataset.command = option.id
    button.textContent = t(option.id, language) + (option.parent ? ' >' : '')
    button.disabled = !!option.disabled
    button.addEventListener('click', () => choose(option.id))
    controls.append(button)
  }
  const back = element<HTMLButtonElement>('.back-button')
  back.textContent = t('back', language)
  back.disabled = !canGoBack(ui)
  element('.page-number').textContent = `${page.page + 1} / ${page.totalPages}`
  const previous = element<HTMLButtonElement>('.previous-page'), next = element<HTMLButtonElement>('.next-page')
  previous.disabled = page.page === 0
  next.disabled = page.page === page.totalPages - 1
  previous.setAttribute('aria-label', t('previousPage', language))
  next.setAttribute('aria-label', t('nextPage', language))
  element('.pagination').setAttribute('aria-label', t('pages', language))
  renderMenu()
  renderHistory(preserveScroll)
}
function commit(ids: readonly CommandId[]) { history.push({ kind: 'command', ids: [...ids] }) }
function performTurn(action: Direction | 'a') {
  const before = game
  game = advanceTurn(game, action)
  if (game.turn !== before.turn) recordMovement(visited, player, game.player)
  player = game.player
  history.push(...game.logs.slice(before.logs.length).map(event => ({ kind: 'event' as const, event })))
}
function choose(id: CommandId) {
  // Validate against the current menu, including game-over restrictions.
  if (id === 'back' ? !canGoBack(ui) : !optionPage(menuOptions(ui, facingDoor(), game.gameOver), currentPage).slots.some(option => option?.id === id && !option.disabled)) return
  const previousMenu = ui, previousHistoryLength = history.length
  if (ui === 'normal') ui = id === 'move' ? 'movement' : id === 'inspect' ? 'inspection' : 'inventory'
  else if (id === 'back') ui = 'normal'
  else if (ui === 'movement') {
    commit(['move', id])
    performTurn(({ forward: 'up', turnBack: 'down', turnLeft: 'left', turnRight: 'right' } as const)[id as 'forward' | 'turnBack' | 'turnLeft' | 'turnRight'])
  } else if (ui === 'inspection' && id === 'door') {
    commit(['inspect', 'door'])
    history.push({ kind: 'message', message: 'doorConfirmation' })
    ui = 'confirmation'
  } else if (ui === 'confirmation') {
    commit([id])
    if (id === 'yes' && !game.gameOver && facingDoor()) performTurn('a')
    ui = 'normal'
  } else if (ui === 'inventory' && id === 'itemMap') {
    mapCenter = clampMapCenter(DUNGEON_MAP, player)
    view = '2d'; ui = 'map'
  } else if (ui === 'map') {
    if (id === 'close') { view = '3d'; ui = 'normal' }
    else mapCenter = scrollMap(DUNGEON_MAP, mapCenter, ({ mapUp: 'up', mapDown: 'down', mapLeft: 'left', mapRight: 'right' } as const)[id as 'mapUp' | 'mapDown' | 'mapLeft' | 'mapRight'])
  }
  if (ui !== previousMenu) currentPage = 0
  closeMenu(); render(history.length === previousHistoryLength)
}
element('.back-button').addEventListener('click', () => choose('back'))
for (const [selector, delta] of [['.previous-page', -1], ['.next-page', 1]] as const) {
  element(selector).addEventListener('click', () => {
    currentPage = optionPage(menuOptions(ui, facingDoor(), game.gameOver), currentPage + delta).page
    render(true)
  })
}
menuButton.addEventListener('click', () => { menuOpen = !menuOpen; renderMenu() })
for (const button of menu.querySelectorAll<HTMLButtonElement>('button')) button.addEventListener('click', () => {
  language = button.dataset.language as Language
  closeMenu(true); render(true)
})
document.addEventListener('pointerdown', event => {
  if (menuOpen && event.target instanceof Node && !menu.contains(event.target) && !menuButton.contains(event.target)) closeMenu(menu.contains(document.activeElement))
})
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuOpen) { event.preventDefault(); closeMenu(true); return }
})
render()
