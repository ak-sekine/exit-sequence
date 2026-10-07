import { t, roomName, initialLanguage, saveLanguage, languageNames, itemName, freshnessName, roomDescriptions, taskLabels, conditionLabels } from './i18n.ts'
import type { Language } from './i18n.ts'
import './style.css'
import { Game, taskInfo } from './game'
import type { Action, Task } from './game'
import { costs, neighbors, baseMapLines, facilityGuideLines } from './map'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('App element was not found')
const game = new Game()
let language: Language = initialLanguage()
type Menu = 'start' | 'main' | 'move' | 'camera' | 'investigate' | 'detail' | 'confirmation' | 'ai' | 'inventory' | 'encounter' | 'flee' | 'end' | 'settings' | 'language'
type Option = { label: string; setting?: boolean; inputLabel?: string; inputPath?: string[]; submenu?: Menu; enter?: () => void; run?: () => void; disabled?: boolean; help?: () => string[]; helpInput?: string }
let menu: Menu = 'start', page = 0
let languageParent: 'start' | 'settings' = 'start'
function changeLanguage(nextLanguage: Language) {
  if (isTyping) return
  language = nextLanguage
  saveLanguage(language)
  pendingInput.length = 0
  render()
}
let selectedTask: Task = 'power'
function targetNames(): Record<Task, string> { return { power: t('powerPanel', language), control: t('controlTerminal', language), repair: t('repairSystem', language), parts: t('partsStorage', language), food: t('foodStorage', language), medical: t('spareBattery', language), observe: t('observationSystem', language), launch: t('returnShip', language) } }
function taskConfirmations(): Partial<Record<Task, { explanation: string; question: string; done: string; declined: string }>> { return {
  medical: { explanation: t('batteryExplanation', language), question: t('batteryQuestion', language), done: t('batteryCollected', language), declined: t('batteryDeclined', language) },
} }
function investigateTask(task: Task) {
  selectedTask = task
  const confirmation = taskConfirmations()[task]
  if (confirmation && game.taskDone(task)) {
    appendLog(confirmation.done)
    return
  }
  open(confirmation ? 'confirmation' : 'detail')
  appendLog(t('checkedTarget', language, targetNames()[task]), ...(confirmation
    ? [confirmation.explanation, confirmation.question]
    : [roomDescriptions(language)[game.state.location], ...taskHelp(task)]))
}
function mapLines(): string[] { return baseMapLines(game.state.location, language) }
let helpMode = false
const pendingInput: string[] = []
const terminal = document.createElement('main')
terminal.className = 'terminal'
const log = document.createElement('div')
log.className = 'terminal-log'
log.setAttribute('role', 'log')
log.setAttribute('aria-label', t('gameLog', language))
log.tabIndex = 0
let prompt: HTMLDivElement | null = null
// Prototype tuning value, not a fixed release specification.
const TYPEWRITER_INTERVAL_MS = 5
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const logQueue: string[] = []
let isTyping = false
let typingTimer: ReturnType<typeof setTimeout> | null = null
let activeLine: HTMLDivElement | null = null
let characters: string[] = [], characterPosition = 0
function appendImmediate(...lines: string[]) {
  prompt?.remove()
  prompt = null
  for (const text of lines) {
    const line = document.createElement('div')
    line.className = 'terminal-line'
    line.textContent = text
    log.append(line)
  }
  log.scrollTop = log.scrollHeight
}
function finishTyping() {
  if (typingTimer !== null) clearTimeout(typingTimer)
  typingTimer = null
  activeLine = null
  characters = []; characterPosition = 0
  isTyping = false
  log.setAttribute('aria-busy', 'false')
  render()
}
function typeNextCharacter() {
  typingTimer = null
  while (!activeLine && logQueue.length) {
    characters = Array.from(logQueue.shift()!)
    characterPosition = 0
    appendImmediate('')
    activeLine = log.lastElementChild as HTMLDivElement
    if (!characters.length) activeLine = null
  }
  if (!activeLine) { finishTyping(); return }
  activeLine.textContent += characters[characterPosition++]!
  log.scrollTop = log.scrollHeight
  if (characterPosition === characters.length) activeLine = null
  if (!activeLine && !logQueue.length) { finishTyping(); return }
  typingTimer = setTimeout(typeNextCharacter, TYPEWRITER_INTERVAL_MS)
}
function appendLog(...lines: string[]) {
  if (!lines.length) return
  if (reducedMotion.matches) { appendImmediate(...lines); return }
  logQueue.push(...lines)
  if (isTyping) return
  showPrompt(false)
  isTyping = true
  log.setAttribute('aria-busy', 'true')
  render()
  typingTimer = setTimeout(typeNextCharacter, TYPEWRITER_INTERVAL_MS)
}
function skipTyping() {
  if (!isTyping) return
  if (typingTimer !== null) clearTimeout(typingTimer)
  if (activeLine) activeLine.textContent += characters.slice(characterPosition).join('')
  appendImmediate(...logQueue.splice(0))
  finishTyping()
}
log.addEventListener('click', skipTyping)
reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) skipTyping() })
function showPrompt(waiting: boolean) {
  if (!waiting || isTyping) { prompt?.remove(); prompt = null; return }
  if (prompt) return
  appendImmediate('>')
  prompt = log.lastElementChild as HTMLDivElement
}
function confirmInput(label: string, path = pendingInput) {
  showPrompt(true)
  prompt!.textContent = `> ${[...path, label].join(' ')}`
  prompt = null
  appendImmediate('')
}
const actions = document.createElement('div')
actions.className = 'terminal-actions'
actions.setAttribute('role', 'group')
function button(label: string, run: () => void) {
  const element = document.createElement('button')
  element.type = 'button'
  element.textContent = label
  element.addEventListener('click', () => { if (!isTyping && !element.disabled) run() })
  return element
}
function open(nextMenu: Menu) {
  menu = nextMenu; page = 0
  if (!parent()) pendingInput.length = 0
  render()
  const first = actions.querySelector<HTMLButtonElement>('button:not(:disabled)')
  const focusTarget = first ?? (parent() ? back : log)
  focusTarget.focus({ preventScroll: true })
}
function act(action: Action) {
  appendLog(...game.act(action, language))
  const s = game.state
  open(s.status !== 'playing' ? 'end' : s.encounter ? 'encounter' : 'main')
}
function restart() {
  helpMode = false
  if (typingTimer !== null) clearTimeout(typingTimer)
  typingTimer = null
  logQueue.length = 0
  activeLine = null
  characters = []; characterPosition = 0
  isTyping = false
  game.restart()
  appendLog(t('title', language), t('systemOnline', language), t('introDamage', language),
    t('introRequirements', language),
    t('introSupplies', language), t('introStatus', language), roomDescriptions(language).居住)
  open('main')
}
function itemHelp(item: string): string[] {
  return [item === '食糧' ? t('foodHelp', language) : t('partsHelp', language)]
}
function taskHelp(task: Task): string[] {
  const s = game.state, info = taskInfo[task]
  const effects: Record<Task, string> = {
    power: t('securePowerForTheReturnShip', language), control: t('releaseTheLaunchControlLock', language),
    repair: t('useRepairPartsToRepairTheReturn', language), parts: t('collectRepairParts', language), food: t('collectFoodToKeepUntilDeparture', language),
    medical: t('supplyHelp', language), observe: t('supplyHelp', language), launch: t('launchTheReturnShipToAchieveGame', language),
  }
  return [taskLabels(language)[task], t('energyCost', language, info.cost), t('taskDone', language, game.taskDone(task) ? t('yes', language) : t('no', language)),
    task === 'repair' ? t('requiresParts', language, s.items.includes('修理部品') ? t('held', language) : t('missing', language)) : task === 'launch' ? t('requiresAllFourReturnRequirements', language) : t('requiresRoom', language, roomName(info.room, language)),
    effects[task], ...(task === 'launch' ? Object.entries(conditionLabels(language)).filter(([key]) => !s.conditions[key as keyof typeof s.conditions]).map(([, name]) => t('missingCondition', language, name)) : [])]
}
function options(): Option[] {
  const s = game.state
  if (menu === 'start') return [{ label: t('start', language), run: restart },
    { label: t('startLanguageMenu', language), setting: true, submenu: 'language', enter: () => { languageParent = 'start' } }]
  if (menu === 'settings') return [{ label: t('languageMenu', language), setting: true, submenu: 'language', enter: () => { languageParent = 'settings' } }]
  if (menu === 'language') return (['ja', 'en'] as const).map(value => ({
    label: languageNames[value], setting: true, run: () => changeLanguage(value),
  }))
  if (menu === 'end') return [{ label: t('restart', language), run: restart }, { label: t('finalStatus', language), run: () => appendLog(...game.statusLines(language)) }]
  if (menu === 'main') return [
    { label: t('exploreMenu', language), submenu: 'investigate' },
    { label: t('moveMenu', language), submenu: 'move' },
    { label: t('inventoryMenu', language), submenu: 'inventory' },
    { label: t('aiMenu', language), submenu: 'ai' },
    { label: t('settingsMenu', language), setting: true, submenu: 'settings' },
  ]
  if (menu === 'ai') return [
    { label: t('status', language), helpInput: t('aiStatus', language), help: () => [t('statusHelp', language)], run: () => appendLog(...game.statusLines(language)) },
    { label: t('camera', language), submenu: 'camera' },
  ]
  if (menu === 'encounter') return [
    { label: t('hide', language), help: () => [t('success80', language), t('energy1', language), t('encounterFailureHelp', language)], run: () => act({ type: 'hide' }) },
    { label: t('forceThrough', language), help: () => [t('success60', language), t('energy2', language), t('encounterFailureHelp', language)], run: () => act({ type: 'force' }) },
    { label: t('fleeMenu', language), submenu: 'flee' },
  ]
  if (menu === 'inventory') return [
    { label: t('baseMap', language), helpInput: t('inventoryBaseMap', language), help: () => [t('mapHelp', language)], run: () => appendLog(...mapLines()) },
    { label: t('facilityGuide', language), helpInput: t('inventoryFacilityGuide', language), help: () => [t('guideHelpFacilities', language), t('guideHelpLocation', language), t('noEnergyCostOrWorldProgression', language)], run: () => appendLog(...facilityGuideLines(language)) },
    ...s.items.map(item => ({ label: itemName(item, language), helpInput: t('inventoryInput', language, itemName(item, language)), help: () => itemHelp(item), run: () => appendLog(...itemHelp(item)) })),
  ]
  if (menu === 'investigate') {
    const tasks = (Object.keys(taskInfo) as Task[]).filter(task => taskInfo[task].room === s.location)
    return [{ label: t('surroundings', language), helpInput: t('exploreSurroundings', language), help: () => [t('surroundingsHelp', language)], run: () => appendLog(t('districtLabel', language, roomName(s.location, language)), roomDescriptions(language)[s.location]) },
      ...tasks.map(task => ({ label: targetNames()[task], inputPath: [t('explore', language)], helpInput: t('exploreInput', language, targetNames()[task]), help: () => taskHelp(task), run: () => investigateTask(task) }))]
  }
  if (menu === 'confirmation') {
    const task = selectedTask, confirmation = taskConfirmations()[task]!
    return [
      { label: t('yes', language), inputPath: [], disabled: game.taskDone(task), run: () => act({ type: 'task', task }) },
      { label: t('no', language), inputPath: [], run: () => { open('investigate'); appendLog(confirmation.declined) } },
    ]
  }
  if (menu === 'detail') {
    const task = selectedTask
    return [{ label: taskLabels(language)[task], inputPath: [], helpInput: t('taskInput', language, targetNames()[task], taskLabels(language)[task]), help: () => taskHelp(task), disabled: game.taskDone(task) || (task === 'launch' && !game.ready()), run: () => act({ type: 'task', task }) }]
  }
  return neighbors(s.location).map(target => {
    if (menu === 'camera') return { label: t('districtLabel', language, roomName(target, language)), helpInput: t('cameraInput', language, roomName(target, language)), help: () => [t('energy1', language), t('checkOnlyTheSelectedRoute', language), t('capturePassageConditionsEnemyPresenceAndEstimated', language), t('informationBecomesStaleAfterTheNextValid', language), t('thisHelpDoesNotActivateTheCamera', language)], run: () => act({ type: 'camera', target }) }
    const closed = game.passage(s.location, target) === 'CLOSED'
    const fleeing = menu === 'flee'
    return { label: t('districtLabel', language, roomName(target, language)), disabled: closed, helpInput: t('routeInput', language, fleeing ? t('flee', language) : t('move', language), roomName(target, language)), help: () => {
      const freshness = game.freshness(s.location, target)
      const feed = s.feeds[`${s.location}:${target}`]
      return [
      t('routeHeading', language, roomName(target, language)), t('feedFreshness', language, freshnessName(freshness, language)), t('passageStatus', language, closed ? t('closedCurrentlyImpassable', language) : feed?.passage ?? t('unknownUnchecked', language)),
      t('estimatedCost', language, closed ? t('impassable', language) : feed ? feed.passage === 'CLOSED' ? t('impassableAtCapture', language) : costs[feed.passage] : t('unknownUnchecked13', language)),
      t('enemyStatus', language, feed ? feed.enemy ? t('presentAtCapture', language) : t('noneAtCapture', language) : t('unknownUnchecked', language)),
      ...(freshness === '古い' ? [t('staleInformationDoesNotGuaranteeCurrentSafety', language)] : []),
      ...(fleeing ? [t('fleeHelp', language)] : []),
    ] }, run: () => act({ type: fleeing ? 'flee' : 'move', target }) }
  })
}
function parent(): Menu | null {
  if (menu === 'language') return languageParent
  if (menu === 'settings') return 'main'
  if (menu === 'flee') return 'encounter'
  if (menu === 'camera') return 'ai'
  if (menu === 'detail' || menu === 'confirmation') return 'investigate'
  return ['move', 'investigate', 'inventory', 'ai'].includes(menu) ? 'main' : null
}
const navigation = document.createElement('nav')
navigation.className = 'action-navigation'
navigation.setAttribute('aria-label', t('choicePageNavigation', language))
const back = button(t('back', language), () => {
  const nextMenu = parent(), previousMenu = menu
  if (!nextMenu) return
  if (previousMenu !== 'detail' && previousMenu !== 'confirmation') pendingInput.pop()
  open(nextMenu)
  const index = options().findIndex(option => option.submenu === previousMenu)
  actions.querySelectorAll<HTMLButtonElement>('button')[Math.max(0, index)]?.focus({ preventScroll: true })
})
back.className = 'back-button'
back.setAttribute('aria-label', t('backToParentMenu', language))
const previous = button('＜', () => { if (page > 0) { page--; render() } })
previous.setAttribute('aria-label', t('previousPage', language))
const next = button('＞', () => { if (page + 1 < Math.ceil(options().length / 6)) { page++; render() } })
next.setAttribute('aria-label', t('nextPage', language))
const indicator = document.createElement('span')
indicator.className = 'action-page-indicator'
indicator.setAttribute('aria-live', 'polite')
const pageNavigation = document.createElement('div')
pageNavigation.className = 'page-navigation'
pageNavigation.append(previous, indicator, next)
const help = button(t('help', language), () => { helpMode = !helpMode; render() })
help.setAttribute('aria-label', t('helpMode', language))
navigation.append(back, pageNavigation, help)
function render() {
  document.documentElement.lang = language
  log.setAttribute('aria-label', t('gameLog', language))
  navigation.setAttribute('aria-label', t('choicePageNavigation', language))
  back.textContent = t('back', language)
  back.setAttribute('aria-label', t('backToParentMenu', language))
  previous.setAttribute('aria-label', t('previousPage', language))
  next.setAttribute('aria-label', t('nextPage', language))
  help.setAttribute('aria-label', t('helpMode', language))
  const list = options(), count = Math.max(1, Math.ceil(list.length / 6))
  page = Math.min(page, count - 1)
  actions.replaceChildren()
  const names: Record<Menu, string> = { start: t('start', language), main: t('chooseAnAction', language), move: t('destination', language), camera: t('cameraRoute', language), investigate: t('explore', language), detail: t('investigationResults', language), confirmation: t('confirmation', language), ai: t('ai', language), inventory: t('inventory', language), encounter: t('encounterResponse', language), flee: t('escapeRoute', language), end: t('end', language), settings: t('settings', language), language: t('language', language) }
  actions.setAttribute('aria-label', t('menuPage', language, names[menu], page + 1, count))
  for (let slot = 0; slot < 6; slot++) {
    const option = list[page * 6 + slot]
    if (option) {
      const element = button(option.label, () => {
        const inputLabel = option.inputLabel ?? option.label.split('\n')[0].replace(/ >$/, '')
        if (option.setting) {
          option.enter?.()
          if (option.submenu) open(option.submenu)
          else option.run?.()
        } else if (helpMode && option.help) {
          confirmInput(t('helpInput', language, option.helpInput ?? inputLabel), [])
          appendLog(...option.help())
          helpMode = false
          render()
        } else if (option.submenu) {
          pendingInput.push(inputLabel)
          option.enter?.()
          open(option.submenu)
        } else {
          confirmInput(inputLabel, option.inputPath ?? pendingInput)
          option.run?.()
        }
        const nextOptions = options()
        showPrompt(nextOptions.some(option => !option.disabled) || !!parent() || nextOptions.length > 6)
      })
      const lines = option.label.split('\n')
      element.replaceChildren(...lines.map((text, index) => {
        const line = document.createElement('span')
        line.className = index === 0 ? 'option-title' : 'option-detail'
        line.textContent = text
        return line
      }))
      element.disabled = isTyping || (!!option.disabled && !(helpMode && option.help))
      actions.append(element)
    } else {
      const empty = document.createElement('span')
      empty.className = 'inventory-empty'
      empty.setAttribute('aria-hidden', 'true')
      actions.append(empty)
    }
  }
  indicator.textContent = `${page + 1} / ${count}`
  help.disabled = isTyping
  help.className = helpMode ? 'help-button help-active' : 'help-button'
  help.setAttribute('aria-pressed', String(helpMode))
  back.disabled = isTyping || !parent(); previous.disabled = isTyping || page === 0; next.disabled = isTyping || page === count - 1
  showPrompt(list.some(option => !option.disabled) || !!parent() || count > 1)
}
terminal.append(log, actions, navigation)
app.append(terminal)
appendLog(t('title', language), t('coreLoopPrototype', language), t('selectStartToBegin', language))
render()
