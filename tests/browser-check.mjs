import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { t, LANGUAGE_STORAGE_KEY } from '../src/i18n.ts'
import { Game } from '../src/game.ts'
import { ordinary, informed, service, decoy, robotOver, oxygenOver, highAlert } from './routes.ts'
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
    assert.match(await prose(), language === 'ja' ? /二本の黒い擦過痕/ : /Two black scrapes/); checked('START and perceptual introduction')
    await layout(); await page.screenshot({ path: `${artifactDir}/intro-${language}-320.png` })
    await menuCycle(); checked('playing menu and language preserve every state field, Scene, Choice and snapshot history')
    await route(informed.slice(0, 6)); assert.ok((await state()).knowledge.includes('arm-traces'))
    assert.equal(await page.locator('[data-choice="trace-shadow"]').count(), 1)
    assert.match(await prose(), language === 'ja' ? /あの映像と同じ痕/ : /marks match the footage/)
    // Inspect past history while the current scene has newly acquired Knowledge.
    await page.locator('.terminal-log').evaluate(log => { log.scrollTop = 0 })
    await menuCycle()
    const snapshots = (await snapshot()).history
    assert.deepEqual(snapshots[0].state.knowledge, [])
    assert.ok(!((await prose()).split('>')[0]).includes(language === 'ja' ? 'アームが旋回' : 'arm turned'))
    checked('language retranslation keeps historical recognition and scroll position')
    await page.screenshot({ path: `${artifactDir}/knowledge-${language}-320.png` })
    checked('Knowledge acquisition, changed recognition and new Choice')
    await route(informed.slice(6)); assert.equal((await state()).status, 'clear'); await menuCycle(); assert.equal(await page.getByRole('button', { name: t('restart', language), exact: true }).count(), 1); checked('full record and launch knowledge CLEAR')
    await page.screenshot({ path: `${artifactDir}/clear-${language}-320.png` })
    await restart(); await route(ordinary); assert.equal((await state()).status, 'clear'); checked('ordinary summary route and final procedure-card CLEAR')
    await restart(); await route(service); assert.equal((await state()).status, 'clear'); checked('second branch: tools, independent power, manual valve, quick card reading CLEAR')
    await restart(); await route(decoy.slice(0, 5)); assert.equal((await state()).scene, 'encounter'); assert.ok((await state()).items.includes('decoy'))
    assert.equal(await page.locator('[data-choice="use-decoy"]').count(), 1)
    await page.screenshot({ path: `${artifactDir}/encounter-${language}-320.png` })
    await choice('use-decoy'); assert.ok(!(await state()).items.includes('decoy')); assert.equal((await state()).threat, 0)
    await route(decoy.slice(6)); assert.equal((await state()).status, 'clear'); checked('risky action, encounter, acquired item use and consumption, CLEAR')
    await restart(); await route(robotOver); assert.equal((await state()).scene, 'robot-over'); await menuCycle(); checked('danger warning, robot encounter and GAME OVER')
    await page.screenshot({ path: `${artifactDir}/over-${language}-320.png` })
    await restart(); await route(oxygenOver); assert.equal((await state()).scene, 'oxygen-over'); await menuCycle(); checked('resource exhaustion GAME OVER')
    await restart(); await route(highAlert); assert.equal((await state()).threat, 2)
    assert.match(await prose(), language === 'ja' ? /駆動音が止まった/ : /motor stops beyond/)
    await page.screenshot({ path: `${artifactDir}/high-${language}-320.png` })
    await choice('wait-relay'); assert.equal((await state()).threat, 1)
    assert.match(await prose(), language === 'ja' ? /金属音が何度も近づいて/ : /Metal sounds draw closer/)
    await choice('alarm-power'); await choice('equalise'); await choice('read-card'); assert.equal((await state()).status, 'over'); checked('HIGH / MEDIUM threat prose and waiting-air trade-off')
    await restart(); await route(['leave-case', 'service-hatch', 'inspect-bench', 'leave-bench', 'hand-seal', 'step-plate', 'wait-relay'])
    assert.equal((await state()).threat, 0); assert.match(await prose(), language === 'ja' ? /遠くで何かが動いている/ : /Something moves far away/)
    await route(['blue-power', 'equalise', 'read-card']); assert.equal((await state()).status, 'over'); checked('LOW threat prose; extra waiting leaves no oxygen for the unread card')
    await restart(); await route(['check-kit', 'take-both', 'service-hatch', 'inspect-bench', 'unscrew-tools', 'hand-seal', 'flood-scan', 'blue-power'])
    assert.equal((await state()).oxygen, 2); await choice('airlock-refill'); assert.equal((await state()).oxygen, 0); assert.ok(!(await state()).items.includes('flask'))
    await route(['manual-valve', 'read-card', 'card-launch']); checked('critical oxygen, refill consumption and CLEAR')
    await restart(); await route(['leave-case', 'service-hatch', 'inspect-bench', 'unscrew-tools', 'hand-seal', 'step-plate', 'alarm-power', 'manual-valve', 'emergency-light', 'crawl-out', 'manual-valve', 'read-card', 'card-launch'])
    assert.equal((await state()).status, 'clear'); checked('tool + Knowledge emergency-light encounter escape CLEAR')
    await restart(); await route(['leave-case', 'service-hatch', 'crawl-through'])
    assert.equal((await state()).body, 'injured'); assert.equal(await page.locator('[data-choice="hand-seal"]').count(), 0)
    checked('body injury keeps conditional narrative and Choice restrictions')
    await menuCycle()
    await page.getByRole('button', { name: t('menu', language), exact: true }).tap()
    await click(`${t('language', language)} >`)
    await page.screenshot({ path: `${artifactDir}/language-menu-${language}-320.png` })
    await page.keyboard.press('Escape')
    const colors = await page.evaluate(() => ({
      text: getComputedStyle(document.querySelector('.terminal-log')).color,
      choice: getComputedStyle(document.querySelector('[data-choice]')).color,
      title: getComputedStyle(document.querySelector('h1')).color,
      border: getComputedStyle(document.querySelector('[data-choice]')).borderTopColor,
      background: getComputedStyle(document.documentElement).backgroundColor,
      button: getComputedStyle(document.querySelector('[data-choice]')).backgroundColor,
      font: parseFloat(getComputedStyle(document.querySelector('.terminal-log')).fontSize),
      line: parseFloat(getComputedStyle(document.querySelector('.terminal-log')).lineHeight) }))
    assert.deepEqual(colors, { text: 'rgb(74, 222, 128)', choice: 'rgb(74, 222, 128)', title: 'rgb(74, 222, 128)',
      border: 'rgb(47, 117, 72)', background: 'rgb(7, 16, 15)', button: 'rgb(13, 33, 29)', font: 14, line: 25.2 })
    const luminance = rgb => rgb.map(c => { const v = c / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0)
    const contrast = bg => (luminance([74, 222, 128]) + .05) / (luminance(bg) + .05)
    assert.ok(contrast([7, 16, 15]) >= 4.5 && contrast([13, 33, 29]) >= 4.5)
    checked(`green theme, 14px/1.8 prose, contrast ${contrast([7, 16, 15]).toFixed(2)} / ${contrast([13, 33, 29]).toFixed(2)}`)
    await page.setViewportSize({ width: 720, height: 800 })
    const wide = await page.locator('[data-choice]').evaluateAll(bs => bs.map(b => b.getBoundingClientRect().x))
    assert.ok(wide.every(x => x === wide[0])); await page.setViewportSize({ width: 320, height: 640 })
    checked('desktop choices also stay in one column')
    await route(['hold-seal', 'step-plate', 'alarm-power', 'equalise', 'read-card', 'card-launch'])
    // The real animation path, tap skip, locked actions and reduced-motion completion.
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await restart()
    assert.equal(await page.locator('.terminal-log').getAttribute('aria-busy'), 'true')
    assert.ok(await page.locator('button').evaluateAll(bs => bs.every(b => b.disabled)))
    const animationState = await state(); await page.locator('.terminal-log').tap(); assert.deepEqual(await state(), animationState)
    assert.equal(await page.locator('.terminal-log').getAttribute('aria-busy'), 'false')
    await choice('check-kit'); await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForFunction(() => document.querySelector('.terminal-log').getAttribute('aria-busy') === 'false')
    assert.equal(await page.locator('.terminal-log').getAttribute('aria-busy'), 'false'); checked('typewriter lock, tap skip and reduced motion')
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await choice('take-both')
    const naturalState = await state()
    await page.waitForFunction(() => document.querySelector('.terminal-log').getAttribute('aria-busy') === 'false')
    assert.deepEqual(await state(), naturalState); assert.equal(await page.locator('.menu-toggle').isEnabled(), true)
    checked('natural typewriter completion unlocks menu without progressing')
    assert.ok(wrappedChoiceSeen, 'Long Choices naturally wrap in this language')
    // Saved preference overrides the original browser locale after reload.
    await click(t('menu', language)); await click(`${t('language', language)} >`)
    const other = language === 'ja' ? 'en' : 'ja'
    await click(language === 'ja' ? 'English' : '日本語')
    await page.reload(); await page.waitForFunction(() => !!globalThis.__exitTest)
    assert.equal(await page.evaluate(() => document.documentElement.lang), other)
    assert.equal((await snapshot()).started, false)
    await click(t('menu', other)); await click(`${t('language', other)} >`); await click(language === 'ja' ? '日本語' : 'English')
    checked('saved language overrides browser locale on reload; long Choices wrap')
    // Supply nonzero environment insets in the test CSS response. The same production
    // max()/padding rules are used; no test styles or state setters are shipped.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.route(/\/src\/style\.css(?:\?.*)?$/, async route => {
      const response = await route.fetch()
      const values = { top: 24, right: 16, bottom: 20, left: 16 }
      const body = (await response.text()).replace(/env\(safe-area-inset-(top|right|bottom|left)\)/g, (_, side) => `${values[side]}px`)
      await route.fulfill({ response, body })
    })
    await page.reload(); await page.waitForFunction(() => !!globalThis.__exitTest)
    assert.deepEqual((await layout()).padding, [24, 16, 20, 16])
    reference.restart(); await click(t('start', language)); await route([...service.slice(0, 5), 'hold-seal', 'step-plate'])
    assert.equal(await page.locator('[data-choice]').count(), 5)
    await menuCycle()
    await page.screenshot({ path: `${artifactDir}/safe-area-${language}-320.png` })
    checked('nonzero Safe Area keeps title, menu, dropdown and five Choices within 320x640')
    assert.deepEqual(errors, []); checked('320px no horizontal overflow, readable full-width choices, no browser exceptions')
    await context.close()
  }
  await writeFile(`${artifactDir}/report.json`, JSON.stringify(report, null, 2) + '\n')
  console.log(`PASS: ${report.length} Chromium checks; real choices only, ja/en, 320px. Artifacts: ${artifactDir}`)
} finally { await browser.close() }
