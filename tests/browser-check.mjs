import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { EVENTS } from '../src/events.ts'

const base = process.env.EXIT_SEQUENCE_URL ?? 'http://127.0.0.1:5173/exit-sequence/'
const screenshotDir = process.env.EXIT_SEQUENCE_SCREENSHOT_DIR
if (screenshotDir) await mkdir(screenshotDir, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox'] })
const viewports = [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 1280, height: 800 }, { width: 812, height: 375 }]

async function prepare(page, slot = 0) {
  await page.addInitScript(value => {
    window.__forcedSlotValue = value
    Object.defineProperty(Crypto.prototype, 'getRandomValues', {
      configurable: true,
      value(array) { array.fill(window.__forcedSlotValue); return array },
    })
  }, slot)
  page.setDefaultTimeout(10000)
}

async function screenshot(page, name) {
  if (screenshotDir) await page.screenshot({ path: `${screenshotDir}/${name}.png` })
}

async function enterFirstEvent(page) {
  await page.waitForSelector('.console-prologue-image')
  assert.equal(await page.locator('#status-position').innerText(), 'POSITION 01/15')
  assert.equal(await page.locator('#status-power').innerText(), 'POWER 20/20')
  assert.equal(await page.locator('.console-event-image').count(), 0)
  assert.equal(await page.locator('.action-command').count(), 0)
  await page.waitForSelector('#continue-command:not([hidden])')
  const prologueImage = page.locator('.console-prologue-image')
  assert.equal(await prologueImage.evaluate(img => img.complete && img.naturalWidth === 320), true)
  assert.match(await prologueImage.getAttribute('src'), /\/story\/prologue\.png$/)
  await revealEndingImage(page, prologueImage)
  await assertImageFrame(prologueImage)
  await page.locator('#continue-button').click()
  await page.waitForFunction(() => document.querySelectorAll('.console-event-image').length === 1)
  await page.waitForSelector('.action-command:not(:disabled)')
  assert.equal(await page.locator('.console-prologue-image').count(), 1)
  assert.equal(await page.locator('.console-event-image').count(), 1)
  const eventImage = page.locator('.console-event-image').first()
  const eventId = await eventImage.getAttribute('data-event-id')
  assert.match(await eventImage.getAttribute('src'), new RegExp(`/events/${eventId}\\.png$`))
  await revealEndingImage(page, eventImage)
  await assertImageFrame(eventImage)
}

async function assertImageFrame(image, allowBroken = false) {
  await image.evaluate(img => new Promise(resolve => { if (img.complete) resolve(); else { img.onload = resolve; img.onerror = resolve } }))
  const measure = await image.evaluate(img => {
    const frame = img.closest('.console-image-row')
    const log = document.querySelector('.console-window')
    const i = img.getBoundingClientRect(), f = frame.getBoundingClientRect(), l = log.getBoundingClientRect()
    return { loaded: img.complete && img.naturalWidth === 320 && img.naturalHeight === 200, width: f.width, height: f.height, ratio: f.width / f.height, frameTop: f.top, frameBottom: f.bottom, logTop: l.top, logBottom: l.bottom, alt: img.alt }
  })
  assert.ok(measure.width > 0 && measure.width <= 320, 'art stays within 320px and adapts to the log')
  assert.ok(Math.abs(measure.ratio - 8 / 5) < 0.02, 'art keeps the 8:5 ratio')
  if (!allowBroken) assert.equal(measure.loaded, true, 'the requested PNG is loaded')
  assert.ok(measure.frameTop >= measure.logTop - 1 && measure.frameBottom <= measure.logBottom + 1, `the full image frame fits the log viewport: ${JSON.stringify(measure)}`)
  assert.ok(measure.alt.length > 0, 'image has alternative text')
}

async function revealEndingImage(page, image = page.locator('.console-ending-image')) {
  await image.evaluate(img => {
    const frame = img.closest('.console-image-row')
    const log = document.querySelector('.console-window')
    log.scrollTop += frame.getBoundingClientRect().top - log.getBoundingClientRect().top - 2
  })
}

async function playToEnding(page, ending, finalFailure = false, continueMethod = 'click', { skipEndingText = false, allowBrokenImage = false } = {}) {
  let terminal = false
  for (let turn = 0; turn < 15; turn++) {
    const choices = await page.locator('.action-command:not(:disabled)').all()
    assert.ok(choices.length > 0, `choices exist on turn ${turn + 1}`)
    const slot = ending === 'lost' || (finalFailure && turn === 14) ? 99 : 0
    await page.evaluate(value => { window.__forcedSlotValue = value }, slot)
    let selected = choices[0]
    let expectedResultText = ''
    let expectedFailureText = ''
    if (ending === 'clear' && turn < 14) {
      let best = Number.NEGATIVE_INFINITY
      for (const choice of choices) {
        const delta = Number((await choice.innerText()).match(/([+-]?\d+)\/[+-]?\d+$/)?.[1] ?? -99)
        if (delta > best) { best = delta; selected = choice }
      }
    }
    if (ending === 'clear' && turn === 14 && finalFailure) {
      let leastCost = Number.NEGATIVE_INFINITY
      for (const choice of choices) {
        const delta = Number((await choice.innerText()).match(/[+-]?\d+\/([+-]?\d+)$/)?.[1] ?? -99)
        if (delta > leastCost) { leastCost = delta; selected = choice }
      }
      const text = await selected.innerText()
      const actionIndex = Number(text.match(/^\[(\d+)\]/)[1]) - 1
      const eventId = await page.locator('.console-event-image').last().getAttribute('data-event-id')
      expectedFailureText = EVENTS.find(event => event.id === eventId).actions[actionIndex].failureText
    }
    const selectedLabel = await selected.innerText()
    const selectedIndex = Number(selectedLabel.match(/^\[(\d+)\]/)[1]) - 1
    const selectedEventId = await page.locator('.console-event-image').last().getAttribute('data-event-id')
    const selectedAction = EVENTS.find(event => event.id === selectedEventId).actions[selectedIndex]
    expectedResultText = slot < selectedAction.successProbabilityPercent ? selectedAction.successText : selectedAction.failureText
    const oldSlotCount = await page.locator('.slot-line').count()
    await selected.click()
    await page.waitForFunction(previous => document.querySelectorAll('.slot-line').length > previous, oldSlotCount)
    await page.keyboard.press('Enter')
    await page.waitForSelector('#continue-command:not([hidden])')
    const powerText = await page.locator('#status-power').innerText()
    const power = Number(powerText.match(/POWER (\d+)\/20/)[1])
    const positionText = await page.locator('#status-position').innerText()
    terminal = ending === 'lost' ? power === 0 : positionText === 'POSITION 15/15' && power > 0
    if (terminal) {
      const finalResultText = await page.locator('#transcript').innerText()
      assert.ok(finalResultText.includes(expectedResultText), 'the final action result is fully visible before any ending')
      assert.match(finalResultText, /電力 [+-]\d+/, 'actual power change is displayed before an ending')
      assert.equal(await page.locator('.console-ending-image').count(), 0, 'terminal art waits for the next input')
      assert.doesNotMatch(finalResultText, /^\[(?:CLEAR|GAME OVER)\]$/m, 'ending heading waits for the next input')
      if (ending === 'lost') {
        assert.match(positionText, /POSITION \d{2}\/15/, 'game over stays on the depleted tile')
        assert.equal(powerText, 'POWER 0/20')
        assert.equal(await page.locator('.console-event-image').count(), Number(positionText.match(/POSITION (\d+)\/15/)[1]), 'game over does not draw or append a next event')
      } else {
        assert.equal(positionText, 'POSITION 15/15')
        assert.ok(power > 0)
        if (finalFailure) assert.ok((await page.locator('#transcript').innerText()).includes(expectedFailureText), 'a failed final action can still clear with power remaining')
      }
      const beforePosition = positionText
      const beforePower = powerText
      await page.locator('.console-window').evaluate(log => { log.scrollTop = 0 })
      if (await page.locator('#latest-log:not([hidden])').count()) await page.locator('#latest-log').click()
      assert.equal(await page.locator('.console-ending-image').count(), 0, 'scroll and latest-log do not advance')
      assert.equal(await page.locator('#status-position').innerText(), beforePosition)
      assert.equal(await page.locator('#status-power').innerText(), beforePower)
      await page.waitForTimeout(40)
      assert.equal(await page.locator('#status-position').innerText(), beforePosition, 'terminal wait keeps the resolved position')
      assert.equal(await page.locator('#status-power').innerText(), beforePower, 'terminal wait keeps the resolved power')
      if (continueMethod === 'Space' || continueMethod === 'Enter') await page.keyboard.press(continueMethod)
      else await page.locator('#continue-button').click()
      break
    }
    await page.keyboard.press('Space')
    await page.waitForSelector('.action-command:not(:disabled)')
  }
  assert.equal(terminal, true, `${ending} state is reached`)
  const endingId = ending === 'clear' ? 'clear' : 'game-over'
  const image = page.locator('.console-ending-image')
  await page.waitForFunction(id => {
    const img = document.querySelector('.console-ending-image')
    return img?.dataset.eventId === id
  }, endingId)
  assert.equal(await image.count(), 1, 'one final input adds one ending image')
  assert.equal(await image.getAttribute('data-image-kind'), 'ending')
  assert.match(await image.getAttribute('src'), new RegExp(`/story/${endingId}\\.png$`))
  await image.evaluate(img => new Promise(resolve => { if (img.complete) resolve(); else { img.onload = resolve; img.onerror = resolve } }))
  await revealEndingImage(page)
  await assertImageFrame(image, allowBrokenImage)
  const structure = await image.evaluate(img => ({ heading: img.closest('.console-image-row').previousElementSibling?.textContent, after: img.closest('.console-image-row').nextElementSibling?.textContent }))
  assert.equal(structure.heading, ending === 'clear' ? '[CLEAR]' : '[GAME OVER]')
  assert.ok(structure.after?.length > 0, 'ending prose follows the image')
  if (skipEndingText) {
    await page.waitForTimeout(30)
    assert.equal(await page.locator('[data-restart]').count(), 0, 'restart waits for ending prose')
    await page.locator('.console-window').click()
  }
  await page.locator('[data-restart]').waitFor()
  await page.keyboard.press('Space')
  await page.keyboard.press('Enter')
  assert.equal(await page.locator('.console-ending-image').count(), 1, 'repeated keys do not duplicate an ending image')
  assert.equal(await page.locator('#transcript .console-line').filter({ hasText: /^\[CLEAR\]$|^\[GAME OVER\]$/ }).count(), 1, 'repeated keys do not duplicate an ending heading')
  const transcript = await page.locator('#transcript').innerText()
  if (ending === 'clear') {
    assert.match(transcript, /地上の光だ！ 出口だ！[\s\S]*やった、ぼく生きてる！[\s\S]*拾った部品？[\s\S]*……あれ、どこに置いたっけ。[\s\S]*まあいいや、街へ帰ろう！/)
  } else {
    assert.match(transcript, /あれ？ 体が動かない。[\s\S]*どうやら電力がゼロになったらしい。[\s\S]*ぼくの冒険はここまで。[\s\S]*誰か、充電器を持ってきてー！/)
  }
  if (!allowBrokenImage) await screenshot(page, `${ending}-${page.viewportSize().width}x${page.viewportSize().height}`)
}

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', hasTouch: viewport.width < 500, isMobile: viewport.width < 500 })
    const page = await context.newPage()
    await prepare(page)
    await page.goto(`${base}?seed=42`)
    await page.waitForSelector('.console-prologue-image')
    await revealEndingImage(page, page.locator('.console-prologue-image'))
    await assertImageFrame(page.locator('.console-prologue-image'))
    await screenshot(page, `prologue-${viewport.width}x${viewport.height}`)
    await enterFirstEvent(page)
    assert.equal(await page.locator('#status-position').innerText(), 'POSITION 01/15')
    assert.equal(await page.locator('#status-power').innerText(), 'POWER 20/20')
    assert.equal(await page.locator('.console-event-image').count(), 1, 'prologue is not included in event image count')
    assert.equal(await page.locator('.console-prologue-image').count(), 1, 'prologue remains in history')
    await screenshot(page, `event-${viewport.width}x${viewport.height}`)
    const eventId = await page.locator('.console-event-image').first().getAttribute('data-event-id')
    assert.ok(EVENTS.some(event => event.id === eventId))
    const action = EVENTS.find(event => event.id === eventId).actions[0]
    await page.locator('.action-command').first().click()
    await page.waitForSelector('.slot-line')
    await page.keyboard.press('Enter')
    await page.waitForSelector('#continue-command:not([hidden])')
    assert.ok((await page.locator('#transcript').innerText()).includes(action.successText))
    assert.match(await page.locator('#transcript').innerText(), /電力 [+-]\d+/)
    assert.equal(await page.locator('.console-event-image').count(), 1, 'no next event image appears during the result wait')
    await page.keyboard.press('Space')
    await page.waitForFunction(() => document.querySelectorAll('.console-event-image').length === 2)
    assert.equal(await page.locator('#status-position').innerText(), 'POSITION 02/15')
    await context.close()
    console.log(`browser ${viewport.width}×${viewport.height}: prologue, event, success wait and layout ok`)
  }

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', hasTouch: viewport.width < 500, isMobile: viewport.width < 500 })
    const page = await context.newPage()
    await prepare(page)
    await page.goto(`${base}?seed=1`)
    await enterFirstEvent(page)
    await playToEnding(page, 'clear', true)
    await context.close()
    console.log(`browser ${viewport.width}×${viewport.height}: failed final action with power remaining clears`)
  }

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', hasTouch: viewport.width < 500, isMobile: viewport.width < 500 })
    const page = await context.newPage()
    await prepare(page, 99)
    await page.goto(`${base}?seed=9`)
    await enterFirstEvent(page)
    await playToEnding(page, 'lost', false, 'Space')
    await context.close()
    console.log(`browser ${viewport.width}×${viewport.height}: game over wait and ending image ok`)
  }

  const slowContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' })
  const slowPage = await slowContext.newPage()
  await prepare(slowPage)
  await slowPage.goto(`${base}?seed=1`)
  await enterFirstEvent(slowPage)
  await playToEnding(slowPage, 'clear', true, 'click', { skipEndingText: true })
  await slowContext.close()

  const brokenContext = await browser.newContext({ viewport: { width: 320, height: 640 }, reducedMotion: 'reduce' })
  await brokenContext.route('**/story/game-over.png', route => route.abort())
  const brokenPage = await brokenContext.newPage()
  await prepare(brokenPage, 99)
  await brokenPage.goto(`${base}?seed=9`)
  await enterFirstEvent(brokenPage)
  await playToEnding(brokenPage, 'lost', false, 'click', { allowBrokenImage: true })
  assert.equal(await brokenPage.locator('.console-ending-image').evaluate(img => img.complete && img.naturalWidth === 0), true, 'failed ending art does not block the ending text or restart')
  await brokenContext.close()

  const restartContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const restartPage = await restartContext.newPage()
  await prepare(restartPage, 0)
  await restartPage.goto(`${base}?seed=42`)
  await enterFirstEvent(restartPage)
  await playToEnding(restartPage, 'clear', true)
  await restartPage.locator('[data-restart]').click()
  await restartPage.waitForSelector('.console-prologue-image')
  assert.equal(await restartPage.locator('.console-prologue-image').count(), 1, 'restart begins at the prologue image')
  assert.equal(await restartPage.locator('.console-ending-image').count(), 0, 'restart clears prior ending art')
  await restartContext.close()

  const keyboardContext = await browser.newContext({ viewport: { width: 812, height: 375 }, reducedMotion: 'reduce' })
  const keyboardPage = await keyboardContext.newPage()
  await prepare(keyboardPage, 0)
  await keyboardPage.goto(`${base}?seed=42`)
  await keyboardPage.waitForSelector('#continue-command:not([hidden])')
  await keyboardPage.keyboard.press('Enter')
  await keyboardPage.waitForSelector('.console-event-image')
  assert.equal(await keyboardPage.locator('#status-position').innerText(), 'POSITION 01/15')
  await keyboardContext.close()

  assert.equal(EVENTS.flatMap(event => event.actions).length, 30)
  console.log('PASS: prologue and event waits, CLEAR/GAME OVER image order, end waits, failed image loading, restart, no duplicate images, Reduced Motion, and four viewport sizes')
} finally {
  await browser.close()
}
