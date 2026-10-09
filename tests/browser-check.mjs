import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { Game } from '../src/game.ts'
import { explore } from './solver.ts'
import { t } from '../src/i18n.ts'

const artifacts = process.env.EXIT_SEQUENCE_ARTIFACTS ?? '/tmp/exit-sequence-browser'
await mkdir(artifacts, { recursive: true })
const searches = [0, 1, 2].map(explore)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
const report = []
try {
  for (const language of ['ja', 'en']) {
    const context = await browser.newContext({ viewport: { width: 320, height: 640 }, locale: language, isMobile: true, hasTouch: true })
    const page = await context.newPage(), errors = []
    page.on('pageerror', error => errors.push(error.message))
    // Read-only observer injected into the dev response; absent from shipped source/build.
    await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
      const response = await route.fetch()
      await route.fulfill({ response, body: await response.text() + '\nglobalThis.__exitTest = () => structuredClone({state:game.state,undoCount:game.undoCount});' })
    })
    await page.goto(process.env.EXIT_SEQUENCE_URL ?? 'http://127.0.0.1:5173/exit-sequence/')
    await page.waitForFunction(() => !!globalThis.__exitTest)
    const reference = new Game()
    const snapshot = () => page.evaluate(() => globalThis.__exitTest())
    async function checkState() {
      assert.deepEqual(await snapshot(), { state: reference.state, undoCount: reference.undoCount })
      assert.equal(await page.locator('.stage').innerText(), `STAGE ${reference.state.stageIndex + 1} / 3`)
      const rows = await page.locator('.cell').allTextContents()
      assert.equal(rows.length, 64)
      for (const entity of reference.state.entities) assert.equal(rows[entity.y * 8 + entity.x], { player: '@', robot: 'R', box: 'B' }[entity.kind])
      assert.equal(rows.filter(s => s === '@').length, reference.state.status === 'fail' ? 0 : 1)
      assert.equal(await page.locator('[data-action="undo"]').isDisabled(), !reference.undoCount)
    }
    async function layout(insideViewport = true) {
      const bounds = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        buttons: [...document.querySelectorAll('button')].filter(b => b.getClientRects().length).map(b => {
          const r = b.getBoundingClientRect()
          return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height, overflow: b.scrollWidth > b.clientWidth }
        }),
        cell: (() => { const r = document.querySelector('.cell').getBoundingClientRect(); return { width: r.width, height: r.height } })(),
        title: document.querySelector('h1').getBoundingClientRect().right,
        toggle: document.querySelector('.menu-toggle').getBoundingClientRect().x,
      }))
      assert.equal(bounds.width, 320); assert.equal(bounds.bodyWidth, 320)
      assert.ok(bounds.buttons.every(b => b.width >= 44 && b.height >= 44 && b.x >= 0 && b.right <= 320 && !b.overflow), JSON.stringify(bounds))
      if (insideViewport) assert.ok(bounds.buttons.every(b => b.y >= 0 && b.bottom <= 640), JSON.stringify(bounds))
      assert.ok(Math.abs(bounds.cell.width - bounds.cell.height) < .1)
      assert.ok(bounds.title <= bounds.toggle)
    }
    async function move(direction) {
      reference.move(direction)
      await page.locator(`[data-direction="${direction}"]`).tap()
      await checkState(); await layout()
    }
    async function route(witness, name) {
      assert.ok(witness)
      for (const direction of witness.route) await move(direction)
      assert.deepEqual(reference.state, witness.state)
      assert.equal(await page.locator('.message').innerText(), t(reference.state.message, language))
      await page.screenshot({ path: `${artifacts}/${language}-stage${reference.state.stageIndex + 1}-${name}.png` })
      report.push({ language, stage: reference.state.stageIndex + 1, pattern: name, route: witness.route, status: reference.state.status, clearBy: reference.state.clearBy, robotAlive: reference.state.entities.some(e => e.kind === 'robot') })
    }
    async function undo() {
      reference.undo(); await page.locator('[data-action="undo"]').tap(); await checkState(); await layout()
    }
    async function restart() {
      reference.restart(); await page.locator('[data-action="restart"]').tap(); await checkState(); await layout()
    }
    async function next() {
      assert.equal(reference.nextStage(), true); await page.locator('[data-action="next"]').tap(); await checkState(); await layout()
    }
    async function languageMenu() {
      const before = await snapshot()
      await page.locator('.menu-toggle').tap(); await layout()
      await page.locator(`[data-language="${language === 'ja' ? 'en' : 'ja'}"]`).tap()
      assert.deepEqual(await snapshot(), before)
      assert.equal(await page.locator('html').getAttribute('lang'), language === 'ja' ? 'en' : 'ja')
      await layout()
      await page.locator('.menu-toggle').tap(); await page.locator(`[data-language="${language}"]`).tap()
      assert.deepEqual(await snapshot(), before); await layout()
      await page.locator('.menu-toggle').tap(); await page.locator('.stage').tap()
      assert.equal(await page.locator('.language-menu').isVisible(), false)
    }
    await checkState(); await layout(); await languageMenu()
    await page.screenshot({ path: `${artifacts}/${language}-initial.png` })
    // Real chain pushing, object removal, repeated undo through all turns.
    await move('right'); await move('right')
    assert.equal(reference.state.entities.filter(e => e.kind === 'box').length, 1)
    await undo(); await undo(); assert.equal(reference.undoCount, 0)
    await move('up'); await move('up') // second is blocked: no history/robot change
    assert.equal(reference.undoCount, 1); await restart()
    await route(searches[0].witnesses.fail, 'hole-fail'); await languageMenu(); await undo(); await restart()
    await route(searches[0].witnesses.clear, 'clear'); await languageMenu(); await undo(); await restart()
    await route(searches[0].witnesses.clear, 'clear-again'); await next()
    await route(searches[1].witnesses.fail, 'hole-fail'); await undo(); await restart()
    await route(searches[1].witnesses.robotRemoved, 'robot-removed'); await restart()
    await route(searches[1].witnesses.robotAlive, 'robot-alive'); await next()
    await route(searches[2].witnesses.fail, 'hole-fail'); await undo(); await restart()
    for (const pattern of ['robotRemoved', 'robotAlive', 'robotPush']) {
      await route(searches[2].witnesses[pattern], pattern)
      assert.equal(reference.state.status, 'all-clear')
      if (pattern === 'robotPush') assert.equal(reference.state.clearBy, 'robot')
      await languageMenu(); await undo(); await restart()
    }
    await route(searches[2].witnesses.robotPush, 'all-clear')
    reference.playAgain(); await page.locator('[data-action="next"]').tap(); await checkState(); await layout()
    // Optional keyboard does not replace tap controls.
    reference.move('right'); await page.keyboard.press('ArrowRight'); await checkState(); await undo()
    // Simulate nonzero insets through the exact CSS variables used by env(...).
    await page.addStyleTag({ content: '.terminal { --safe-top:24px; --safe-right:16px; --safe-bottom:20px; --safe-left:16px; }' })
    assert.deepEqual(await page.locator('.terminal').evaluate(el => {
      const style = getComputedStyle(el)
      return ['Top', 'Right', 'Bottom', 'Left'].map(side => parseFloat(style[`padding${side}`]))
    }), [24, 16, 20, 16])
    await layout(false)
    // Tap-only navigation also works when insets require vertical scrolling.
    await move('right')
    await page.locator('[data-action="restart"]').tap(); reference.restart(); await checkState()
    assert.deepEqual(errors, [])
    report.push({ language, check: '320px, tap-only, 44px, square cells, no horizontal overflow, language nonprogress, fail/undo/restart/next/play-again, simulated safe-area', result: 'PASS' })
    await context.close()
  }
  await writeFile(`${artifacts}/report.json`, JSON.stringify(report, null, 2) + '\n')
  console.log(`PASS: 320px Chromium ja/en, 3 stages, distinct strategies, robot-pushed exit, hole FAIL, undo/restart/next/play-again. ${artifacts}`)
} finally { await browser.close() }
