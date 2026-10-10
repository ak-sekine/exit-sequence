import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { createGame, advanceTurn } from '../src/game.ts'
import { character } from '../src/character.ts'
import { renderMap, initialVisited } from '../src/automap.ts'
import { DUNGEON_MAP } from '../src/dungeon.ts'
import { mkdir } from 'node:fs/promises'
const artifacts = process.env.EXIT_SEQUENCE_ARTIFACTS ?? '/tmp/exit-sequence-browser'
await mkdir(artifacts, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox'] })
try {
  for (const width of [320, 1280]) for (const hearing of [2, 0]) {
    const context = await browser.newContext({ viewport: { width, height: width === 320 ? 640 : 800 }, locale: 'ja', hasTouch: true })
    await context.addInitScript(() => { Math.random = () => 0 })
    const page = await context.newPage(), errors = []
    page.on('pageerror', e => errors.push(e.message))
    let game = { ...createGame(), player: { ...character({ x: 2, y: 14, facing: 1 }), hearing }, enemies: [{ ...character({ x: 2, y: 11, facing: 2 }), id: 'fixture', vision: 0, hearing: 0, destination: { x: 2, y: 14 } }] }
    await page.route('**/src/main.ts*', async route => {
      const response = await route.fetch()
      let body = (await response.text()).replace('let game = createGame();', `let game = ${JSON.stringify(game)};`)
      assert.ok(body.includes('fixture'))
      body += '\nwindow.readGameForTest = () => game;'
      await route.fulfill({ response, body })
    })
    await page.goto(process.env.EXIT_SEQUENCE_URL ?? 'http://127.0.0.1:5173/exit-sequence/')
    const snapshot = () => page.evaluate(() => window.readGameForTest())
    const toggle = () => page.locator('[data-action="b"]').tap()
    const boxes = () => page.locator('.dungeon, .status, .log, .controls').evaluateAll(els => els.map(el => JSON.stringify(el.getBoundingClientRect())))
    const initialBoxes = await boxes()
    await toggle(); assert.equal(await page.locator('[data-map-enemy]').count(), 0); await toggle()
    const turn = async action => {
      game = advanceTurn(game, action, () => 0)
      await page.locator(`[data-direction="${action}"]`).tap()
      assert.deepEqual(await snapshot(), game)
    }
    const checkMap = async () => {
      const before = await snapshot()
      await toggle()
      const check = async () => {
        const center = await page.locator('.dungeon').evaluate(el => ({ x: +el.dataset.centerX, y: +el.dataset.centerY }))
        const expected = renderMap(DUNGEON_MAP, game.player, initialVisited(game.player), undefined, center, game.detections)
        const normalized = await page.evaluate(svg => { const el = document.createElement('div'); el.innerHTML = svg; return el.innerHTML }, expected)
        assert.equal(await page.locator('.dungeon').innerHTML(), normalized)
        assert.deepEqual(await snapshot(), before)
      }
      await check()
      for (const direction of ['up', 'right', 'down', 'left']) { await page.locator(`[data-direction="${direction}"]`).tap(); await check() }
      await page.locator('.menu-toggle').tap(); await check()
      await page.locator('[data-language="en"]').tap(); await check()
      assert.deepEqual(await boxes(), initialBoxes)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width)
      await page.screenshot({ path: `${artifacts}/enemy-map-${width}-${hearing}-${game.turn}.png` })
      await toggle(); assert.deepEqual(await snapshot(), before)
    }
    await turn('left'); assert.equal(game.detections[0].kind, 'sight') // enemy at (2,12), north of the player
    await checkMap()
    await turn('down') // now facing south: enemy at (2,13) only audible
    assert.equal(game.detections.length, hearing ? 1 : 0)
    if (hearing) { assert.equal(game.detections[0].kind, 'hearing'); assert.equal('facing' in game.detections[0], false) }
    await checkMap()
    await turn('left'); assert.ok(game.gameOver)
    await checkMap()
    for (const action of ['up', 'left', 'right', 'down']) await turn(action)
    assert.deepEqual(errors, [])
    // SVG geometry in the browser proves all compass rotations and marker bounds.
    for (const facing of [0, 1, 2, 3]) {
      const detections = [{ enemyId: 'arrow', kind: 'sight', position: { x: 2, y: 14 }, facing, distance: 1 }, { enemyId: 'circle', kind: 'hearing', position: { x: 2, y: 13 }, direction: 'front', distance: 1 }]
      await page.locator('.dungeon').evaluate((el, svg) => { el.innerHTML = svg }, renderMap(DUNGEON_MAP, game.player, initialVisited(game.player), undefined, undefined, detections))
      const bounds = await page.locator('[data-map-enemy]').evaluateAll(els => els.map(el => { const b = el.getBBox(); return [b.width, b.height] }))
      assert.ok(bounds.every(([w, h]) => w <= 24 && h <= 24))
      assert.match(await page.locator('[data-map-enemy="arrow"]').getAttribute('transform'), new RegExp(`rotate\\(${facing * 90}\\)`))
      assert.equal(await page.locator('[data-map-enemy="circle"]').getAttribute('transform'), null)
      assert.equal(await page.locator('[data-map-arrow]').getAttribute('fill'), '#e5fff0')
    }
    await context.close()
  }
  console.log('PASS: enemy map sight/hearing/lost detection, all compass arrows, SVG bounds, 3D snapshots, scroll/toggle/language/menu freeze, next turn and game over, 320px/1280px unchanged layout')
} finally { await browser.close() }
