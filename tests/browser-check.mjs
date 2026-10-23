import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const base = process.env.EXIT_SEQUENCE_URL ?? 'http://127.0.0.1:5173/exit-sequence/'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox'] })

try {
  for (const layout of [
    { width: 320, height: 640, mobile: true },
    { width: 390, height: 844, mobile: true },
    { width: 1280, height: 800, mobile: false },
    { width: 812, height: 375, mobile: true },
  ]) {
    const context = await browser.newContext({
      viewport: { width: layout.width, height: layout.height },
      deviceScaleFactor: 1,
      hasTouch: layout.mobile,
      isMobile: layout.mobile,
    })
    const page = await context.newPage()
    page.setDefaultTimeout(5000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${base}?seed=123456`)
    await page.locator('.action-button').first().waitFor()

    const measurements = await page.evaluate(() => ({
      viewport: { width: innerWidth, height: innerHeight },
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      buttons: [...document.querySelectorAll('.action-button')].map(button => {
        const rect = button.getBoundingClientRect()
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom }
      }),
      overflowing: [...document.querySelectorAll('.action-button, .action-button *, .event-panel h1, .event-description, .observation')]
        .filter(element => element.scrollWidth > element.clientWidth + 1)
        .map(element => element.className || element.tagName),
    }))
    assert.equal(measurements.document.width, layout.width, `no horizontal scroll at ${layout.width}px`)
    assert.deepEqual(measurements.overflowing, [], `no clipped choice or event text at ${layout.width}px`)
    assert.ok(measurements.buttons.every(button => button.x >= 0 && button.right <= layout.width), `choices fit horizontally at ${layout.width}px`)
    assert.ok(measurements.buttons.every(button => button.height >= 44), 'choice buttons have touch friendly height')
    if (layout.width === 320) {
      assert.ok(measurements.buttons.every(button => button.bottom <= layout.height), `all initial choices are visible at 320×640: ${JSON.stringify(measurements.buttons)}`)
    }

    const text = await page.locator('body').innerText()
    assert.match(text, /EXIT SEQUENCE/)
    assert.match(text, /電力 POWER/)
    assert.match(text, /EVENT 01 \/ 15/)
    assert.match(text, /行動を選択/)
    assert.doesNotMatch(text, /(?:0|[1-9]\d?)\s*%|facilityConditions|\b(?:stable|degraded)\b/i)

    if (layout.width === 320) {
      const button = page.locator('.action-button').first()
      const bounds = await button.boundingBox()
      await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
      await page.waitForFunction(() => document.querySelector('.event-kicker')?.textContent?.includes('EVENT 02 / 15'))
      assert.equal(await page.locator('.log-entry').count(), 1)
      assert.match(await page.locator('.event-kicker').innerText(), /EVENT 02 \/ 15/)
      await page.locator('.history-panel summary').click()
      assert.match(await page.locator('.event-log').innerText(), /観測:/)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320)
    } else if (layout.width === 390) {
      await page.keyboard.press('2')
      assert.equal(await page.locator('.log-entry').count(), 1)
      assert.match(await page.locator('.event-kicker').innerText(), /EVENT 02 \/ 15/)
    } else if (layout.width === 1280) {
      await page.locator('.action-button').nth(1).click()
      assert.equal(await page.locator('.log-entry').count(), 1)
      await page.keyboard.press('3')
      assert.equal(await page.locator('.log-entry').count(), 2)
    }

    assert.deepEqual(errors, [], `no browser errors at ${layout.width}×${layout.height}`)
    console.log(`browser layout ${layout.width}×${layout.height}: ok`)
    await context.close()
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const page = await context.newPage()
  page.setDefaultTimeout(5000)
  await page.goto(`${base}?seed=123456`)
  for (let turn = 0; turn < 15 && await page.locator('.action-button').count() > 0; turn++) {
    const choices = page.locator('.action-button')
    await choices.nth(await choices.count() - 1).click()
  }
  assert.match(await page.locator('.system-state').innerText(), /脱出成功|電力枯渇/)
  const finishedText = await page.locator('.system-state').innerText()
  const finishedPosition = await page.locator('.route-caption').innerText()
  await page.keyboard.press('1')
  assert.equal(await page.locator('.system-state').innerText(), finishedText)
  assert.equal(await page.locator('.route-caption').innerText(), finishedPosition)
  await page.locator('[data-restart]').click()
  assert.match(await page.locator('.system-state').innerText(), /進行中/)
  assert.match(await page.locator('.event-kicker').innerText(), /EVENT 01 \/ 15/)
  assert.equal(await page.locator('.power-heading strong span').innerText(), '20')
  assert.equal(await page.locator('.log-entry').count(), 0)
  assert.ok(new URL(page.url()).searchParams.has('seed'))
  console.log('browser terminal/restart and post-finish input lock: ok')
  await context.close()
  console.log('PASS: 320px no horizontal scroll, visible touch choices, mobile touch, keyboard and mouse actions, clue history, hidden odds, terminal lock, and fresh restart')
} finally {
  await browser.close()
}
