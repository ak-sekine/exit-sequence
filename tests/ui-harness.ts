import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as i18n from '../src/i18n.ts'
import * as balance from '../src/balance.ts'
import { Game } from '../src/game.ts'
import { costs, neighbors, rooms, baseMapLines, passable, cellCode, edgeKey, cardinalDirections, neighborInDirection, named } from '../src/map.ts'
import { facilities, itemSpecs } from '../src/items.ts'
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

export function fixture(reduce = true, environment: i18n.LanguageEnvironment = {}) {
  const app = new Element('div')
  let timerId = 0
  const timers = new Map<number, () => void>()
  const context = vm.createContext({
    ...balance, Game, costs, neighbors, rooms, baseMapLines, facilities, itemSpecs, passable, cellCode, edgeKey, cardinalDirections, neighborInDirection, named,
    ...i18n, initialLanguage: () => i18n.initialLanguage(environment), saveLanguage: (language: i18n.Language) => i18n.saveLanguage(language, environment),
    window: { matchMedia: () => ({ matches: reduce, addEventListener() {} }) },
    setTimeout: (callback: () => void, delay: number) => {
      assert.equal(delay, 5)
      timers.set(++timerId, callback)
      return timerId
    },
    clearTimeout: (id: number) => timers.delete(id),
    document: { documentElement: { lang: '' }, querySelector: () => app, createElement: (tag: string) => new Element(tag) },
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
  return { language: () => vm.runInContext('language', context), documentLanguage: () => vm.runInContext('document.documentElement.lang', context),
    changeLanguage: (language: i18n.Language) => vm.runInContext(`changeLanguage('${language}')`, context),
    game, actions: actions!, navigation: navigation!, log: log!, lines, click, render, assertPrompt, tick, flush, timers,
    helpMode: () => vm.runInContext('helpMode', context) as boolean,
    enqueue: (...lines: string[]) => vm.runInContext(`appendLog(...${JSON.stringify(lines)})`, context) }
}
