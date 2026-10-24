import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { EVENTS } from '../src/events.ts'
import { createGame, createSeededRandom } from '../src/game.ts'

const base = process.env.EXIT_SEQUENCE_URL ?? 'http://127.0.0.1:5173/exit-sequence/'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox'] })

async function waitForChoices(page) {
  await page.waitForFunction(() =>
    document.querySelectorAll('#command-list .action-command:not(:disabled)').length === 3
    && !!document.querySelector('#transcript .prompt-line:last-child .console-cursor'),
  )
}

async function skipOutput(page) {
  await page.locator('.console-window').click()
  await waitForChoices(page)
}

async function forceSlotValue(page, value) {
  await page.addInitScript(forcedValue => {
    Object.defineProperty(Crypto.prototype, 'getRandomValues', {
      configurable: true,
      value(array) { array.fill(forcedValue); return array },
    })
  }, value)
}

async function forceFirstSpinChange(page) {
  await page.addInitScript(() => {
    let nextValue = 0
    Object.defineProperty(Crypto.prototype, 'getRandomValues', {
      configurable: true,
      value(array) { array.fill(nextValue < 3 ? nextValue++ : 0); return array },
    })
  })
}

async function selectBestSuccessAction(page) {
  const choices = await page.locator('.action-command:not(:disabled)').all()
  let selected = 0
  let bestDelta = Number.NEGATIVE_INFINITY
  for (let index = 0; index < choices.length; index++) {
    const text = await choices[index].innerText()
    const powerText = text.match(/([+-]?\d+)\/[+-]?\d+$/)
    const delta = Number(powerText[1])
    if (delta > bestDelta) { bestDelta = delta; selected = index }
  }
  await choices[selected].tap()
}

async function finishCurrentTurn(page, index = 0, stopMethod = 'Enter') {
  const position = await page.locator('#status-position').innerText()
  const power = await page.locator('#status-power').innerText()
  const oldSlotCount = await page.locator('.slot-line').count()
  await page.locator('.action-command:not(:disabled)').nth(index).click()
  await page.waitForFunction(previous => document.querySelectorAll('.slot-line').length > previous, oldSlotCount)
  const activeSlot = page.locator('.slot-line').last()
  const activeNumber = activeSlot.locator('.slot-number')
  const rowCount = await page.locator('#transcript .console-line').count()
  await activeNumber.evaluate(element => { window.__rollElement = element })
  await page.waitForTimeout(120)
  assert.match(await activeNumber.innerText(), /^\d{2}$/)
  assert.equal(await page.locator('#status-position').innerText(), position, 'position stays fixed while the slot spins')
  assert.equal(await page.locator('#status-power').innerText(), power, 'power stays fixed while the slot spins')
  assert.equal(await page.locator('.action-command:not(:disabled)').count(), 0, 'choices are locked while the slot spins')
  assert.equal(await page.locator('#transcript .console-line').count(), rowCount, 'roll updates reuse one log row')
  assert.equal(await activeSlot.evaluate(element => element.scrollWidth > element.clientWidth), false, 'the two-digit roll stays inside the console width')
  assert.equal(await activeNumber.evaluate(element => window.__rollElement === element), true, 'the rolling number keeps the same DOM node')
  const roll = await activeNumber.innerText()
  const probabilityLine = await page.locator('.console-line').filter({ hasText: /^成功率 \d+%$/ }).last().innerText()
  const probability = Number(probabilityLine.match(/(\d+)%/)[1])
  const previousResults = await page.locator('.line-good, .line-bad').filter({ hasText: /^\[(?:SUCCESS|FAILED)\]/ }).count()
  if (stopMethod === 'tap') await page.locator('.slot-line').tap()
  else if (stopMethod === 'click') {
    const bounds = await page.locator('.slot-line').boundingBox()
    await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  } else await page.keyboard.press(stopMethod)
  try {
    await page.waitForFunction(previous => document.querySelectorAll('.line-good, .line-bad').length > previous, previousResults)
  } catch (error) {
    console.error('slot stop debug', { previousResults, transcript: await page.locator('#transcript').innerText(), slot: await page.locator('.slot-number').innerText().catch(() => null), status: await page.locator('#status-position').innerText() })
    throw error
  }
  assert.equal(await activeNumber.innerText(), roll, 'stopped roll does not change')
  const expected = Number(roll) < probability ? '[SUCCESS]' : '[FAILED]'
  await page.waitForFunction(value => [...document.querySelectorAll('.line-good, .line-bad')].some(line => line.textContent?.startsWith(value)), expected)
  assert.match(await page.locator('#transcript').innerText(), new RegExp(`\\[ROLL\\] ${roll}`))
  const result = await page.locator('.line-good, .line-bad').filter({ hasText: /^\[(?:SUCCESS|FAILED)\]/ }).last().innerText()
  assert.ok(result.startsWith(expected), 'the visible roll and integer success threshold determine the result')
  await page.waitForFunction(() => document.querySelector('.action-command:not(:disabled)') || document.querySelector('[data-restart]'))
  if (await page.locator('.action-command:not(:disabled)').count()) await waitForChoices(page)
  await page.waitForFunction(() => {
    const image = document.querySelector('.event-image')
    return image?.complete && image.naturalWidth > 0 && new URL(image.currentSrc).pathname.endsWith(`/events/${image.dataset.eventId}.svg`)
  })
}

async function measureRegions(page) {
  return page.evaluate(() => {
    const restartProbe = document.createElement('button')
    restartProbe.className = 'restart-button'
    document.querySelector('#restart-command').append(restartProbe)
    const restartFontSize = getComputedStyle(restartProbe).fontSize
    restartProbe.remove()
    const rect = selector => {
      const { top, right, bottom, left, width, height } = document.querySelector(selector).getBoundingClientRect()
      return { top, right, bottom, left, width, height }
    }
    return {
      viewport: { width: innerWidth, height: innerHeight },
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      fontSizes: {
        title: getComputedStyle(document.querySelector('.wordmark')).fontSize,
        status: getComputedStyle(document.querySelector('.status-values')).fontSize,
        log: getComputedStyle(document.querySelector('.transcript')).fontSize,
        action: getComputedStyle(document.querySelector('.command-number')).fontSize,
        probability: getComputedStyle(document.querySelector('.command-probability')).fontSize,
        delta: getComputedStyle(document.querySelector('.command-delta')).fontSize,
        latest: getComputedStyle(document.querySelector('.latest-log')).fontSize,
        restart: restartFontSize,
      },
      shell: rect('.terminal-shell'),
      status: rect('.status-bar'),
      statusContent: rect('.status-content'),
      statusValues: rect('.status-values'),
      wordmark: rect('.wordmark'),
      image: rect('.event-image'),
      log: rect('.console-window'),
      dock: rect('.command-dock'),
      logOverflow: getComputedStyle(document.querySelector('.console-window')).overflowY,
      dockOverflow: getComputedStyle(document.querySelector('.command-dock')).overflowY,
      imageState: {
        eventId: document.querySelector('.event-image').dataset.eventId,
        src: document.querySelector('.event-image').currentSrc,
        loaded: document.querySelector('.event-image').complete,
        naturalWidth: document.querySelector('.event-image').naturalWidth,
        naturalHeight: document.querySelector('.event-image').naturalHeight,
      },
      buttons: [...document.querySelectorAll('.action-command')].map(button => {
        const { top, right, bottom, left, width, height } = button.getBoundingClientRect()
        return { top, right, bottom, left, width, height }
      }),
      choiceTextOverflow: [...document.querySelectorAll('.command-number')].map(element => getComputedStyle(element).textOverflow),
      overflowing: [...document.querySelectorAll('.action-command, .action-command *, .console-line')]
        .filter(element => element.scrollWidth > element.clientWidth + 1)
        .map(element => element.className || element.tagName),
    }
  })
}

function assertRegions(measurements, layout) {
  assert.equal(measurements.document.width, layout.width, `no horizontal scroll at ${layout.width}px`)
  assert.equal(measurements.document.height, layout.height, `no page scroll at ${layout.width}×${layout.height}`)
  assert.ok(Math.abs(measurements.shell.height - layout.height) <= 1, 'terminal fills the viewport')
  assert.ok(measurements.status.bottom <= measurements.log.top + 1, 'status does not overlap the log')
  assert.ok(Math.abs(measurements.wordmark.left - measurements.status.left) <= 1, 'title stays at the top left of the status area')
  assert.ok(measurements.image.left >= measurements.statusContent.left - 1 && measurements.image.right <= measurements.statusContent.right + 1, 'event image stays inside the two-column status content')
  assert.ok(measurements.image.right <= measurements.statusValues.left + 1, 'event image and right-side status values do not overlap')
  assert.ok(measurements.image.bottom <= measurements.status.bottom + 1, 'event image stays inside the top status area')
  assert.ok(measurements.statusContent.right <= measurements.status.right + 1, 'status content stays inside the viewport column')
  assert.equal(measurements.imageState.loaded, true, 'event image finishes loading')
  assert.equal(measurements.imageState.naturalWidth, 320, 'event image has its authored width')
  assert.equal(measurements.imageState.naturalHeight, 200, 'event image has its authored height')
  assert.ok(measurements.image.width >= 116 && measurements.image.width <= 160, 'event image adapts to the layout')
  assert.ok(measurements.image.width > 120 || layout.height <= 440, 'portrait and desktop event images exceed the former 120px size')
  assert.ok(measurements.imageState.src.endsWith(`/events/${measurements.imageState.eventId}.svg`), 'displayed image matches the current event ID')
  assert.ok(measurements.log.bottom <= measurements.dock.top + 1, 'log does not overlap the fixed input dock')
  assert.ok(measurements.dock.bottom <= measurements.shell.bottom + 1, 'input dock stays inside the safe-area padded shell')
  assert.ok(measurements.log.height > 0, 'central log retains a scrollable viewport')
  assert.equal(measurements.logOverflow, 'auto', 'only the log scrolls vertically in the middle region')
  assert.equal(measurements.dockOverflow, 'auto', 'the input dock can scroll internally on short screens')
  assert.ok(measurements.dock.height <= 150, 'the three-row input dock stays compact')
  assert.deepEqual(measurements.overflowing, [], `no clipped console or choice text at ${layout.width}px`)
  assert.ok(measurements.choiceTextOverflow.every(value => value !== 'ellipsis'), 'action labels never use ellipsis')
  assert.deepEqual(measurements.fontSizes, {
    title: '18px', status: '16px', log: '15px', action: '15px', probability: '14px', delta: '14px', latest: '14px', restart: '15px',
  }, `required text sizes are used at ${layout.width}px`)
  assert.ok(Object.values(measurements.fontSizes).every(size => Number.parseFloat(size) >= 14), 'no game UI text is smaller than 14px')
  assert.ok(measurements.buttons.every(button => button.left >= measurements.dock.left - 1 && button.right <= measurements.dock.right + 1), 'choices stay inside the input dock')
  assert.ok(measurements.buttons.every(button => button.top >= measurements.dock.top - 1 && button.bottom <= measurements.dock.bottom + 1), 'all three choices are visible inside the input dock')
  assert.ok(measurements.buttons.every(button => button.height >= 44), 'choice tap areas are at least 44px high')
  assert.ok(measurements.buttons.every(button => button.bottom <= layout.height), `choices stay within ${layout.height}px viewport`)
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
    await forceFirstSpinChange(page)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${base}?seed=123456`)
    await page.locator('.action-command').first().waitFor()
    assert.equal(await page.locator('.action-command').count(), 3, 'all three one-line choices appear immediately')
    assert.equal(await page.locator('.action-command:disabled').count(), 3, 'choices stay disabled until the event log finishes')
    assert.doesNotMatch(await page.locator('.command-dock').innerText(), /\[SELECT ACTION\]/, 'the command heading is omitted')
    assert.equal(await page.locator('#status-position').innerText(), 'POSITION 01/15')
    await page.waitForFunction(() => {
      const image = document.querySelector('.event-image')
      return image?.complete && image.naturalWidth > 0
    })
    const eventAssets = await page.evaluate(async ids => Promise.all(ids.map(id => new Promise(resolve => {
      const image = new Image()
      image.onload = () => resolve({ id, loaded: true, width: image.naturalWidth, height: image.naturalHeight })
      image.onerror = () => resolve({ id, loaded: false, width: 0, height: 0 })
      image.src = new URL(`${id}.svg`, document.querySelector('.event-image').src).href
    }))), ['battery', 'bulkhead', 'cargo-rail', 'charger', 'conveyor', 'emergency', 'generator', 'leak', 'lift', 'terminal'])
    assert.ok(eventAssets.every(asset => asset.loaded && asset.width === 320 && asset.height === 200), 'all ten local event SVGs load at the same size')

    await page.keyboard.press('1')
    assert.equal(await page.locator('#status-position').innerText(), 'POSITION 01/15')
    const disabledChoice = page.locator('.action-command:disabled').first()
    if (await disabledChoice.count()) {
      await disabledChoice.evaluate(button => button.click())
      assert.equal(await page.locator('#status-position').innerText(), 'POSITION 01/15')
    }
    await skipOutput(page)

    const measurements = await measureRegions(page)
    assertRegions(measurements, layout)

    const palette = await page.evaluate(() => {
      const color = selector => getComputedStyle(document.querySelector(selector)).color
      return {
        root: getComputedStyle(document.documentElement).color,
        title: color('.wordmark'),
        status: color('#status-position'),
        log: color('.transcript'),
        logLine: color('.console-line'),
        prompt: color('.prompt-prefix'),
        cursor: getComputedStyle(document.querySelector('.console-cursor')).backgroundColor,
        choice: color('.command-number'),
        probability: color('.command-probability'),
        delta: color('.command-delta'),
        latest: color('.latest-log'),
      }
    })
    const terminalGreen = 'rgb(79, 214, 106)'
    assert.deepEqual(Object.values(palette), Array(11).fill(terminalGreen), 'all text and the cursor use one deep green')
    const activeChoice = page.locator('.action-command:not(:disabled)').first()
    await activeChoice.hover()
    assert.equal(await activeChoice.evaluate(button => getComputedStyle(button).color), terminalGreen, 'hover keeps the terminal text color')
    await activeChoice.focus()
    const focusStyle = await activeChoice.evaluate(button => ({ color: getComputedStyle(button).color, outline: getComputedStyle(button).outlineColor }))
    assert.equal(focusStyle.color, terminalGreen, 'focus keeps the terminal text color')
    assert.equal(focusStyle.outline, terminalGreen, 'focus outline stays in the terminal palette')

    const transcript = await page.locator('#transcript').innerText()
    assert.match(transcript, /\[SYSTEM\] 脱出シーケンス開始/)
    assert.match(transcript, /\[EVENT\]/)
    assert.match(transcript, /観測：/)
    assert.doesNotMatch(transcript, /\[(?:STATUS|POSITION|MOVE|ACTION)\]/, 'status and action details are not duplicated in the transcript')
    assert.equal(await page.locator('#transcript .prompt-line').count(), 1, 'one prompt is appended after the current event')
    assert.match(await page.locator('#transcript .prompt-line').innerText(), /^>\s*$/)
    assert.equal(await page.locator('#transcript .console-cursor').count(), 1, 'cursor is shown at the log prompt while waiting')
    assert.equal(await page.locator('#command-prompt').count(), 0, 'the input dock does not contain a prompt')
    assert.doesNotMatch(await page.locator('#command-dock').innerText(), />/, 'the prompt appears only in the log')
    const bodyText = await page.locator('body').innerText()
    assert.doesNotMatch(bodyText, /\[SELECT ACTION\]/)
    assert.match(bodyText, /\[1\]/)
    for (const choice of await page.locator('.action-command').all()) {
      const text = (await choice.innerText()).replace(/\s+/g, ' ')
      assert.match(text, /^\[\d+\] .+ \d+% [+-]?\d+\/[+-]?\d+$/, 'each choice shows its full action name, integer percent and compact power deltas')
      assert.equal(await choice.getAttribute('title'), null, 'action descriptions do not appear as hover tooltips')
    }
    assert.doesNotMatch(bodyText, /facilityConditions|baseChance|\b(?:stable|degraded)\b/i)
    assert.doesNotMatch(await page.locator('body').evaluate(element => element.innerHTML), /facilityConditions|baseChance|stableModifier|degraded/i)
    assert.equal(await page.locator('.wordmark').innerText(), 'EXIT SEQUENCE')
    assert.equal(await page.locator('#status-position').innerText(), 'POSITION 01/15')
    assert.equal(await page.locator('#status-power').innerText(), 'POWER 20/20')

    if (layout.width === 320) {
      await page.evaluate(() => { window.__originalFirstLine = document.querySelector('.console-line') })
      const priorLines = await page.locator('#transcript .console-line:not(.prompt-line)').allInnerTexts()
      const selectedLabel = await page.locator('.action-command:not(:disabled) .command-number').nth(1).innerText()
      const dockTop = measurements.dock.top
      await page.locator('.action-command:not(:disabled)').nth(1).tap()
      const dockTopWhileOutputRuns = (await page.locator('.command-dock').boundingBox()).y
      assert.ok(Math.abs(dockTopWhileOutputRuns - dockTop) <= 1, 'the input dock stays fixed while the selected line is written')
      const powerBeforeSpin = await page.locator('#status-power').innerText()
      await page.locator('.slot-line').waitFor()
      assert.equal(await page.locator('#status-power').innerText(), powerBeforeSpin, 'power does not change before the slot is stopped')
      const oldRoll = await page.locator('.slot-number').innerText()
      const logRowsAtSpin = await page.locator('#transcript .console-line').count()
      await page.waitForFunction(previous => document.querySelector('.slot-number')?.textContent !== previous, oldRoll)
      assert.equal(await page.locator('#transcript .console-line').count(), logRowsAtSpin, 'slot updates do not append log rows')
      await page.keyboard.press('1')
      await page.locator('.action-command:disabled').first().evaluate(button => button.click())
      assert.equal(await page.locator('.slot-line').count(), 1, 'keyboard and disabled-choice input cannot begin another action during a roll')
      assert.equal(await page.locator('#status-position').innerText(), 'POSITION 01/15')
      const rollRow = page.locator('.slot-number')
      await rollRow.tap()
      const stoppedRoll = await rollRow.innerText()
      await page.waitForSelector('.line-good, .line-bad')
      await page.waitForTimeout(80)
      assert.equal(await rollRow.innerText(), stoppedRoll, 'the tapped number is frozen')
      assert.ok((await page.locator('.line-good, .line-bad').last().innerText()).length < 12, 'the slot tap does not also skip the result typewriter')
      assert.equal(await page.locator('#status-position').innerText(), 'POSITION 01/15', 'position remains unchanged until result output completes')
      await waitForChoices(page)
    const resultText = await page.locator('#transcript').innerText()
      const promptRows = await page.locator('#transcript .prompt-line').allInnerTexts()
      const selectedAction = selectedLabel.replace(/^\[2\]\s*/, '')
      assert.equal(promptRows.length, 2, 'the selected command remains as a past prompt line and the next event gets a new prompt')
      assert.equal(promptRows[0], `> 2. ${selectedAction}`, 'the selection number and action name share the prompt line')
      assert.match(promptRows[1], /^>\s*$/, 'the new event has a fresh prompt')
      const loggedLines = await page.locator('#transcript .console-line').allInnerTexts()
      assert.ok(loggedLines.some(line => /^成功率 \d+%$/.test(line)), 'the selected integer rate is logged')
      assert.ok(loggedLines.some(line => /^\[ROLL\] \d{2}/.test(line)), 'the final two-digit roll remains in log history')
      assert.ok(loggedLines.some(line => /^\[(?:SUCCESS|FAILED)\]/.test(line)), 'the matching result follows the roll')
      assert.ok(resultText.indexOf(promptRows[0]) < Math.max(resultText.indexOf('[SUCCESS]'), resultText.indexOf('[FAILED]')), 'the committed choice appears before its result')
      assert.ok(Math.max(resultText.indexOf('[SUCCESS]'), resultText.indexOf('[FAILED]')) < resultText.lastIndexOf('[EVENT]'), 'the result precedes the next event')
      assert.doesNotMatch(resultText, /\[(?:ACTION|STATUS|POSITION|MOVE)\]/, 'duplicate action and status log lines are omitted')
      const priorLinesAfter = await page.locator('#transcript .console-line:not(.prompt-line)').allInnerTexts()
      assert.deepEqual(priorLinesAfter.slice(0, priorLines.length), priorLines, 'past console lines stay in order')
      assert.match(await page.locator('#status-position').innerText(), /02\/15/)
      const powerDelta = resultText.match(/\[(?:SUCCESS|FAILED)\] 電力 ([+-]?\d+)/)
      assert.ok(powerDelta, 'action result includes the actual power change')
      const statusPower = (await page.locator('#status-power').innerText()).match(/POWER (\d+)\/20/)
      assert.ok(statusPower, 'power status keeps the compact value format')
      assert.equal(Number(statusPower[1]), Math.max(0, Math.min(20, 20 + Number(powerDelta[1]))), 'top power status matches the game result')
      assert.equal(await page.evaluate(() => window.__originalFirstLine === document.querySelector('.console-line')), true, 'existing log DOM node is reused')

      await finishCurrentTurn(page, 0)
      await finishCurrentTurn(page, 0)
      await finishCurrentTurn(page, 0)
      const dockTopAfterMoreLogs = (await page.locator('.command-dock').boundingBox()).y
      assert.ok(Math.abs(dockTopAfterMoreLogs - dockTop) <= 1, 'new log output does not move the input dock')
      const canScroll = await page.locator('.console-window').evaluate(element => element.scrollHeight > element.clientHeight)
      assert.equal(canScroll, true, 'long run logs scroll inside the console')
      await page.locator('.console-window').evaluate(element => { element.scrollTop = 0 })
      await page.locator('#latest-log').waitFor({ state: 'visible' })
      const previousSlotRows = await page.locator('.slot-line').count()
      await page.locator('.action-command:not(:disabled)').first().click()
      await page.waitForFunction(previous => document.querySelectorAll('.slot-line').length > previous, previousSlotRows)
      const activeSlot = page.locator('.slot-line').last()
      const slotBounds = await activeSlot.boundingBox()
      const consoleBounds = await page.locator('.console-window').boundingBox()
      assert.ok(slotBounds.y >= consoleBounds.y && slotBounds.y + slotBounds.height <= consoleBounds.y + consoleBounds.height, 'the active roll is scrolled into view')
      await page.locator('.console-window').evaluate(element => { element.scrollTop = 0 })
      await page.locator('#latest-log').waitFor({ state: 'visible' })
      await page.locator('#latest-log').click()
      assert.equal(await page.locator('#latest-log').isVisible(), false, 'latest log control returns to the tail')
      assert.equal(await page.locator('.slot-line').count(), previousSlotRows + 1, 'using the log scroll control does not stop the slot')
      await page.keyboard.press('Space')
      await waitForChoices(page)
      const latestCursor = await page.locator('#transcript .console-cursor').boundingBox()
      const logBounds = await page.locator('.console-window').boundingBox()
      assert.ok(latestCursor && latestCursor.y >= logBounds.y && latestCursor.y + latestCursor.height <= logBounds.y + logBounds.height, 'latest prompt is actually visible inside the log viewport')
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320)
    } else if (layout.width === 390) {
      await page.keyboard.press('2')
      await page.locator('.slot-line').waitFor()
      await page.keyboard.press('Space')
      await waitForChoices(page)
      assert.match((await page.locator('#transcript .prompt-line').first().innerText()), /^> 2\. /, 'number keys also commit a prompt history line')
      assert.match(await page.locator('#status-position').innerText(), /02\/15/)
    } else if (layout.width === 1280) {
      assert.ok(measurements.buttons.every(button => button.width < 760), 'desktop console is centered and width-limited')
      await page.locator('.action-command:not(:disabled)').nth(1).click()
      await page.locator('.slot-line').waitFor()
      await page.keyboard.press('Enter')
      await waitForChoices(page)
      const slotsBeforeKeyboardChoice = await page.locator('.slot-line').count()
      await page.keyboard.press('3')
      await page.waitForFunction(previous => document.querySelectorAll('.slot-line').length > previous, slotsBeforeKeyboardChoice)
      await page.mouse.click(700, 700)
      await waitForChoices(page)
      assert.match(await page.locator('#status-position').innerText(), /03\/15/)
      assert.match((await page.locator('#transcript .prompt-line').nth(1).innerText()), /^> 3\. /, 'a later numeric choice is retained in the log')
    } else {
      const slotsBeforeTap = await page.locator('.slot-line').count()
      await page.locator('.action-command:not(:disabled)').last().tap()
      await page.waitForFunction(previous => document.querySelectorAll('.slot-line').length > previous, slotsBeforeTap)
      await page.locator('.slot-line').last().tap()
      await waitForChoices(page)
      assert.match((await page.locator('#transcript .prompt-line').first().innerText()), /^> 3\. /, 'landscape tap appends the selected command')
    }

    assert.deepEqual(errors, [], `no browser errors at ${layout.width}×${layout.height}`)
    console.log(`browser layout ${layout.width}×${layout.height}: ok`)
    await context.close()
  }

  const eventSeeds = new Map()
  for (let seed = 0; seed < 10000 && eventSeeds.size < EVENTS.length; seed++) {
    const id = createGame(createSeededRandom(seed), seed).currentEvent.eventId
    if (!eventSeeds.has(id)) eventSeeds.set(id, seed)
  }
  assert.equal(eventSeeds.size, EVENTS.length, 'a deterministic seed is available for each event')
  const imageContext = await browser.newContext({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' })
  const imagePage = await imageContext.newPage()
  imagePage.setDefaultTimeout(5000)
  for (const definition of EVENTS) {
    await imagePage.goto(`${base}?seed=${eventSeeds.get(definition.id)}`)
    await waitForChoices(imagePage)
    await imagePage.waitForFunction(() => {
      const image = document.querySelector('#event-image')
      return image?.complete && image.naturalWidth === 320 && image.naturalHeight === 200
    })
    const image = await imagePage.locator('#event-image').evaluate(element => ({ id: element.dataset.eventId, src: element.currentSrc, alt: element.alt }))
    assert.equal(image.id, definition.id, `${definition.id} is selected by its event ID`)
    assert.ok(image.src.endsWith(`/events/${definition.id}.svg`), `${definition.id} maps to its own local SVG`)
    assert.equal(image.alt, `${definition.title}の設備`, `${definition.id} image has descriptive alternative text`)
    assertRegions(await measureRegions(imagePage), { width: 320, height: 640 })
    const choiceRows = await imagePage.locator('.action-command').allInnerTexts()
    const choices = await imagePage.locator('#command-dock').innerText()
    assert.equal(choiceRows.length, 3, `${definition.id} has one row for each action`)
    assert.ok(choiceRows.every((row, index) => {
      const text = row.replace(/\s+/g, ' ')
      return text.startsWith(`[${index + 1}]`) && /[+-]?\d+\/[+-]?\d+$/.test(text)
    }), `${definition.id} shows compact power changes on each one-line option`)
    assert.ok(choiceRows.every(row => !row.includes('…')), `${definition.id} action names are not ellipsized`)
    assert.ok(choiceRows.every(row => /\d+%/.test(row)), `${definition.id} shows integer success rates`)
    for (const action of definition.actions) assert.ok(!choices.includes(action.detail), `${definition.id} keeps action detail off the three visible rows`)
  }
  await imageContext.close()
  console.log('event illustrations: all ten IDs load their own shaded local SVG')

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
  assert.equal(await reducedPage.locator('.console-cursor').evaluate(element => getComputedStyle(element).visibility), 'visible', 'Reduced Motion keeps the waiting cursor visible without animation')
  await reducedPage.keyboard.press('1')
  await reducedPage.locator('.slot-line').waitFor()
  const reducedRoll = await reducedPage.locator('.slot-number').innerText()
  assert.match(reducedRoll, /^\d{2}$/)
  await reducedPage.waitForTimeout(120)
  assert.equal(await reducedPage.locator('.slot-number').innerText(), reducedRoll, 'Reduced Motion keeps the initial random roll still')
  assert.equal(await reducedPage.locator('#status-position').innerText(), 'POSITION 01/15', 'position waits for a reduced-motion slot stop')
  await reducedPage.keyboard.press('Enter')
  await waitForChoices(reducedPage)
  assert.match(await reducedPage.locator('#status-position').innerText(), /02\/15/)
  assert.match(await reducedPage.locator('#transcript .prompt-line').first().innerText(), /^> 1\. /)
  assert.doesNotMatch(await reducedPage.locator('#transcript').innerText(), /\[(?:ACTION|STATUS|POSITION|MOVE)\]/)
  console.log('reduced motion full output and keyboard action: ok')
  await reducedContext.close()

  const visibilityContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const visibilityPage = await visibilityContext.newPage()
  visibilityPage.setDefaultTimeout(5000)
  await visibilityPage.goto(`${base}?seed=123456`)
  await skipOutput(visibilityPage)
  const slotsBeforeVisibility = await visibilityPage.locator('.slot-line').count()
  await visibilityPage.locator('.action-command:not(:disabled)').first().click()
  await visibilityPage.waitForFunction(previous => document.querySelectorAll('.slot-line').length > previous, slotsBeforeVisibility)
  await visibilityPage.evaluate(() => {
    let hidden = true
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
    document.dispatchEvent(new Event('visibilitychange'))
    window.__setDocumentHidden = value => { hidden = value; document.dispatchEvent(new Event('visibilitychange')) }
  })
  const hiddenRoll = await visibilityPage.locator('.slot-line').last().locator('.slot-number').innerText()
  await visibilityPage.waitForTimeout(160)
  assert.equal(await visibilityPage.locator('.slot-line').last().locator('.slot-number').innerText(), hiddenRoll, 'hidden tabs pause the rolling digits')
  await visibilityPage.evaluate(() => window.__setDocumentHidden(false))
  await visibilityPage.waitForFunction(previous => document.querySelector('.slot-line:last-child .slot-number')?.textContent !== previous, hiddenRoll)
  await visibilityPage.keyboard.press('Enter')
  await waitForChoices(visibilityPage)
  console.log('hidden-tab pause and resume: ok')
  await visibilityContext.close()

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const page = await context.newPage()
  page.setDefaultTimeout(5000)
  await forceSlotValue(page, 4_294_967_199)
  await page.goto(`${base}?seed=1`)
  await skipOutput(page)
  for (let turn = 0; turn < 15 && await page.locator('.action-command:not(:disabled)').count() > 0; turn++) {
    const slotsBefore = await page.locator('.slot-line').count()
    await page.locator('.action-command:not(:disabled)').last().tap()
    await page.waitForFunction(previous => document.querySelectorAll('.slot-line').length > previous, slotsBefore)
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => document.querySelector('.action-command:not(:disabled)') || document.querySelector('[data-restart]'))
  }
  await page.locator('[data-restart]').waitFor()
  const finishedText = await page.locator('#transcript').innerText()
  assert.match(finishedText, /\[GAME OVER\]/)
  const endingLine = await page.locator('#transcript .console-line').last().innerText()
  assert.equal(endingLine, '[GAME OVER] 電力が尽きた')
  assert.doesNotMatch(endingLine, /残存電力|\/ 15|\/ 20/)
  assert.equal(await page.locator('#transcript .console-cursor').count(), 0, 'terminal states do not leave a waiting cursor')
  const failedAndGameOverColors = await page.evaluate(() => [...document.querySelectorAll('.line-bad')].map(line => getComputedStyle(line).color))
  assert.ok(failedAndGameOverColors.length >= 2 && failedAndGameOverColors.every(color => color === 'rgb(79, 214, 106)'), '[FAILED] and [GAME OVER] stay green')
  assert.equal(await page.locator('.restart-button').evaluate(button => getComputedStyle(button).color), 'rgb(79, 214, 106)', 'restart text stays green')
  const finishedPosition = await page.locator('#status-position').innerText()
  assert.match(await page.locator('#status-power').innerText(), /POWER 0\/20/)
  await page.keyboard.press('1')
  assert.equal(await page.locator('#status-position').innerText(), finishedPosition)
  await page.locator('[data-restart]').tap()
  assert.match(await page.locator('#status-position').innerText(), /01\/15/)
  await waitForChoices(page)
  assert.match(await page.locator('#transcript').innerText(), /\[SYSTEM\] 脱出シーケンス開始/)
  assert.doesNotMatch(await page.locator('#transcript').innerText(), /\[CLEAR\]|\[GAME OVER\]/)
  assert.equal(await page.locator('#transcript .console-line').count(), 5, 'restart clears the previous run transcript')
  assert.equal(await page.locator('#transcript .prompt-line').count(), 1, 'restart creates one fresh prompt')
  assert.equal(await page.locator('#transcript .console-cursor').count(), 1, 'restart does not leave an old cursor behind')
  assert.doesNotMatch(await page.locator('#command-dock').innerText(), />/)
  assert.ok(new URL(page.url()).searchParams.has('seed'))
  console.log('browser game over, input lock, fresh transcript and restart: ok')
  await context.close()

  const clearContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const clearPage = await clearContext.newPage()
  clearPage.setDefaultTimeout(5000)
  await forceSlotValue(clearPage, 0)
  await clearPage.goto(`${base}?seed=1`)
  await skipOutput(clearPage)
  for (let turn = 0; turn < 15 && await clearPage.locator('.action-command:not(:disabled)').count() > 0; turn++) {
    const slotsBefore = await clearPage.locator('.slot-line').count()
    await selectBestSuccessAction(clearPage)
    await clearPage.waitForFunction(previous => document.querySelectorAll('.slot-line').length > previous, slotsBefore)
    await clearPage.keyboard.press('Enter')
    await clearPage.waitForFunction(() => document.querySelector('.action-command:not(:disabled)') || document.querySelector('[data-restart]'))
  }
  await clearPage.locator('[data-restart]').waitFor()
  assert.equal(await clearPage.locator('#transcript .console-line').last().innerText(), '[CLEAR] 脱出成功')
  assert.equal(await clearPage.locator('.line-good').last().evaluate(line => getComputedStyle(line).color), 'rgb(79, 214, 106)', '[SUCCESS] and [CLEAR] stay green')
  assert.match(await clearPage.locator('#status-position').innerText(), /POSITION 15\/15/)
  assert.match(await clearPage.locator('#status-power').innerText(), /POWER [1-9]\d*\/20/)
  assert.equal(await clearPage.locator('#transcript .console-cursor').count(), 0, 'clear state does not leave a waiting cursor')
  assert.doesNotMatch(await clearPage.locator('#transcript').innerText(), /\[(?:ACTION|STATUS|POSITION|MOVE)\]/)
  console.log('browser clear message and final status: ok')
  await clearContext.close()
  console.log('PASS: 320px no horizontal scroll, tappable choices, output skip/input gating, ordered append-only logs, scroll preservation, keyboard/mouse/touch, reduced motion, end state and restart')
} finally {
  await browser.close()
}
