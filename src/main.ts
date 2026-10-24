import './style.css'
import { ConsoleOutput, type OutputHooks, type OutputItem } from './console-output.ts'
import {
  createGame,
  createSeededRandom,
  continueAfterResult,
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
      <div class="status-values" aria-live="polite">
        <span id="status-position">POSITION 01/${TOTAL_TILES}</span>
        <span id="status-power">POWER 20/20</span>
      </div>
    </header>
    <section class="console-window" aria-label="コンソールログ。文字送り中はクリックでスキップし、スロット回転中はタップまたはクリックで停止します">
      <div id="transcript" class="transcript" role="log" aria-live="off" aria-relevant="additions"></div>
      <button id="latest-log" class="latest-log" type="button" hidden>最新ログへ ↓</button>
    </section>
    <footer id="command-dock" class="command-dock" aria-label="コマンド選択">
      <div id="command-list" class="command-list"></div>
      <div id="continue-command" class="continue-command" hidden><button id="continue-button" class="continue-button" type="button">[ 次へ進む ▶ ]</button></div>
      <div id="restart-command" class="restart-command" hidden></div>
    </footer>
  </main>`

const transcript = app.querySelector<HTMLDivElement>('#transcript')!
const consoleWindow = app.querySelector<HTMLElement>('.console-window')!
const positionOutput = app.querySelector<HTMLSpanElement>('#status-position')!
const powerOutput = app.querySelector<HTMLSpanElement>('#status-power')!
const commandList = app.querySelector<HTMLDivElement>('#command-list')!
const restartCommand = app.querySelector<HTMLDivElement>('#restart-command')!
const continueCommand = app.querySelector<HTMLDivElement>('#continue-command')!
const latestLogButton = app.querySelector<HTMLButtonElement>('#latest-log')!

type Phase = 'prologue-log' | 'prologue-wait' | 'event-log' | 'waiting' | 'selection-echo' | 'probability-log' | 'slot' | 'result-log' | 'await-continue' | 'ending-log' | 'idle'
type PendingChoice = { index: number; action: ActionView }

let seed = seedFromAddress()
let gameRandom = createSeededRandom(seed)
let game = createGame(gameRandom, seed)
let followTail = true
let phase: Phase = 'idle'
let activeChoiceButtons: HTMLButtonElement[] = []
let activePromptLine: { row: HTMLDivElement; text: Text; cursor: HTMLElement } | null = null
let pendingChoice: PendingChoice | null = null
let currentRoll: number | null = null
let rollText: Text | null = null
let rollTimer: number | null = null
let suppressClickAfterStop = false
let skipClickHandled = false
let pointerStart: { id: number; x: number; y: number; scrollTop: number } | null = null
let lastContinueTap: { at: number; x: number; y: number; pointerType: string } | null = null
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

function formatRoll(value: number): string {
  return String(value).padStart(2, '0')
}

function randomSlotNumber(): number {
  const values = new Uint32Array(1)
  const limit = Math.floor(0x1_0000_0000 / 100) * 100
  do {
    window.crypto.getRandomValues(values)
  } while (values[0]! >= limit)
  return values[0]! % 100
}

function mutateTranscript(mutation: () => void): void {
  const previousTop = consoleWindow.scrollTop
  mutation()
  consoleWindow.scrollTop = followTail ? consoleWindow.scrollHeight : previousTop
}

function appendTranscriptLines(entries: readonly (string | OutputItem)[], extraHooks: OutputHooks = {}): void {
  let activeText: Text | null = null
  const hooks: OutputHooks = {
    onLineStart(text, lineIndex) {
      const row = document.createElement('div')
      row.className = `console-line${text.startsWith('[CLEAR]') ? ' line-good' : ''}${text.startsWith('[GAME OVER]') ? ' line-bad' : ''}`
      activeText = document.createTextNode('')
      row.append(activeText)
      mutateTranscript(() => transcript.append(row))
      extraHooks.onLineStart?.(text, lineIndex)
    },
    onCharacter(character, text, lineIndex) {
      if (activeText) mutateTranscript(() => activeText?.appendData(character))
      extraHooks.onCharacter?.(character, text, lineIndex)
    },
    onLineEnd(text, lineIndex) {
      extraHooks.onLineEnd?.(text, lineIndex)
    },
    onImage(image, lineIndex) {
      const frame = document.createElement('div')
      frame.className = `console-image-row ${image.kind === 'prologue' ? 'prologue-image-row' : image.kind === 'ending' ? 'ending-image-row' : 'event-image-row'}`
      const element = document.createElement('img')
      element.className = image.kind === 'prologue' ? 'console-prologue-image' : image.kind === 'ending' ? 'console-ending-image' : 'console-event-image'
      element.dataset.eventId = image.eventId
      element.dataset.imageKind = image.kind ?? 'event'
      element.width = image.width
      element.height = image.height
      element.alt = image.alt
      element.decoding = 'async'
      element.src = image.src
      frame.append(element)
      mutateTranscript(() => transcript.append(frame))
      extraHooks.onImage?.(image, lineIndex)
    },
  }
  const items: OutputItem[] = entries.map(entry => typeof entry === 'string' ? { type: 'text', text: entry } : entry)
  output.enqueueSequence(items, hooks)
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
  mutateTranscript(() => transcript.append(row))
  activePromptLine = { row, text, cursor }
}

function appendSelectionEcho(index: number, action: ActionView): void {
  const prompt = activePromptLine
  if (!prompt) return
  phase = 'selection-echo'
  output.enqueue([`${index + 1}. ${action.label}`], {
    onCharacter(character) {
      mutateTranscript(() => prompt.text.appendData(character))
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
  continueCommand.hidden = true
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
    button.disabled = true
    button.setAttribute('aria-label', `${index + 1}: ${action.label}. ${action.detail}. 成功率 ${action.successProbabilityPercent}%。成功時 ${signed(successDelta)}、失敗時 ${signed(failureDelta)}`)

    const label = document.createElement('span')
    label.className = 'command-number'
    label.textContent = `[${index + 1}] ${action.label}`
    const probability = document.createElement('span')
    probability.className = 'command-probability'
    probability.textContent = `${action.successProbabilityPercent}%`
    const delta = document.createElement('span')
    delta.className = 'command-delta'
    delta.textContent = `${signed(successDelta)}/${signed(failureDelta)}`
    button.append(label, probability, delta)
    activeChoiceButtons.push(button)
    commandList.append(button)
  }
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
  if (phase === 'prologue-log') {
    phase = 'prologue-wait'
    continueCommand.hidden = false
    return
  }
  if (phase === 'event-log') {
    phase = 'waiting'
    activeChoiceButtons.forEach(button => { button.disabled = false })
    appendPromptLine()
    return
  }
  if (phase === 'selection-echo') {
    const choice = pendingChoice
    if (!choice) return
    phase = 'probability-log'
    appendTranscriptLines([`成功率 ${choice.action.successProbabilityPercent}%`])
    return
  }
  if (phase === 'probability-log') {
    beginSlot()
    return
  }
  if (phase === 'ending-log') {
    phase = 'idle'
    appendRestartCommand()
    return
  }
  if (phase === 'result-log') {
    phase = 'await-continue'
    continueCommand.hidden = false
  }
}

function scrollIfFollowing(): void {
  if (followTail) consoleWindow.scrollTop = consoleWindow.scrollHeight
}

function scrollToLatest(): void {
  followTail = true
  consoleWindow.scrollTop = consoleWindow.scrollHeight
  latestLogButton.hidden = true
}

function updateStatus(view: GameView): void {
  positionOutput.textContent = `POSITION ${String(view.position).padStart(2, '0')}/${TOTAL_TILES}`
  powerOutput.textContent = `POWER ${view.power}/20`
}

function eventLines(view: GameView): OutputItem[] {
  const event = view.currentEvent
  return [
    { type: 'text', text: `[EVENT] ${event.title}` },
    {
      type: 'image',
      eventId: event.id,
      src: `${import.meta.env.BASE_URL}events/${event.id}.png`,
      alt: `${event.title}の設備`,
      width: 320,
      height: 200,
    },
    { type: 'text', text: event.description },
  ]
}

function prologueLines(): (string | OutputItem)[] {
  const compactLandscape = window.matchMedia('(max-height: 440px) and (min-width: 700px)').matches
  const introduction = compactLandscape
    ? [
        'ぼくの仕事は、廃墟から部品を拾って街へ持ち帰ること。',
        '今日もお宝探し……のはずが、床が抜けて最深部まで落下！',
        'ミュータントに会う前に、電力が切れる前に地上へ帰ろう！',
      ]
    : [
        'ぼくの仕事は、廃墟から部品を拾って',
        '街へ持ち帰ること。',
        '今日もお宝探し……のはずが、',
        '床が抜けて最深部まで落下！',
        'ミュータントに会う前に、',
        '電力が切れる前に地上へ帰ろう！',
      ]
  return [
    '[SYSTEM] EXIT SEQUENCE',
    {
      type: 'image', kind: 'prologue', eventId: 'prologue',
      src: `${import.meta.env.BASE_URL}story/prologue.png`,
      alt: '床を踏み抜き、手足を広げて廃棄施設の奥へ落下する主人公ロボット',
      width: 320, height: 200,
    },
    ...introduction,
  ]
}

function beginRunOutput(): void {
  stopSlotTimer()
  transcript.replaceChildren()
  commandList.replaceChildren()
  restartCommand.replaceChildren()
  restartCommand.hidden = true
  continueCommand.hidden = true
  activeChoiceButtons = []
  activePromptLine = null
  pendingChoice = null
  currentRoll = null
  rollText = null
  pointerStart = null
  lastContinueTap = null
  skipClickHandled = false
  suppressClickAfterStop = false
  phase = 'prologue-log'
  followTail = true
  consoleWindow.scrollTop = 0
  latestLogButton.hidden = true
  const view = toGameView(game)
  updateStatus(view)
  appendTranscriptLines(prologueLines())
}

function resultLines(view: GameView, action: ActionView): (string | OutputItem)[] {
  const result = view.lastResult!
  const expectedDelta = result.success ? action.successDelta : action.failureDelta
  const capNote = result.powerChange !== expectedDelta && expectedDelta > 0 && result.powerAfter === 20
    ? '（上限20）'
    : result.powerChange !== expectedDelta && expectedDelta < 0 && result.powerAfter === 0
      ? '（最低値0）'
      : ''
  const lines: (string | OutputItem)[] = [
    result.success ? result.successText : result.failureText,
    `電力 ${signed(result.powerChange)}${capNote}`,
  ]
  return lines
}

function endingLines(status: GameView['status']): OutputItem[] {
  if (status === 'won') {
    return [
      { type: 'text', text: '[CLEAR]' },
      { type: 'image', kind: 'ending', eventId: 'clear', src: `${import.meta.env.BASE_URL}story/clear.png`, alt: 'ロボットが廃棄施設を脱出し、地上で喜んでいる', width: 320, height: 200 },
      { type: 'text', text: '地上の光だ！ 出口だ！' },
      { type: 'text', text: 'やった、ぼく生きてる！' },
      { type: 'text', text: '拾った部品？' },
      { type: 'text', text: '……あれ、どこに置いたっけ。' },
      { type: 'text', text: 'まあいいや、街へ帰ろう！' },
    ]
  }
  return [
    { type: 'text', text: '[GAME OVER]' },
    { type: 'image', kind: 'ending', eventId: 'game-over', src: `${import.meta.env.BASE_URL}story/game-over.png`, alt: '廃棄施設の通路で電力切れになり、へたり込んで助けを呼ぶロボット', width: 320, height: 200 },
    { type: 'text', text: 'あれ？ 体が動かない。' },
    { type: 'text', text: 'どうやら電力がゼロになったらしい。' },
    { type: 'text', text: 'ぼくの冒険はここまで。' },
    { type: 'text', text: '誰か、充電器を持ってきてー！' },
  ]
}

function beginSlot(): void {
  const choice = pendingChoice
  if (!choice || game.status !== 'playing') return

  currentRoll = randomSlotNumber()
  const row = document.createElement('div')
  row.className = 'console-line slot-line'
  const visibleText = document.createTextNode('[ROLL] ')
  rollText = document.createTextNode(formatRoll(currentRoll))
  const number = document.createElement('span')
  number.className = 'slot-number'
  number.setAttribute('aria-hidden', 'true')
  number.append(rollText)
  const announcement = document.createElement('span')
  announcement.className = 'sr-only slot-announcement'
  announcement.setAttribute('role', 'status')
  announcement.setAttribute('aria-live', 'polite')
  announcement.setAttribute('aria-atomic', 'true')
  row.append(visibleText, number, announcement)
  mutateTranscript(() => transcript.append(row))
  phase = 'slot'
  scrollToLatest()
  resumeSlotTimer()
}

function spinOnce(): void {
  if (phase !== 'slot' || rollText === null) return
  currentRoll = randomSlotNumber()
  rollText.data = formatRoll(currentRoll)
  scrollIfFollowing()
}

function stopSlotTimer(): void {
  if (rollTimer === null) return
  window.clearInterval(rollTimer)
  rollTimer = null
}

function resumeSlotTimer(): void {
  stopSlotTimer()
  if (phase === 'slot' && !document.hidden && !motionPreference.matches) {
    rollTimer = window.setInterval(spinOnce, 50)
  }
}

function stopSlot(): void {
  if (phase !== 'slot' || currentRoll === null || rollText === null) return
  stopSlotTimer()
  const roll = currentRoll
  const choice = pendingChoice
  if (!choice) return

  // Lock the phase before resolving so a second tap cannot resolve the turn twice.
  phase = 'idle'
  rollText.data = formatRoll(roll)
  game = resolveAction(game, choice.index, roll, gameRandom)
  pendingChoice = null
  if (game.pendingNextEvent || game.status !== 'playing') {
    commandList.replaceChildren()
    activeChoiceButtons = []
  }
  const resolvedView = toGameView(game)
  const result = resolvedView.lastResult!
  const announcement = transcript.querySelector<HTMLElement>('.slot-announcement:last-child')
  if (announcement) announcement.textContent = `停止数値 ${formatRoll(roll)}。${result.success ? '成功' : '失敗'}。`

  phase = 'result-log'
  appendTranscriptLines(resultLines(resolvedView, choice.action), {
    onLineEnd(_text, lineIndex) {
      if (lineIndex !== 1) return
      updateStatus(resolvedView)
      commandList.replaceChildren()
      activeChoiceButtons = []
    },
  })
}

function continueAfterResultFlow(input?: PointerEvent): void {
  if (phase === 'prologue-wait') {
    phase = 'idle'
    continueCommand.hidden = true
    const view = toGameView(game)
    appendCommandLines(view.currentEvent.actions)
    phase = 'event-log'
    appendTranscriptLines(eventLines(view))
    return
  }
  if (phase !== 'await-continue') return
  phase = 'idle'
  continueCommand.hidden = true
  if (game.status !== 'playing') {
    phase = 'ending-log'
    appendTranscriptLines(endingLines(game.status))
    return
  }
  const previousZone = game.currentEvent.zone
  game = continueAfterResult(game)
  lastContinueTap = input?.pointerType
    ? { at: Date.now(), x: input.clientX, y: input.clientY, pointerType: input.pointerType }
    : null
  const view = toGameView(game)
  updateStatus(view)
  appendCommandLines(view.currentEvent.actions)
  phase = 'event-log'
  appendTranscriptLines([
    ...(view.currentEvent.zone !== previousZone
      ? [view.currentEvent.zone === 2 ? '[ZONE] 中層へ到着。保守設備が増えてきた。地上まであと少し……のはず！' : '[ZONE] 上層に入った！ 外の風が近い。街の充電スタンドが待ってる！']
      : []),
    ...eventLines(view),
  ])
}

function selectAction(index: number, input?: PointerEvent): void {
  if (input && lastContinueTap) {
    const elapsed = Date.now() - lastContinueTap.at
    const samePointer = input.pointerType === lastContinueTap.pointerType
    const sameTarget = Math.hypot(input.clientX - lastContinueTap.x, input.clientY - lastContinueTap.y) <= 24
    if (elapsed <= 500 && samePointer && sameTarget) {
      lastContinueTap = null
      return
    }
    if (elapsed > 500) lastContinueTap = null
  }
  if (input) lastContinueTap = null
  if (phase !== 'waiting' || !activePromptLine || output.isBusy || game.status !== 'playing') return
  const action = toGameView(game).currentEvent.actions[index]
  if (!action) return

  pendingChoice = { index, action }
  activeChoiceButtons.forEach(button => { button.disabled = true })
  appendSelectionEcho(index, action)
}

function startNewRun(): void {
  stopSlotTimer()
  output.stop()
  seed = randomSeed()
  gameRandom = createSeededRandom(seed)
  game = createGame(gameRandom, seed)
  const nextUrl = new URL(window.location.href)
  nextUrl.searchParams.set('seed', String(seed))
  window.history.replaceState(null, '', nextUrl)
  beginRunOutput()
}

consoleWindow.addEventListener('scroll', () => {
  followTail = consoleWindow.scrollHeight - consoleWindow.scrollTop - consoleWindow.clientHeight < 48
  latestLogButton.hidden = followTail
})

latestLogButton.addEventListener('click', scrollToLatest)

consoleWindow.addEventListener('click', () => {
  if (output.isBusy) {
    skipClickHandled = true
    output.skip()
  }
})

document.addEventListener('click', event => {
  if (skipClickHandled) {
    skipClickHandled = false
    return
  }
  const target = event.target
  if (target instanceof Element && target.closest('#latest-log, [data-action-index], [data-restart]')) return
  if (output.isBusy) {
    output.skip()
    return
  }
  if (phase === 'prologue-wait' && !(target instanceof Element && target.closest('.console-window, #continue-button'))) return
  continueAfterResultFlow(event instanceof PointerEvent ? event : undefined)
})

commandList.addEventListener('click', event => {
  const target = event.target
  if (!(target instanceof Element)) return
  const button = target.closest<HTMLButtonElement>('[data-action-index]')
  if (!button || button.disabled) return
  const index = Number(button.dataset.actionIndex)
  if (Number.isInteger(index)) selectAction(index, event instanceof PointerEvent ? event : undefined)
})

restartCommand.addEventListener('click', event => {
  const target = event.target
  if (target instanceof Element && target.closest('[data-restart]')) startNewRun()
})

document.addEventListener('pointerdown', event => {
  if (!event.isPrimary) return
  pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY, scrollTop: consoleWindow.scrollTop }
}, true)

document.addEventListener('pointerup', event => {
  const start = pointerStart
  pointerStart = null
  if (phase !== 'slot' || !start || start.id !== event.pointerId) return
  const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8
  const logScrolled = Math.abs(consoleWindow.scrollTop - start.scrollTop) > 1
  const isLatestLogControl = event.target instanceof Element && Boolean(event.target.closest('#latest-log'))
  if (moved || logScrolled || isLatestLogControl) return
  suppressClickAfterStop = true
  stopSlot()
}, true)

document.addEventListener('pointercancel', () => { pointerStart = null }, true)

document.addEventListener('click', event => {
  if (!suppressClickAfterStop) return
  suppressClickAfterStop = false
  event.preventDefault()
  event.stopImmediatePropagation()
}, true)

window.addEventListener('keydown', event => {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
  if (event.code === 'Space' || event.key === 'Enter') {
    if (phase === 'slot') {
      event.preventDefault()
      stopSlot()
    } else if (output.isBusy) {
      event.preventDefault()
      output.skip()
    } else if (phase === 'await-continue' || phase === 'prologue-wait') {
      event.preventDefault()
      continueAfterResultFlow()
    }
    return
  }
  if (phase !== 'waiting' || (event.key !== '1' && event.key !== '2' && event.key !== '3')) return
  const index = Number(event.key) - 1
  if (!toGameView(game).currentEvent.actions[index]) return
  event.preventDefault()
  selectAction(index)
})

document.addEventListener('visibilitychange', () => {
  output.setPaused(document.hidden)
  if (document.hidden) stopSlotTimer()
  else resumeSlotTimer()
})

motionPreference.addEventListener('change', event => {
  output.setReducedMotion(event.matches)
  if (event.matches) stopSlotTimer()
  else resumeSlotTimer()
})

beginRunOutput()
