import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { renderDungeon } from '../src/renderer.ts'
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
    let displayLanguage = locale
    const checkDirection = async () => {
      const facing = (await state())[2]
      assert.equal(await page.locator('.direction-label').textContent(), displayLanguage === 'ja' ? '方角' : 'Direction')
      assert.equal(await page.locator('.direction-value').textContent(), (displayLanguage === 'ja' ? ['北', '東', '南', '西'] : ['N', 'E', 'S', 'W'])[facing])
    }
    const tap = async d => { await page.locator(`[data-direction="${d}"]`).tap(); await checkDirection() }
    async function layout() {
      const result = await page.evaluate(() => {
        const buttons = [...document.querySelectorAll('.controls button, .menu-toggle')].map(el => { const r = el.getBoundingClientRect(); return r.x >= 0 && r.right <= innerWidth && r.y >= 0 && r.bottom <= innerHeight && r.width >= 44 && r.height >= 44 })
        const r = document.querySelector('svg').getBoundingClientRect()
        const dungeon = document.querySelector('.dungeon').getBoundingClientRect()
        const status = document.querySelector('.status').getBoundingClientRect()
        const log = document.querySelector('.log').getBoundingClientRect()
        const controls = document.querySelector('.controls').getBoundingClientRect()
        const label = document.querySelector('.direction-label').getBoundingClientRect()
        const value = document.querySelector('.direction-value').getBoundingClientRect()
        const row = document.querySelector('.dungeon-row').getBoundingClientRect()
        const viewBox = document.querySelector('svg').viewBox.baseVal
        const transform = document.querySelector('svg').getScreenCTM()
        return { buttons, width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, viewportHeight: innerHeight, viewportWidth: innerWidth, ratio: r.width / r.height, internalRatio: viewBox.width / viewBox.height, scaleX: transform.a, scaleY: transform.d, dungeon, status, log, controls, label, value, row }
      })
      assert.ok(result.buttons.every(Boolean), JSON.stringify(result))
      assert.equal(result.width, result.viewportWidth); assert.equal(result.height, result.viewportHeight)
      assert.ok(result.dungeon.right <= result.status.x)
      assert.ok(Math.abs(result.dungeon.height - result.status.height) < 1)
      assert.ok(Math.abs(result.dungeon.width / result.status.width - 2) < .02)
      assert.ok(result.row.bottom <= result.log.y && result.log.bottom <= result.controls.y)
      assert.equal(result.internalRatio, 1.6)
      assert.equal(result.scaleX, result.scaleY)
      assert.ok(result.label.x >= result.status.x && result.label.right <= result.status.right)
      assert.ok(result.value.bottom <= result.status.bottom)
      if (result.viewportHeight >= 480) {
        assert.ok(Math.abs(result.ratio - 1.6) < .02)
      }
      // On short screens SVG's default xMidYMid meet keeps drawing undistorted.
    }
    assert.deepEqual(await state(), [2, 4, 0]); await checkDirection(); await layout()
    const toggle = () => page.locator('[data-action="b"]').tap()
    const mapCells = () => page.locator('[data-map-cell]').evaluateAll(els => els.map(el => el.dataset.mapCell).sort())
    async function checkMap(expected) {
      const beforeState = await state(), beforeLog = await page.locator('.log').innerHTML()
      const boxes = await page.locator('.dungeon, .status, .log, .controls').evaluateAll(els => els.map(el => JSON.stringify(el.getBoundingClientRect())))
      await toggle()
      assert.equal(await page.locator('.dungeon').getAttribute('data-view'), '2d')
      assert.deepEqual(await mapCells(), expected.slice().sort())
      assert.equal(await page.locator('[data-map-arrow]').getAttribute('data-map-arrow'), String(beforeState[2]))
      const floors = await page.locator('[data-map-cell] rect').evaluateAll(els => els.map(el => ({ width: el.getAttribute('width'), height: el.getAttribute('height'), fill: el.getAttribute('fill'), stroke: el.getAttribute('stroke') })))
      assert.ok(floors.every(r => r.width === '24' && r.height === '24' && r.stroke === null && ['#123c24', '#245c38'].includes(r.fill)))
      assert.equal(await page.locator('svg > rect').getAttribute('fill'), '#000')
      const discoveredDoor = expected.includes('2,1') || expected.includes('2,0')
      assert.equal(await page.locator('[data-map-door]').count(), discoveredDoor ? 1 : 0)
      assert.equal(await page.locator('[data-map-wall="2,0.5"]').count(), 0)
      assert.equal(await page.locator('[data-map-wall="2,3.5"]').count(), 0)
      assert.ok(await page.locator('[data-map-wall="2.5,4"]').count() === 1)
      if (discoveredDoor) {
        assert.equal(await page.locator('[data-map-door]').getAttribute('data-map-door'), '2,0.5')
        assert.equal((await page.locator('[data-map-door]').getAttribute('d')).match(/M/g).length, 4)
      }
      const arrowBox = await page.locator('[data-map-arrow]').evaluate(el => { const b = el.getBBox(); return [b.width, b.height] })
      assert.ok(arrowBox.every(n => n <= 16))
      for (const selector of ['[data-direction="up"]', '[data-direction="left"]', '[data-direction="down"]', '[data-direction="right"]', '[data-action="a"]']) {
        assert.equal(await page.locator(selector).isDisabled(), true)
        await page.locator(selector).evaluate(el => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
      }
      for (const key of ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']) await page.keyboard.press(key)
      assert.deepEqual(await state(), beforeState); assert.deepEqual(await mapCells(), expected.slice().sort())
      assert.equal(await page.locator('.log').innerHTML(), beforeLog)
      assert.deepEqual(await page.locator('.dungeon, .status, .log, .controls').evaluateAll(els => els.map(el => JSON.stringify(el.getBoundingClientRect()))), boxes)
      await layout()
      await page.screenshot({ path: `${artifacts}/${locale}-map-${expected.length}.png` })
      await toggle()
      assert.equal(await page.locator('.dungeon').getAttribute('data-view'), '3d')
      assert.deepEqual(await state(), beforeState); assert.equal(await page.locator('.log').innerHTML(), beforeLog)
      assert.equal(await page.locator('[data-action="a"]').isEnabled(), true)
    }
    assert.equal(await page.locator('.dungeon').getAttribute('data-view'), '3d')
    await checkMap(['2,4'])
    const initial = await page.locator('.dungeon').innerHTML()
    for (let i = 0; i < 3; i++) await tap('up')
    assert.deepEqual(await state(), [2, 1, 0])
    assert.notEqual(await page.locator('.dungeon').innerHTML(), initial)
    assert.ok(await page.locator('[data-door]').count() > 0)
    assert.ok(await page.locator('[data-action="b"]').evaluate(el => el.getBoundingClientRect().x) < await page.locator('[data-action="a"]').evaluate(el => el.getBoundingClientRect().x))
    await page.screenshot({ path: `${artifacts}/${locale}-junction.png` })
    await tap('up'); assert.deepEqual(await state(), [2, 1, 0])
    await checkMap(['2,4', '2,3', '2,2', '2,1'])
    await page.locator('[data-action="a"]').tap(); assert.deepEqual(await state(), [2, 0, 0]); await checkDirection()
    assert.equal(await page.locator('.log p').last().textContent(), locale === 'ja' ? '扉を開けて部屋に入った。' : 'Opened the door and entered the room.')
    await checkMap(['2,4', '2,3', '2,2', '2,1', '2,0'])
    await page.screenshot({ path: `${artifacts}/${locale}-room-north.png` })
    await tap('up'); assert.deepEqual(await state(), [2, 0, 0])
    await tap('right'); await tap('up'); assert.deepEqual(await state(), [2, 0, 1])
    await tap('down'); await tap('up'); assert.deepEqual(await state(), [2, 0, 3])
    await tap('left'); assert.deepEqual(await state(), [2, 0, 2])
    assert.ok(await page.locator('[data-door]').count() > 0)
    await tap('up'); assert.deepEqual(await state(), [2, 0, 2])
    await page.screenshot({ path: `${artifacts}/${locale}-room-door.png` })
    await page.locator('[data-action="a"]').tap(); assert.deepEqual(await state(), [2, 1, 2]); await checkDirection()
    assert.equal(await page.locator('.log p').last().textContent(), locale === 'ja' ? '扉を開けて通路に戻った。' : 'Opened the door and returned to the corridor.')
    await tap('down')
    await tap('left'); assert.deepEqual(await state(), [2, 1, 3])
    await tap('up'); await tap('up'); assert.deepEqual(await state(), [0, 1, 3])
    await tap('up'); assert.deepEqual(await state(), [0, 1, 3])
    await tap('down'); assert.deepEqual(await state(), [0, 1, 1])
    for (let i = 0; i < 4; i++) await tap('right')
    assert.deepEqual(await state(), [0, 1, 1])
    const before = await page.locator('.log').innerHTML()
    for (const action of ['a', 'b']) await page.locator(`[data-action="${action}"]`).tap()
    assert.equal(await page.locator('.log').innerHTML(), before); assert.deepEqual(await state(), [0, 1, 1])
    await page.locator('.menu-toggle').tap()
    await page.locator(`[data-language="${locale === 'ja' ? 'en' : 'ja'}"]`).tap()
    assert.equal(await page.locator('html').getAttribute('lang'), locale === 'ja' ? 'en' : 'ja')
    assert.deepEqual(await state(), [0, 1, 1])
    displayLanguage = locale === 'ja' ? 'en' : 'ja'; await checkDirection()
    assert.equal(await page.locator('.dungeon').getAttribute('data-view'), '2d')
    assert.equal(await page.locator('[data-action="a"]').isDisabled(), true)
    await toggle()
    await checkMap(['2,4', '2,3', '2,2', '2,1', '2,0', '1,1', '0,1'])
    await page.locator('.menu-toggle').tap(); await page.keyboard.press('Escape')
    assert.equal(await page.locator('.language-menu').isVisible(), false)
    for (const height of [480, 320, 240]) {
      await page.setViewportSize({ width: 320, height }); await layout()
    }
    await page.setViewportSize({ width: 320, height: 480 })
    await page.addStyleTag({ content: '.terminal { --safe-top:24px; --safe-right:16px; --safe-bottom:20px; --safe-left:16px; }' })
    await layout()
    const statusBefore = await page.locator('.status').boundingBox()
    for (let i = 0; i < 30; i++) await tap('right')
    await page.locator('.log').evaluate(el => { el.scrollTop = 0 })
    assert.deepEqual(await page.locator('.status').boundingBox(), statusBefore)
    await tap('down'); await tap('down')
    assert.ok(await page.locator('.log').evaluate(el => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) <= 1))
    await page.keyboard.press('ArrowUp'); assert.deepEqual(await state(), [0, 1, 3])
    await page.screenshot({ path: `${artifacts}/${locale}-short-safe-area.png` })
    await page.setViewportSize({ width: 1280, height: 800 }); await layout()
    await page.screenshot({ path: `${artifacts}/${locale}-desktop-status.png` })
    await page.setViewportSize({ width: 320, height: 640 }); await layout()
    await page.screenshot({ path: `${artifacts}/${locale}-mobile-status.png` })
    await page.setViewportSize({ width: 1280, height: 800 })
    const pcBefore = await page.locator('.dungeon, .status, .log, .controls').evaluateAll(els => els.map(el => JSON.stringify(el.getBoundingClientRect())))
    await toggle()
    assert.deepEqual(await page.locator('.dungeon, .status, .log, .controls').evaluateAll(els => els.map(el => JSON.stringify(el.getBoundingClientRect()))), pcBefore)
    assert.ok(await page.locator('[data-map-arrow]').isVisible())
    await page.screenshot({ path: `${artifacts}/${locale}-pc-map.png` })
    await layout()
    await toggle()
    // Pixel comparisons prove extra structures behind solid front/side walls
    // cannot change the visible image. Openings must reveal added geometry.
    let imageIndex = 0
    const image = async (map, player, doors = []) => {
      await page.locator('.dungeon').evaluate((el, svg) => { el.innerHTML = svg }, renderDungeon(map, player, doors))
      return page.locator('.dungeon').screenshot({ path: `${artifacts}/occlusion-${locale}-${imageIndex++}.png` })
    }
    await page.setViewportSize({ width: 320, height: 640 })
    const north = { x: 1, y: 2, facing: 0 }
    assert.ok((await image(['   ', '   ', ' # '], north)).equals(await image(['###', '   ', ' # '], north)), 'front wall occlusion')
    const side = { x: 1, y: 2, facing: 0 }
    assert.ok((await image([' #  ', ' #  ', ' #  '], side)).equals(await image([' # #', ' # #', ' # #'], side)), 'side wall occlusion')
    assert.ok(!(await image([' #  ', ' #  ', ' #  '], side)).equals(await image([' #  ', ' ## ', ' #  '], side)), 'visible opening')
    const doors = [{ from: { x: 1, y: 2 }, to: { x: 1, y: 1 } }]
    assert.ok((await image([' # ', ' # ', ' # '], north, doors)).equals(await image(['###', '###', ' # '], north, doors)), 'door occlusion')
    assert.deepEqual(errors, [])
    await context.close()
  }
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en' })
  const desktopPage = await desktop.newPage()
  await desktopPage.goto(process.env.EXIT_SEQUENCE_URL ?? 'http://127.0.0.1:5173/exit-sequence/')
  assert.equal(await desktopPage.locator('.direction-value').textContent(), 'N')
  await desktopPage.keyboard.press('ArrowRight')
  assert.equal(await desktopPage.locator('.direction-value').textContent(), 'E')
  await desktopPage.screenshot({ path: `${artifacts}/desktop-mouse-keyboard.png` })
  await desktop.close()
  console.log(`PASS: 3D/2D B toggle, visited-only mapping, disabled controls and keyboard, preserved state/log/history/layout, ja/en direction labels and all four values, immediate rotation/forward/door/language synchronization, fixed status during log scrolling, desktop 1280px, movement, closed-door round trip, SVG wall/door pixel occlusion and openings, B/A, language menu, log scrolling, 320px at 640/480/320/240px heights, simulated safe area. ${artifacts}`)
} finally { await browser.close() }
