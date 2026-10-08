// Real Chromium interaction checks. Test-only state controls are injected into Vite's
// response in this browser session; they are never part of the shipped application.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { t, itemName, roomName } from '../src/i18n.ts'
import { rooms, edges, edgeKey, directionBetween } from '../src/map.ts'
import { escapeItems } from '../src/items.ts'

const url = process.env.EXIT_SEQUENCE_URL ?? 'http://127.0.0.1:5173/exit-sequence/'
const artifactDir = process.env.EXIT_SEQUENCE_ARTIFACTS ?? '/tmp/exit-sequence-browser'
await mkdir(artifactDir, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
const report = []
try {
  for (const language of ['ja', 'en']) {
    const context = await browser.newContext({ viewport: { width: 320, height: 640 }, locale: language, reducedMotion: 'reduce' })
    const page = await context.newPage(), errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(({ language }) => { localStorage.setItem('exit-sequence-language', language); Math.random = () => 0.999 }, { language })
    await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
      const response = await route.fetch()
      await route.fulfill({ response, body: await response.text() + '\nglobalThis.__exitTest = { game, open, render, appendLog };' })
    })
    await page.goto(url)
    await page.waitForFunction(() => !!globalThis.__exitTest)
    const labels = () => page.locator('.terminal-actions button').allTextContents()
    const logText = () => page.locator('.terminal-log').innerText()
    const state = () => page.evaluate(() => structuredClone(globalThis.__exitTest.game.state))
    async function click(label) {
      for (let i = 0; i < 10; i++) {
        const choice = page.locator('.terminal-actions button').filter({ hasText: new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') })
        if (await choice.count()) { await choice.click(); return }
        const next = page.getByRole('button', { name: t('nextPage', language), exact: true })
        if (!(await next.isEnabled())) throw Error(`Missing option ${label}; found ${await labels()}`)
        await next.click()
      }
      throw Error(`Paging limit for ${label}`)
    }
    const yes = () => click(t('yes', language))
    const back = () => page.getByRole('button', { name: t('backToParentMenu', language), exact: true }).click()
    const read = async (menuLabel, entry) => { await click(menuLabel); await click(entry) }
    const main = () => page.evaluate(() => globalThis.__exitTest.open('main'))
    const checked = (name) => { report.push({ language, viewport: 320, check: name, result: 'pass' }) }
    async function fixture({ location = '居住', enemy = '通信', items = [], mapped = true, roll = 0.999 } = {}) {
      await page.evaluate(({ location, enemy, items, mapped, roll, rooms, edgeKeys }) => {
        const { game, open } = globalThis.__exitTest
        game.random = () => roll; game.restart()
        const s = game.state; s.location = location; s.enemy = enemy; s.robotNext = enemy
        s.items.push(...items.filter(item => !s.items.includes(item)))
        s.knowledge[location] = 'visited'
        if (mapped) { for (const room of rooms) if (s.knowledge[room] !== 'visited') s.knowledge[room] = 'mapped'; s.knownEdges = edgeKeys }
        open('main')
      }, { location, enemy, items, mapped, roll, rooms, edgeKeys: edges.map(([a, b]) => edgeKey(a, b)) })
    }
    async function useItem(item) { await click(t('inventoryMenu', language)); await click(itemName(item, language) + ' >'); await click(t('use', language)) }
    async function lure(item, target) { await click(t('inventoryMenu', language)); await click(itemName(item, language) + ' >'); await click(t('use', language) + ' >'); await click(roomName(target, language)); await yes() }
    async function bulk(item, edge, closed) {
      await click(t('inventoryMenu', language)); await click(itemName(item, language) + ' >'); await click(t('use', language) + ' >')
      const label = edge.split(':').map(room => { const i = rooms.indexOf(room); return `${'ABCD'[i % 4]}${Math.floor(i / 4) + 1}` }).join('–')
      await click(label); await click(t(closed ? 'close' : 'open', language)); await yes()
    }

    await click(t('start', language)); assert.equal((await state()).location, '居住'); checked('1. game start')
    await read(t('inventoryMenu', language), t('baseMap', language)); assert.match(await logText(), /\?/); checked('2. unknown map')
    await back(); await click(t('moveMenu', language))
    const directionLabels = ['north', 'south', 'west', 'east'].map(d => t(d, language))
    assert.deepEqual(await labels(), directionLabels)
    assert.deepEqual(await page.locator('.terminal-actions button').evaluateAll(bs => bs.map(b => b.disabled)), [true, false, true, false])
    const helpButton = () => page.getByRole('button', { name: t('helpMode', language), exact: true }).click()
    const beforeUnknownHelp = await state()
    await helpButton(); await click(t('east', language))
    assert.deepEqual(await state(), beforeUnknownHelp)
    assert.ok((await logText()).includes(t('destinationUnknown', language, 'B1')))
    assert.ok(!(await logText()).includes(language === 'ja' ? '医療' : 'MEDICAL'))
    await page.screenshot({ path: `${artifactDir}/direction-unknown-${language}-320.png` })
    await click(t('east', language)); checked('3. direction move into unexplored district')
    assert.ok((await logText()).includes(`> ${t('move', language)} ${t('east', language)}`))
    assert.equal((await state()).knowledge.医療, 'visited'); checked('4. district name discovered')
    await fixture(); await click(t('moveMenu', language)); await helpButton(); await click(t('east', language))
    assert.ok((await logText()).includes(t('destinationKnown', language, roomName('医療', language))))
    await page.screenshot({ path: `${artifactDir}/direction-known-${language}-320.png` })
    for (const passage of ['BLOCKED', 'CLOSED']) {
      await page.evaluate(({ passage, key }) => { globalThis.__exitTest.game.state.passages[key] = passage; globalThis.__exitTest.render() }, { passage, key: edgeKey('居住', '医療') })
      assert.deepEqual(await labels(), directionLabels)
      assert.equal(await page.getByRole('button', { name: t('east', language), exact: true }).isDisabled(), true)
      await helpButton(); await click(t('east', language)); assert.ok((await logText()).includes(`PASSAGE: ${passage}`) || (await logText()).includes(`通路：${passage}`))
    }
    await back(); await fixture({ location: '管制' }); await click(t('moveMenu', language))
    assert.deepEqual(await labels(), directionLabels)
    assert.ok(await page.locator('.terminal-actions button').evaluateAll(bs => bs.every(b => !b.disabled)))
    const directionLayout = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, slots: document.querySelector('.terminal-actions').children.length, rows: getComputedStyle(document.querySelector('.terminal-actions')).gridTemplateRows }))
    assert.deepEqual(directionLayout, { width: 320, slots: 6, rows: '44px 44px 44px' })
    await page.screenshot({ path: `${artifactDir}/direction-center-${language}-320.png` })
    checked('fixed A1/central directions, unknown/known HELP, BLOCKED/CLOSED, no overflow')
    await fixture({ enemy: '観測' }); await read(t('aiMenu', language), t('sensor', language)); assert.match(await logText(), language === 'ja' ? /東.*距離2/s : /EAST.*Distance 2/s); checked('5. distance 2 warning')
    await fixture({ enemy: '医療' }); await read(t('aiMenu', language), t('sensor', language)); assert.match(await logText(), language === 'ja' ? /危険.*距離1/s : /DANGER.*distance 1/s); checked('6. distance 1 warning'); await back(); await click(t('moveMenu', language)); assert.equal((await labels())[3], t('east', language))
    await fixture(); await click(t('aiMenu', language)); await click(t('camera', language)); await yes()
    assert.equal((await state()).feed.enemy, '通信'); assert.match(await logText(), /B4/); checked('7. camera exact position')
    await useItem('predictor'); await yes(); const prediction = (await state()).prediction
    await click(t('aiMenu', language)); await click(t('wait', language)); await yes(); assert.equal((await state()).enemy, prediction.next); checked('8. prediction matches next action')
    await fixture({ enemy: '観測' }); await lure('short-decoy', '管制'); assert.equal((await state()).enemy, '電力管理'); checked('9. short lure')
    await fixture({ enemy: '発着', items: ['long-decoy'] }); await lure('long-decoy', '観測'); assert.equal((await state()).enemy, '資材'); checked('10. long lure one step')
    await fixture({ location: '観測', enemy: '資材', items: ['remote-decoy'] })
    await click(t('inventoryMenu', language)); await click(itemName('remote-decoy', language) + ' >'); await click(t('install', language)); await yes()
    await click(t('moveMenu', language)); await click(t('west', language)); await click(t('inventoryMenu', language))
    await click(t('installedLabel', language, itemName('remote-decoy', language), 'C1')); await click(t('activate', language)); await yes()
    assert.equal((await state()).lure.target, '観測'); assert.equal((await state()).installations[0].room, '観測'); checked('11. installed lure remote activation')
    await fixture({ enemy: '観測' }); await click(t('aiMenu', language)); await click(t('selfLure', language)); await yes(); assert.equal((await state()).enemy, '医療'); checked('12. lure to player')
    await fixture({ enemy: '管制' }); await bulk('local-key', edgeKey('居住', '医療'), true); assert.equal((await state()).passages[edgeKey('居住', '医療')], 'CLOSED'); checked('13. bulkhead closure')
    await fixture({ enemy: '管制', items: ['remote-key'] })
    await page.evaluate(() => { const s = globalThis.__exitTest.game.state; s.lure = { target: '居住', remaining: 5 }; s.robotNext = '医療' })
    await bulk('remote-key', edgeKey('管制', '医療'), true); assert.equal((await state()).enemy, '倉庫'); checked('14. robot rerouted by closed passage')
    await fixture({ location: '整備' }); await read(t('exploreMenu', language), itemName('override', language)); await yes(); assert.ok((await state()).items.includes('override')); checked('15. portable item collected')
    await fixture({ location: '観測' }); await read(t('exploreMenu', language), t('cameraTerminal', language)); await yes(); assert.equal((await state()).energy, 39); checked('16. fixed camera facility')
    await fixture({ location: '医療', mapped: false }); await read(t('exploreMenu', language), itemName('map', language)); await yes(); assert.ok((await state()).items.includes('map')); checked('17. layout map collected')
    assert.ok(Object.values((await state()).knowledge).every(value => value === 'mapped' || value === 'visited'))
    await read(t('inventoryMenu', language), t('baseMap', language)); checked('18. all districts shown')
    await page.screenshot({ path: `${artifactDir}/map-${language}-320.png` })
    const mapLayout = await page.locator('.terminal-line').evaluateAll(lines => lines.filter(line => /^\[/.test(line.textContent)).map(line => ({ text: line.textContent, width: line.scrollWidth, client: line.clientWidth, height: line.getBoundingClientRect().height })))
    assert.ok(mapLayout.every(line => line.width <= line.client && line.height <= 24), JSON.stringify(mapLayout))
    await fixture({ location: '倉庫' }); await read(t('exploreMenu', language), itemName('food', language)); await yes(); assert.ok((await state()).items.includes('food')); checked('19. escape supply collected')
    await fixture({ enemy: '医療', roll: 0.1 }); await click(t('moveMenu', language)); await click(t('east', language)); assert.equal((await state()).encounter, true); checked('20. robot encounter')
    await click(t('emergency', language)); assert.deepEqual(await labels(), directionLabels); await page.screenshot({ path: `${artifactDir}/retreat-${language}-320.png` }); await click(t('west', language)); assert.ok((await logText()).includes(`> ${t('emergency', language).replace(/ >$/, '')} ${t('west', language)}`)); await yes(); assert.equal((await state()).status, 'playing'); assert.equal((await state()).retreatUsed, true); checked('21. low-probability emergency success fixture')
    await fixture({ enemy: '医療', roll: 0.999 }); await click(t('moveMenu', language)); await click(t('east', language)); await click(t('emergency', language)); await click(t('west', language)); await yes()
    assert.equal((await state()).status, 'over'); checked('22. emergency failure GAME OVER')
    await page.screenshot({ path: `${artifactDir}/over-${language}-320.png` })

    // Complete a playable item-first route through normal controls, without relocating state.
    await fixture({ mapped: false })
    async function move(target) {
      const s = await state(), label = t(directionBetween(s.location, target), language)
      await click(t('moveMenu', language)); await click(label); assert.equal((await state()).encounter, false)
    }
    async function collect(item) { await read(t('exploreMenu', language), itemName(item, language)); await yes() }
    await move('医療'); await collect('map'); await move('管制'); await collect('key'); await move('電力管理'); await move('蓄電'); await collect('power')
    await move('電力管理'); await move('管制'); await move('倉庫'); await collect('food'); await move('研究'); await collect('parts')
    await move('整備'); await move('計測'); await move('前室'); await move('発着')
    const supplies = (await state()).items; assert.ok(escapeItems.every(item => supplies.includes(item)))
    await read(t('exploreMenu', language), t('returnShip', language)); await yes(); assert.equal((await state()).status, 'clear'); checked('23. full route GAME CLEAR')
    await page.screenshot({ path: `${artifactDir}/clear-${language}-320.png` })

    // Additional regressions: HELP/BACK/paging, settings/storage, typewriter/tap skip, A11y/layout.
    await fixture({ items: ['controller', 'sensor', 'long-decoy', 'remote-key', 'override', 'battery'] })
    await click(t('inventoryMenu', language)); await click(itemName('controller', language) + ' >'); await click(t('install', language) + ' >'); await click('B1–A1')
    await yes(); await click(t('moveMenu', language)); await click(t('east', language)); await click(t('inventoryMenu', language))
    await click(t('installedLabel', language, itemName('controller', language), 'A1')); await click(t('close', language)); await yes()
    assert.equal((await state()).passages[edgeKey('居住', '医療')], 'CLOSED'); checked('installed controller remote closure')
    await fixture({ location: '計測', enemy: '資材', items: ['sensor'] }); await click(t('inventoryMenu', language)); await click(itemName('sensor', language) + ' >'); await click(t('install', language)); await yes()
    await click(t('inventoryMenu', language)); await click(t('installedLabel', language, itemName('sensor', language), 'C3')); await click(t('activate', language)); await yes(); assert.match(await logText(), /D3/); checked('installed sensor')
    await fixture({ items: ['override'] }); await bulk('override', edgeKey('居住', '医療'), true); assert.ok(!(await state()).items.includes('override')); checked('single-use override')
    await fixture({ location: '隔壁' }); await click(t('exploreMenu', language)); await click(t('bulkPanel', language)); await click('A3–A4'); await click(t('close', language)); await yes(); assert.equal((await state()).passages[edgeKey('研究', '隔壁')], 'CLOSED'); checked('fixed bulkhead panel')
    await fixture({ location: '管制', enemy: '発着' }); await click(t('exploreMenu', language)); await click(t('alarm', language)); await click(roomName('観測', language)); await yes(); assert.equal((await state()).lure.target, '観測'); checked('fixed alarm')
    await fixture({ items: ['battery'] }); await page.evaluate(() => { globalThis.__exitTest.game.state.energy = 35 }); await useItem('battery'); await yes(); assert.equal((await state()).energy, 40); checked('portable battery')
    await fixture({ location: '電力管理' }); await page.evaluate(() => { globalThis.__exitTest.game.state.energy = 30 }); await read(t('exploreMenu', language), t('charger', language)); await yes(); assert.equal((await state()).energy, 40); checked('fixed charger')
    await fixture(); const beforeHelp = await state(); await click(t('inventoryMenu', language))
    await page.getByRole('button', { name: t('helpMode', language), exact: true }).click(); await click(t('baseMap', language))
    assert.deepEqual(await state(), beforeHelp); assert.equal(await page.getByRole('button', { name: t('helpMode', language), exact: true }).getAttribute('aria-pressed'), 'false')
    await back(); checked('read-only HELP and BACK')
    const beforeLanguage = await state(); const past = await logText(); await click(t('settingsMenu', language)); await click(t('languageMenu', language)); await click(language === 'ja' ? 'English' : '日本語')
    assert.deepEqual(await state(), beforeLanguage); assert.equal(await logText(), past); assert.equal(await page.evaluate(() => document.documentElement.lang), language === 'ja' ? 'en' : 'ja'); checked('language switch preserves state and log')
    const layout = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth, slots: document.querySelector('.terminal-actions').children.length, rows: getComputedStyle(document.querySelector('.terminal-actions')).gridTemplateRows }))
    assert.equal(layout.document, 320); assert.equal(layout.slots, 6); assert.equal(layout.rows, '44px 44px 44px'); checked('320px no horizontal scrolling and 2x3 layout')
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await main(); const changed = language === 'ja' ? 'en' : 'ja'; await click(t('inventoryMenu', changed)); await click(t('baseMap', changed))
    assert.equal(await page.locator('.terminal-log').getAttribute('aria-busy'), 'true')
    assert.ok(await page.locator('.terminal-actions button').evaluateAll(buttons => buttons.every(button => button.disabled)))
    await page.locator('.terminal-log').click(); assert.equal(await page.locator('.terminal-log').getAttribute('aria-busy'), 'false'); checked('typewriter action lock and tap skip')
    assert.deepEqual(errors, []); await context.close()
  }
  await writeFile(`${artifactDir}/report.json`, JSON.stringify(report, null, 2) + '\n')
  console.log(`PASS: ${report.length} Chromium checks, ja/en, 320px. Artifacts: ${artifactDir}`)
} finally { await browser.close() }
