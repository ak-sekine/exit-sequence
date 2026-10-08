import { supplyEnergy, maxEnergy } from './balance.ts'
import { t, roomName, initialLanguage, saveLanguage, languageNames, itemName, roomDescriptions, facilityName, itemDescription } from './i18n.ts'
import type { Language } from './i18n.ts'
import './style.css'
import { Game } from './game.ts'
import type { Action } from './game.ts'
import { costs, cardinalDirections, neighborInDirection, named, rooms, passable, cellCode, edgeKey } from './map.ts'
import { itemSpecs, facilities } from './items.ts'
import type { ItemId, Installation } from './items.ts'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('App element was not found')
const game = new Game()
let language: Language = initialLanguage()
type Menu = 'start' | 'main' | 'move' | 'investigate' | 'confirmation' | 'ai' | 'inventory' | 'encounter' | 'retreat' | 'end' | 'settings' | 'language' | 'item' | 'target' | 'edge' | 'bulk' | 'device'
type Option = { label: string; setting?: boolean; inputLabel?: string; inputPath?: string[]; submenu?: Menu; enter?: () => void; run?: () => void; disabled?: boolean; help?: () => string[]; helpInput?: string }
let menu: Menu = 'start', page = 0
let languageParent: 'start' | 'settings' = 'start'
function changeLanguage(nextLanguage: Language) {
  if (isTyping) return
  language = nextLanguage
  saveLanguage(language)
  pendingInput.length = 0
  open(languageParent === 'settings' ? 'main' : 'start')
}
let selectedItem: ItemId = 'predictor'
let selectedDevice = 0
let selectedEdge = ''
let targetParent: Menu = 'item'
let bulkParent: Menu = 'item'
let targetAction: (target: typeof game.state.location) => Action = target => ({ type: 'use', item: selectedItem, target })
let edgeAction: (edge: string, closed: boolean) => Action = (edge, closed) => ({ type: 'use', item: selectedItem, edge, closed })
let installingController = false
let localEdges = true
let confirmation: { action: Action; parent: Menu; page: number; path: string[] } | null = null
function prepare(action: Action, description: string[] = []) {
  if (!game.canAct(action)) { appendLog(action.type === 'facility' && action.facility === 'charger' && game.state.chargerUsed ? t('chargerUsed', language) : t('actionUnavailable', language), ...(action.type === 'facility' && action.facility === 'ship' ? [t('requirementsMissing', language), ...game.statusLines(language)] : [])); return }
  confirmation = { action, parent: menu, page, path: [...pendingInput] }
  open('confirmation')
  appendLog(...description, ...(action.type === 'give-up' ? [] : [t('worldHelp', language)]), t(action.type === 'collect' ? 'collectQuestion' : action.type === 'facility' && action.facility === 'ship' ? 'launchQuestion' : 'useQuestion', language))
}
function itemHelp(item: ItemId): string[] {
  const spec = itemSpecs[item]
  return [itemName(item, language), t('toolStats', language, t(spec.kind, language), spec.cost, spec.range, spec.duration, t(spec.consumable ? 'consumable' : 'reusable', language)),
    itemDescription(item, language), ...(item === 'predictor' ? [t('predictionHelp', language)] : []),
    ...(spec.effect === 'escape' ? [t('escapeItem', language)] : [t('worldHelp', language)])]
}
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
  if (!parent() && nextMenu !== 'confirmation') pendingInput.length = 0
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
  confirmation = null
  appendLog(t('title', language), roomDescriptions(language).居住, t('introDamage', language), t('introRequirements', language), t('introTools', language), t('introStatus', language), ...game.warningLines(language))
  open('main')
}
function options(): Option[] {
  const s = game.state
  const describe = (item: ItemId) => () => itemHelp(item)
  if (menu === 'start') return [{ label: t('start', language), run: restart },
    { label: t('startLanguageMenu', language), setting: true, submenu: 'language', enter: () => { languageParent = 'start' } }]
  if (menu === 'settings') return [{ label: t('languageMenu', language), setting: true, submenu: 'language', enter: () => { languageParent = 'settings' } }]
  if (menu === 'language') return (['ja', 'en'] as const).map(value => ({ label: languageNames[value], setting: true, run: () => changeLanguage(value) }))
  if (menu === 'end') return [{ label: t('restart', language), run: restart }, { label: t('finalStatus', language), help: () => [t('readHelp', language)], run: () => appendLog(...game.statusLines(language)) }]
  if (menu === 'main') return [
    { label: t('exploreMenu', language), submenu: 'investigate' }, { label: t('moveMenu', language), submenu: 'move' },
    { label: t('inventoryMenu', language), submenu: 'inventory' }, { label: t('aiMenu', language), submenu: 'ai' },
    { label: t('settingsMenu', language), setting: true, submenu: 'settings' },
  ]
  if (menu === 'ai') return [
    { label: t('status', language), help: () => [t('readHelp', language)], run: () => appendLog(...game.statusLines(language)) },
    { label: t('camera', language), help: () => [t('cameraHelp', language)], run: () => prepare({ type: 'camera' }, [t('cameraHelp', language)]) },
    { label: t('feed', language), help: () => [t('readHelp', language)], run: () => appendLog(...game.feedLines(language)) },
    { label: t('sensor', language), help: () => [t('readHelp', language)], run: () => appendLog(...(game.warningLines(language).length ? game.warningLines(language) : [t('noSignal', language)])) },
    { label: t('selfLure', language), help: () => [t('selfHelp', language)], run: () => prepare({ type: 'self-lure' }, [t('selfHelp', language)]) },
    { label: t('wait', language), help: () => [t('worldHelp', language), 'ENERGY 1'], run: () => prepare({ type: 'wait' }, ['ENERGY 1']) },
    { label: t('predictionRecord', language), help: () => [t('readHelp', language)], run: () => appendLog(...game.predictionLines(language)) },
  ]
  if (menu === 'encounter') return [
    { label: t('emergency', language), submenu: 'retreat' },
    { label: t('giveUp', language), help: () => [t('gameOver', language)], run: () => prepare({ type: 'give-up' }, [t('gameOver', language)]) },
  ]
  if (menu === 'inventory') return [
    { label: t('baseMap', language), help: () => [t('mapHelp', language)], run: () => appendLog(...game.mapLines(language)) },
    { label: t('facilityGuide', language), help: () => [t('guideHelp', language)], run: () => appendLog(...game.guideLines(language)) },
    ...s.items.filter(item => item !== 'map').map(item => ({ label: itemName(item, language) + ' >', submenu: 'item' as const, enter: () => { selectedItem = item } })),
    ...s.installations.map(device => ({ label: t('installedLabel', language, itemName(device.item, language), cellCode(device.room)), submenu: 'device' as const, enter: () => { selectedDevice = device.id } })),
  ]
  if (menu === 'investigate') return [
    { label: t('surroundings', language), help: () => [t('readHelp', language)], run: () => appendLog(t('locationStatus', language, roomName(s.location, language)), roomDescriptions(language)[s.location]) },
    ...(s.ground[s.location] ?? []).map(item => ({ label: itemName(item, language), help: describe(item), run: () => prepare({ type: 'collect', item }, [t('inspectItem', language, itemName(item, language)), ...itemHelp(item)]) })),
    ...(facilities[s.location] ?? []).map(facility => {
      const submenu = facility === 'alarm' ? 'target' as const : facility === 'bulkhead' ? 'edge' as const : undefined
      return { label: facilityName(facility, language) + (submenu ? ' >' : ''), submenu,
        enter: () => {
          if (facility === 'alarm') { targetParent = 'investigate'; targetAction = target => ({ type: 'facility', facility: 'alarm', target }) }
          if (facility === 'bulkhead') { bulkParent = 'investigate'; installingController = false; localEdges = true; edgeAction = (edge, closed) => ({ type: 'facility', facility: 'bulkhead', edge, closed }) }
        },
        help: submenu ? undefined : () => [facility === 'camera' ? t('cameraHelp', language) : facility === 'ship' ? t('escapeItem', language) : `ENERGY +${supplyEnergy} / ${maxEnergy}`],
        run: () => prepare({ type: 'facility', facility }, [roomDescriptions(language)[s.location], ...(facility === 'camera' ? [t('cameraHelp', language)] : facility === 'charger' ? [`ENERGY +${supplyEnergy} / ${maxEnergy}`] : game.statusLines(language))]),
      }
    }),
  ]
  if (menu === 'item') {
    const item = selectedItem, spec = itemSpecs[item]
    if (spec.effect === 'escape') return [{ label: t('status', language), help: describe(item), run: () => appendLog(...itemHelp(item)) }]
    if (spec.kind === 'deployable') return [{ label: t('install', language) + (item === 'controller' ? ' >' : ''), submenu: item === 'controller' ? 'edge' : undefined,
      enter: () => { bulkParent = 'item'; installingController = true; localEdges = true },
      help: item === 'controller' ? undefined : describe(item), run: () => prepare({ type: 'install', item: item as Installation['item'] }, itemHelp(item)) }]
    if (spec.effect === 'lure') return [{ label: t('use', language) + ' >', submenu: 'target', enter: () => { targetParent = 'item'; targetAction = target => ({ type: 'use', item, target }) } }]
    if (spec.effect === 'bulkhead') return [{ label: t('use', language) + ' >', submenu: 'edge', enter: () => { bulkParent = 'item'; installingController = false; localEdges = item === 'local-key'; edgeAction = (edge, closed) => ({ type: 'use', item, edge, closed }) } }]
    return [{ label: t('use', language), help: describe(item), run: () => prepare({ type: 'use', item }, itemHelp(item)) }]
  }
  if (menu === 'device') {
    const device = s.installations.find(device => device.id === selectedDevice)!
    if (device.item === 'controller') return [
      ...([true, false] as const).map(closed => ({ label: t(closed ? 'close' : 'open', language), help: describe(device.item), run: () => prepare({ type: 'activate', id: device.id, closed }, itemHelp(device.item)) })),
    ]
    return [{ label: t('activate', language), help: describe(device.item), run: () => prepare({ type: 'activate', id: device.id }, itemHelp(device.item)) }]
  }
  if (menu === 'target') return rooms.filter(room => game.targetKnown(room)).map(target => ({ label: game.label(target, language), help: () => targetParent === 'item' ? itemHelp(selectedItem) : [t('toolStats', language, t('fixed', language), 1, 6, 4, t('reusable', language))], run: () => prepare(targetAction(target), targetParent === 'item' ? itemHelp(selectedItem) : [t('toolStats', language, t('fixed', language), 1, 6, 4, t('reusable', language))]) }))
  if (menu === 'edge') return s.knownEdges.filter(edge => !localEdges || edge.split(':').includes(s.location)).map(edge => ({ label: game.edgeLabel(edge),
    ...(installingController ? { help: describe('controller'), run: () => prepare({ type: 'install', item: 'controller', edge }, itemHelp('controller')) }
      : { submenu: 'bulk' as const, enter: () => { selectedEdge = edge } }),
  }))
  if (menu === 'bulk') return ([true, false] as const).map(closed => ({ label: t(closed ? 'close' : 'open', language), help: () => bulkParent === 'item' ? itemHelp(selectedItem) : [t('toolStats', language, t('fixed', language), 1, 1, 3, t('reusable', language))], run: () => prepare(edgeAction(selectedEdge, closed), bulkParent === 'item' ? itemHelp(selectedItem) : [t('toolStats', language, t('fixed', language), 1, 1, 3, t('reusable', language))]) }))
  if (menu === 'confirmation') return [
    { label: t('yes', language), inputPath: [], run: () => { const action = confirmation!.action; confirmation = null; act(action) } },
    { label: t('no', language), inputPath: [], run: () => { const previous = confirmation!; confirmation = null; pendingInput.splice(0, pendingInput.length, ...previous.path); open(previous.parent); page = previous.page; render(); appendLog(t('declined', language)) } },
  ]
  return cardinalDirections.map(direction => {
    const target = neighborInDirection(s.location, direction), retreat = menu === 'retreat'
    const label = t(direction, language)
    if (!target) return { label, disabled: true }
    const action: Action = retreat ? { type: 'retreat', target } : { type: 'move', target }
    const passage = game.passage(s.location, target), blocked = !passable(passage)
    return { label, disabled: !game.canAct(action),
      help: () => {
        const recorded = s.feed?.passages[edgeKey(s.location, target)]
        const destination = named(s.knowledge[target]) ? t('destinationKnown', language, roomName(target, language)) : t('destinationUnknown', language, cellCode(target))
        return [label, destination,
          t('routeHelp', language, blocked ? passage : recorded ?? t('unchecked', language), retreat ? 2 : blocked ? '—' : recorded ? passable(recorded) ? costs[recorded] : '—' : '1–2', t(game.freshness(s.feed), language)),
          ...(retreat ? [t('emergencyHelp', language)] : [])]
      },
      run: () => retreat ? prepare(action, [t('emergencyHelp', language)]) : act(action),
    }
  })
}
function parent(): Menu | null {
  if (menu === 'language') return languageParent
  if (menu === 'settings') return 'main'
  if (menu === 'confirmation') return null
  if (menu === 'retreat') return 'encounter'
  if (menu === 'target') return targetParent
  if (menu === 'edge') return bulkParent
  if (menu === 'bulk') return 'edge'
  if (menu === 'item' || menu === 'device') return 'inventory'
  return ['move', 'investigate', 'inventory', 'ai'].includes(menu) ? 'main' : null
}
const navigation = document.createElement('nav')
navigation.className = 'action-navigation'
navigation.setAttribute('aria-label', t('choicePageNavigation', language))
const back = button(t('back', language), () => {
  const nextMenu = parent(), previousMenu = menu
  if (!nextMenu) return
  if (previousMenu !== 'confirmation') pendingInput.pop()
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
  const names: Record<Menu, string> = { start: t('start', language), main: t('chooseAnAction', language), move: t('destination', language), investigate: t('explore', language), confirmation: t('confirmation', language), ai: t('ai', language), inventory: t('inventory', language), encounter: t('encounterResponse', language), retreat: t('destination', language), end: t('end', language), settings: t('settings', language), language: t('language', language), item: t('use', language), target: t('destination', language), edge: t('destination', language), bulk: t('use', language), device: t('activate', language) }
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
  back.disabled = isTyping || menu === 'confirmation' || !parent(); previous.disabled = isTyping || page === 0; next.disabled = isTyping || page === count - 1
  showPrompt(list.some(option => !option.disabled) || !!parent() || count > 1)
}
terminal.append(log, actions, navigation)
app.append(terminal)
appendLog(t('title', language), t('coreLoopPrototype', language), t('selectStartToBegin', language))
render()
