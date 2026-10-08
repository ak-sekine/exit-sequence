import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { t } from '../src/i18n.ts'
import { ordinary, informed, service, decoy, robotOver, oxygenOver, highAlert } from './routes.ts'
const url = process.env.EXIT_SEQUENCE_URL ?? 'http://127.0.0.1:5173/exit-sequence/'
const artifactDir = process.env.EXIT_SEQUENCE_ARTIFACTS ?? '/tmp/exit-sequence-browser'
await mkdir(artifactDir, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
const report = []
try {
  for (const language of ['ja', 'en']) {
    const context = await browser.newContext({ viewport: { width: 320, height: 640 }, locale: language, reducedMotion: 'reduce' })
    const page = await context.newPage(), errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(language => localStorage.setItem('exit-sequence-language', language), language)
    // Read-only test access injected into the dev response, never shipped.
    await page.route(/\/src\/main\.ts(?:\?.*)?$/, async route => {
      const response = await route.fetch()
      await route.fulfill({ response, body: await response.text() + '\nglobalThis.__exitTest = { state: () => structuredClone(game.state) };' })
    })
    await page.goto(url); await page.waitForFunction(() => !!globalThis.__exitTest)
    const state = () => page.evaluate(() => globalThis.__exitTest.state())
    const prose = () => page.locator('.terminal-log').innerText()
    const click = label => page.getByRole('button', { name: label, exact: true }).click()
    const checked = name => report.push({ language, width: 320, check: name, result: 'pass' })
    async function layout() {
      const actual = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth,
        buttons: [...document.querySelectorAll('button')].map(b => ({ width: b.scrollWidth, client: b.clientWidth, height: b.getBoundingClientRect().height })),
        logHeight: document.querySelector('.terminal-log').getBoundingClientRect().height }))
      assert.equal(actual.width, actual.viewport); assert.equal(actual.width, 320)
      assert.ok(actual.buttons.every(b => b.width <= b.client && b.height >= 44), JSON.stringify(actual))
      assert.ok(actual.logHeight >= 100, JSON.stringify(actual))
    }
    async function choice(id) {
      const b = page.locator(`[data-choice="${id}"]`); assert.equal(await b.count(), 1, `Available: ${id}`)
      await b.click(); await layout()
    }
    async function restart() { await click(t('restart', language)); assert.equal((await state()).scene, 'wake') }
    async function route(ids) { for (const id of ids) await choice(id) }
    await click(t('start', language)); assert.equal((await state()).scene, 'wake'); assert.match(await prose(), language === 'ja' ? /二本の黒い擦過痕/ : /Two black scrapes/); checked('START and perceptual introduction')
    await layout(); await page.screenshot({ path: `${artifactDir}/intro-${language}-320.png` })
    const before = await state()
    for (const panel of ['status', 'inventory', 'knowledge', 'help', 'settings']) {
      await click(t(panel, language)); assert.deepEqual(await state(), before)
      await click(t('back', language)); assert.deepEqual(await state(), before)
    }
    assert.equal(await page.getByRole('button', { name: t('back', language), exact: true }).count(), 0)
    checked('STATUS / INVENTORY / KNOWLEDGE / HELP / SETTINGS / BACK never advance or undo')
    const past = await prose(); await click(t('settings', language)); await click(language === 'ja' ? 'English' : '日本語')
    const other = language === 'ja' ? 'en' : 'ja'; assert.deepEqual(await state(), before)
    assert.equal(await page.evaluate(() => document.documentElement.lang), other)
    await click(t('back', other)); assert.notEqual(await prose(), past)
    await click(t('settings', other)); await click(language === 'ja' ? '日本語' : 'English'); await click(t('back', language))
    assert.deepEqual(await state(), before); assert.equal(await prose(), past); checked('LANGUAGE preserves state and history; both languages render naturally')
    await route(informed.slice(0, 6)); assert.ok((await state()).knowledge.includes('arm-traces'))
    assert.equal(await page.locator('[data-choice="trace-shadow"]').count(), 1)
    assert.match(await prose(), language === 'ja' ? /あの映像と同じ痕/ : /marks match the footage/)
    await click(t('knowledge', language)); assert.match(await prose(), language === 'ja' ? /二本の黒い擦過痕/ : /Paired black scrapes/); await click(t('back', language))
    await page.screenshot({ path: `${artifactDir}/knowledge-${language}-320.png` })
    checked('Knowledge acquisition, changed recognition and new Choice')
    await route(informed.slice(6)); assert.equal((await state()).status, 'clear'); checked('full record and launch knowledge CLEAR')
    await page.screenshot({ path: `${artifactDir}/clear-${language}-320.png` })
    await restart(); await route(ordinary); assert.equal((await state()).status, 'clear'); checked('ordinary summary route and final procedure-card CLEAR')
    await restart(); await route(service); assert.equal((await state()).status, 'clear'); checked('second branch: tools, independent power, manual valve, quick card reading CLEAR')
    await restart(); await route(decoy.slice(0, 5)); assert.equal((await state()).scene, 'encounter'); assert.ok((await state()).items.includes('decoy'))
    await click(t('inventory', language)); assert.match(await prose(), language === 'ja' ? /簡易デコイ/ : /Simple decoy/); await click(t('back', language))
    await page.screenshot({ path: `${artifactDir}/encounter-${language}-320.png` })
    await choice('use-decoy'); assert.ok(!(await state()).items.includes('decoy')); assert.equal((await state()).threat, 0)
    await route(decoy.slice(6)); assert.equal((await state()).status, 'clear'); checked('risky action, encounter, acquired item use and consumption, CLEAR')
    await restart(); await route(robotOver); assert.equal((await state()).scene, 'robot-over'); checked('danger warning, robot encounter and GAME OVER')
    await page.screenshot({ path: `${artifactDir}/over-${language}-320.png` })
    await restart(); await route(oxygenOver); assert.equal((await state()).scene, 'oxygen-over'); checked('resource exhaustion GAME OVER')
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
    // The real animation path, tap skip, locked actions and reduced-motion completion.
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await restart()
    assert.equal(await page.locator('.terminal-log').getAttribute('aria-busy'), 'true')
    assert.ok(await page.locator('button').evaluateAll(bs => bs.every(b => b.disabled)))
    const animationState = await state(); await page.locator('.terminal-log').click(); assert.deepEqual(await state(), animationState)
    assert.equal(await page.locator('.terminal-log').getAttribute('aria-busy'), 'false')
    await choice('check-kit'); await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForFunction(() => document.querySelector('.terminal-log').getAttribute('aria-busy') === 'false')
    assert.equal(await page.locator('.terminal-log').getAttribute('aria-busy'), 'false'); checked('typewriter lock, tap skip and reduced motion')
    assert.deepEqual(errors, []); checked('320px no horizontal overflow, readable full-width choices, no browser exceptions')
    await context.close()
  }
  await writeFile(`${artifactDir}/report.json`, JSON.stringify(report, null, 2) + '\n')
  console.log(`PASS: ${report.length} Chromium checks; real choices only, ja/en, 320px. Artifacts: ${artifactDir}`)
} finally { await browser.close() }
