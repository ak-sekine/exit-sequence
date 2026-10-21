import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'

const base = process.env.EXIT_SEQUENCE_URL ?? 'http://127.0.0.1:5173/exit-sequence/'
const artifacts = process.env.EXIT_SEQUENCE_ARTIFACTS ?? '/tmp/exit-sequence-browser'
await mkdir(artifacts, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox'] })

async function openFixture(context, fixture) {
  const page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(value => { window.__EXIT_SEQUENCE_FIXTURE__ = value }, fixture)
  await page.route('**/src/main.ts*', async route => {
    const response = await route.fetch()
    let body = await response.text()
    assert.ok(body.includes('let game = createGame();'))
    body = body.replace('let game = createGame();', 'let game = createGame(window.__EXIT_SEQUENCE_FIXTURE__);')
    body += '\nwindow.readGameForTest = () => game;'
    await route.fulfill({ response, body })
  })
  await page.goto(base)
  await page.waitForFunction(() => !!document.querySelector('.scene-frame')?.dataset.time)
  return { page, errors }
}

try {
  // The known guard marker can appear over an unvisited cell without revealing its floor or walls.
  {
    const enemy = { id: 'map-guard', x: 2.5, y: 12.5, heading: Math.PI, vision: 6, hearing: 5, destination: null, route: [], alerted: false }
    const fixture = { player: { x: 2.5, y: 14.5, heading: 0 }, enemies: [enemy] }
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true })
    const { page, errors } = await openFixture(context, fixture)
    await page.waitForFunction(() => document.querySelector('.status-signal').textContent.length > 0)
    await page.locator('.menu-toggle').click()
    const before = await page.locator('.scene-frame').getAttribute('data-time')
    await page.locator('.map-button').click()
    assert.equal(await page.locator('.scene-frame').getAttribute('data-paused'), 'true')
    assert.equal(await page.locator('[data-map-enemy="map-guard"]').count(), 1)
    assert.equal(await page.locator('[data-map-cell="2,12"]').count(), 0)
    assert.equal(await page.locator('[data-map-player]').getAttribute('transform'), 'translate(50 290) rotate(0)')
    await page.screenshot({ path: `${artifacts}/detected-map-390.png` })
    await page.waitForTimeout(180)
    assert.equal(await page.locator('.scene-frame').getAttribute('data-time'), before)
    await page.locator('.map-close').click()
    assert.equal(await page.locator('.scene-frame').getAttribute('data-paused'), 'false')
    assert.deepEqual(errors, [])
    await context.close()
  }

  // Visit-only map geometry records continuous movement and retains door state boundaries.
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true })
    const { page, errors } = await openFixture(context, { player: { x: 2.5, y: 14.5, heading: 0 }, enemies: [] })
    await page.keyboard.down('w')
    await page.waitForFunction(() => Number(document.querySelector('.scene-frame').dataset.y) < 13.99, { timeout: 3000 })
    await page.keyboard.up('w')
    const movedY = Number(await page.locator('.scene-frame').getAttribute('data-y'))
    assert.ok(movedY < 14 && movedY > 13, `expected to visit only cell 2,13, got y=${movedY}`)
    await page.locator('.menu-toggle').click()
    await page.locator('.map-button').click()
    assert.equal(await page.locator('[data-map-cell="2,13"]').count(), 1)
    assert.equal(await page.locator('[data-map-cell="2,12"]').count(), 0)
    assert.equal(await page.locator('[data-map-door="0"]').count(), 0, 'door is not revealed before its approach cell is visited')
    await page.locator('.map-close').click()

    await page.keyboard.down('w')
    await page.waitForFunction(() => Number(document.querySelector('.scene-frame').dataset.y) < 11.25, { timeout: 4000 })
    await page.keyboard.up('w')
    const atDoor = Number(await page.locator('.scene-frame').getAttribute('data-y'))
    assert.ok(atDoor > 11.15 && atDoor < 11.25, `closed door stops continuous movement at its boundary: ${atDoor}`)
    await page.keyboard.press('e')
    assert.equal((await page.locator('.scene-frame').getAttribute('data-open-doors'))[0], '1')
    await page.keyboard.down('w')
    await page.waitForFunction(() => Number(document.querySelector('.scene-frame').dataset.y) < 10.2, { timeout: 2000 })
    await page.keyboard.up('w')
    const throughDoorY = Number(await page.locator('.scene-frame').getAttribute('data-y'))
    assert.ok(throughDoorY < 10.2, `opened door can be crossed: ${throughDoorY}`)

    await page.locator('.menu-toggle').click()
    await page.locator('.map-button').click()
    assert.equal(await page.locator('[data-map-cell="2,10"]').count(), 1)
    assert.equal(await page.locator('[data-map-door="0"][data-open="true"]').count(), 1)
    assert.equal(await page.locator('[data-map-cell="12,10"]').count(), 0)
    await page.screenshot({ path: `${artifacts}/visited-map-390.png` })
    assert.deepEqual(errors, [])
    await context.close()
  }

  console.log('PASS: detected-only enemy map markers, hidden floor protection, pause on map, continuous visited-cell tracking, closed-door collision, A/E door opening, and open-door traversal')
} finally {
  await browser.close()
}
