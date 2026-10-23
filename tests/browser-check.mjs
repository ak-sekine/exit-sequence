import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'

const base = process.env.EXIT_SEQUENCE_URL ?? 'http://127.0.0.1:5173/exit-sequence/'
const artifacts = process.env.EXIT_SEQUENCE_ARTIFACTS ?? '/tmp/exit-sequence-browser'
await mkdir(artifacts, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox'] })
try {
  const layouts = [
    { width: 320, height: 640, mobile: true },
    { width: 375, height: 812, mobile: true },
    { width: 390, height: 844, mobile: true },
    { width: 1280, height: 800, mobile: false },
    { width: 812, height: 375, mobile: true },
  ]
  for (const layout of layouts) {
    const context = await browser.newContext({
      viewport: { width: layout.width, height: layout.height },
      deviceScaleFactor: 1,
      hasTouch: layout.mobile,
      isMobile: layout.mobile,
    })
    const page = await context.newPage(), errors = []
    page.setDefaultTimeout(5000)
    console.log(`browser layout ${layout.width}×${layout.height}`)
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(base)
    await page.waitForFunction(() => !!document.querySelector('.scene-frame')?.dataset.time)
    const measurements = await page.evaluate(() => {
      const frame = document.querySelector('.scene-frame').getBoundingClientRect()
      return {
        frame: { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        viewport: { width: innerWidth, height: innerHeight },
        controls: document.querySelector('.controls').getBoundingClientRect().toJSON(),
      }
    })
    assert.ok(Math.abs(measurements.frame.width - measurements.frame.height) <= 1, `square scene at ${layout.width}×${layout.height}: ${JSON.stringify(measurements.frame)}`)
    assert.ok(measurements.frame.width <= layout.width, `scene fits width at ${layout.width}px`)
    assert.equal(measurements.scrollWidth, layout.width, `no horizontal scrolling at ${layout.width}px`)
    assert.equal(measurements.scrollHeight, layout.height, `no page scrolling at ${layout.width}×${layout.height}`)
    assert.ok(measurements.controls.y + measurements.controls.height <= layout.height, `controls remain visible at ${layout.width}×${layout.height}`)
    assert.ok(await page.locator('.game-canvas').evaluate(canvas => canvas.getContext('2d') !== null))

    if (layout.width === 390 || layout.width === 1280) {
      await page.screenshot({ path: `${artifacts}/initial-${layout.width}.png` })
    }

    if (layout.width === 320) {
      await page.addStyleTag({ content: '.shell { --safe-top: 24px; --safe-right: 14px; --safe-bottom: 22px; --safe-left: 14px; }' })
      const safe = await page.locator('.shell').evaluate(element => ({
        top: getComputedStyle(element).paddingTop,
        right: getComputedStyle(element).paddingRight,
        bottom: getComputedStyle(element).paddingBottom,
        left: getComputedStyle(element).paddingLeft,
      }))
      assert.deepEqual(safe, { top: '24px', right: '14px', bottom: '22px', left: '14px' })
      const safeFrame = await page.locator('.scene-frame').boundingBox()
      assert.ok(Math.abs(safeFrame.width - safeFrame.height) <= 1)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320)
    }

    if (layout.width === 390) {
      await page.locator('.menu-toggle').click()
      assert.equal(await page.locator('.scene-frame').getAttribute('data-paused'), 'true')
      const beforeMenu = await page.locator('.scene-frame').getAttribute('data-time')
      await page.waitForTimeout(250)
      assert.equal(await page.locator('.scene-frame').getAttribute('data-time'), beforeMenu)
      await page.locator('[data-language="en"]').click()
      assert.equal(await page.locator('.status-direction').textContent().then(text => text.startsWith('Direction')), true)
      await page.locator('.map-button').click()
      assert.equal(await page.locator('.scene-frame').getAttribute('data-paused'), 'true')
      assert.equal(await page.locator('.map-screen').isVisible(), true)
      await page.screenshot({ path: `${artifacts}/map-paused-390.png` })
      console.log('  map pause and language: ok')
      await page.locator('.map-close').click()
      assert.equal(await page.locator('.scene-frame').getAttribute('data-paused'), 'false')

      const initialY = Number(await page.locator('.scene-frame').getAttribute('data-y'))
      const stick = await page.locator('.joystick').boundingBox()
      const center = { x: stick.x + stick.width / 2, y: stick.y + stick.height / 2 }
      await page.mouse.move(center.x, center.y)
      await page.mouse.down()
      await page.mouse.move(center.x, center.y - 40, { steps: 4 })
      await page.waitForTimeout(220)
      await page.mouse.move(layout.width + 24, center.y - 40, { steps: 4 })
      await page.waitForTimeout(100)
      await page.mouse.up()
      const movedY = Number(await page.locator('.scene-frame').getAttribute('data-y'))
      assert.ok(movedY < initialY - 0.2, `stick moves while captured: ${initialY} -> ${movedY}`)
      await page.waitForTimeout(220)
      const stoppedY = Number(await page.locator('.scene-frame').getAttribute('data-y'))
      assert.ok(Math.abs(stoppedY - movedY) < 0.025, 'release stops movement immediately')
      console.log('  joystick capture and release: ok')

      let heading = Number(await page.locator('.scene-frame').getAttribute('data-heading'))
      const status = await page.locator('.status').boundingBox()
      await page.mouse.move(status.x + 35, status.y + status.height / 2)
      await page.mouse.down()
      await page.mouse.move(status.x + 225, status.y + status.height / 2, { steps: 12 })
      await page.mouse.up()
      await page.waitForTimeout(50)
      const turned = Number(await page.locator('.scene-frame').getAttribute('data-heading'))
      let delta = ((turned - heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI
      assert.ok(Math.abs(delta) > 2.8, `horizontal drag allows a near 180 degree turn: ${delta}`)
      console.log('  view rotation: ok')

      heading = turned
      await page.mouse.move(status.x + 80, status.y + status.height / 2)
      await page.mouse.down()
      await page.mouse.move(status.x + 80, status.y + status.height / 2 + 60, { steps: 6 })
      await page.mouse.up()
      await page.waitForTimeout(40)
      assert.equal(await page.locator('.scene-frame').getAttribute('data-heading'), heading.toFixed(4), 'vertical drag does not rotate')
      const log = await page.locator('.event-log').boundingBox()
      const action = await page.locator('.action-button').boundingBox()
      await page.mouse.move(log.x + 20, log.y + log.height / 2)
      await page.mouse.down()
      await page.mouse.move(action.x + action.width / 2, action.y + action.height / 2, { steps: 8 })
      await page.mouse.up()
      await page.waitForTimeout(40)
      assert.equal(await page.locator('.scene-frame').getAttribute('data-open-doors'), '000000', 'look pointer moving over A does not activate A')
      const afterOverButton = Number(await page.locator('.scene-frame').getAttribute('data-heading'))
      delta = Math.abs(((afterOverButton - heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
      assert.ok(delta > 0.4, 'look gesture continues while the pointer passes over a button')
      console.log('  pointer origin stays fixed over A: ok')

      await page.screenshot({ path: `${artifacts}/realtime-390.png` })
      await page.keyboard.down('w')
      const beforeKey = await page.locator('.scene-frame').evaluate(element => ({ x: Number(element.dataset.x), y: Number(element.dataset.y) }))
      await page.waitForTimeout(150)
      await page.keyboard.up('w')
      const afterKey = await page.locator('.scene-frame').evaluate(element => ({ x: Number(element.dataset.x), y: Number(element.dataset.y) }))
      assert.ok(Math.hypot(afterKey.x - beforeKey.x, afterKey.y - beforeKey.y) > 0.15, 'WASD works in the browser')

      await page.keyboard.press('Escape')
      assert.equal(await page.locator('.scene-frame').getAttribute('data-paused'), 'true')
      const beforeHidden = await page.locator('.scene-frame').getAttribute('data-time')
      await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
        document.dispatchEvent(new Event('visibilitychange'))
      })
      await page.waitForTimeout(120)
      assert.equal(await page.locator('.scene-frame').getAttribute('data-time'), beforeHidden)
      await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
        document.dispatchEvent(new Event('visibilitychange'))
      })
    }
    assert.deepEqual(errors, [], `no browser exceptions at ${layout.width}×${layout.height}`)
    await context.close()
  }
  console.log('PASS: square 2.5D canvas, 320/375/390 phone widths, PC and landscape layout, safe-area padding, no scroll, menu/map pause, language switch, stick capture/release, view drag, WASD, and Escape pause')
} finally {
  await browser.close()
}
