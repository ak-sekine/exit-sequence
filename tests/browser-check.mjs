import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const base = process.env.EXIT_SEQUENCE_URL ?? 'http://127.0.0.1:5173/exit-sequence/'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox'] })

async function waitForChoices(page) {
  await page.locator('.action-command:not(:disabled)').first().waitFor()
}

async function skipOutput(page) {
  await page.locator('.console-window').click()
  await waitForChoices(page)
}

async function finishCurrentTurn(page, index = 0) {
  await page.locator('.action-command:not(:disabled)').nth(index).click()
  await page.locator('#status-position').waitFor()
  await page.keyboard.press('Space')
  await waitForChoices(page).catch(async () => {
    await page.locator('[data-restart]').waitFor()
  })
}

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
    await page.locator('.action-command').first().waitFor()

    await page.keyboard.press('1')
    assert.match(await page.locator('#status-position').innerText(), /01 \/ 15/)
    const disabledChoice = page.locator('.action-command:disabled').first()
    if (await disabledChoice.count()) {
      await disabledChoice.evaluate(button => button.click())
      assert.match(await page.locator('#status-position').innerText(), /01 \/ 15/)
    }
    await skipOutput(page)

    const measurements = await page.evaluate(() => ({
      viewport: { width: innerWidth, height: innerHeight },
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      buttons: [...document.querySelectorAll('.action-command')].map(button => {
        const rect = button.getBoundingClientRect()
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom }
      }),
      overflowing: [...document.querySelectorAll('.action-command, .action-command *, .console-line')]
        .filter(element => element.scrollWidth > element.clientWidth + 1)
        .map(element => element.className || element.tagName),
    }))
    assert.equal(measurements.document.width, layout.width, `no horizontal scroll at ${layout.width}px`)
    assert.deepEqual(measurements.overflowing, [], `no clipped console or choice text at ${layout.width}px`)
    assert.ok(measurements.buttons.every(button => button.x >= 0 && button.right <= layout.width), `choices fit horizontally at ${layout.width}px`)
    assert.ok(measurements.buttons.every(button => button.height >= 44), 'choice tap areas are at least 44px high')
    assert.ok(measurements.buttons.every(button => button.bottom <= layout.height), `choices stay visible at ${layout.width}×${layout.height}`)

    const transcript = await page.locator('#transcript').innerText()
    assert.match(transcript, /\[SYSTEM\] 脱出シーケンス開始/)
    assert.match(transcript, /\[STATUS\] 電力 20 \/ 20/)
    assert.match(transcript, /\[POSITION\] 01 \/ 15/)
    assert.match(transcript, /\[EVENT\]/)
    assert.match(transcript, /観測：/)
    const bodyText = await page.locator('body').innerText()
    assert.match(bodyText, /\[SELECT ACTION\]/)
    assert.match(bodyText, /\[1\]/)
    assert.doesNotMatch(bodyText, /(?:0|[1-9]\d?)\s*%|facilityConditions|\b(?:stable|degraded)\b/i)
    assert.equal(await page.locator('.wordmark').innerText(), 'EXIT SEQUENCE')

    if (layout.width === 320) {
      await page.evaluate(() => { window.__originalFirstLine = document.querySelector('.console-line') })
      const firstChoice = page.locator('.action-command:not(:disabled)').first()
      const priorTranscript = await page.locator('#transcript').innerText()
      await firstChoice.tap()
      await page.keyboard.press('1')
      assert.match(await page.locator('#status-position').innerText(), /02 \/ 15/)
      await page.keyboard.press('Enter')
      await waitForChoices(page)
      const resultText = await page.locator('#transcript').innerText()
      for (const marker of ['[ACTION]', '[STATUS]', '[MOVE]', '[EVENT]', '観測：']) assert.ok(resultText.includes(marker), `result log contains ${marker}`)
      assert.ok(resultText.indexOf('[ACTION]') < resultText.indexOf('[SUCCESS]') || resultText.indexOf('[ACTION]') < resultText.indexOf('[FAILED]'))
      const outcomeIndex = Math.max(resultText.indexOf('[SUCCESS]'), resultText.indexOf('[FAILED]'))
      assert.ok(outcomeIndex < resultText.indexOf('[STATUS]', resultText.indexOf('[ACTION]')))
      assert.ok(resultText.indexOf('[MOVE]') < resultText.indexOf('[EVENT]', resultText.indexOf('[MOVE]')))
      assert.ok(resultText.indexOf('[EVENT]', resultText.indexOf('[MOVE]')) < resultText.lastIndexOf('観測：'))
      assert.ok(resultText.startsWith(priorTranscript), 'past console output stays in place as new lines append')
      assert.equal(await page.evaluate(() => window.__originalFirstLine === document.querySelector('.console-line')), true, 'existing log DOM node is reused')

      await finishCurrentTurn(page, 0)
      await finishCurrentTurn(page, 0)
      const canScroll = await page.locator('.console-window').evaluate(element => element.scrollHeight > element.clientHeight)
      assert.equal(canScroll, true, 'long run logs scroll inside the console')
      await page.locator('.console-window').evaluate(element => { element.scrollTop = 0 })
      await page.locator('.action-command:not(:disabled)').first().click()
      await page.keyboard.press('Enter')
      await waitForChoices(page)
      assert.equal(await page.locator('.console-window').evaluate(element => element.scrollTop), 0, 'reading old output does not auto-scroll to the tail')
      await page.locator('#latest-log').click()
      assert.equal(await page.locator('#latest-log').isVisible(), false, 'latest log control returns to the tail')
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320)
    } else if (layout.width === 390) {
      await page.keyboard.press('2')
      assert.match(await page.locator('#status-position').innerText(), /02 \/ 15/)
      await page.keyboard.press('Space')
      await waitForChoices(page)
    } else if (layout.width === 1280) {
      assert.ok(measurements.buttons.every(button => button.width < 760), 'desktop console is centered and width-limited')
      await page.locator('.action-command:not(:disabled)').nth(1).click()
      await page.keyboard.press('Enter')
      await waitForChoices(page)
      await page.keyboard.press('3')
      assert.match(await page.locator('#status-position').innerText(), /03 \/ 15/)
    }

    assert.deepEqual(errors, [], `no browser errors at ${layout.width}×${layout.height}`)
    console.log(`browser layout ${layout.width}×${layout.height}: ok`)
    await context.close()
  }

  const reducedContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  })
  const reducedPage = await reducedContext.newPage()
  reducedPage.setDefaultTimeout(5000)
  await reducedPage.goto(`${base}?seed=123456`)
  await waitForChoices(reducedPage)
  assert.match(await reducedPage.locator('#transcript').innerText(), /観測：/)
  assert.equal(await reducedPage.locator('.action-command:not(:disabled)').count(), 3)
  await reducedPage.keyboard.press('1')
  assert.match(await reducedPage.locator('#status-position').innerText(), /02 \/ 15/)
  assert.match(await reducedPage.locator('#transcript').innerText(), /\[MOVE\]/)
  await waitForChoices(reducedPage)
  console.log('reduced motion full output and keyboard action: ok')
  await reducedContext.close()

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const page = await context.newPage()
  page.setDefaultTimeout(5000)
  await page.goto(`${base}?seed=123456`)
  await skipOutput(page)
  for (let turn = 0; turn < 15 && await page.locator('.action-command:not(:disabled)').count() > 0; turn++) {
    await page.locator('.action-command:not(:disabled)').last().tap()
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => document.querySelector('.action-command:not(:disabled)') || document.querySelector('[data-restart]'))
  }
  await page.locator('[data-restart]').waitFor()
  const finishedText = await page.locator('#transcript').innerText()
  assert.match(finishedText, /\[(?:CLEAR|GAME OVER)\]/)
  const finishedPosition = await page.locator('#status-position').innerText()
  await page.keyboard.press('1')
  assert.equal(await page.locator('#status-position').innerText(), finishedPosition)
  await page.locator('[data-restart]').tap()
  assert.match(await page.locator('#status-position').innerText(), /01 \/ 15/)
  await waitForChoices(page)
  assert.match(await page.locator('#transcript').innerText(), /\[SYSTEM\] 脱出シーケンス開始/)
  assert.doesNotMatch(await page.locator('#transcript').innerText(), /\[CLEAR\]|\[GAME OVER\]/)
  assert.equal(await page.locator('#transcript .console-line').count(), 6, 'restart clears the previous run transcript')
  assert.ok(new URL(page.url()).searchParams.has('seed'))
  console.log('browser run completion, input lock, fresh transcript and restart: ok')
  await context.close()
  console.log('PASS: 320px no horizontal scroll, tappable choices, output skip/input gating, ordered append-only logs, scroll preservation, keyboard/mouse/touch, reduced motion, end state and restart')
} finally {
  await browser.close()
}
