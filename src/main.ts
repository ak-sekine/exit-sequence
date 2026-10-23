import './style.css'
import { ConsoleOutput, type OutputHooks } from './console-output.ts'
import {
  createGame,
  createSeededRandom,
  displayedPowerDelta,
  randomSeed,
  resolveAction,
  toGameView,
  TOTAL_TILES,
} from './game.ts'
import type { ActionView, GameView } from './game.ts'

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <main class="terminal-shell">
    <header class="status-bar" aria-label="ゲーム状態">
      <h1 class="wordmark">EXIT SEQUENCE</h1>
      <div class="status-content">
        <img id="event-image" class="event-image" width="120" height="90" alt="" />
        <div class="status-values" aria-live="polite">
          <span id="status-position">POSITION 01/${TOTAL_TILES}</span>
          <span id="status-power">POWER    20/20</span>
        </div>
      </div>
    </header>
    <section class="console-window" aria-label="コンソールログをクリックすると文字送りをスキップします">
      <div id="transcript" class="transcript" role="log" aria-live="off" aria-relevant="additions"></div>
      <button id="latest-log" class="latest-log" type="button" hidden>最新ログへ ↓</button>
    </section>
    <footer id="command-dock" class="command-dock" aria-label="コマンド選択">
      <div id="command-list" class="command-list"></div>
      <div id="restart-command" class="restart-command" hidden></div>
    </footer>
  </main>`

const transcript = app.querySelector<HTMLDivElement>('#transcript')!
const consoleWindow = app.querySelector<HTMLElement>('.console-window')!
const positionOutput = app.querySelector<HTMLSpanElement>('#status-position')!
const powerOutput = app.querySelector<HTMLSpanElement>('#status-power')!
const eventImage = app.querySelector<HTMLImageElement>('#event-image')!
const commandList = app.querySelector<HTMLDivElement>('#command-list')!
const restartCommand = app.querySelector<HTMLDivElement>('#restart-command')!
const latestLogButton = app.querySelector<HTMLButtonElement>('#latest-log')!

let seed = seedFromAddress()
let random = createSeededRandom(seed)
let game = createGame(random, seed)
let followTail = true
let inputReady = false
let phase: 'event-log' | 'selection-echo' | 'end-log' | 'idle' = 'idle'
let activeChoiceButtons: HTMLButtonElement[] = []
let activePromptLine: { row: HTMLDivElement; text: Text; cursor: HTMLElement } | null = null
let pendingChoice: { index: number; action: ActionView } | null = null
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')

const output = new ConsoleOutput({
  delayMs: 10,
  reducedMotion: motionPreference.matches,
  onIdle: outputBecameIdle,
})

function seedFromAddress(): number {
  const supplied = new URLSearchParams(window.location.search).get('seed')
  if (supplied === null || supplied.trim() === '') return randomSeed()
  const parsed = Number(supplied)
  return Number.isFinite(parsed) ? Math.floor(parsed) >>> 0 : randomSeed()
}

function signed(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}`
}

function appendTranscriptLines(lines: readonly string[]): void {
  let activeText: Text | null = null
  const hooks: OutputHooks = {
    onLineStart(text) {
      const row = document.createElement('div')
      row.className = `console-line${text.startsWith('[SUCCESS]') || text.startsWith('[CLEAR]') ? ' line-good' : ''}${text.startsWith('[FAILED]') || text.startsWith('[GAME OVER]') ? ' line-bad' : ''}`
      activeText = document.createTextNode('')
      row.append(activeText)
      transcript.append(row)
      scrollIfFollowing()
    },
    onCharacter(character) {
      activeText?.appendData(character)
      scrollIfFollowing()
    },
  }
  output.enqueue(lines, hooks)
}

function appendPromptLine(): void {
  const row = document.createElement('div')
  row.className = 'console-line prompt-line'
  const prefix = document.createElement('span')
  prefix.className = 'prompt-prefix'
  prefix.textContent = '> '
  const text = document.createTextNode('')
  const cursor = document.createElement('i')
  cursor.className = 'console-cursor'
  cursor.setAttribute('aria-hidden', 'true')
  row.append(prefix, text, cursor)
  transcript.append(row)
  activePromptLine = { row, text, cursor }
  scrollIfFollowing()
}

function appendSelectionEcho(index: number, action: ActionView): void {
  const prompt = activePromptLine
  if (!prompt) return
  phase = 'selection-echo'
  output.enqueue([`${index + 1}. ${action.label}`], {
    onCharacter(character) {
      prompt.text.appendData(character)
      scrollIfFollowing()
    },
    onLineEnd() {
      prompt.row.classList.add('committed-prompt')
      prompt.cursor.remove()
      activePromptLine = null
    },
  })
}

function appendCommandLines(actions: readonly ActionView[]): void {
  commandList.replaceChildren()
  restartCommand.replaceChildren()
  restartCommand.hidden = true
  activeChoiceButtons = []

  for (let index = 0; index < actions.length; index++) {
    const action = actions[index]!
    const successDelta = displayedPowerDelta(game.power, action.successDelta)
    const failureDelta = displayedPowerDelta(game.power, action.failureDelta)
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'action-command'
    button.dataset.actionIndex = String(index)
    button.setAttribute('aria-label', `${index + 1}: ${action.label} 成功時 ${signed(successDelta)}、失敗時 ${signed(failureDelta)}`)

    const number = document.createElement('span')
    number.className = 'command-number'
    number.textContent = `[${index + 1}]`
    const label = document.createElement('span')
    label.className = 'command-label'
    label.textContent = action.label
    const delta = document.createElement('span')
    delta.className = 'command-delta'
    delta.textContent = `成${signed(successDelta)}/失${signed(failureDelta)}`
    button.append(number, label, delta)
    activeChoiceButtons.push(button)
    commandList.append(button)
  }

  phase = 'idle'
  inputReady = true
  appendPromptLine()
}

function appendRestartCommand(): void {
  restartCommand.replaceChildren()
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'restart-button'
  button.dataset.restart = ''
  button.textContent = '[R] 新しいシーケンスを開始'
  restartCommand.append(button)
  restartCommand.hidden = false
}

function outputBecameIdle(): void {
  if (phase === 'event-log') {
    appendCommandLines(toGameView(game).currentEvent.actions)
    return
  }
  if (phase === 'selection-echo') {
    phase = 'idle'
    executePendingChoice()
    return
  }
  if (phase === 'end-log') {
    phase = 'idle'
    appendRestartCommand()
  }
}

function scrollIfFollowing(): void {
  if (followTail) consoleWindow.scrollTop = consoleWindow.scrollHeight
}

function updateStatus(view: GameView): void {
  positionOutput.textContent = `POSITION ${String(view.position).padStart(2, '0')}/${TOTAL_TILES}`
  powerOutput.textContent = `POWER    ${view.power}/20`
  eventImage.src = `${import.meta.env.BASE_URL}events/${view.currentEvent.id}.svg`
  eventImage.alt = `${view.currentEvent.title}の設備画像`
  eventImage.dataset.eventId = view.currentEvent.id
}

function eventLines(view: GameView): string[] {
  const event = view.currentEvent
  return [
    `[EVENT] ${event.title}`,
    event.description,
    `観測：${event.observationText}`,
  ]
}

function beginRunOutput(): void {
  transcript.replaceChildren()
  commandList.replaceChildren()
  restartCommand.replaceChildren()
  restartCommand.hidden = true
  activeChoiceButtons = []
  activePromptLine = null
  pendingChoice = null
  inputReady = false
  followTail = true
  consoleWindow.scrollTop = 0
  latestLogButton.hidden = true
  const view = toGameView(game)
  updateStatus(view)
  phase = 'event-log'
  appendTranscriptLines([
    '[SYSTEM] 脱出シーケンス開始',
    ...eventLines(view),
  ])
}

function resultLines(view: GameView, action: ActionView): string[] {
  const result = view.lastResult!
  const expectedDelta = result.success ? action.successDelta : action.failureDelta
  const capNote = result.powerChange !== expectedDelta && expectedDelta > 0 && result.powerAfter === 20
    ? '（上限20）'
    : result.powerChange !== expectedDelta && expectedDelta < 0 && result.powerAfter === 0
      ? '（最低値0）'
      : ''
  const lines = [
    `[${result.success ? 'SUCCESS' : 'FAILED'}] 電力 ${signed(result.powerChange)}${capNote}`,
  ]
  if (view.status === 'lost') {
    lines.push('[GAME OVER] 電力が尽きた')
  } else if (view.status === 'won') {
    lines.push('[CLEAR] 脱出成功')
  } else {
    lines.push(...eventLines(view))
  }
  return lines
}

function executePendingChoice(): void {
  const choice = pendingChoice
  pendingChoice = null
  if (!choice || game.status !== 'playing') return

  game = resolveAction(game, choice.index, random)
  const view = toGameView(game)
  updateStatus(view)
  phase = view.status === 'playing' ? 'event-log' : 'end-log'
  appendTranscriptLines(resultLines(view, choice.action))
}

function selectAction(index: number): void {
  if (!inputReady || !activePromptLine || output.isBusy || game.status !== 'playing') return
  const before = toGameView(game)
  const action = before.currentEvent.actions[index]
  if (!action) return

  inputReady = false
  pendingChoice = { index, action }
  activeChoiceButtons.forEach(button => { button.disabled = true })
  commandList.replaceChildren()
  appendSelectionEcho(index, action)
}

function startNewRun(): void {
  output.stop()
  seed = randomSeed()
  random = createSeededRandom(seed)
  game = createGame(random, seed)
  const nextUrl = new URL(window.location.href)
  nextUrl.searchParams.set('seed', String(seed))
  window.history.replaceState(null, '', nextUrl)
  beginRunOutput()
}

consoleWindow.addEventListener('scroll', () => {
  followTail = consoleWindow.scrollHeight - consoleWindow.scrollTop - consoleWindow.clientHeight < 48
  latestLogButton.hidden = followTail
})

latestLogButton.addEventListener('click', () => {
  followTail = true
  consoleWindow.scrollTop = consoleWindow.scrollHeight
  latestLogButton.hidden = true
})

consoleWindow.addEventListener('click', () => {
  if (output.isBusy) output.skip()
})

commandList.addEventListener('click', event => {
  const target = event.target
  if (!(target instanceof Element)) return
  const button = target.closest<HTMLButtonElement>('[data-action-index]')
  if (!button || button.disabled) return
  const index = Number(button.dataset.actionIndex)
  if (Number.isInteger(index)) selectAction(index)
})

restartCommand.addEventListener('click', event => {
  const target = event.target
  if (target instanceof Element && target.closest('[data-restart]')) startNewRun()
})

window.addEventListener('keydown', event => {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
  if (event.code === 'Space' || event.key === 'Enter') {
    if (output.isBusy) {
      event.preventDefault()
      output.skip()
    }
    return
  }
  if (event.key !== '1' && event.key !== '2' && event.key !== '3') return
  if (!inputReady || output.isBusy || game.status !== 'playing') return
  const index = Number(event.key) - 1
  if (!toGameView(game).currentEvent.actions[index]) return
  event.preventDefault()
  selectAction(index)
})

document.addEventListener('visibilitychange', () => output.setPaused(document.hidden))
motionPreference.addEventListener('change', event => output.setReducedMotion(event.matches))

beginRunOutput()
