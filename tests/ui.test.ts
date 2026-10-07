import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { Game, taskInfo, conditionNames } from '../src/game.ts'
import { costs, descriptions, neighbors, rooms, baseMapLines } from '../src/map.ts'

// Exercise the real UI handlers with a small DOM adapter, without adding a test framework.
class Element {
  children: Element[] = []
  parent: Element | null = null
  ownText = ''
  disabled = false
  className = ''
  scrollTop = 0
  scrollHeight = 0
  handlers: Record<string, () => void> = {}
  tag: string
  constructor(tag: string) { this.tag = tag }
  set textContent(text: string) { this.ownText = text; this.children = [] }
  get textContent(): string { return this.ownText + this.children.map(child => child.textContent).join('') }
  get lastElementChild() { return this.children.at(-1) }
  append(...children: Element[]) { children.forEach(child => { child.parent = this; this.children.push(child) }) }
  replaceChildren(...children: Element[]) { this.children = []; this.ownText = ''; this.append(...children) }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this) }
  attributes: Record<string, string> = {}
  setAttribute(name: string, value: string) { this.attributes[name] = value }
  focus() {}
  addEventListener(event: string, handler: () => void) { this.handlers[event] = handler }
  click() { if (!this.disabled) this.handlers.click?.() }
  querySelectorAll(selector: string): Element[] {
    return this.children.flatMap(child => [
      ...(child.tag === 'button' && (!selector.includes(':disabled') || !child.disabled) ? [child] : []),
      ...child.querySelectorAll(selector),
    ])
  }
  querySelector(selector: string) { return this.querySelectorAll(selector)[0] }
}

function fixture(reduce = true) {
  const app = new Element('div')
  let timerId = 0
  const timers = new Map<number, () => void>()
  const context = vm.createContext({
    Game, taskInfo, conditionNames, costs, descriptions, neighbors, rooms, baseMapLines,
    window: { matchMedia: () => ({ matches: reduce, addEventListener() {} }) },
    setTimeout: (callback: () => void, delay: number) => {
      assert.equal(delay, 5)
      timers.set(++timerId, callback)
      return timerId
    },
    clearTimeout: (id: number) => timers.delete(id),
    document: { querySelector: () => app, createElement: (tag: string) => new Element(tag) },
  })
  const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8').replace(/^import .*$/gm, '')
  vm.runInContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023 } }).outputText, context)
  const game: Game = vm.runInContext('game', context)
  const terminal = app.children[0]!
  const [log, actions, navigation] = terminal.children
  const lines = () => log!.children.map(line => line.textContent)
  const click = (label: string) => {
    const element = actions!.children.find(child => child.children[0]?.textContent === label)
    assert.ok(element, `Option exists: ${label}`)
    element.click()
  }
  const render = (menu: string) => vm.runInContext(`open('${menu}')`, context)
  const assertPrompt = () => {
    assert.equal(lines().at(-1), '>')
    assert.equal(lines().filter(line => line === '>').length, 1)
    for (const [index, line] of lines().entries()) if (line.startsWith('> ')) {
      assert.equal(lines()[index + 1], '')
      assert.notEqual(lines()[index + 2], '')
    }
  }
  const tick = () => {
    const entry = timers.entries().next().value
    if (entry) { timers.delete(entry[0]); entry[1]() }
  }
  const flush = () => { let limit = 10000; while (timers.size && limit--) tick(); assert.ok(limit > 0) }
  return { game, actions: actions!, navigation: navigation!, log: log!, lines, click, render, assertPrompt, tick, flush, timers,
    helpMode: () => vm.runInContext('helpMode', context) as boolean,
    enqueue: (...lines: string[]) => vm.runInContext(`appendLog(...${JSON.stringify(lines)})`, context) }
}

test('main has four intent entries and information reads never advance state or randomness', () => {
  const ui = fixture()
  ui.click('ゲーム開始')
  const labels = () => ui.actions.children.filter(e => e.tag === 'button').map(e => e.textContent)
  assert.deepEqual(labels(), ['調べる >', '移動 >', '持ち物 >', 'AI >'])
  ui.game.state.items = ['修理部品', '食糧']
  ui.game.state.feeds['居住:医療'] = { destination: '医療', passage: 'DARK', enemy: true, turn: 0 }
  const before = JSON.stringify(ui.game.state)
  ui.game.act = () => { throw new Error('Reference must not call act') }
  ;(ui.game as unknown as { random: () => number }).random = () => { throw new Error('Reference must not draw randomness') }
  ui.click('調べる >'); ui.click('周囲')
  assert.ok(ui.lines().includes('> 調べる 周囲'))
  ui.navigation.children[0]!.click()
  ui.click('AI >'); ui.click('状態確認')
  assert.ok(ui.lines().includes('> AI 状態確認'))
  ui.navigation.children[0]!.click()
  ui.click('持ち物 >')
  assert.deepEqual(labels(), ['基地マップ', '修理部品', '食糧'])
  const first = ui.lines().length - 1
  ui.click('基地マップ'); ui.click('基地マップ')
  assert.ok(ui.lines().includes('> 持ち物 基地マップ'))
  const map = ui.lines().slice(first)
  for (const line of baseMapLines('居住')) assert.ok(map.includes(line))
  assert.ok(!map.some(line => /DARK|防災ロボット|推定 ENERGY/.test(line)))
  assert.equal(JSON.stringify(ui.game.state), before)
  ui.navigation.children[2]!.click(); ui.click('基地マップ')
  assert.ok(ui.lines().includes('> HELP 持ち物 基地マップ'))
  assert.equal(ui.helpMode(), false)
  assert.equal(JSON.stringify(ui.game.state), before)
})

test('investigation shows state before execution and back preserves one level and HELP', () => {
  const ui = fixture()
  ui.click('ゲーム開始')
  ui.game.state.location = '電力管理'
  const before = JSON.stringify(ui.game.state)
  ui.click('調べる >')
  const inputCount = ui.lines().filter(line => line.startsWith('> ')).length
  ui.click('配電盤')
  assert.ok(ui.lines().includes('配電盤を確認した。'))
  assert.equal(ui.lines().filter(line => line.startsWith('> ')).length, inputCount + 1)
  assert.equal(JSON.stringify(ui.game.state), before)
  const logs = ui.lines()
  ui.navigation.children[2]!.click()
  ui.navigation.children[0]!.click()
  assert.ok(ui.actions.children.some(e => e.textContent === '配電盤'))
  assert.equal(ui.helpMode(), true)
  assert.deepEqual(ui.lines(), logs)
  ui.click('配電盤')
  assert.ok(ui.lines().includes('> HELP 調べる 配電盤'))
  assert.equal(ui.helpMode(), false)
  ui.click('配電盤'); ui.click('帰還船へ配電する')
  assert.ok(ui.lines().includes('> 帰還船へ配電する'))
  assert.equal(ui.game.state.conditions.power, true)
  assert.equal(ui.game.state.energy, 19)
  assert.equal(ui.game.state.turn, 1)
})

test('each investigation detail uses the selected task even with reduced motion', () => {
  const names = { power: '配電盤', control: '管制端末', repair: '整備設備', parts: '部品保管箱', food: '食糧保管庫', medical: '予備バッテリー', observe: '観測装置', launch: '帰還船' }
  for (const task of Object.keys(taskInfo) as (keyof typeof taskInfo)[]) {
    const ui = fixture()
    ui.click('ゲーム開始'); ui.game.state.location = taskInfo[task].room
    ui.game.state.items = ['修理部品']
    ui.game.state.conditions = { power: true, control: true, repair: true, food: true }
    if (task === 'power' || task === 'control' || task === 'repair' || task === 'food') ui.game.state.conditions[task] = false
    if (task === 'parts') { ui.game.state.items = []; ui.game.state.conditions.repair = false }
    const before = JSON.stringify(ui.game.state)
    ui.click('調べる >'); ui.click(names[task])
    assert.equal(JSON.stringify(ui.game.state), before)
    assert.equal(ui.actions.children[0]!.textContent, task === 'medical' ? 'はい' : taskInfo[task].label)
    assert.equal(ui.actions.children[0]!.disabled, false)
    ui.click(task === 'medical' ? 'はい' : taskInfo[task].label)
    assert.equal(ui.game.state.turn, 1)
    assert.ok(ui.lines().includes(`> 調べる ${names[task]}`)); assert.ok(ui.lines().includes(`> ${task === 'medical' ? 'はい' : taskInfo[task].label}`))
    if (task === 'launch') assert.equal(ui.game.state.status, 'clear')
  }
})

test('camera returns to AI and retains full HELP and normal history paths', () => {
  const ui = fixture()
  ui.click('ゲーム開始'); ui.click('AI >'); ui.click('監視カメラ >')
  const before = JSON.stringify(ui.game.state), logs = ui.lines()
  ui.navigation.children[2]!.click(); ui.navigation.children[0]!.click()
  assert.ok(ui.actions.children.some(e => e.textContent === '状態確認'))
  assert.equal(ui.helpMode(), true)
  assert.deepEqual(ui.lines(), logs)
  ui.click('監視カメラ >'); ui.click('医療区')
  assert.ok(ui.lines().includes('> HELP AI 監視カメラ 医療区'))
  assert.equal(JSON.stringify(ui.game.state), before)
  ui.click('医療区')
  assert.ok(ui.lines().includes('> AI 監視カメラ 医療区'))
  assert.equal(ui.game.state.energy, 19)
  assert.equal(ui.game.state.turn, 1)
  assert.equal(ui.game.freshness('居住', '医療'), '最新')
})

test('typing queues characters and lines, blocks actions, and finishes with one prompt', () => {
  const ui = fixture(false)
  assert.deepEqual(ui.lines(), [])
  ui.click('ゲーム開始')
  assert.equal(ui.game.state.turn, 0)
  assert.ok(ui.actions.children.filter(e => e.tag === 'button').every(e => e.disabled))
  ui.tick(); assert.deepEqual(ui.lines(), ['E'])
  ui.tick(); assert.deepEqual(ui.lines(), ['EX'])
  assert.ok(!ui.lines().includes('>'))
  ui.flush(); ui.assertPrompt()
  ui.click('ゲーム開始')
  assert.deepEqual(ui.lines().slice(-2), ['> ゲーム開始', ''])
  ui.flush()
  ui.click('AI >')
  const before = ui.lines().slice(0, -1)
  ui.click('状態確認')
  assert.deepEqual(ui.lines().slice(-2), ['> AI 状態確認', ''])
  ui.click('状態確認')
  ui.tick(); assert.equal(ui.lines().at(-1), 'L')
  ui.flush()
  assert.deepEqual(ui.lines(), [...before, '> AI 状態確認', '', ...ui.game.statusLines(), '>'])
  ui.assertPrompt()
  ui.game.state.items = Array(8).fill('食糧')
  ui.navigation.children[0]!.click()
  ui.click('持ち物 >')
  ui.enqueue('A😀', 'B'); ui.enqueue('C')
  ui.navigation.children[0]!.click()
  ui.navigation.children[1]!.children[2]!.click()
  assert.ok(ui.navigation.children[0]!.disabled)
  ui.tick(); ui.tick(); assert.equal(ui.lines().at(-1), 'A😀')
  ui.flush()
  assert.deepEqual(ui.lines().slice(-4), ['A😀', 'B', 'C', '>'])
  assert.equal(ui.navigation.children[0]!.disabled, false)
  assert.equal(ui.navigation.children[1]!.children[0]!.disabled, true)
  assert.equal(ui.navigation.children[1]!.children[2]!.disabled, false)
})

test('skip drains the queue once, cancels timers and restores original disabled states', () => {
  const ui = fixture(false)
  ui.tick(); ui.log.click(); ui.log.click()
  assert.equal(ui.timers.size, 0)
  ui.assertPrompt()
  ui.click('ゲーム開始'); ui.log.click()
  ui.game.state.location = '発着'
  ui.click('調べる >'); ui.click('帰還船'); ui.log.click()
  ui.enqueue('first', '', 'last')
  ui.tick(); ui.log.click()
  const result = ui.lines()
  ui.tick(); ui.log.click()
  assert.deepEqual(ui.lines(), result)
  assert.deepEqual(result.slice(-4), ['first', '', 'last', '>'])
  assert.equal(ui.actions.children[0]!.disabled, true)
  assert.equal(ui.navigation.children[0]!.disabled, false)
  assert.equal(ui.timers.size, 0)
  ui.assertPrompt()
})

test('end outputs lock restart; restart and reduced motion preserve identical output', () => {
  for (const status of ['over', 'clear'] as const) {
    const ui = fixture(false)
    ui.log.click(); ui.click('ゲーム開始'); ui.log.click()
    ui.game.state.status = status; ui.render('end')
    ui.enqueue(status === 'over' ? 'GAME OVER' : 'GAME CLEAR', 'AI：終了。')
    ui.click('最初から'); assert.equal(ui.game.state.status, status)
    ui.log.click(); ui.click('最初から')
    assert.deepEqual(ui.lines().slice(-2), ['> 最初から', ''])
    ui.flush(); ui.assertPrompt(); assert.equal(ui.timers.size, 0)
    assert.equal(ui.game.state.status, 'playing')
  }
  const animated = fixture(false), immediate = fixture(true)
  animated.flush()
  assert.deepEqual(animated.lines(), immediate.lines())
  animated.click('ゲーム開始'); immediate.click('ゲーム開始'); animated.flush()
  animated.click('AI >'); immediate.click('AI >'); animated.click('状態確認'); immediate.click('状態確認'); animated.flush()
  assert.deepEqual(animated.lines(), immediate.lines())
  assert.equal(immediate.timers.size, 0)
})

test('start, confirmations, submenu inputs and navigation preserve a single prompt', () => {
  const ui = fixture()
  ui.assertPrompt()
  ui.click('ゲーム開始')
  assert.deepEqual(ui.lines().slice(3, 7), ['> ゲーム開始', '', 'EXIT SEQUENCE', 'SYSTEM ONLINE'])
  assert.equal(ui.actions.children.length, 6)
  const state = JSON.stringify(ui.game.state)
  for (const label of ['調べる', '移動', '持ち物', 'AI']) {
    const before = ui.lines()
    ui.click(`${label} >`)
    assert.deepEqual(ui.lines(), before)
    ui.assertPrompt()
    ui.navigation.children[0]!.click()
    assert.deepEqual(ui.lines(), before)
    ui.assertPrompt()
  }
  ui.click('AI >'); ui.click('状態確認')
  assert.ok(ui.lines().includes('> AI 状態確認'))
  assert.equal(JSON.stringify(ui.game.state), state)
  ui.assertPrompt()

  ui.navigation.children[0]!.click()
  // Supply extra display-only items to verify both paging handlers.
  ui.game.state.items = Array(8).fill('食糧')
  ui.click('持ち物 >')
  const before = ui.lines()
  ui.navigation.children[1]!.children[2]!.click()
  assert.equal(ui.actions.children.filter(child => child.tag === 'button').length, 3)
  ui.navigation.children[1]!.children[0]!.click()
  assert.deepEqual(ui.lines(), before)
  ui.navigation.children[1]!.children[2]!.click()
  ui.click('食糧')
  assert.deepEqual(ui.lines().slice(-4), ['> 持ち物 食糧', '', '食糧：帰還用物資。帰還まで保持する。', '>'])
  ui.click('食糧')
  assert.equal(ui.lines().filter(line => line === '> 持ち物 食糧').length, 2)
  ui.navigation.children[0]!.click()
  ui.click('調べる >'); ui.click('周囲'); ui.navigation.children[0]!.click()
  assert.equal(ui.lines().filter(line => line === '> 調べる 周囲').length, 1)
  assert.equal(JSON.stringify(ui.game.state), JSON.stringify({ ...JSON.parse(state), items: Array(8).fill('食糧') }))
  ui.assertPrompt()
})

test('movement, encounter and both end states use the same input format', () => {
  const ui = fixture()
  ui.click('ゲーム開始')
  for (const key of Object.keys(ui.game.state.passages)) ui.game.state.passages[key] = 'NORMAL'
  ui.game.state.enemy = '管制'
  ui.click('移動 >'); ui.click('医療区')
  assert.ok(ui.lines().includes('> 移動 医療区'))
  assert.equal(ui.game.state.energy, 19)
  assert.equal(ui.game.state.turn, 1)
  ui.assertPrompt()

  ui.game.state.encounter = true
  ui.render('encounter')
  const before = ui.lines()
  ui.click('逃げる >')
  assert.deepEqual(ui.lines(), before)
  ui.navigation.children[0]!.click()
  ui.assertPrompt()

  for (const status of ['over', 'clear'] as const) {
    ui.game.state.status = status
    ui.render('end')
    ui.assertPrompt()
    ui.click('最終状態確認')
    ui.assertPrompt()
    ui.click('最初から')
    const index = ui.lines().lastIndexOf('> 最初から')
    assert.deepEqual(ui.lines().slice(index, index + 4), ['> 最初から', '', 'EXIT SEQUENCE', 'SYSTEM ONLINE'])
    assert.equal(ui.game.state.energy, 20)
    assert.equal(ui.game.state.turn, 0)
    ui.assertPrompt()
  }
})

test('camera, equipment and flee confirm one concise selection path', () => {
  for (const kind of ['camera', 'equipment', 'flee'] as const) {
    const ui = fixture()
    ui.click('ゲーム開始')
    for (const key of Object.keys(ui.game.state.passages)) ui.game.state.passages[key] = 'NORMAL'
    ui.game.state.enemy = '研究'
    if (kind === 'equipment') ui.game.state.location = '電力管理'
    if (kind === 'flee') { ui.game.state.encounter = true; ui.render('encounter') }
    const label = { camera: '監視', equipment: '設備', flee: '逃げる' }[kind]
    const before = ui.lines(), state = JSON.stringify(ui.game.state)
    if (kind === 'camera') { ui.click('AI >'); ui.click('監視カメラ >') }
    else if (kind === 'equipment') ui.click('調べる >')
    else ui.click('逃げる >')
    assert.deepEqual(ui.lines(), before)
    assert.equal(JSON.stringify(ui.game.state), state)
    ui.assertPrompt()
    const target = kind === 'equipment' ? '帰還船へ配電する' : '医療区'
    if (kind === 'equipment') ui.click('配電盤')
    const selectionStart = ui.lines().length
    ui.click(target)
    const added = ui.lines().slice(selectionStart - 1)
    assert.equal(added.filter(line => line.startsWith('> ')).length, 1)
    assert.equal(added[0], kind === 'equipment' ? `> ${target}` : `> ${kind === 'camera' ? 'AI 監視カメラ' : label} ${target}`)
    assert.equal(added[1], '')
    assert.equal(ui.game.state.turn, 1)
    ui.assertPrompt()
  }
})

test('encounter actions confirm immediately without display details', () => {
  for (const label of ['隠れる', '強行突破']) {
    const ui = fixture()
    ui.click('ゲーム開始')
    ui.game.state.encounter = true
    ui.render('encounter')
    ui.click(label)
    assert.equal(ui.lines().filter(line => line === `> ${label}`).length, 1)
    assert.equal(ui.game.state.turn, 1)
    ui.assertPrompt()
  }
})

test('fatal movement and launch output end with a prompt for restart', () => {
  const ui = fixture(false)
  ui.flush()
  ui.click('ゲーム開始'); ui.log.click()
  ui.game.state.energy = 1
  for (const key of Object.keys(ui.game.state.passages)) ui.game.state.passages[key] = 'NORMAL'
  ui.click('移動 >'); ui.click('医療区')
  assert.equal(ui.actions.children[0]!.disabled, true)
  assert.ok(!ui.lines().includes('>'))
  ui.flush()
  assert.ok(ui.lines().includes('GAME OVER'))
  assert.equal(ui.game.state.turn, 0)
  ui.assertPrompt()
  ui.click('最初から'); ui.log.click()
  ui.game.state.location = '発着'
  ui.game.state.conditions = { power: true, control: true, repair: true, food: true }
  ui.click('調べる >'); ui.click('帰還船'); ui.log.click(); ui.click('帰還船を発進する')
  assert.equal(ui.actions.children[0]!.disabled, true)
  ui.log.click()
  assert.ok(ui.lines().includes('GAME CLEAR'))
  assert.equal(ui.game.state.energy, 20)
  assert.equal(ui.game.state.turn, 1)
  ui.assertPrompt()
  ui.click('最初から'); ui.flush()
  ui.assertPrompt()
})

test('HELP waiting survives navigation and unrelated actions; manual toggle is silent', () => {
  const ui = fixture(), help = ui.navigation.children[2]!
  assert.equal(help.textContent, 'HELP')
  assert.equal(help.attributes['aria-pressed'], 'false')
  ui.click('ゲーム開始')
  const started = ui.lines()
  help.click()
  assert.equal(help.attributes['aria-pressed'], 'true')
  assert.ok(help.className.includes('help-active'))
  assert.deepEqual(ui.lines(), started)
  ui.click('調べる >'); ui.click('周囲'); ui.navigation.children[0]!.click()
  assert.equal(ui.helpMode(), false)
  help.click()
  for (const label of ['調べる', '移動', '持ち物', 'AI']) {
    const state = JSON.stringify(ui.game.state), logs = ui.lines()
    ui.click(`${label} >`)
    assert.equal(ui.helpMode(), true)
    ui.navigation.children[0]!.click()
    assert.equal(ui.helpMode(), true)
    assert.deepEqual(ui.lines(), logs)
    assert.equal(JSON.stringify(ui.game.state), state)
  }
  ui.game.state.items = Array(8).fill('食糧')
  ui.click('持ち物 >')
  ui.navigation.children[1]!.children[2]!.click()
  assert.equal(ui.helpMode(), true)
  ui.navigation.children[1]!.children[0]!.click()
  assert.equal(ui.helpMode(), true)
  ui.navigation.children[0]!.click()
  assert.equal(help.attributes['aria-pressed'], 'true')
  const logs = ui.lines()
  help.click()
  assert.equal(help.attributes['aria-pressed'], 'false')
  assert.ok(!help.className.includes('help-active'))
  assert.equal(help.textContent, 'HELP')
  assert.deepEqual(ui.lines(), logs)
})

test('all HELP targets read state without actions or random calls and retain their menu', () => {
  for (const kind of ['move', 'camera', 'equipment', 'inventory', 'hide', 'force', 'flee', 'launch', 'supply', 'done'] as const) {
    const ui = fixture()
    ui.click('ゲーム開始')
    if (kind === 'equipment' || kind === 'done') ui.game.state.location = '電力管理'
    if (kind === 'done') ui.game.state.conditions.power = true
    if (kind === 'launch') ui.game.state.location = '発着'
    if (kind === 'supply') ui.game.state.location = '医療'
    if (kind === 'inventory') ui.game.state.items = ['修理部品']
    if (['hide', 'force', 'flee'].includes(kind)) ui.game.state.encounter = true
    const menu = ['hide', 'force'].includes(kind) ? 'encounter' : ['launch', 'supply', 'done'].includes(kind) ? 'equipment' : kind
    ui.render(menu === 'equipment' ? 'investigate' : menu)
    const label = { move: '医療区', camera: '医療区', equipment: '帰還船へ配電する', inventory: '修理部品', hide: '隠れる', force: '強行突破', flee: '医療区', launch: '帰還船を発進する', supply: '予備バッテリーを回収', done: '帰還船へ配電する' }[kind]
    const operation = { move: '移動', camera: '監視', equipment: '設備', inventory: '持ち物', hide: '', force: '', flee: '逃げる', launch: '設備', supply: '設備', done: '設備' }[kind]
    const before = JSON.stringify(ui.game.state)
    ui.game.act = () => { throw new Error('HELP must not call act') }
    ;(ui.game as unknown as { random: () => number }).random = () => { throw new Error('HELP must not draw random numbers') }
    ui.navigation.children[2]!.click()
    const targetLabel = ['equipment', 'done'].includes(kind) ? '配電盤' : kind === 'launch' ? '帰還船' : kind === 'supply' ? '予備バッテリー' : label
    ui.click(targetLabel)
    assert.equal(JSON.stringify(ui.game.state), before)
    const path = ['equipment', 'done'].includes(kind) ? '調べる 配電盤' : kind === 'launch' ? '調べる 帰還船' : kind === 'supply' ? '調べる 予備バッテリー' : `${kind === 'camera' ? 'AI 監視カメラ' : operation}${operation ? ' ' : ''}${label}`
    assert.ok(ui.lines().includes(`> HELP ${path}`))
    assert.ok(ui.actions.children.some(e => e.children[0]?.textContent === targetLabel))
    assert.equal(ui.helpMode(), false)
    assert.equal(ui.navigation.children[2]!.attributes['aria-pressed'], 'false')
    assert.ok(!ui.navigation.children[2]!.className.includes('help-active'))
  }
})

test('route HELP reveals only known information, keeps freshness and allows CLOSED explanations', () => {
  const ui = fixture()
  ui.click('ゲーム開始'); ui.click('移動 >'); ui.navigation.children[2]!.click()
  for (const key of Object.keys(ui.game.state.passages)) ui.game.state.passages[key] = 'DARK'
  ui.render('move')
  ui.click('医療区')
  assert.ok(ui.lines().includes('状態：UNKNOWN / 未確認'))
  assert.ok(ui.lines().includes('敵情報：UNKNOWN / 未確認'))
  ui.game.state.feeds['居住:医療'] = { destination: '医療', passage: 'BLOCKED', enemy: true, turn: 0 }
  ui.game.state.turn = 1
  const before = JSON.stringify(ui.game.state)
  ui.navigation.children[2]!.click()
  ui.click('医療区')
  assert.ok(ui.lines().includes('情報の鮮度：古い'))
  assert.ok(ui.lines().includes('状態：BLOCKED'))
  assert.ok(ui.lines().includes('推定ENERGY：3'))
  assert.equal(JSON.stringify(ui.game.state), before)
  for (const key of Object.keys(ui.game.state.passages)) ui.game.state.passages[key] = 'CLOSED'
  ui.render('move'); ui.navigation.children[2]!.click(); ui.click('医療区')
  assert.ok(ui.lines().includes('状態：CLOSED（現在移動不可）'))
  assert.equal(ui.actions.children[0]!.disabled, true)
})

test('target menus have no cancel; back alone returns silently without world changes', () => {
  const ui = fixture()
  ui.click('ゲーム開始')
  for (const label of ['調べる', '移動', '持ち物', 'AI']) {
    ui.click(`${label} >`)
    const before = JSON.stringify(ui.game.state)
    const logs = ui.lines()
    assert.ok(!ui.actions.children.some(e => e.textContent === 'キャンセル'))
    ui.navigation.children[0]!.click()
    assert.equal(JSON.stringify(ui.game.state), before)
    assert.deepEqual(ui.lines(), logs)
    assert.ok(ui.actions.children.some(e => e.children[0]?.textContent === '移動 >'))
  }
  ui.game.state.encounter = true; ui.render('encounter'); ui.click('逃げる >')
  assert.ok(!ui.actions.children.some(e => e.textContent === 'キャンセル'))
  const state = JSON.stringify(ui.game.state), logs = ui.lines()
  ui.navigation.children[0]!.click()
  assert.equal(JSON.stringify(ui.game.state), state)
  assert.deepEqual(ui.lines(), logs)
  ui.game.state.items = Array(5).fill('食糧'); ui.render('inventory')
  assert.equal(ui.navigation.children[1]!.children[1]!.textContent, '1 / 1')
  assert.equal(ui.navigation.children[1]!.children[2]!.disabled, true)
  assert.ok(!ui.lines().includes('> キャンセル'))
})

test('HELP input is immediate, body types at 5ms and skip restores controls with HELP OFF', () => {
  const ui = fixture(false)
  ui.log.click(); ui.click('ゲーム開始'); ui.log.click()
  ui.click('移動 >'); const help = ui.navigation.children[2]!
  help.click()
  const before = JSON.stringify(ui.game.state)
  ui.click('医療区')
  assert.deepEqual(ui.lines().slice(-2), ['> HELP 移動 医療区', ''])
  assert.equal(help.disabled, true)
  assert.equal(ui.helpMode(), false)
  assert.equal(help.attributes['aria-pressed'], 'false')
  assert.ok(ui.actions.children.filter(e => e.tag === 'button').every(e => e.disabled))
  assert.ok(ui.navigation.children[0]!.disabled)
  assert.ok(ui.navigation.children[1]!.children[0]!.disabled)
  assert.ok(ui.navigation.children[1]!.children[2]!.disabled)
  help.click(); ui.tick()
  assert.equal(ui.lines().at(-1), '医')
  ui.log.click()
  assert.equal(help.disabled, false)
  assert.equal(help.attributes['aria-pressed'], 'false')
  assert.equal(JSON.stringify(ui.game.state), before)
  assert.equal(ui.timers.size, 0)
  ui.assertPrompt()
})

test('one HELP reference retains selection path and the next click executes normal movement', () => {
  const ui = fixture()
  ui.click('ゲーム開始')
  ui.game.state.location = '医療'; ui.game.state.enemy = '研究'
  for (const key of Object.keys(ui.game.state.passages)) ui.game.state.passages[key] = 'NORMAL'
  ui.game.state.feeds['医療:居住'] = { destination: '居住', passage: 'NORMAL', enemy: false, turn: 0 }
  ui.render('main'); ui.click('移動 >'); ui.navigation.children[2]!.click()
  const state = JSON.stringify(ui.game.state)
  ui.click('居住区')
  assert.equal(JSON.stringify(ui.game.state), state)
  assert.ok(ui.lines().includes('> HELP 移動 居住区'))
  assert.equal(ui.helpMode(), false)
  ui.click('居住区')
  assert.ok(ui.lines().includes('> 移動 居住区'))
  assert.equal(ui.game.state.location, '居住')
  assert.equal(ui.game.state.energy, 19)
  assert.equal(ui.game.state.turn, 1)
})

test('restart clears pending HELP in both end states', () => {
  for (const status of ['over', 'clear'] as const) {
    const ui = fixture()
    ui.click('ゲーム開始'); ui.game.state.status = status; ui.render('end')
    const help = ui.navigation.children[2]!
    help.click(); ui.click('最終状態確認')
    assert.equal(ui.helpMode(), true)
    ui.click('最初から')
    assert.equal(ui.helpMode(), false)
    assert.equal(help.attributes['aria-pressed'], 'false')
    assert.ok(!help.className.includes('help-active'))
    assert.equal(ui.game.state.status, 'playing')
  }
})

test('battery investigation and answers are separate immediate inputs; decline and back never progress', () => {
  const ui = fixture(false)
  ui.log.click(); ui.click('ゲーム開始'); ui.log.click()
  ui.game.state.location = '医療'; ui.game.state.energy = 10
  ui.game.state.feeds['医療:居住'] = { destination: '居住', passage: 'NORMAL', enemy: false, turn: 0 }
  const before = JSON.stringify(ui.game.state)
  ui.game.act = () => { throw new Error('Decline and investigation must not act') }
  ;(ui.game as unknown as { random: () => number }).random = () => { throw new Error('Must not draw randomness') }
  ui.click('調べる >')
  assert.ok(!ui.actions.children.some(e => e.textContent === '予備バッテリー >'))
  ui.click('予備バッテリー')
  assert.deepEqual(ui.lines().slice(-2), ['> 調べる 予備バッテリー', ''])
  assert.ok(ui.actions.children.filter(e => e.tag === 'button').every(e => e.disabled))
  assert.ok(ui.navigation.children[0]!.disabled)
  assert.ok(ui.navigation.children[2]!.disabled)
  ui.tick(); assert.equal(ui.lines().at(-1), '予')
  ui.log.click()
  assert.ok(ui.lines().includes('回収しますか？'))
  assert.deepEqual(ui.actions.children.filter(e => e.tag === 'button').map(e => e.textContent), ['はい', 'いいえ'])
  const logs = ui.lines()
  ui.navigation.children[0]!.click()
  assert.deepEqual(ui.lines(), logs)
  ui.click('周囲'); ui.log.click()
  assert.ok(ui.lines().includes('> 調べる 周囲'))
  ui.click('予備バッテリー'); ui.log.click(); ui.click('いいえ')
  assert.deepEqual(ui.lines().slice(-2), ['> いいえ', ''])
  ui.flush()
  assert.equal(JSON.stringify(ui.game.state), before)
  assert.equal(ui.game.freshness('医療', '居住'), '最新')
  assert.ok(ui.actions.children.some(e => e.textContent === '予備バッテリー'))
  ui.click('予備バッテリー'); ui.log.click()
  assert.equal(ui.lines().filter(e => e === '> 調べる 予備バッテリー').length, 3)
  ui.assertPrompt()
})

test('battery yes reuses medical action, caps at 20 and completed investigation offers no answer', () => {
  for (const energy of [10, 19, 20]) {
    const ui = fixture(false)
    ui.log.click(); ui.click('ゲーム開始'); ui.log.click()
    ui.game.state.location = '医療'; ui.game.state.energy = energy
    const expected = new Game(() => 0.9)
    expected.state = structuredClone(ui.game.state)
    ;(ui.game as unknown as { random: () => number }).random = () => 0.9
    const result = expected.act({ type: 'task', task: 'medical' })
    ui.click('調べる >'); ui.click('予備バッテリー'); ui.log.click(); ui.click('はい')
    assert.deepEqual(ui.lines().slice(-2), ['> はい', ''])
    assert.deepEqual(ui.game.state, expected.state)
    assert.equal(ui.game.state.energy, Math.min(20, energy + 6))
    assert.equal(ui.game.state.turn, 1)
    assert.equal(ui.game.state.supplies.medical, true)
    ui.log.click()
    assert.deepEqual(ui.lines().slice(-result.length - 1, -1), result)
    ui.game.state.encounter = false; ui.render('main')
    const before = JSON.stringify(ui.game.state)
    ui.click('調べる >'); ui.click('予備バッテリー'); ui.log.click()
    assert.ok(ui.lines().includes('予備バッテリーはすでに回収済みだ。'))
    assert.ok(!ui.actions.children.some(e => ['はい', 'いいえ'].includes(e.textContent)))
    assert.equal(JSON.stringify(ui.game.state), before)
    ui.navigation.children[2]!.click(); ui.click('予備バッテリー'); ui.log.click()
    assert.ok(ui.lines().includes('> HELP 調べる 予備バッテリー'))
    assert.ok(ui.lines().includes('実行済み：はい'))
    assert.equal(ui.helpMode(), false)
    assert.equal(JSON.stringify(ui.game.state), before)
  }
})

test('map marker follows movement; move and camera menus use grid neighbors', () => {
  const ui = fixture(); ui.click('ゲーム開始')
  for (const room of rooms) {
    ui.game.state.location = room
    for (const menu of ['move','camera']) {
      ui.render(menu)
      assert.deepEqual(ui.actions.children.filter(e => e.tag === 'button').map(e => e.textContent), neighbors(room).map(r => r + '区'))
    }
  }
  ui.game.state.location = '居住'; ui.game.state.enemy = '研究'
  for (const key of Object.keys(ui.game.state.passages)) ui.game.state.passages[key] = 'NORMAL'
  ui.render('move'); ui.click('医療区')
  ui.render('inventory'); const before = JSON.stringify(ui.game.state)
  ui.click('基地マップ')
  assert.ok(ui.lines().includes('[ 居住]─[*医療]─[ 観測]'))
  assert.equal(JSON.stringify(ui.game.state), before)
})
