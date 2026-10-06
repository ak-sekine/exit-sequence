import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { Game, taskInfo } from '../src/game.ts'
import { costs, descriptions, neighbors } from '../src/map.ts'

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
  setAttribute() {}
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

function fixture() {
  const app = new Element('div')
  const context = vm.createContext({
    Game, taskInfo, costs, descriptions, neighbors,
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
    for (const [index, line] of lines().entries()) if (line.startsWith('> ')) assert.equal(lines()[index + 1], '')
  }
  return { game, actions: actions!, navigation: navigation!, lines, click, render, assertPrompt }
}

test('start, confirmations, submenu inputs and navigation preserve a single prompt', () => {
  const ui = fixture()
  ui.assertPrompt()
  ui.click('ゲーム開始')
  assert.deepEqual(ui.lines().slice(3, 7), ['> ゲーム開始', '', 'EXIT SEQUENCE', 'SYSTEM ONLINE'])
  assert.equal(ui.actions.children.length, 6)
  const state = JSON.stringify(ui.game.state)
  for (const label of ['移動', '監視', '設備', '持ち物']) {
    ui.click(`${label} >`)
    assert.deepEqual(ui.lines().slice(-3), [`> ${label}`, '', '>'])
    const before = ui.lines()
    ui.navigation.children[0]!.click()
    assert.deepEqual(ui.lines(), before)
    ui.assertPrompt()
  }
  ui.click('状態確認')
  assert.ok(ui.lines().includes('> 状態確認'))
  assert.equal(JSON.stringify(ui.game.state), state)
  ui.assertPrompt()

  // Supply extra display-only items to verify both paging handlers.
  ui.game.state.items = Array(8).fill('食糧')
  ui.click('持ち物 >')
  const before = ui.lines()
  ui.navigation.children[1]!.children[2]!.click()
  assert.equal(ui.actions.children.filter(child => child.tag === 'button').length, 2)
  ui.navigation.children[1]!.children[0]!.click()
  assert.deepEqual(ui.lines(), before)
  ui.assertPrompt()
})

test('movement, encounter and both end states use the same input format', () => {
  const ui = fixture()
  ui.click('ゲーム開始')
  for (const key of Object.keys(ui.game.state.passages)) ui.game.state.passages[key] = 'NORMAL'
  ui.game.state.enemy = '管制'
  ui.click('移動 >'); ui.click('医療区')
  assert.ok(ui.lines().includes('> 医療区'))
  assert.equal(ui.game.state.energy, 19)
  assert.equal(ui.game.state.turn, 1)
  ui.assertPrompt()

  ui.game.state.encounter = true
  ui.render('encounter'); ui.click('逃げる >')
  assert.deepEqual(ui.lines().slice(-3), ['> 逃げる', '', '>'])
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

test('fatal movement and launch output end with a prompt for restart', () => {
  const ui = fixture()
  ui.click('ゲーム開始')
  ui.game.state.energy = 1
  for (const key of Object.keys(ui.game.state.passages)) ui.game.state.passages[key] = 'NORMAL'
  ui.click('移動 >'); ui.click('医療区')
  assert.ok(ui.lines().includes('GAME OVER'))
  assert.equal(ui.game.state.turn, 0)
  ui.assertPrompt()
  ui.click('最初から')
  ui.game.state.location = '発着'
  ui.game.state.conditions = { power: true, control: true, repair: true, food: true }
  ui.click('設備 >'); ui.click('帰還船を発進する')
  assert.ok(ui.lines().includes('GAME CLEAR'))
  assert.equal(ui.game.state.energy, 20)
  assert.equal(ui.game.state.turn, 1)
  ui.assertPrompt()
  ui.click('最初から')
  ui.assertPrompt()
})
