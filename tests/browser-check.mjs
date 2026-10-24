import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { EVENTS } from '../src/events.ts'

const base = process.env.EXIT_SEQUENCE_URL ?? 'http://127.0.0.1:5173/exit-sequence/'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox'] })
try {
  for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 1280, height: 800 }, { width: 812, height: 375 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', hasTouch: viewport.width < 500, isMobile: viewport.width < 500 })
    const page = await context.newPage()
    await page.addInitScript(() => Object.defineProperty(Crypto.prototype, 'getRandomValues', { configurable: true, value(array) { array.fill(0); return array } }))
    page.setDefaultTimeout(10000)
    await page.goto(`${base}?seed=42`)
    await page.waitForSelector('.action-command')
    await page.locator('.console-window').click() // skip intro and event typewriter
    await page.waitForSelector('.action-command:not(:disabled)')
    assert.equal(await page.locator('#status-position').innerText(), 'POSITION 01/15')
    assert.equal(await page.locator('#status-power').innerText(), 'POWER 20/20')
    assert.match(await page.locator('#transcript').innerText(), /廃墟から部品を拾って街へ持ち帰る/)
    assert.doesNotMatch(await page.locator('#transcript').innerText(), /観測：|\[SUCCESS\]|\[FAILED\]/)
    assert.equal(await page.locator('.console-event-image').count(), 1)
    assert.equal(await page.locator('.console-event-image').first().evaluate(img => img.complete && img.naturalWidth === 320), true)
    const dims = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: innerHeight }))
    assert.ok(dims.width <= viewport.width, `no horizontal overflow at ${viewport.width}px`)
    assert.equal(await page.locator('.action-command').count(), 3)
    assert.ok((await page.locator('.action-command').first().innerText()).match(/\d+%/))
    const eventId = await page.locator('.console-event-image').first().getAttribute('data-event-id')
    const firstAction = EVENTS.find(event => event.id === eventId).actions[0]
    await page.locator('.action-command').first().click()
    await page.waitForSelector('.slot-line')
    await page.keyboard.press('Enter')
    await page.waitForSelector('#continue-command:not([hidden])')
    const resultText = await page.locator('#transcript').innerText()
    assert.doesNotMatch(resultText, /\[(SUCCESS|FAILED)\]/)
    assert.ok(resultText.includes(firstAction.successText), 'the visible 00 roll selects the matching action success text')
    assert.match(resultText, /電力 [+-]\d+/)
    const posDuringWait = await page.locator('#status-position').innerText()
    assert.equal(posDuringWait, 'POSITION 01/15')
    await page.locator('#continue-button').click()
    await page.waitForFunction(() => document.querySelectorAll('.console-event-image').length === 2)
    assert.equal(await page.locator('#status-position').innerText(), 'POSITION 02/15')
    await context.close()
    console.log(`browser ${viewport.width}×${viewport.height}: ok`)
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.addInitScript(() => Object.defineProperty(Crypto.prototype, 'getRandomValues', { configurable: true, value(array) { array.fill(0); return array } }))
  await page.goto(`${base}?seed=1`)
  await page.locator('.action-command').first().waitFor()
  await page.locator('.console-window').click()
  await page.waitForSelector('.action-command:not(:disabled)')
  for (let turn = 0; turn < 15; turn++) {
    const choices = await page.locator('.action-command').all()
    let selected = choices[0]
    let best = -Infinity
    for (const choice of choices) {
      const delta = Number((await choice.innerText()).match(/([+-]?\d+)\/[+-]?\d+$/)?.[1] ?? -99)
      if (delta > best) { best = delta; selected = choice }
    }
    await selected.click()
    await page.waitForSelector('.slot-line')
    await page.keyboard.press('Enter')
    if (turn < 14) {
      await page.waitForSelector('#continue-command:not([hidden])')
      await page.locator('#continue-button').click()
    }
  }
  await page.waitForSelector('[data-restart]')
  assert.match(await page.locator('#transcript').innerText(), /\[CLEAR\].*地上の光だ！/)
  assert.equal(await page.locator('.console-event-image').count(), 15)
  assert.equal(await page.locator('#status-position').innerText(), 'POSITION 15/15')
  assert.equal(await page.locator('#status-power').evaluate(el => Number(el.textContent.match(/POWER (\d+)/)[1]) > 0), true)
  const consoleWindow = page.locator('.console-window')
  assert.ok(await consoleWindow.evaluate(el => el.scrollHeight > el.clientHeight), 'long run history remains scrollable')
  await consoleWindow.evaluate(el => { el.scrollTop = 0 })
  await page.locator('#latest-log:not([hidden])').waitFor()
  await page.locator('#latest-log').click()
  assert.ok(await consoleWindow.evaluate(el => el.scrollHeight - el.scrollTop - el.clientHeight < 48), 'latest-log returns to the transcript tail')
  await context.close()

  const failureContext = await browser.newContext({ viewport: { width: 320, height: 640 }, reducedMotion: 'reduce' })
  const failurePage = await failureContext.newPage()
  await failurePage.addInitScript(() => Object.defineProperty(Crypto.prototype, 'getRandomValues', { configurable: true, value(array) { array.fill(99); return array } }))
  await failurePage.goto(`${base}?seed=0`)
  await failurePage.locator('.action-command').first().waitFor()
  await failurePage.locator('.console-window').click()
  await failurePage.waitForSelector('.action-command:not(:disabled)')
  const failureId = await failurePage.locator('.console-event-image').first().getAttribute('data-event-id')
  const failureAction = EVENTS.find(event => event.id === failureId).actions[0]
  await failurePage.locator('.action-command').first().click()
  await failurePage.waitForSelector('.slot-line')
  await failurePage.keyboard.press('Enter')
  await failurePage.waitForSelector('#continue-command:not([hidden])')
  const failureText = await failurePage.locator('#transcript').innerText()
  assert.ok(failureText.includes(failureAction.failureText), 'a 99 roll selects the matching action failure text')
  assert.match(failureText, /電力 -\d+/)
  await failurePage.locator('#continue-button').click()
  assert.equal(await failurePage.locator('#status-position').innerText(), 'POSITION 02/15', 'failure with remaining power advances normally')
  await failureContext.close()

  const overContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const overPage = await overContext.newPage()
  await overPage.addInitScript(() => Object.defineProperty(Crypto.prototype, 'getRandomValues', { configurable: true, value(array) { array.fill(99); return array } }))
  await overPage.goto(`${base}?seed=9`)
  await overPage.locator('.action-command').first().waitFor()
  await overPage.locator('.console-window').click()
  await overPage.waitForSelector('.action-command:not(:disabled)')
  for (let turn = 0; turn < 15; turn++) {
    await overPage.locator('.action-command').first().click()
    await overPage.waitForSelector('.slot-line')
    await overPage.keyboard.press('Enter')
    if (await overPage.locator('[data-restart]').count()) break
    await overPage.waitForSelector('#continue-command:not([hidden])')
    await overPage.locator('#continue-button').click()
  }
  await overPage.locator('[data-restart]').waitFor()
  assert.match(await overPage.locator('#transcript').innerText(), /\[GAME OVER\].*充電器を持ってきてー！/)
  assert.equal(await overPage.locator('#status-power').innerText(), 'POWER 0/20')
  await overPage.locator('[data-restart]').click()
  assert.equal(await overPage.locator('#status-position').innerText(), 'POSITION 01/15')
  await overPage.locator('.action-command').first().waitFor()
  assert.doesNotMatch(await overPage.locator('#transcript').innerText(), /\[CLEAR\]|\[GAME OVER\]/, 'restart starts a clean run')
  await overContext.close()

  assert.equal(EVENTS.flatMap(event => event.actions).length, 30)
  console.log('browser clear, slot, result wait, image history, and all requested viewport sizes: ok')
} finally {
  await browser.close()
}
