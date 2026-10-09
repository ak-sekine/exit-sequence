import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
const artifacts = process.env.EXIT_SEQUENCE_ARTIFACTS ?? '/tmp/exit-sequence-browser'
await mkdir(artifacts, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox'] })
try {
  for (const locale of ['ja', 'en']) {
    const context = await browser.newContext({ viewport: { width: 320, height: 640 }, locale, isMobile: true, hasTouch: true })
    const page = await context.newPage(), errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto(process.env.EXIT_SEQUENCE_URL ?? 'http://127.0.0.1:5173/exit-sequence/')
    const state = () => page.locator('.dungeon').evaluate(el => [Number(el.dataset.x), Number(el.dataset.y), Number(el.dataset.facing)])
    const tap = d => page.locator(`[data-direction="${d}"]`).tap()
    async function layout() {
      const result = await page.evaluate(() => {
        const buttons = [...document.querySelectorAll('.controls button, .menu-toggle')].map(el => { const r = el.getBoundingClientRect(); return r.x >= 0 && r.right <= innerWidth && r.y >= 0 && r.bottom <= innerHeight && r.width >= 44 && r.height >= 44 })
        const r = document.querySelector('svg').getBoundingClientRect()
        return { buttons, width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, viewportHeight: innerHeight, ratio: r.width / r.height }
      })
      assert.ok(result.buttons.every(Boolean), JSON.stringify(result))
      assert.equal(result.width, 320); assert.equal(result.height, result.viewportHeight)
      // SVG preserves its internal aspect ratio when the short viewport limits its container.
    }
    assert.deepEqual(await state(), [2, 3, 0]); await layout()
    const initial = await page.locator('.dungeon').innerHTML()
    for (let i = 0; i < 3; i++) await tap('up')
    assert.deepEqual(await state(), [2, 0, 0])
    assert.notEqual(await page.locator('.dungeon').innerHTML(), initial)
    assert.equal(await page.locator('[data-opening][data-depth="0"]').count(), 2)
    await page.screenshot({ path: `${artifacts}/${locale}-junction.png` })
    await tap('up'); assert.deepEqual(await state(), [2, 0, 0])
    await tap('left'); assert.deepEqual(await state(), [2, 0, 3])
    await tap('up'); await tap('up'); assert.deepEqual(await state(), [0, 0, 3])
    await tap('up'); assert.deepEqual(await state(), [0, 0, 3])
    await tap('down'); assert.deepEqual(await state(), [0, 0, 1])
    for (let i = 0; i < 4; i++) await tap('right')
    assert.deepEqual(await state(), [0, 0, 1])
    const before = await page.locator('.log').innerHTML()
    for (const action of ['a', 'b']) await page.locator(`[data-action="${action}"]`).tap()
    assert.equal(await page.locator('.log').innerHTML(), before); assert.deepEqual(await state(), [0, 0, 1])
    await page.locator('.menu-toggle').tap()
    await page.locator(`[data-language="${locale === 'ja' ? 'en' : 'ja'}"]`).tap()
    assert.equal(await page.locator('html').getAttribute('lang'), locale === 'ja' ? 'en' : 'ja')
    assert.deepEqual(await state(), [0, 0, 1])
    await page.locator('.menu-toggle').tap(); await page.keyboard.press('Escape')
    assert.equal(await page.locator('.language-menu').isVisible(), false)
    for (const height of [480, 320, 240]) {
      await page.setViewportSize({ width: 320, height }); await layout()
    }
    await page.setViewportSize({ width: 320, height: 480 })
    await page.addStyleTag({ content: '.terminal { --safe-top:24px; --safe-right:16px; --safe-bottom:20px; --safe-left:16px; }' })
    await layout()
    for (let i = 0; i < 30; i++) await tap('right')
    assert.ok(await page.locator('.log').evaluate(el => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) <= 1))
    await page.keyboard.press('ArrowUp'); assert.deepEqual(await state(), [0, 0, 3])
    await page.screenshot({ path: `${artifacts}/${locale}-short-safe-area.png` })
    assert.deepEqual(errors, [])
    await context.close()
  }
  console.log(`PASS: ja/en, movement, SVG junction openings, A/B, language menu, log scrolling, 320px at 640/480/320/240px heights, simulated safe area. ${artifacts}`)
} finally { await browser.close() }
