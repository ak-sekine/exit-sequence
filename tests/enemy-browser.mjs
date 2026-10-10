import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
const artifacts = process.env.EXIT_SEQUENCE_ARTIFACTS ?? '/tmp/exit-sequence-browser'
await mkdir(artifacts, { recursive: true })
import assert from 'node:assert/strict'
import { createGame, advanceTurn } from '../src/game.ts'
import { character } from '../src/character.ts'
import { translateLog } from '../src/i18n.ts'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox'] })
try {
  for (const locale of ['ja', 'en']) for (const phase of ['player', 'enemy', 'hearing', 'sight']) {
    const context = await browser.newContext({ viewport: { width: 320, height: 640 }, locale, isMobile: true, hasTouch: true })
    const page = await context.newPage(), errors = []
    page.on('pageerror', e => errors.push(e.message))
    let game = createGame()
    // Real map: south dead end, unobstructed corridor, deterministic chase.
    const e = { ...character({ x: 2, y: phase === 'player' ? 13 : 12, facing: 2 }), id: 'fixture', destination: null }
    game = { ...game, enemies: [e] }
    if (phase === 'hearing') game = { ...game, player: character({ x: 2, y: 14, facing: 1 }) }
    if (phase === 'sight') game = { ...game, player: character({ x: 2, y: 14, facing: 0 }), enemies: [{ ...e, y: 12, facing: 0, destination: { x: 2, y: 11 } }] }
    const initial = game
    await page.route('**/src/main.ts*', async route => {
      const response = await route.fetch()
      const body = (await response.text()).replace('let game = createGame();', `let game = ${JSON.stringify(initial)};`)
      assert.ok(body.includes('fixture')); await route.fulfill({ response, body })
    })
    await page.goto(process.env.EXIT_SEQUENCE_URL ?? 'http://127.0.0.1:5173/exit-sequence/')
    const state = () => page.locator('.dungeon').evaluate(el => ({ x: +el.dataset.x, y: +el.dataset.y, facing: +el.dataset.facing, turn: +el.dataset.turn, gameOver: el.dataset.gameOver === 'true' }))
    const logs = () => page.locator('.log p').allTextContents()
    const action = async a => {
      game = advanceTurn(game, a, () => 0)
      await page.locator(a === 'a' ? '[data-action="a"]' : `[data-direction="${a}"]`).tap()
      assert.deepEqual(await state(), { ...{ x: game.player.x, y: game.player.y, facing: game.player.facing }, turn: game.turn, gameOver: game.gameOver })
      assert.deepEqual(await logs(), game.logs.map(e => translateLog(e, locale)))
    }
    await action('a'); assert.equal(game.turn, 0)
    await action(phase === 'player' ? 'up' : phase === 'hearing' || phase === 'sight' ? 'up' : 'right')
    if (phase === 'sight') {
      assert.equal(game.logs.at(-1).kind, 'sight')
      assert.match((await logs()).at(-1), locale === 'ja' ? /敵は南/ : /facing south/)
      await action('up')
      // Enemy now at the destination; turn south and walk to the player.
      for (const a of ['up', 'up', 'up', 'up']) { if (!game.gameOver) await action(a) }
    } else if (phase === 'hearing') {
      assert.equal(game.logs.at(-1).kind, 'hearing')
      assert.match((await logs()).at(-1), locale === 'ja' ? /音が聞こえる/ : /hear an enemy/)
      await action('left')
    } else if (phase === 'enemy') {
      assert.equal(game.logs.at(-1).kind, 'hearing')
      await action('left')
    }
    assert.ok(game.gameOver)
    await page.screenshot({ path: `${artifacts}/${locale}-enemy-${phase}.png` })
    assert.equal((await logs()).at(-1), translateLog('gameOver', locale))
    const frozen = await state(), count = (await logs()).length
    for (const a of ['up', 'left', 'right', 'down', 'a']) await action(a)
    await page.locator('[data-action="b"]').tap()
    assert.equal(await page.locator('[data-map-enemy]').count(), 0)
    for (const d of ['up', 'left', 'down', 'right']) await page.locator(`[data-direction="${d}"]`).tap()
    assert.deepEqual(await state(), frozen)
    const center = await page.locator('.dungeon').getAttribute('data-center-y')
    await page.locator('.menu-toggle').tap()
    const other = locale === 'ja' ? 'en' : 'ja'
    await page.locator(`[data-language="${other}"]`).tap()
    assert.deepEqual(await logs(), game.logs.map(e => translateLog(e, other)))
    assert.equal((await logs()).length, count); assert.deepEqual(await state(), frozen)
    assert.equal(await page.locator('.dungeon').getAttribute('data-center-y'), center)
    await page.locator('[data-action="b"]').tap()
    assert.equal(await page.locator('.dungeon').getAttribute('data-view'), '3d')
    assert.deepEqual(await state(), frozen)
    assert.deepEqual(errors, [])
    await context.close()
  }
  // Unmodified production integration: deterministic RNG and actual initial enemy.
  const context = await browser.newContext({ viewport: { width: 320, height: 640 }, locale: 'ja', hasTouch: true })
  await context.addInitScript(() => { Math.random = () => 0 })
  const page = await context.newPage()
  await page.goto(process.env.EXIT_SEQUENCE_URL ?? 'http://127.0.0.1:5173/exit-sequence/')
  let game = createGame()
  const turnBefore = await page.locator('.dungeon').getAttribute('data-turn')
  const logBefore = await page.locator('.log').innerHTML()
  await page.locator('[data-action="b"]').tap()
  for (const d of ['up', 'right', 'down', 'left']) await page.locator(`[data-direction="${d}"]`).tap()
  await page.locator('.menu-toggle').tap()
  await page.locator('[data-language="en"]').tap()
  assert.equal(await page.locator('.dungeon').getAttribute('data-turn'), turnBefore)
  await page.locator('.menu-toggle').tap()
  await page.locator('[data-language="ja"]').tap()
  assert.equal(await page.locator('.log').innerHTML(), logBefore)
  await page.locator('[data-action="b"]').tap()
  for (const action of ['up', 'up', 'up', 'right', 'up', 'up', 'up', 'left', 'up', 'right']) {
    game = advanceTurn(game, action, () => 0)
    await page.locator(`[data-direction="${action}"]`).tap()
    assert.equal(await page.locator('.dungeon').getAttribute('data-turn'), String(game.turn))
    assert.deepEqual(await page.locator('.log p').allTextContents(), game.logs.map(e => translateLog(e, 'ja')))
  }
  await context.close()
  console.log('PASS: actual initial AI integration; ja/en mobile taps, both collision phases, sight/hearing, active and ended turn freeze, map scroll/toggle and history retranslation')
} finally { await browser.close() }
