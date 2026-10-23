import { chromium } from 'playwright'
import assert from 'node:assert/strict'

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

async function watchFirstChoiceRender(page) {
  await page.addInitScript(() => {
    window.__firstChoiceRender = null
    window.__choiceRenders = []
    let lastRenderedButton = null
    const observer = new MutationObserver(() => {
      const buttons = [...document.querySelectorAll('#command-list .action-command')]
      if (buttons.length === 0) {
        lastRenderedButton = null
        return
      }
      if (buttons[0] === lastRenderedButton) return
      lastRenderedButton = buttons[0]
      const render = {
        count: buttons.length,
        disabled: buttons.map(button => button.disabled),
        labels: buttons.map(button => button.querySelector('.command-number')?.textContent ?? ''),
        details: buttons.map(button => button.querySelector('.command-detail')?.textContent ?? ''),
        promptReady: !!document.querySelector('#transcript .prompt-line .console-cursor'),
      }
      window.__choiceRenders.push(render)
      if (window.__firstChoiceRender === null) window.__firstChoiceRender = render
    })
    observer.observe(document, { childList: true, subtree: true })
  })
}

async function assertGreenConsole(page) {
  const colors = await page.evaluate(() => {
    const selectors = [
      '.wordmark', '#status-position', '#status-power', '.transcript',
      '.command-heading', '.action-command', '.command-number', '.command-detail',
      '.prompt-prefix', '.console-cursor', '.restart-button',
    ]
    const rootColor = getComputedStyle(document.documentElement).color
    return {
      rootColor,
      textColors: selectors.flatMap(selector => [...document.querySelectorAll(selector)].map(element => getComputedStyle(element).color)),
      resultColors: [...document.querySelectorAll('.line-good, .line-bad')].map(element => getComputedStyle(element).color),
    }
  })
  assert.equal(colors.rootColor, 'rgb(124, 255, 152)', 'the console uses one bright green text color')
  assert.ok(colors.textColors.length > 0 && colors.textColors.every(color => color === colors.rootColor), 'status, log, options, prompt and restart text stay green')
  assert.ok(colors.resultColors.every(color => color === colors.rootColor), 'success, failure, clear and game-over lines use the same green')
}

async function assertFixedTextSizes(page) {
  const sizes = await page.evaluate(() => ({
    title: getComputedStyle(document.querySelector('.wordmark')).fontSize,
    status: getComputedStyle(document.querySelector('#status-position')).fontSize,
    heading: getComputedStyle(document.querySelector('.command-heading')).fontSize,
    action: getComputedStyle(document.querySelector('.command-number')).fontSize,
    detail: getComputedStyle(document.querySelector('.command-detail')).fontSize,
  }))
  assert.deepEqual(sizes, { title: '18px', status: '15px', heading: '14px', action: '15px', detail: '14px' })
}

async function finishCurrentTurn(page, index = 0) {
  const position = await page.locator('#status-position').innerText()
  await page.locator('.action-command:not(:disabled)').nth(index).click()
  await page.waitForFunction(previous => document.querySelector('#status-position')?.textContent !== previous, position)
  await page.keyboard.press('Space')
  await waitForChoices(page)
}

async function measureRegions(page) {
  return page.evaluate(() => {
    const rect = selector => {
      const { top, right, bottom, left, width, height } = document.querySelector(selector).getBoundingClientRect()
      return { top, right, bottom, left, width, height }
    }
    return {
      viewport: { width: innerWidth, height: innerHeight },
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      shell: rect('.terminal-shell'),
      status: rect('.status-bar'),
      log: rect('.console-window'),
      dock: rect('.command-dock'),
      logOverflow: getComputedStyle(document.querySelector('.console-window')).overflowY,
      dockOverflow: getComputedStyle(document.querySelector('.command-dock')).overflowY,
      buttons: [...document.querySelectorAll('.action-command')].map(button => {
        const { top, right, bottom, left, width, height } = button.getBoundingClientRect()
        return { top, right, bottom, left, width, height }
      }),
      dockScrollHeight: document.querySelector('.command-dock').scrollHeight,
      dockClientHeight: document.querySelector('.command-dock').clientHeight,
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
  assert.ok(measurements.log.bottom <= measurements.dock.top + 1, 'log does not overlap the fixed input dock')
  assert.ok(measurements.dock.bottom <= measurements.shell.bottom + 1, 'input dock stays inside the safe-area padded shell')
  assert.ok(measurements.log.height > 0, 'central log retains a scrollable viewport')
  assert.equal(measurements.logOverflow, 'auto', 'only the log scrolls vertically in the middle region')
  assert.equal(measurements.dockOverflow, 'auto', 'the input dock can scroll internally on short screens')
  assert.deepEqual(measurements.overflowing, [], `no clipped console or choice text at ${layout.width}px`)
  assert.ok(measurements.buttons.every(button => button.left >= measurements.dock.left - 1 && button.right <= measurements.dock.right + 1), 'choices stay inside the input dock')
  assert.ok(measurements.buttons.every(button => button.height >= 44), 'choice tap areas are at least 44px high')
  assert.ok(measurements.buttons.some(button => button.top < measurements.dock.bottom && button.bottom > measurements.dock.top), 'the input dock shows an available choice')
  assert.ok(measurements.dockScrollHeight >= measurements.dockClientHeight, 'the dock exposes all choices through its visible area or internal scrolling')
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
    await watchFirstChoiceRender(page)
    await page.goto(`${base}?seed=123456`)

    const eventDescription = page.locator('#transcript .console-line').nth(2)
    await page.waitForFunction(() => document.querySelectorAll('#transcript .console-line')[2]?.textContent?.length > 0)
    const descriptionStarted = (await eventDescription.innerText()).length
    await page.waitForTimeout(40)
    const descriptionAdvanced = (await eventDescription.innerText()).length
    assert.ok(descriptionAdvanced > descriptionStarted && descriptionAdvanced < 30, 'event descriptions stream through the central log a character at a time')
    assert.equal(await page.locator('.action-command').count(), 0, 'choices stay hidden while the event log is still being written')
    await page.keyboard.press('1')
    assert.match(await page.locator('#status-position').innerText(), /01 \/ 15/, 'actions cannot be selected while the event log is running')
    await page.locator('.action-command').first().waitFor()
    const firstChoiceRender = await page.evaluate(() => window.__firstChoiceRender)
    assert.equal(firstChoiceRender.count, 3, 'all three choices are created in the first input render')
    assert.deepEqual(firstChoiceRender.disabled, [false, false, false], 'all choices are enabled as soon as the event log ends')
    assert.ok(firstChoiceRender.labels.every(label => label.length > 4), 'action names are complete when choices first appear')
    assert.ok(firstChoiceRender.details.every(detail => detail.includes('成功') && detail.includes('失敗')), 'descriptions and both power changes are complete on first render')
    assert.equal(firstChoiceRender.promptReady, true, 'the log prompt and cursor appear with the immediately available choices')

    await skipOutput(page)

    const measurements = await measureRegions(page)
    assertRegions(measurements, layout)
    await assertGreenConsole(page)
    await assertFixedTextSizes(page)

    const dockTop = measurements.dock.top
    const logTop = measurements.log.top
    await page.locator('.command-dock').evaluate(element => { element.scrollTop = element.scrollHeight })
    const finalChoice = await page.locator('.action-command').last().boundingBox()
    const dockAfterScroll = await page.locator('.command-dock').boundingBox()
    const logAfterDockScroll = await page.locator('.console-window').boundingBox()
    assert.ok(finalChoice && finalChoice.y >= dockAfterScroll.y - 1 && finalChoice.y + finalChoice.height <= dockAfterScroll.y + dockAfterScroll.height + 1, 'the last choice is reachable by scrolling inside the dock')
    assert.ok(Math.abs(dockAfterScroll.y - dockTop) <= 1 && Math.abs(logAfterDockScroll.y - logTop) <= 1, 'scrolling choices leaves the input dock fixed and the log in its own region')
    await page.locator('.command-dock').evaluate(element => { element.scrollTop = 0 })

    const firstChoice = page.locator('.action-command:not(:disabled)').first()
    await firstChoice.hover()
    assert.equal(await firstChoice.evaluate(element => getComputedStyle(element).color), 'rgb(124, 255, 152)', 'choice hover keeps green text')
    await firstChoice.focus()
    assert.equal(await firstChoice.evaluate(element => getComputedStyle(element).color), 'rgb(124, 255, 152)', 'choice focus keeps green text')

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
    assert.match(bodyText, /\[SELECT ACTION\]/)
    assert.match(bodyText, /\[1\]/)
    assert.doesNotMatch(bodyText, /(?:0|[1-9]\d?)\s*%|facilityConditions|\b(?:stable|degraded)\b/i)
    assert.equal(await page.locator('.wordmark').innerText(), 'EXIT SEQUENCE')
    assert.match(await page.locator('#status-position').innerText(), /\[POSITION\] 01 \/ 15/)
    assert.match(await page.locator('#status-power').innerText(), /\[POWER\] 20 \/ 20/)

    if (layout.width === 320) {
      await page.evaluate(() => { window.__originalFirstLine = document.querySelector('.console-line') })
      const priorLines = await page.locator('#transcript .console-line:not(.prompt-line)').allInnerTexts()
      const selectedLabel = await page.locator('.action-command:not(:disabled) .command-number').nth(1).innerText()
      await page.locator('.action-command:not(:disabled)').nth(1).tap()
      const dockTopWhileOutputRuns = (await page.locator('.command-dock').boundingBox()).y
      assert.ok(Math.abs(dockTopWhileOutputRuns - dockTop) <= 1, 'the input dock stays fixed while the selected line is written')
      await page.keyboard.press('1')
      await waitForChoices(page)
      const resultText = await page.locator('#transcript').innerText()
      const promptRows = await page.locator('#transcript .prompt-line').allInnerTexts()
      const selectedAction = selectedLabel.replace(/^\[2\]\s*/, '')
      assert.equal(promptRows.length, 2, 'the selected command remains as a past prompt line and the next event gets a new prompt')
      assert.equal(promptRows[0], `> 2. ${selectedAction}`, 'the selection number and action name share the prompt line')
      assert.match(promptRows[1], /^>\s*$/, 'the new event has a fresh prompt')
      assert.match(resultText, /\[SUCCESS\]|\[FAILED\]/)
      assert.ok(resultText.indexOf(promptRows[0]) < Math.max(resultText.indexOf('[SUCCESS]'), resultText.indexOf('[FAILED]')), 'the committed choice appears before its result')
      assert.ok(Math.max(resultText.indexOf('[SUCCESS]'), resultText.indexOf('[FAILED]')) < resultText.lastIndexOf('[EVENT]'), 'the result precedes the next event')
      assert.doesNotMatch(resultText, /\[(?:ACTION|STATUS|POSITION|MOVE)\]/, 'duplicate action and status log lines are omitted')
      const priorLinesAfter = await page.locator('#transcript .console-line:not(.prompt-line)').allInnerTexts()
      assert.deepEqual(priorLinesAfter.slice(0, priorLines.length), priorLines, 'past console lines stay in order')
      assert.match(await page.locator('#status-position').innerText(), /02 \/ 15/)
      const powerDelta = resultText.match(/\[(?:SUCCESS|FAILED)\] 電力 ([+-]?\d+)/)
      assert.ok(powerDelta, 'action result includes the actual power change')
      assert.equal(Number((await page.locator('#status-power').innerText()).match(/\d+ \/ 20/)?.[0].split(' ')[0]), Math.max(0, Math.min(20, 20 + Number(powerDelta[1]))), 'top power status matches the game result')
      assert.equal(await page.evaluate(() => window.__originalFirstLine === document.querySelector('.console-line')), true, 'existing log DOM node is reused')
      await assertGreenConsole(page)

      await finishCurrentTurn(page, 0)
      await finishCurrentTurn(page, 0)
      await finishCurrentTurn(page, 0)
      const dockTopAfterMoreLogs = (await page.locator('.command-dock').boundingBox()).y
      assert.ok(Math.abs(dockTopAfterMoreLogs - dockTop) <= 1, 'new log output does not move the input dock')
      const canScroll = await page.locator('.console-window').evaluate(element => element.scrollHeight > element.clientHeight)
      assert.equal(canScroll, true, 'long run logs scroll inside the console')
      await page.locator('.console-window').evaluate(element => { element.scrollTop = 0 })
      await page.locator('#latest-log').waitFor({ state: 'visible' })
      await finishCurrentTurn(page, 0)
      assert.equal(await page.locator('.console-window').evaluate(element => element.scrollTop), 0, 'reading old output does not auto-scroll to the tail')
      await page.locator('#latest-log').click()
      assert.equal(await page.locator('#latest-log').isVisible(), false, 'latest log control returns to the tail')
      const latestCursor = await page.locator('#transcript .console-cursor').boundingBox()
      const logBounds = await page.locator('.console-window').boundingBox()
      assert.ok(latestCursor && latestCursor.y >= logBounds.y && latestCursor.y + latestCursor.height <= logBounds.y + logBounds.height, 'latest prompt is actually visible inside the log viewport')
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320)
    } else if (layout.width === 390) {
      await page.keyboard.press('2')
      await waitForChoices(page)
      assert.match((await page.locator('#transcript .prompt-line').first().innerText()), /^> 2\. /, 'number keys also commit a prompt history line')
      assert.match(await page.locator('#status-position').innerText(), /02 \/ 15/)
    } else if (layout.width === 1280) {
      assert.ok(measurements.buttons.every(button => button.width < 760), 'desktop console is centered and width-limited')
      await page.locator('.action-command:not(:disabled)').nth(1).click()
      await waitForChoices(page)
      await page.keyboard.press('3')
      await waitForChoices(page)
      assert.match(await page.locator('#status-position').innerText(), /03 \/ 15/)
      assert.match((await page.locator('#transcript .prompt-line').nth(1).innerText()), /^> 3\. /, 'a later numeric choice is retained in the log')
    } else {
      await page.locator('.action-command:not(:disabled)').last().tap()
      await waitForChoices(page)
      assert.match((await page.locator('#transcript .prompt-line').first().innerText()), /^> 3\. /, 'landscape tap appends the selected command')
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
  assert.equal(await reducedPage.locator('.console-cursor').evaluate(element => getComputedStyle(element).visibility), 'visible', 'Reduced Motion keeps the waiting cursor visible without animation')
  await reducedPage.keyboard.press('1')
  await waitForChoices(reducedPage)
  assert.match(await reducedPage.locator('#status-position').innerText(), /02 \/ 15/)
  assert.match(await reducedPage.locator('#transcript .prompt-line').first().innerText(), /^> 1\. /)
  assert.doesNotMatch(await reducedPage.locator('#transcript').innerText(), /\[(?:ACTION|STATUS|POSITION|MOVE)\]/)
  console.log('reduced motion full output and keyboard action: ok')
  await reducedContext.close()

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const page = await context.newPage()
  page.setDefaultTimeout(5000)
  await watchFirstChoiceRender(page)
  await page.goto(`${base}?seed=1`)
  await skipOutput(page)
  const skippedChoiceRender = await page.evaluate(() => window.__firstChoiceRender)
  assert.equal(skippedChoiceRender.count, 3, 'skipping the opening log renders all choices immediately')
  assert.deepEqual(skippedChoiceRender.disabled, [false, false, false])
  assert.ok(skippedChoiceRender.details.every(detail => detail.includes('成功') && detail.includes('失敗')))
  for (let turn = 0; turn < 15 && await page.locator('.action-command:not(:disabled)').count() > 0; turn++) {
    await page.locator('.action-command:not(:disabled)').last().tap()
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
  await assertGreenConsole(page)
  assert.equal(await page.locator('.restart-button').evaluate(element => getComputedStyle(element).color), 'rgb(124, 255, 152)', 'restart text stays green')
  const finishedPosition = await page.locator('#status-position').innerText()
  assert.match(await page.locator('#status-power').innerText(), /\[POWER\] 0 \/ 20/)
  await page.keyboard.press('1')
  assert.equal(await page.locator('#status-position').innerText(), finishedPosition)
  const rendersBeforeRestart = await page.evaluate(() => window.__choiceRenders.length)
  await page.locator('[data-restart]').tap()
  assert.match(await page.locator('#status-position').innerText(), /01 \/ 15/)
  await waitForChoices(page)
  assert.match(await page.locator('#transcript').innerText(), /\[SYSTEM\] 脱出シーケンス開始/)
  assert.doesNotMatch(await page.locator('#transcript').innerText(), /\[CLEAR\]|\[GAME OVER\]/)
  assert.equal(await page.locator('#transcript .console-line').count(), 5, 'restart clears the previous run transcript')
  assert.equal(await page.locator('#transcript .prompt-line').count(), 1, 'restart creates one fresh prompt')
  assert.equal(await page.locator('#transcript .console-cursor').count(), 1, 'restart does not leave an old cursor behind')
  assert.doesNotMatch(await page.locator('#command-dock').innerText(), />/)
  assert.ok(new URL(page.url()).searchParams.has('seed'))
  const rendersAfterRestart = await page.evaluate(() => window.__choiceRenders.length)
  assert.equal(rendersAfterRestart, rendersBeforeRestart + 1, 'restart renders one fresh choice panel after clearing the previous list')
  const restartedChoiceRender = await page.evaluate(() => window.__choiceRenders.at(-1))
  assert.equal(restartedChoiceRender.count, 3, 'a restarted run displays all choices with the same immediate render')
  assert.deepEqual(restartedChoiceRender.disabled, [false, false, false])
  assert.ok(restartedChoiceRender.details.every(detail => detail.includes('成功') && detail.includes('失敗')))
  console.log('browser game over, input lock, fresh transcript and restart: ok')
  await context.close()

  const clearContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const clearPage = await clearContext.newPage()
  clearPage.setDefaultTimeout(5000)
  await clearPage.goto(`${base}?seed=1`)
  await skipOutput(clearPage)
  for (let turn = 0; turn < 15 && await clearPage.locator('.action-command:not(:disabled)').count() > 0; turn++) {
    await clearPage.locator('.action-command:not(:disabled)').first().tap()
    await clearPage.keyboard.press('Enter')
    await clearPage.waitForFunction(() => document.querySelector('.action-command:not(:disabled)') || document.querySelector('[data-restart]'))
  }
  await clearPage.locator('[data-restart]').waitFor()
  assert.equal(await clearPage.locator('#transcript .console-line').last().innerText(), '[CLEAR] 脱出成功')
  assert.match(await clearPage.locator('#status-position').innerText(), /\[POSITION\] 15 \/ 15/)
  assert.match(await clearPage.locator('#status-power').innerText(), /\[POWER\] [1-9]\d* \/ 20/)
  assert.equal(await clearPage.locator('#transcript .console-cursor').count(), 0, 'clear state does not leave a waiting cursor')
  await assertGreenConsole(clearPage)
  assert.doesNotMatch(await clearPage.locator('#transcript').innerText(), /\[(?:ACTION|STATUS|POSITION|MOVE)\]/)
  console.log('browser clear message and final status: ok')
  await clearContext.close()
  console.log('PASS: 320px no horizontal scroll, tappable choices, output skip/input gating, ordered append-only logs, scroll preservation, keyboard/mouse/touch, reduced motion, end state and restart')
} finally {
  await browser.close()
}
