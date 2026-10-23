import './style.css'
import {
  createGame,
  createSeededRandom,
  displayedPowerDelta,
  randomSeed,
  resolveAction,
  toGameView,
  TOTAL_TILES,
} from './game.ts'
import type { GameView } from './game.ts'

const app = document.querySelector<HTMLDivElement>('#app')!
let seed = seedFromAddress()
let random = createSeededRandom(seed)
let game = createGame(random, seed)

function seedFromAddress(): number {
  const supplied = new URLSearchParams(window.location.search).get('seed')
  if (supplied === null || supplied.trim() === '') return randomSeed()
  const parsed = Number(supplied)
  return Number.isFinite(parsed) ? Math.floor(parsed) >>> 0 : randomSeed()
}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value}`
}

function routeMarkup(view: GameView): string {
  return Array.from({ length: TOTAL_TILES }, (_, index) => {
    const tile = index + 1
    const completed = view.history.some(entry => entry.tile === tile)
    const current = tile === view.position && view.status === 'playing'
    const zoneBreak = tile === 6 || tile === 11 ? ' zone-break' : ''
    const state = completed ? 'done' : current ? 'current' : 'future'
    return `<li class="route-tile ${state}${zoneBreak}" aria-label="${tile}">${String(tile).padStart(2, '0')}</li>`
  }).join('')
}

function logMarkup(view: GameView): string {
  if (view.history.length === 0) return '<p class="empty-log">まだ記録はありません。</p>'
  return `<ol class="event-log">${[...view.history].reverse().map(entry => `
    <li class="log-entry">
      <div class="log-heading"><span>区画 ${entry.zone} · ${String(entry.tile).padStart(2, '0')}</span><strong class="${entry.success ? 'text-good' : 'text-bad'}">${entry.success ? '成功' : '失敗'}</strong></div>
      <p class="log-event">${entry.title} — ${entry.actionLabel}</p>
      <p class="log-observation">観測: ${entry.observationText}</p>
      <p class="log-power">電力 ${entry.powerBefore} → ${entry.powerAfter} <span>(${signed(entry.powerChange)})</span></p>
    </li>`).join('')}</ol>`
}

function resultMarkup(view: GameView): string {
  if (view.status === 'won') {
    return `<section class="run-result success" aria-live="polite"><span class="result-mark">[ CLEAR ]</span><p>地上の出口に到達。残存電力 <strong>${view.power}</strong></p></section>`
  }
  if (view.status === 'lost') {
    return `<section class="run-result failure" aria-live="polite"><span class="result-mark">[ POWER 0 ]</span><p>電力が尽きた。区画 ${view.currentEvent.zone} · ${String(view.position).padStart(2, '0')} マスで停止。</p></section>`
  }
  const result = view.lastResult
  if (!result) return '<section class="run-result waiting" aria-live="polite">選択して突破してください。</section>'
  return `<section class="run-result ${result.success ? 'success' : 'failure'}" aria-live="polite">
    <span class="result-mark">${result.success ? '[ ACTION OK ]' : '[ ACTION FAILED ]'}</span>
    <p>${result.title} · ${result.actionLabel} · 電力 ${result.powerBefore} → <strong>${result.powerAfter}</strong> (${signed(result.powerChange)})</p>
  </section>`
}

function actionMarkup(view: GameView): string {
  if (view.status !== 'playing') return ''
  return `<div class="action-list">${view.currentEvent.actions.map((action, index) => {
    const successDelta = displayedPowerDelta(view.power, action.successDelta)
    const failureDelta = displayedPowerDelta(view.power, action.failureDelta)
    const stopWarning = view.power + action.failureDelta <= 0 ? '<span class="stop-note">失敗時は停止</span>' : ''
    return `<button class="action-button" type="button" data-action-index="${index}" aria-label="${index + 1}: ${action.label}; 成功時 電力 ${signed(successDelta)}、失敗時 電力 ${signed(failureDelta)}">
      <span class="action-number">${index + 1}</span>
      <span class="action-copy"><strong>${action.label}</strong><small>${action.detail}</small></span>
      <span class="action-cost"><span>成功 <b>${signed(successDelta)}</b></span><span>失敗 <b>${signed(failureDelta)}</b></span>${stopWarning}</span>
    </button>`
  }).join('')}</div>`
}

function render(): void {
  const view = toGameView(game)
  const event = view.currentEvent
  const statusLabel = view.status === 'won' ? '脱出成功' : view.status === 'lost' ? '電力枯渇' : '進行中'
  const powerBlocks = Array.from({ length: 20 }, (_, index) => `<i class="${index < view.power ? 'charged' : ''}"></i>`).join('')
  const progress = Math.round((view.history.length / TOTAL_TILES) * 100)

  app.innerHTML = `<main class="terminal-shell">
    <header class="topbar">
      <a class="wordmark" href="./" aria-label="EXIT SEQUENCE はじめから"><span class="prompt">&gt;</span> EXIT SEQUENCE</a>
      <span class="system-state"><i></i>${statusLabel}</span>
    </header>

    <section class="overview" aria-label="進行状況と電力">
      <div class="position-block">
        <div class="section-label">進行 ROUTE</div>
        <ol class="route" aria-label="15マスの進行状況">${routeMarkup(view)}</ol>
        <div class="route-caption"><span>${view.status === 'playing' ? `現在 ${String(view.position).padStart(2, '0')} / ${TOTAL_TILES}` : `到達 ${String(view.position).padStart(2, '0')} / ${TOTAL_TILES}`}</span><span>区画 ${event.zone} / 3</span></div>
      </div>
      <div class="power-block">
        <div class="power-heading"><span class="section-label">電力 POWER</span><strong><span>${view.power}</span><small> / 20</small></strong></div>
        <div class="power-meter" role="meter" aria-label="電力" aria-valuemin="0" aria-valuemax="20" aria-valuenow="${view.power}">${powerBlocks}</div>
      </div>
    </section>

    <div class="progress-track" role="progressbar" aria-label="脱出までの進行" aria-valuemin="0" aria-valuemax="15" aria-valuenow="${view.history.length}"><span style="width:${progress}%"></span></div>

    <section class="event-panel" aria-labelledby="event-title">
      <div class="event-kicker"><span>EVENT ${String(event.tile).padStart(2, '0')} / ${TOTAL_TILES}</span><span>ZONE ${event.zone}</span></div>
      <h1 id="event-title">${event.title}</h1>
      <p class="event-description">${event.description}</p>
      <p class="observation"><span>観測 //</span> ${event.observationText}</p>
    </section>

    <section class="decision-panel" aria-labelledby="decision-title">
      <div class="decision-heading"><h2 id="decision-title">行動を選択</h2><span>KEY [ 1 ] [ 2 ] [ 3 ]</span></div>
      ${actionMarkup(view)}
      ${view.status !== 'playing' ? `<button class="restart-button" type="button" data-restart>新しいランを開始</button>` : ''}
    </section>

    ${resultMarkup(view)}

    <details class="history-panel">
      <summary><span>イベントログ</span><span>${view.history.length} / ${TOTAL_TILES} <b>＋</b></span></summary>
      ${logMarkup(view)}
    </details>

    <footer class="footer-line"><span>FACILITY EXIT PROTOCOL</span><span>電力が 0 でシステム停止</span></footer>
  </main>`
}

function startNewRun(): void {
  seed = randomSeed()
  random = createSeededRandom(seed)
  game = createGame(random, seed)
  const nextUrl = new URL(window.location.href)
  nextUrl.searchParams.set('seed', String(seed))
  window.history.replaceState(null, '', nextUrl)
  render()
}

app.addEventListener('click', event => {
  const target = event.target
  if (!(target instanceof Element)) return
  const restart = target.closest<HTMLButtonElement>('[data-restart]')
  if (restart) {
    startNewRun()
    return
  }
  const button = target.closest<HTMLButtonElement>('[data-action-index]')
  if (!button) return
  const index = Number(button.dataset.actionIndex)
  if (!Number.isInteger(index)) return
  game = resolveAction(game, index, random)
  render()
})

window.addEventListener('keydown', event => {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
  if (event.key !== '1' && event.key !== '2' && event.key !== '3') return
  if (game.status !== 'playing') return
  const index = Number(event.key) - 1
  if (!toGameView(game).currentEvent.actions[index]) return
  event.preventDefault()
  game = resolveAction(game, index, random)
  render()
})

render()
