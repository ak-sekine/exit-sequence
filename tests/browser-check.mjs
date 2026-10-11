import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { click, moveCommand, toggleMap, passDoorCommand } from './command-helpers.mjs'
import { DUNGEON_MAP, INITIAL_PLAYER, move, passDoor, locationKind, facingDoor } from '../src/dungeon.ts'
import { initialVisited, recordMovement, renderMap, clampMapCenter, scrollMap } from '../src/automap.ts'
import { renderDungeon } from '../src/renderer.ts'
import { explore } from './exploration.ts'
import { commandText } from '../src/commands.ts'
import { t, translateLog } from '../src/i18n.ts'
const artifacts = process.env.EXIT_SEQUENCE_ARTIFACTS ?? '/tmp/exit-sequence-browser'
await mkdir(artifacts, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox'] })
try {
 for (const locale of ['ja', 'en']) {
  const context = await browser.newContext({ viewport: { width: 320, height: 640 }, locale, hasTouch: true })
  const page = await context.newPage(), errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.route('**/src/main.ts*', async route => {
   const response = await route.fetch()
   const body = (await response.text()).replace('let game = createGame();', 'let game = { ...createGame(), enemies: [] };')
   assert.ok(body.includes('enemies: []'))
   await route.fulfill({ response, body: body + '\nwindow.snapshot = () => ({ game, history, visited: [...visited], ui, inspection: menuOptions("inspection", facingDoor(), game.gameOver) });' })
  })
  await page.goto(process.env.EXIT_SEQUENCE_URL ?? 'http://127.0.0.1:5173/exit-sequence/')
  let language = locale, model = INITIAL_PLAYER, turn = 0
  const visited = initialVisited(model), history = [{ kind: 'event', event: 'ready' }]
  const lines = () => history.map(e => e.kind === 'command' ? commandText(e.ids, language) : e.kind === 'message' ? t(e.message, language) : translateLog(e.event, language))
  const check = async () => {
   assert.deepEqual(await page.locator('.log p').allTextContents(), [...lines(), commandText((await page.locator('.controls').getAttribute('data-menu')) === 'movement' ? ['move'] : [], language)])
   assert.deepEqual(await page.locator('.dungeon').evaluate(el => [+el.dataset.x, +el.dataset.y, +el.dataset.facing, +el.dataset.turn]), [model.x, model.y, model.facing, turn])
   assert.equal(await page.locator('.direction-value').textContent(), (language === 'ja' ? ['北', '東', '南', '西'] : ['N', 'E', 'S', 'W'])[model.facing])
  }
  const commit = ids => history.push({ kind: 'command', ids })
  const changeLanguage = async () => {
   language = language === 'ja' ? 'en' : 'ja'
   await page.locator('.menu-toggle').tap(); await page.locator(`[data-language="${language}"]`).tap()
  }
  await check()
  const initial = await page.evaluate(() => window.snapshot())
  await click(page, 'move')
  assert.deepEqual(await page.locator('.log p').allTextContents(), [...lines(), commandText(['move'], language)])
  assert.deepEqual((await page.evaluate(() => window.snapshot())).game, initial.game)
  await changeLanguage()
  assert.equal(await page.locator('.prompt').textContent(), commandText(['move'], language))
  assert.equal(await page.locator('.controls').getAttribute('data-menu'), 'movement')
  await click(page, 'back'); await check(); await changeLanguage()
  await click(page, 'inspect'); assert.equal(await page.locator('[data-command=door]').count(), 0)
  await click(page, 'back'); await check()
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowRight'); await check()
  assert.equal(await page.locator('[data-direction], [data-action]').count(), 0)
  async function perform(action) {
   const result = action === 'a' ? passDoor(DUNGEON_MAP, model) : move(DUNGEON_MAP, model, action)
   if (action === 'a') {
    assert.ok(result)
    commit(['inspect', 'door']); history.push({ kind: 'message', message: 'doorConfirmation' }); commit(['yes'])
    await passDoorCommand(page)
   } else {
    commit(['move', { up: 'forward', down: 'turnBack', left: 'turnLeft', right: 'turnRight' }[action]])
    await moveCommand(page, action)
   }
   const moved = model.x !== result.player.x || model.y !== result.player.y
   recordMovement(visited, model, result.player); model = result.player
   if (result.message !== 'blocked') turn++
   if (['blocked', 'enteredRoom', 'returnedCorridor'].includes(result.message)) history.push({ kind: 'event', event: result.message })
   if (moved) history.push({ kind: 'event', event: locationKind(DUNGEON_MAP, model) === 'room' ? 'inRoom' : 'inCorridor' })
   if (result.message !== 'blocked') {
    if (action !== 'up' && action !== 'a') history.push({ kind: 'event', event: 'noEnemySign' })
    if (facingDoor(DUNGEON_MAP, model)) history.push({ kind: 'event', event: 'doorAhead' })
   }
   await check()
   const snapshot = await page.evaluate(() => window.snapshot())
   assert.equal(snapshot.inspection.some(option => option.id === 'door'), facingDoor(DUNGEON_MAP, model))
   assert.deepEqual(snapshot.game.logs, history.filter(entry => entry.kind === 'event').map(entry => entry.event))
   assert.equal(await page.locator('.controls').getAttribute('data-menu'), action === 'a' ? 'normal' : 'movement')
   assert.equal(await page.locator('.page-number').textContent(), '1 / 1')
  }
  for (let i = 0; i < 3; i++) await perform('up')
  await perform('up') // blocked door
  const beforeDoor = await page.evaluate(() => window.snapshot())
  const beforeBack = await page.evaluate(() => window.snapshot())
  const backHistory = await page.locator('.log [data-kind]').allTextContents()
  await changeLanguage(); await check(); await changeLanguage(); await check()
  await click(page, 'back'); await check()
  assert.deepEqual((await page.evaluate(() => window.snapshot())).game, beforeBack.game)
  assert.deepEqual((await page.evaluate(() => window.snapshot())).visited, beforeBack.visited)
  assert.deepEqual(await page.locator('.log [data-kind]').allTextContents(), backHistory)
  await click(page, 'inspect'); await click(page, 'door')
  commit(['inspect', 'door']); history.push({ kind: 'message', message: 'doorConfirmation' })
  assert.deepEqual(await page.locator('.controls button').evaluateAll(es => es.map(e => e.dataset.command)), ['yes', 'no'])
  await changeLanguage()
  assert.equal(await page.locator('.controls').getAttribute('data-menu'), 'confirmation')
  await click(page, 'no'); commit(['no']); await check()
  assert.deepEqual((await page.evaluate(() => window.snapshot())).game, beforeDoor.game)
  await perform('a'); await perform('down'); await perform('a')
  while (visited.size < 112) {
   const next = [...explore(DUNGEON_MAP, model).routes].find(([key]) => !visited.has(key))
   assert.ok(next)
   for (const action of next[1]) await perform(action)
  }
  const layout = async () => {
   const data = await page.evaluate(() => {
    const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON()
    const slots = [...document.querySelector('.controls').children].map(e => e.getBoundingClientRect().toJSON())
    return { back: rect('.back-button'), operations: rect('.operation-row'), pagination: rect('.pagination'), slots, controls: rect('.controls'), dungeon: rect('.dungeon'), status: rect('.status'), log: rect('.log'), terminal: rect('.terminal'), w: innerWidth, h: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight }
   })
   assert.equal(data.slots.length, 6)
   assert.equal(await page.locator('.page-number').textContent(), '1 / 1')
   assert.ok(await page.locator('.previous-page').isDisabled())
   assert.ok(await page.locator('.next-page').isDisabled())
   assert.equal(data.back.x, data.operations.x)
   assert.ok(data.controls.bottom <= data.operations.y)
   assert.ok(data.back.right <= data.pagination.x)
   assert.ok(Math.abs((data.pagination.x + data.pagination.width / 2) - (data.operations.x + data.operations.width / 2)) < 1)
   assert.ok(data.operations.bottom <= data.h)
   assert.ok(data.back.height >= 44)
   for (let i = 0; i < 6; i++) {
    assert.ok(data.slots[i].height >= 44)
    assert.equal(data.slots[i].x, data.slots[i % 2].x)
    assert.equal(data.slots[i].y, data.slots[i - i % 2].y)
    assert.ok(data.slots[i].right <= data.w && data.slots[i].bottom <= data.h)
   }
   assert.equal(data.sw, data.w); assert.equal(data.sh, data.h)
   assert.ok(data.terminal.width <= 440)
   assert.ok(Math.abs(data.dungeon.width / data.status.width - 2) < .02)
   assert.equal(data.dungeon.height, data.status.height)
   assert.ok(data.dungeon.bottom <= data.log.y && data.log.bottom <= data.controls.y)
  }
  for (const size of [{ width: 320, height: 640 }, { width: 320, height: 320 }, { width: 320, height: 240 }, { width: 1280, height: 800 }]) { await page.setViewportSize(size); await layout() }
  await page.setViewportSize({ width: 320, height: 480 })
  await page.addStyleTag({ content: '.terminal { --safe-top:24px; --safe-right:16px; --safe-bottom:20px; --safe-left:16px; }' }); await layout()
  if (await page.locator('.controls').getAttribute('data-menu') === 'movement') await click(page, 'back')
  await check()
  await click(page, 'items'); await layout()
  assert.equal(await page.locator('.controls [data-command=back]').count(), 0)
  assert.equal(await page.locator('.back-button').isDisabled(), false)
  await page.locator('.log').evaluate(el => { el.scrollTop = 12 })
  const beforeMap = await page.evaluate(() => window.snapshot())
  await click(page, 'itemMap'); commit(['items', 'itemMap']); await check(); await layout()
  const openedMap = await page.evaluate(() => window.snapshot())
  assert.deepEqual(openedMap.history, [...beforeMap.history, { kind: 'command', ids: ['items', 'itemMap'] }])
  assert.deepEqual(openedMap.game, beforeMap.game)
  assert.deepEqual(openedMap.visited, beforeMap.visited)
  assert.ok(await page.locator('.log').evaluate(el => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) <= 1))
  await page.locator('.log').evaluate(el => { el.scrollTop = 12 })
  const logScroll = await page.locator('.log').evaluate(el => el.scrollTop)
  assert.equal(await page.locator('.controls > :nth-child(5)').getAttribute('data-command'), 'close')
  const frozen = await page.evaluate(() => window.snapshot())
  let center = clampMapCenter(DUNGEON_MAP, model)
  for (const d of ['up', 'down', 'left', 'right']) for (let i = 0; i < 20; i++) {
   const id = { up: 'mapUp', down: 'mapDown', left: 'mapLeft', right: 'mapRight' }[d]
   await click(page, id); center = scrollMap(DUNGEON_MAP, center, d)
   await check()
   assert.equal(await page.locator('.log').evaluate(el => el.scrollTop), logScroll)
   const actual = await page.evaluate(() => window.snapshot())
   assert.deepEqual(actual.game, frozen.game); assert.deepEqual(actual.visited, frozen.visited)
   assert.deepEqual(actual.history, frozen.history)
  }
  const expectedMap = renderMap(DUNGEON_MAP, model, visited, undefined, center)
  const normalized = await page.evaluate(svg => { const el = document.createElement('div'); el.innerHTML = svg; return el.innerHTML }, expectedMap)
  assert.equal(await page.locator('.dungeon').innerHTML(), normalized)
  await changeLanguage(); await check()
  assert.equal(await page.locator('.dungeon').innerHTML(), normalized)
  await page.screenshot({ path: `${artifacts}/${locale}-commands-map.png` })
  const scrollBeforeClose = await page.locator('.log').evaluate(el => el.scrollTop)
  await click(page, 'close'); await check()
  assert.equal(await page.locator('.log').evaluate(el => el.scrollTop), scrollBeforeClose)
  assert.deepEqual((await page.evaluate(() => window.snapshot())).history, frozen.history)
  await toggleMap(page); commit(['items', 'itemMap']); await check()
  assert.ok(await page.locator('.log').evaluate(el => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) <= 1))
  assert.deepEqual(await page.locator('.dungeon').evaluate(el => ({ x: +el.dataset.centerX, y: +el.dataset.centerY })), clampMapCenter(DUNGEON_MAP, model))
  await click(page, 'close')
  const status = await page.locator('.status').boundingBox()
  await page.locator('.log').evaluate(el => { el.scrollTop = 0 })
  assert.deepEqual(await page.locator('.status').boundingBox(), status)
  await perform('right')
  assert.ok(await page.locator('.log').evaluate(el => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) <= 1))
  await page.screenshot({ path: `${artifacts}/${locale}-commands-safe-area.png` })
  await page.setViewportSize({ width: 1280, height: 800 }); await layout()
  await page.screenshot({ path: `${artifacts}/${locale}-commands-desktop.png` })
  const image = async (map, doors = []) => {
   await page.locator('.dungeon').evaluate((el, svg) => { el.innerHTML = svg }, renderDungeon(map, { x: 1, y: 2, facing: 0 }, doors))
   return page.locator('.dungeon').screenshot()
  }
  assert.ok((await image(['   ', '   ', ' # '])).equals(await image(['###', '   ', ' # '])))
  assert.ok((await image([' #  ', ' #  ', ' #  '])).equals(await image([' # #', ' # #', ' # #'])))
  assert.ok(!(await image([' #  ', ' #  ', ' #  '])).equals(await image([' #  ', ' ## ', ' #  '])))
  assert.deepEqual(errors, [])
  await context.close()
 }
 // Inject extra choices only into the development response to exercise actual UI paging.
 const pagingContext = await browser.newContext({ viewport: { width: 320, height: 640 }, locale: 'en', hasTouch: true })
 const paging = await pagingContext.newPage()
 await paging.route('**/src/main.ts*', async route => {
  const response = await route.fetch()
  const body = (await response.text()).replaceAll('menuOptions(ui, facingDoor(), game.gameOver)', 'testOptions(ui)')
  await route.fulfill({ response, body: body + `
function testOptions(state) {
  return state === 'movement' ? [...menuOptions(state, true, false), {id:'forward'}, {id:'turnRight'}, {id:'forward'}, {id:'turnRight'}, {id:'turnBack'}, {id:'turnLeft'}, {id:'forward'}, {id:'turnRight'}, {id:'turnBack'}] : menuOptions(state, true, false);
}
window.snapshot = () => ({ game, history, visited: [...visited], ui, currentPage });` })
 })
 await paging.goto(process.env.EXIT_SEQUENCE_URL ?? 'http://127.0.0.1:5173/exit-sequence/')
 await click(paging, 'move')
 const frozenPaging = await paging.evaluate(() => window.snapshot())
 const pending = await paging.locator('.log').textContent()
 assert.equal(await paging.locator('.page-number').textContent(), '1 / 3')
 assert.ok(await paging.locator('.previous-page').isDisabled())
 await paging.locator('.next-page').tap()
 assert.equal(await paging.locator('.page-number').textContent(), '2 / 3')
 assert.deepEqual(await paging.locator('.controls button').evaluateAll(es => es.map(e => e.dataset.command)), ['forward', 'turnRight', 'turnBack', 'turnLeft', 'forward', 'turnRight'])
 await paging.locator('.next-page').tap()
 assert.equal(await paging.locator('.page-number').textContent(), '3 / 3')
 assert.ok(await paging.locator('.next-page').isDisabled())
 assert.deepEqual(await paging.locator('.controls button').evaluateAll(es => es.map(e => e.dataset.command)), ['turnBack'])
 const afterPaging = await paging.evaluate(() => window.snapshot())
 assert.deepEqual({ ...afterPaging, currentPage: 0 }, frozenPaging)
 assert.equal(await paging.locator('.log').textContent(), pending)
 await click(paging, 'turnBack')
 assert.equal(await paging.locator('.controls').getAttribute('data-menu'), 'movement')
 assert.equal(await paging.locator('.page-number').textContent(), '3 / 3')
 assert.equal(await paging.locator('.prompt').textContent(), '> Move')
 assert.equal((await paging.evaluate(() => window.snapshot())).currentPage, 2)
 const beforePagingBack = await paging.evaluate(() => window.snapshot())
 await paging.locator('.previous-page').tap()
 assert.equal(await paging.locator('.page-number').textContent(), '2 / 3')
 await click(paging, 'back')
 assert.equal(await paging.locator('.page-number').textContent(), '1 / 1')
 assert.deepEqual((await paging.evaluate(() => window.snapshot())).game, beforePagingBack.game)
 assert.deepEqual((await paging.evaluate(() => window.snapshot())).history, beforePagingBack.history)
 assert.equal(await paging.locator('.prompt').textContent(), '>')
 await click(paging, 'move')
 assert.equal(await paging.locator('.page-number').textContent(), '1 / 3')
 await pagingContext.close()
 console.log('PASS: ja/en structured chronological commands, pending/back/language, door yes/no, all 112 floors, rotations and failed turns, map bounds/recenter/state freeze, six fixed slots, 320px/PC/short viewport/simulated Safe Area, log-only scroll, legacy input removed, 3D occlusion')
} finally { await browser.close() }
