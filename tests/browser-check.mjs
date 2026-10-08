import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { t, LANGUAGE_STORAGE_KEY } from '../src/i18n.ts'
import { Game } from '../src/game.ts'
import { toolkit, lightRobot, toolSeal, toolPower, launch, newcomer, expert, remembered, decoyRoute, equipmentRoute, manualRoute, refillRoute, injuryOver, oxygenOver, launchOver } from './routes.ts'
const url = process.env.EXIT_SEQUENCE_URL ?? 'http://127.0.0.1:5173/exit-sequence/'
const artifactDir = process.env.EXIT_SEQUENCE_ARTIFACTS ?? '/tmp/exit-sequence-browser'
await mkdir(artifactDir, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
const report = []
try {
  for (const language of ['ja', 'en']) {
    const context = await browser.newContext({ viewport: { width: 320, height: 640 }, locale: language, reducedMotion: 'reduce', isMobile: true, hasTouch: true })
    const page = await context.newPage(), errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(language => { if (!localStorage.getItem('exit-sequence-language')) localStorage.setItem('exit-sequence-language', language) }, language)
    // Read-only test access injected into the dev response, never shipped.
    await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
      const response = await route.fetch()
      await route.fulfill({ response, body: await response.text() + '\nglobalThis.__exitTest = { state: () => structuredClone(game.state), snapshot: () => structuredClone({ state: game.state, history, choices: game.choices(), started }) };' })
    })
    await page.goto(url); await page.waitForFunction(() => !!globalThis.__exitTest)
    const state = () => page.evaluate(() => globalThis.__exitTest.state())
    const snapshot = () => page.evaluate(() => globalThis.__exitTest.snapshot())
    const reference = new Game()
    let wrappedChoiceSeen = false
    const prose = () => page.locator('.terminal-log').innerText()
    const click = label => page.getByRole('button', { name: label, exact: true }).tap()
    const checked = name => report.push({ language, width: 320, check: name, result: 'pass' })
    async function layout() {
      const actual = await page.evaluate(() => {
        const rect = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height } }
        const terminal = document.querySelector('.terminal'), css = getComputedStyle(terminal)
        return { width: document.documentElement.scrollWidth, viewport: innerWidth, height: innerHeight,
          buttons: [...document.querySelectorAll('button')].filter(b => b.getClientRects().length).map(b => ({ scroll: b.scrollWidth, client: b.clientWidth, ...rect(b) })),
          log: rect(document.querySelector('.terminal-log')), title: rect(document.querySelector('h1')),
          toggle: rect(document.querySelector('.menu-toggle')), actions: rect(document.querySelector('.terminal-actions')),
          padding: ['Top', 'Right', 'Bottom', 'Left'].map(side => parseFloat(css[`padding${side}`])),
          dropdown: document.querySelector('.language-menu').hidden ? null : rect(document.querySelector('.language-menu')) }
      })
      assert.equal(actual.width, actual.viewport); assert.equal(actual.width, 320)
      assert.ok(actual.buttons.every(b => b.scroll <= b.client && b.height >= 44 && b.x >= 0 && b.right <= 320 && b.bottom <= 640), JSON.stringify(actual))
      assert.ok(actual.log.height >= 100, JSON.stringify(actual))
      assert.ok(actual.title.right <= actual.toggle.x && actual.toggle.width >= 44)
      assert.ok(actual.padding.every(p => p >= 12))
      assert.ok(actual.toggle.y >= actual.padding[0] && actual.toggle.right <= 320 - actual.padding[1])
      assert.ok(actual.actions.bottom <= 640 - actual.padding[2])
      if (actual.dropdown) assert.ok(actual.dropdown.x >= actual.padding[3] && actual.dropdown.right <= 320 - actual.padding[1])
      assert.equal(await page.locator('nav, .terminal-navigation').count(), 0)
      const forbidden = /^(STATUS|INVENTORY|KNOWLEDGE|HELP|SETTINGS|BACK TO STORY|状態|持ち物|知った事実|遊び方|設定|物語へ戻る)$/
      assert.ok(!(await page.getByRole('button').allTextContents()).some(label => forbidden.test(label)))
      wrappedChoiceSeen ||= await page.locator('[data-choice]').evaluateAll(bs => bs.some(b => b.getBoundingClientRect().height > 44))
      return actual
    }
    async function menuCycle() {
      const before = await snapshot(), text = await prose()
      const geometry = await layout(), scroll = await page.locator('.terminal-log').evaluate(log => log.scrollTop)
      const toggle = page.getByRole('button', { name: t('menu', language), exact: true })
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false')
      assert.equal(await toggle.getAttribute('aria-controls'), 'language-menu')
      await toggle.tap(); assert.equal(await toggle.getAttribute('aria-expanded'), 'true')
      assert.deepEqual(await page.locator('.language-menu button').allTextContents(), [`${t('language', language)} >`])
      const opened = await layout(); assert.deepEqual(opened.log, geometry.log); assert.deepEqual(opened.actions, geometry.actions)
      assert.deepEqual(await snapshot(), before); assert.equal(await prose(), text)
      assert.equal(await page.locator('.terminal-log').evaluate(log => log.scrollTop), scroll)
      await toggle.tap(); assert.equal(await toggle.getAttribute('aria-expanded'), 'false')
      await toggle.tap(); await click(`${t('language', language)} >`)
      assert.deepEqual(await page.locator('.language-menu button').allTextContents(), ['日本語', 'English'])
      assert.deepEqual(await snapshot(), before); await layout()
      await page.keyboard.press('Escape'); assert.equal(await toggle.getAttribute('aria-expanded'), 'false')
      assert.equal(await toggle.evaluate(b => b === document.activeElement), true)
      await toggle.tap(); await page.locator('h1').tap(); assert.equal(await toggle.getAttribute('aria-expanded'), 'false')
      assert.deepEqual(await snapshot(), before)
      // Switch and restore the language using only real menu buttons.
      await toggle.tap(); await click(`${t('language', language)} >`); await click(language === 'ja' ? 'English' : '日本語')
      const other = language === 'ja' ? 'en' : 'ja'
      assert.deepEqual(await snapshot(), before); assert.notEqual(await prose(), text)
      assert.equal(await page.evaluate(() => document.documentElement.lang), other)
      assert.equal(await page.evaluate(key => localStorage.getItem(key), LANGUAGE_STORAGE_KEY), other)
      assert.equal(await page.getByRole('button', { name: t('menu', other), exact: true }).getAttribute('aria-expanded'), 'false')
      await click(t('menu', other)); await click(`${t('language', other)} >`); await click(language === 'ja' ? '日本語' : 'English')
      assert.deepEqual(await snapshot(), before); assert.equal(await prose(), text)
      assert.equal(await page.evaluate(() => document.documentElement.lang), language)
      assert.equal(await page.evaluate(key => localStorage.getItem(key), LANGUAGE_STORAGE_KEY), language)
      await layout()
    }
    async function choice(id) {
      const b = page.locator(`[data-choice="${id}"]`); assert.equal(await b.count(), 1, `Available: ${id}`)
      assert.ok(reference.choose(id)); await b.tap(); assert.deepEqual(await state(), reference.state); await layout()
    }
    async function restart() { reference.restart(); await click(t('restart', language)); assert.equal((await state()).scene, 'wake') }
    async function route(ids) { for (const id of ids) await choice(id) }
    assert.equal(await page.getByRole('heading', { name: 'EXIT SEQUENCE', exact: true }).count(), 1)
    assert.equal(await page.getByRole('button', { name: t('start', language), exact: true }).count(), 1)
    assert.equal((await snapshot()).started, false)
    await menuCycle(); checked('pre-START: header, START, language-only menu, toggle, outside tap, Escape, non-progression and language storage')
    await page.screenshot({ path: `${artifactDir}/start-menu-${language}-320.png` })
    await click(t('start', language)); assert.deepEqual(await state(), reference.state)
    assert.match(await prose(), language === 'ja' ? /二本の黒いこすれた跡/ : /Two black scrapes/); checked('START and perceptual introduction')
    await layout(); await page.screenshot({ path: `${artifactDir}/intro-${language}-320.png` })
    await menuCycle(); checked('playing menu and language preserve every state field, Scene, Choice and snapshot history')
    const screen = name => page.screenshot({ path: `${artifactDir}/${name}-${language}-320.png` })
    const action = id => page.locator(`[data-choice="${id}"]`)
    await route(toolkit)
    const initialRobot = await state()
    assert.deepEqual(initialRobot.knowledge, [])
    assert.equal(initialRobot.challenges.robot.attempts, 0)
    await route(['prepare-robot', 'ready-light', 'stance-upright'])
    assert.equal((await state()).challenges.robot.outcome, 'untried')
    assert.equal((await state()).scene, 'robot-act')
    await screen('prepared')
    await choice('robot-cross')
    assert.equal((await state()).status, 'playing')
    assert.equal((await state()).challenges.robot.outcome, 'failure')
    assert.equal((await state()).body, 'bruised')
    assert.match(await prose(), language === 'ja' ? /止まったのは、赤い光だけ/ : /Only the red light stopped/)
    await screen('learn-from-failure')
    await menuCycle()
    await route(['robot-result-retry', 'watch-robot'])
    assert.ok((await state()).challenges.robot.observations.includes('robot-motion'))
    assert.match(await prose(), language === 'ja' ? /配管の下のほこり/ : /Dust beneath the pipe/)
    await route(['watch-to-prep', 'ready-light', 'stance-low', 'robot-cross'])
    assert.equal((await state()).challenges.robot.outcome, 'clean')
    assert.equal((await state()).challenges.robot.attempts, 2)
    assert.equal((await state()).body, 'bruised')
    await screen('improved-retry')
    checked('observation, separate preparation slots, nonfatal failure, concrete clue and improved retry')
    await choice('robot-result-continue')
    await route(newcomer.slice(newcomer.indexOf('prepare-seal')))
    assert.equal((await state()).status, 'clear')
    assert.equal((await state()).challenges.launch.outcome, 'costly')
    await menuCycle(); await screen('newcomer-clear')
    checked('newcomer CLEAR: robot, airlock, power and final procedure mistakes repaired')
    await page.locator('.terminal-log').evaluate(log => { log.scrollTop = 0 })
    await menuCycle()
    const snapshots = (await snapshot()).history
    assert.deepEqual(snapshots[0].state.knowledge, [])
    assert.ok(!(await prose()).split('>')[0].includes(language === 'ja' ? 'アーム' : 'arm'))
    checked('language changes preserve historic Knowledge and log position')

    for (const [name, ids] of [['expert', expert], ['remembered', remembered], ['decoy', decoyRoute], ['equipment', equipmentRoute], ['manual', manualRoute], ['refill', refillRoute]]) {
      await restart(); await route(ids)
      const ending = await state()
      assert.equal(ending.status, 'clear')
      if (name === 'expert') { assert.equal(ending.body, 'normal'); assert.equal(ending.oxygen, 1) }
      if (name === 'remembered') assert.deepEqual(ending.knowledge, [])
      if (name === 'decoy' || name === 'equipment') assert.ok(!ending.items.includes('decoy'))
      if (name === 'equipment' || name === 'refill') assert.ok(!ending.items.includes('flask'))
      if (name === 'manual') assert.equal(ending.body, 'bruised')
      await menuCycle(); await screen(`${name}-clear`)
      checked(`${name} CLEAR: real operations and deterministic reference State agree`)
    }
    await restart()
    await route([...toolkit, ...lightRobot, ...toolSeal, ...toolPower, 'board-ship', 'to-electric', 'launch-ignite'])
    assert.equal((await state()).status, 'playing')
    assert.match(await prose(), language === 'ja' ? /外部ケーブルの線が赤く点滅/ : /external cable line flashes red/)
    await screen('launch-warning')
    await route(['launch-retry', 'to-pressure', 'launch-lock', 'launch-equalise', 'pressure-to-electric', 'launch-arm', 'launch-ignite'])
    assert.equal((await state()).status, 'playing')
    await route(['launch-retry', 'to-electric', 'launch-disconnect', 'launch-ignite'])
    assert.equal((await state()).status, 'clear')
    checked('launch is a sequence of individual controls, preserves valid setup and repairs two errors')
    await restart()
    await route([...toolkit, ...lightRobot, 'prepare-seal', 'patch-pipe', 'seal-to-act', 'open-airlock', 'seal-result-withdraw', 'resume-challenge'])
    assert.equal((await state()).challenges.seal.preparation.patch, 'tools')
    assert.match(await prose(), language === 'ja' ? /漏れる音はない/ : /There is no hiss/)
    await route(['prepare-seal', 'hold-pressure', 'seal-to-act', 'equalise-pressure', 'open-airlock', 'seal-result-continue', ...toolPower, ...launch])
    assert.equal((await state()).status, 'clear')
    checked('installed pipe repair survives withdrawal and retry; only temporary pressure setup resets')

    for (const [name, ids, ending] of [['injury', injuryOver, 'injury-over'], ['oxygen', oxygenOver, 'oxygen-over'], ['launch', launchOver, 'launch-over']]) {
      await restart(); await route(ids)
      assert.equal((await state()).scene, ending)
      await menuCycle(); await screen(`${name}-over`)
      assert.equal(await page.getByRole('button', { name: t('restart', language), exact: true }).count(), 1)
      checked(`${name} GAME OVER: accumulated decisions or explicitly warned fatal operation`)
    }
    await restart(); await route(['start-without-kit', 'prepare-robot', 'ready-empty', 'stance-upright', 'robot-cross', 'robot-result-retry', 'prepare-robot', 'ready-empty', 'stance-upright', 'robot-cross'])
    assert.equal((await state()).body, 'injured')
    assert.equal((await state()).threat, 2)
    assert.match(await prose(), language === 'ja' ? /移動を続けられません/ : /unable to move/)
    await route(['robot-result-retry', 'watch-robot', 'watch-to-door', 'watch-robot'])
    assert.equal((await state()).threat, 3)
    await route(['watch-to-door', 'prepare-robot', 'ready-empty', 'stance-low', 'robot-gap'])
    assert.equal((await state()).challenges.robot.outcome, 'retreat')
    await screen('high-alert-retreat')
    checked('repeated dangerous action and observation worsen air and alert; HIGH alert causes retreat')
    await route(['robot-result-withdraw', 'return-supplies', 'take-flask', 'leave-supplies', 'breathe-reserve'])
    assert.ok((await state()).oxygen < 10)
    assert.ok(!(await state()).items.includes('flask'))
    await menuCycle(); checked('withdrawal, retrieve another tool, consumable breathing use and current State prose')
    // Finish this run with remaining ordinary choices before exercising RESTART.
    await route(['resume-challenge', 'prepare-robot', 'ready-empty', 'stance-upright', 'robot-cross'])
    // Alert is high, so this returns safely; three further bad airlock-free attempts exhaust air.
    while ((await state()).status === 'playing') {
      await route(['robot-result-retry', 'prepare-robot', 'ready-empty', 'stance-upright', 'robot-cross'])
    }
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await restart()
    assert.equal(await page.locator('.terminal-log').getAttribute('aria-busy'), 'true')
    assert.ok(await page.locator('button').evaluateAll(bs => bs.every(b => b.disabled)))
    const animationState = await state()
    await page.locator('.terminal-log').tap()
    assert.deepEqual(await state(), animationState)
    assert.equal(await page.locator('.terminal-log').getAttribute('aria-busy'), 'false')
    await choice('open-supplies')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.waitForFunction(() => document.querySelector('.terminal-log').getAttribute('aria-busy') === 'false')
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await choice('take-light')
    const naturalState = await state()
    await page.waitForFunction(() => document.querySelector('.terminal-log').getAttribute('aria-busy') === 'false')
    assert.deepEqual(await state(), naturalState)
    assert.equal(await page.locator('.menu-toggle').isEnabled(), true)
    checked('typewriter lock, tap skip, live reduced-motion completion and natural completion do not progress')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    if (!wrappedChoiceSeen) {
      const target = action('take-tools'), original = await target.textContent(), before = await snapshot()
      await target.evaluate(b => { b.textContent = (b.textContent + ' ').repeat(8) })
      await layout(); assert.ok(wrappedChoiceSeen)
      assert.deepEqual(await snapshot(), before)
      await target.evaluate((b, label) => { b.textContent = label }, original); await layout()
    }
    const colors = await page.evaluate(() => ({
      text: getComputedStyle(document.querySelector('.terminal-log')).color,
      button: getComputedStyle(document.querySelector('[data-choice]')).backgroundColor,
      background: getComputedStyle(document.documentElement).backgroundColor,
      font: parseFloat(getComputedStyle(document.querySelector('.terminal-log')).fontSize),
      line: parseFloat(getComputedStyle(document.querySelector('.terminal-log')).lineHeight) }))
    assert.deepEqual(colors, { text: 'rgb(74, 222, 128)', button: 'rgb(13, 33, 29)', background: 'rgb(7, 16, 15)', font: 14, line: 25.2 })
    await page.setViewportSize({ width: 720, height: 800 })
    const wide = await page.locator('[data-choice]').evaluateAll(bs => bs.map(b => b.getBoundingClientRect().x))
    assert.ok(wide.every(x => x === wide[0])); await page.setViewportSize({ width: 320, height: 640 })
    checked('green theme, readable prose, long-label wrapping and one-column desktop Choices')
    await click(t('menu', language)); await click(`${t('language', language)} >`)
    const other = language === 'ja' ? 'en' : 'ja'
    await click(language === 'ja' ? 'English' : '日本語')
    await page.reload(); await page.waitForFunction(() => !!globalThis.__exitTest)
    assert.equal(await page.evaluate(() => document.documentElement.lang), other)
    assert.equal((await snapshot()).started, false)
    await click(t('menu', other)); await click(`${t('language', other)} >`); await click(language === 'ja' ? '日本語' : 'English')
    checked('only language is saved; reload resets game and preserves preference')
    await page.route(/\/src\/style\.css(?:\?.*)?$/, async route => {
      const response = await route.fetch(), values = { top: 24, right: 16, bottom: 20, left: 16 }
      const body = (await response.text()).replace(/env\(safe-area-inset-(top|right|bottom|left)\)/g, (_, side) => `${values[side]}px`)
      await route.fulfill({ response, body })
    })
    await page.reload(); await page.waitForFunction(() => !!globalThis.__exitTest)
    assert.deepEqual((await layout()).padding, [24, 16, 20, 16])
    reference.restart(); await click(t('start', language)); await choice('open-supplies')
    assert.equal(await page.locator('[data-choice]').count(), 5)
    await menuCycle(); await screen('safe-area-five-choices')
    checked('nonzero Safe Area, five Choices, menu and dropdown stay within 320x640')
    assert.deepEqual(errors, [])
    checked('every operation: no horizontal overflow, 44px targets, log space, forbidden panels or browser exceptions')
    await context.close()
  }
  await writeFile(`${artifactDir}/report.json`, JSON.stringify(report, null, 2) + '\n')
  console.log(`PASS: ${report.length} Chromium checks; real choices only, ja/en, 320px. Artifacts: ${artifactDir}`)
} finally { await browser.close() }
