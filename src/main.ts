import './style.css'
import { renderMap } from './automap.ts'
import { normalizeStick, POINTER_TURN_RADIANS_PER_PIXEL } from './controls.ts'
import { cellAt, DOORS, DUNGEON_MAP, locationKind } from './dungeon.ts'
import { createGame, interact, MAX_SIMULATION_STEP, rotatePlayer, stepGame } from './game.ts'
import { compass, initialLanguage, t } from './i18n.ts'
import type { Language } from './i18n.ts'
import { renderDungeon } from './renderer.ts'

let game = createGame()
let language: Language = initialLanguage()
let menuOpen = false
let mapOpen = false
let pendingRotation = 0
let lastFrame = 0
const heldKeys = new Set<string>()
const pointers = new Map<number, { kind: 'stick' | 'look' | 'action'; lastX: number }>()
let stick = { x: 0, y: 0 }

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `<main class="shell">
  <header class="topbar">
    <h1>EXIT SEQUENCE</h1>
    <button class="menu-toggle" type="button" aria-controls="game-menu" aria-expanded="false">≡</button>
    <section id="game-menu" class="menu-panel" aria-label="Menu" hidden>
      <div class="menu-panel-title"><span class="menu-label"></span><button class="resume-button" type="button"></button></div>
      <button class="map-button" type="button"></button>
      <div class="language-row"><span class="language-label"></span><button data-language="ja" type="button">日本語</button><button data-language="en" type="button">English</button></div>
    </section>
  </header>
  <section class="scene-frame" aria-label="Dungeon view">
    <canvas class="game-canvas"></canvas>
    <div class="pause-banner" hidden></div>
    <section class="map-screen" aria-label="Explored map" hidden>
      <div class="map-toolbar"><span class="map-title"></span><button class="map-close" type="button"></button></div>
      <div class="map-art"></div>
    </section>
    <div class="game-over-screen" hidden></div>
  </section>
  <section class="status" aria-label="Status">
    <span class="status-direction"></span><span class="status-coordinate"></span><span class="status-location"></span>
    <span class="status-signal" hidden></span>
  </section>
  <section class="event-log" role="log" aria-live="polite" aria-relevant="additions" aria-atomic="false"></section>
  <section class="controls" aria-label="Game controls">
    <div class="joystick" role="application" tabindex="0"><span class="stick-ring"></span><span class="stick-knob"></span><span class="joystick-label"></span></div>
    <button class="action-button" type="button"><span class="action-letter">A</span></button>
  </section>
</main>`

function element<T extends HTMLElement>(selector: string): T { return app.querySelector<T>(selector)! }
const canvas = element<HTMLCanvasElement>('.game-canvas')
const scene = element<HTMLElement>('.scene-frame')
const menuButton = element<HTMLButtonElement>('.menu-toggle')
const menuPanel = element<HTMLElement>('.menu-panel')
const joystick = element<HTMLElement>('.joystick')
const knob = element<HTMLElement>('.stick-knob')
const mapScreen = element<HTMLElement>('.map-screen')
const mapArt = element<HTMLElement>('.map-art')
const pauseBanner = element<HTMLElement>('.pause-banner')
const overScreen = element<HTMLElement>('.game-over-screen')

const STICK_TRAVEL = 0.34

function isPaused(): boolean { return menuOpen || mapOpen || document.hidden }

function resetInputs(): void {
  for (const pointerId of pointers.keys()) {
    try { if (app.hasPointerCapture(pointerId)) app.releasePointerCapture(pointerId) } catch { /* pointer already ended */ }
  }
  pointers.clear()
  heldKeys.clear()
  pendingRotation = 0
  stick = { x: 0, y: 0 }
  knob.style.transform = 'translate(0, 0)'
}

function normalizedStick(clientX: number, clientY: number): { x: number; y: number } {
  const bounds = joystick.getBoundingClientRect()
  const radius = Math.min(bounds.width, bounds.height) * STICK_TRAVEL
  const x = (clientX - (bounds.left + bounds.width / 2)) / radius
  const y = (clientY - (bounds.top + bounds.height / 2)) / radius
  return normalizeStick(x, y)
}

function updateStick(clientX: number, clientY: number): void {
  const bounds = joystick.getBoundingClientRect()
  const radius = Math.min(bounds.width, bounds.height) * STICK_TRAVEL
  const dx = clientX - (bounds.left + bounds.width / 2), dy = clientY - (bounds.top + bounds.height / 2)
  const scale = Math.min(1, radius / Math.max(1, Math.hypot(dx, dy)))
  knob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`
  stick = normalizedStick(clientX, clientY)
}

function movementInput() {
  const forward = stick.y * -1 + Number(heldKeys.has('w')) - Number(heldKeys.has('s'))
  const strafe = stick.x + Number(heldKeys.has('d')) - Number(heldKeys.has('a'))
  return { forward, strafe }
}

function performAction(): void {
  if (isPaused() || game.gameOver) return
  game = interact(game, DUNGEON_MAP, DOORS)
  render()
}

function showMenu(open: boolean): void {
  menuOpen = open
  if (open) { mapOpen = false; resetInputs(); lastFrame = 0 }
  render()
}

function showMap(open: boolean): void {
  mapOpen = open
  menuOpen = false
  if (open) { resetInputs(); lastFrame = 0 }
  render()
}

function render(): void {
  document.documentElement.lang = language
  const paused = isPaused()
  const menuLabel = t('menu', language)
  menuButton.setAttribute('aria-label', menuLabel)
  menuButton.setAttribute('aria-expanded', String(menuOpen || mapOpen))
  menuPanel.hidden = !menuOpen
  element('.menu-label').textContent = menuLabel
  element<HTMLButtonElement>('.resume-button').textContent = t('resume', language)
  element<HTMLButtonElement>('.map-button').textContent = t('showMap', language)
  element('.language-label').textContent = t('language', language)
  for (const button of menuPanel.querySelectorAll<HTMLButtonElement>('[data-language]')) {
    button.setAttribute('aria-pressed', String(button.dataset.language === language))
  }

  mapScreen.hidden = !mapOpen
  element('.map-title').textContent = t('mapLabel', language)
  element<HTMLButtonElement>('.map-close').textContent = '×'
  element<HTMLButtonElement>('.map-close').setAttribute('aria-label', t('closeMap', language))
  if (mapOpen) mapArt.innerHTML = renderMap(DUNGEON_MAP, game.player, game.visited, DOORS, game.openDoors, game.detections)
  pauseBanner.hidden = !menuOpen || mapOpen || game.gameOver
  pauseBanner.textContent = t('paused', language)
  overScreen.hidden = !game.gameOver
  overScreen.textContent = t('gameOver', language)

  const cell = cellAt(game.player)
  const location = locationKind(DUNGEON_MAP, game.player)
  element('.status-direction').textContent = `${t('direction', language)} ${compass(game.player.heading, language)}`
  element('.status-coordinate').textContent = `${t('coordinates', language)} ${String(cell.x).padStart(2, '0')},${String(cell.y).padStart(2, '0')}`
  element('.status-location').textContent = location ? t(location, language) : ''
  const signal = element<HTMLElement>('.status-signal')
  signal.hidden = game.detections.length === 0
  signal.textContent = game.detections.some(detection => detection.kind === 'sight') ? t('enemyDetected', language) : t('heardMovement', language)

  const log = element<HTMLElement>('.event-log')
  log.setAttribute('aria-label', t('log', language))
  log.replaceChildren(...game.events.map(event => {
    const line = document.createElement('p')
    line.dataset.eventId = String(event.id)
    line.textContent = t(event.key, language)
    return line
  }))

  const visible = renderDungeon(canvas, game)
  scene.dataset.x = game.player.x.toFixed(3)
  scene.dataset.y = game.player.y.toFixed(3)
  scene.dataset.heading = game.player.heading.toFixed(4)
  scene.dataset.time = game.time.toFixed(3)
  scene.dataset.paused = String(paused)
  scene.dataset.gameOver = String(game.gameOver)
  scene.dataset.openDoors = game.openDoors.map(open => open ? '1' : '0').join('')
  scene.dataset.visibleEnemies = visible.join(',')
  scene.setAttribute('aria-label', `${t('dungeon', language)} ${cell.x},${cell.y}`)
  canvas.setAttribute('aria-label', `${t('dungeon', language)} ${cell.x},${cell.y}`)
  element('.joystick-label').textContent = t('joystick', language)
  element<HTMLButtonElement>('.action-button').setAttribute('aria-label', `${t('action', language)} · ${t('doorAhead', language)}`)
}

menuButton.addEventListener('click', () => showMenu(!menuOpen && !mapOpen))
element<HTMLButtonElement>('.resume-button').addEventListener('click', () => showMenu(false))
element<HTMLButtonElement>('.map-button').addEventListener('click', () => showMap(true))
element<HTMLButtonElement>('.map-close').addEventListener('click', () => showMap(false))
for (const button of menuPanel.querySelectorAll<HTMLButtonElement>('[data-language]')) {
  button.addEventListener('click', () => { language = button.dataset.language as Language; render() })
}
element<HTMLButtonElement>('.action-button').addEventListener('click', event => {
  if (event.detail === 0) performAction()
})

app.addEventListener('pointerdown', event => {
  const target = event.target instanceof Element ? event.target : null
  if (!target) return
  const pointerId = event.pointerId
  if (target.closest('.joystick')) {
    if (isPaused() || game.gameOver || [...pointers.values()].some(pointer => pointer.kind === 'stick')) return
    event.preventDefault()
    pointers.set(pointerId, { kind: 'stick', lastX: event.clientX })
    try { app.setPointerCapture(pointerId) } catch { /* capture is best effort on synthetic events */ }
    updateStick(event.clientX, event.clientY)
    return
  }
  if (target.closest('.action-button')) {
    if (isPaused() || game.gameOver) return
    event.preventDefault()
    pointers.set(pointerId, { kind: 'action', lastX: event.clientX })
    try { app.setPointerCapture(pointerId) } catch { /* capture is best effort on synthetic events */ }
    performAction()
    return
  }
  if (target.closest('button')) return
  if (isPaused() || game.gameOver) return
  event.preventDefault()
  pointers.set(pointerId, { kind: 'look', lastX: event.clientX })
  try { app.setPointerCapture(pointerId) } catch { /* capture is best effort on synthetic events */ }
}, { passive: false })

app.addEventListener('pointermove', event => {
  const pointer = pointers.get(event.pointerId)
  if (!pointer) return
  event.preventDefault()
  if (pointer.kind === 'stick') updateStick(event.clientX, event.clientY)
  else if (pointer.kind === 'look') {
    pendingRotation += (event.clientX - pointer.lastX) * POINTER_TURN_RADIANS_PER_PIXEL
    pointer.lastX = event.clientX
  }
}, { passive: false })

function endPointer(event: PointerEvent): void {
  const pointer = pointers.get(event.pointerId)
  if (!pointer) return
  if (pointer.kind === 'stick') {
    stick = { x: 0, y: 0 }
    knob.style.transform = 'translate(0, 0)'
  }
  pointers.delete(event.pointerId)
}
app.addEventListener('pointerup', endPointer)
app.addEventListener('pointercancel', endPointer)
app.addEventListener('lostpointercapture', endPointer)

document.addEventListener('keydown', event => {
  const key = event.key.toLowerCase()
  if (key === 'escape') {
    event.preventDefault()
    if (mapOpen) showMap(false)
    else if (menuOpen) showMenu(false)
    else showMenu(true)
    return
  }
  if ((key === 'e' || event.code === 'Space') && !event.repeat) { event.preventDefault(); performAction(); return }
  if (['w', 'a', 's', 'd'].includes(key) && !isPaused() && !game.gameOver) {
    event.preventDefault(); heldKeys.add(key)
  }
})
document.addEventListener('keyup', event => heldKeys.delete(event.key.toLowerCase()))
window.addEventListener('blur', resetInputs)
document.addEventListener('visibilitychange', () => { resetInputs(); lastFrame = 0; render() })

function frame(timestamp: number): void {
  const dt = lastFrame === 0 ? 0 : Math.min(MAX_SIMULATION_STEP, Math.max(0, (timestamp - lastFrame) / 1000))
  lastFrame = timestamp
  if (!isPaused() && !game.gameOver) {
    if (pendingRotation) { game = rotatePlayer(game, pendingRotation); pendingRotation = 0 }
    if (dt > 0) game = stepGame(game, movementInput(), dt, DUNGEON_MAP, DOORS)
  }
  render()
  requestAnimationFrame(frame)
}

render()
requestAnimationFrame(frame)
