import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './ui-harness.ts'
import { t, itemName, LANGUAGE_STORAGE_KEY } from '../src/i18n.ts'
import { rooms, edgeKey, cardinalDirections, neighborInDirection } from '../src/map.ts'
import { Game } from '../src/game.ts'
import { escapeItems } from '../src/items.ts'

const buttons = (ui: ReturnType<typeof fixture>) => ui.actions.children.filter(child => child.tag === 'button')
function start(language: 'ja' | 'en' = 'ja', reduce = true) {
  const ui = fixture(reduce, { navigator: { language } }); ui.flush(); ui.click(t('start', language)); ui.flush()
  ui.game.state.enemy = '通信'; ui.game.state.robotNext = '通信'
  ;(ui.game as unknown as { random: () => number }).random = () => 0.05
  return ui
}
function assertNoProgress(ui: ReturnType<typeof fixture>, run: () => void) {
  const before = structuredClone(ui.game.state)
  const random = (ui.game as unknown as { random: () => number }).random
  ;(ui.game as unknown as { random: () => number }).random = () => { throw Error('reference consumed RNG') }
  run(); assert.deepEqual(ui.game.state, before)
  ;(ui.game as unknown as { random: () => number }).random = random
}
for (const language of ['ja', 'en'] as const) {
  test(`${language}: main has five intents, 6 slots and unknown map/move labels`, () => {
    const ui = start(language)
    assert.equal(ui.actions.children.length, 6); assert.equal(buttons(ui).length, 5)
    ui.click(t('inventoryMenu', language)); assertNoProgress(ui, () => ui.click(t('baseMap', language)))
    assert.ok(ui.lines().join('').includes('[ ?')); assert.ok(!ui.lines().join('').includes('[ MED]'))
    ui.navigation.children[0]!.click(); ui.click(t('moveMenu', language)); ui.click(t('east', language))
    assert.equal(ui.game.state.knowledge.医療, 'visited'); assert.equal(ui.game.state.location, '医療')
    ui.click(t('inventoryMenu', language)); ui.click(t('baseMap', language)); assert.ok(ui.lines().join('').includes(language === 'ja' ? '[*医]' : '[*MED]'))
  })

  test(`${language}: collection confirmation locks BACK, decline is read-only and YES executes once`, () => {
    const ui = start(language); ui.game.state.location = '電力管理'; ui.render('investigate')
    assertNoProgress(ui, () => {
      ui.click(itemName('map', language)); ui.navigation.children[0]!.click()
      assert.equal(buttons(ui)[0]!.textContent, t('yes', language)); ui.click(t('no', language))
    })
    ui.click(itemName('map', language)); ui.click(t('yes', language))
    assert.equal(ui.game.state.turn, 1); assert.ok(rooms.every(room => ui.game.state.knowledge[room] !== 'unexplored'))
    ui.click(t('inventoryMenu', language)); ui.click(t('baseMap', language))
    assert.equal(ui.lines().slice(-9, -1).join('').includes('?'), false)
  })

  test(`${language}: camera, prediction and references share confirmation and preserve freshness on reads`, () => {
    const ui = start(language); ui.game.state.items.push('predictor'); ui.click(t('aiMenu', language)); ui.click(t('camera', language)); ui.click(t('yes', language))
    assert.equal(ui.game.state.energy, 24); assert.equal(ui.game.freshness(ui.game.state.feed), 'fresh')
    ui.click(t('aiMenu', language)); assertNoProgress(ui, () => { ui.click(t('feed', language)); ui.click(t('sensor', language)); ui.click(t('status', language)) })
    ui.navigation.children[0]!.click(); ui.click(t('inventoryMenu', language)); ui.click(itemName('predictor', language) + ' >')
    ui.click(t('use', language)); ui.click(t('yes', language))
    assert.equal(ui.game.freshness(ui.game.state.prediction), 'fresh'); assert.equal(ui.game.freshness(ui.game.state.feed), 'stale')
  })

  test(`${language}: HELP auto-off retains page/menu, navigation is fixed and never executes another action`, () => {
    const ui = start(language); ui.game.state.items.push('predictor', 'local-key', 'long-decoy', 'remote-key', 'override', 'sensor'); ui.render('inventory')
    const [back, pager, help] = ui.navigation.children, [previous, indicator, next] = pager!.children
    next!.click(); assert.equal(indicator!.textContent, '2 / 2'); assert.equal(next!.disabled, true)
    const before = structuredClone(ui.game.state); for (let i = 0; i < 5; i++) next!.click()
    assert.deepEqual(ui.game.state, before); assert.equal(back!.disabled, false)
    help!.click(); ui.click(itemName('override', language) + ' >'); assert.equal(ui.helpMode(), true)
    ui.click(t('use', language) + ' >') // edge selector
    ui.click(gameEdge(ui)) // bulk menu
    assertNoProgress(ui, () => ui.click(t('close', language)))
    assert.equal(ui.helpMode(), false); assert.match(ui.lines().join('\n'), /> HELP/)
    assert.equal(previous!.parent, pager); assert.equal(next!.parent, pager)
  })

  test(`${language}: typewriter locks all controls, tap skips once and keeps a single prompt`, () => {
    const ui = start(language, false); ui.click(t('inventoryMenu', language)); ui.click(t('baseMap', language))
    assert.ok(buttons(ui).every(button => button.disabled)); assert.equal(ui.log.attributes['aria-busy'], 'true')
    assert.ok(ui.navigation.querySelectorAll('button').every(button => button.disabled))
    ui.tick(); assert.ok(ui.timers.size > 0); ui.log.click(); assert.equal(ui.timers.size, 0)
    assert.equal(ui.log.attributes['aria-busy'], 'false'); ui.assertPrompt()
    const lines = ui.lines(); ui.log.click(); assert.deepEqual(ui.lines(), lines)
  })

  test(`${language}: encounter offers only emergency retreat, failure and clear use shared end menu`, () => {
    const ui = start(language); ui.game.state.enemy = '医療'; ui.game.state.robotNext = '観測'
    ui.click(t('moveMenu', language)); ui.click(t('east', language)); assert.equal(ui.game.state.encounter, true)
    assert.equal(buttons(ui).length, 2); assert.ok(!buttons(ui).some(button => /HIDE|隠れる/.test(button.textContent)))
    ui.click(t('emergency', language)); ui.click(t('west', language))
    ;(ui.game as unknown as { random: () => number }).random = () => 0.999
    ui.click(t('yes', language)); assert.equal(ui.game.state.status, 'over'); assert.ok(ui.lines().includes('GAME OVER'))
    ui.click(t('restart', language)); ui.game.state.location = '発着'; ui.game.state.items.push(...escapeItems); ui.render('investigate')
    ui.click(t('returnShip', language)); ui.click(t('yes', language)); assert.equal(ui.game.state.status, 'clear')
    assert.ok(ui.lines().includes('GAME CLEAR')); ui.assertPrompt()
  })
}
function gameEdge(ui: ReturnType<typeof fixture>) { return ui.game.edgeLabel(edgeKey('居住', '医療')) }

test('language settings preserve full State, old logs and RNG; localStorage restores new session', () => {
  const values = new Map<string, string>()
  const env = { navigator: { language: 'ja' }, localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } } }
  const ui = fixture(true, env); ui.click(t('start', 'ja')); const logs = ui.lines()
  assertNoProgress(ui, () => { ui.click(t('settingsMenu', 'ja')); ui.click(t('languageMenu', 'ja')); ui.click('English') })
  assert.equal(ui.documentLanguage(), 'en'); assert.deepEqual(ui.lines(), logs)
  assert.equal(values.get(LANGUAGE_STORAGE_KEY), 'en'); assert.equal(fixture(true, env).language(), 'en')
  ui.click(t('inventoryMenu', 'en')); ui.click(t('baseMap', 'en')); assert.ok(ui.lines().join('').includes('BASE MAP'))
  assert.equal(ui.log.attributes['aria-label'], 'Game log')
})

test('installed item appears with coordinate and remote controls, and fixed equipment is only in EXPLORE', () => {
  const ui = start(); ui.game.state.items.push('remote-decoy'); ui.render('inventory')
  ui.click('リモートデコイ >'); ui.click('設置'); ui.click('はい')
  assert.equal(ui.game.state.installations.length, 1); assert.ok(!ui.game.state.items.includes('remote-decoy'))
  ui.click('持ち物 >'); ui.click('リモートデコイ (A1) >'); assert.equal(buttons(ui)[0]!.textContent, '遠隔起動')
  ui.navigation.children[0]!.click(); ui.navigation.children[0]!.click(); ui.game.state.location = '観測'; ui.click('調べる >')
  assert.ok(buttons(ui).some(button => button.textContent === 'カメラ端末'))
})

for (const language of ['ja', 'en'] as const) {
  test(`${language}: fixed directions, hidden HELP names, mapped names and blocked passages`, () => {
    const ui = start(language)
    ui.click(t('moveMenu', language))
    const labels = cardinalDirections.map(d => t(d, language))
    assert.deepEqual(buttons(ui).map(b => b.textContent), labels)
    assert.deepEqual(buttons(ui).map(b => b.disabled), [true, false, true, false])
    assert.equal(ui.actions.children.length, 6)
    assertNoProgress(ui, () => {
      ui.navigation.children[2]!.click(); ui.click(t('east', language))
    })
    assert.ok(ui.lines().includes(t('destinationUnknown', language, 'B1')))
    assert.ok(!ui.lines().join('').includes(language === 'ja' ? '医療' : 'MEDICAL'))
    ui.game.state.knowledge.医療 = 'visited'
    ui.navigation.children[2]!.click(); ui.click(t('east', language))
    assert.ok(ui.lines().includes(t('destinationKnown', language, language === 'ja' ? '医療' : 'MEDICAL')))
    ui.game.state.knowledge.医療 = 'mapped'; ui.render('move')
    assert.deepEqual(buttons(ui).map(b => b.textContent), labels)
    for (const passage of ['BLOCKED', 'CLOSED', 'DARK', 'NORMAL'] as const) {
      ui.game.state.passages[edgeKey('居住', '医療')] = passage; ui.render('move')
      assert.equal(buttons(ui)[3]!.disabled, passage === 'BLOCKED' || passage === 'CLOSED')
      if (passage === 'BLOCKED' || passage === 'CLOSED') assertNoProgress(ui, () => {
        ui.click(t('east', language)); ui.navigation.children[2]!.click(); ui.click(t('east', language))
        assert.ok(ui.lines().join('').includes(passage))
      })
    }
    ui.game.state.location = '管制'; ui.render('move')
    assert.deepEqual(buttons(ui).map(b => b.textContent), labels)
    assert.deepEqual(buttons(ui).map(b => b.disabled), [true, false, false, false])
  })

  test(`${language}: direction UI preserves complete State and RNG versus direct Room actions`, () => {
    for (const retreat of [false, true]) for (const direction of cardinalDirections) for (const roll of [0.1, 0.25, 0.999]) {
      const ui = start(language), direct = new Game(() => 0.999)
      ui.game.state.location = '管制'; ui.game.state.passages[edgeKey('管制', '医療')] = 'NORMAL'
      if (retreat) { ui.game.state.enemy = '管制'; ui.game.state.encounter = true }
      direct.state = structuredClone(ui.game.state)
      const calls: number[][] = [[], []]
      ;(ui.game as unknown as { random: () => number }).random = () => { calls[0]!.push(roll); return roll }
      ;(direct as unknown as { random: () => number }).random = () => { calls[1]!.push(roll); return roll }
      ui.render(retreat ? 'encounter' : 'main')
      ui.click(t(retreat ? 'emergency' : 'moveMenu', language)); ui.click(t(direction, language))
      if (retreat) ui.click(t('yes', language))
      const target = neighborInDirection('管制', direction)!
      direct.act(retreat ? { type: 'retreat', target } : { type: 'move', target }, language)
      assert.deepEqual(ui.game.state, direct.state)
      assert.deepEqual(calls[0], calls[1])
      assert.ok(ui.lines().includes(`> ${t(retreat ? 'emergency' : 'moveMenu', language).replace(/ >$/, '')} ${t(direction, language)}`))
    }
    const ui = start(language); ui.click(t('moveMenu', language)); ui.click(t('east', language))
    assert.equal(ui.game.state.location, '医療'); assert.equal(ui.game.state.knowledge.医療, 'visited')
    assert.ok(ui.lines().includes(`> ${t('move', language)} ${t('east', language)}`))
    assert.ok(!ui.lines().some(line => /^> (移動|MOVE) .*(B1|医療|MEDICAL)/.test(line)))
  })
}
