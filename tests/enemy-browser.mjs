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
    assert.ok(body.includes('let game = createGame();'), 'dev main module keeps the game factory boundary')
    body = body.replace('let game = createGame();', 'let game = createGame(window.__EXIT_SEQUENCE_FIXTURE__);')
    body += '\nwindow.readGameForTest = () => game;'
    await route.fulfill({ response, body })
  })
  await page.goto(base)
  await page.waitForFunction(() => !!document.querySelector('.scene-frame')?.dataset.time)
  return { page, errors }
}

try {
  const doorEnemy = {
    id: 'door-guard', x: 2.5, y: 10.5, heading: Math.PI,
    vision: 6, hearing: 5, destination: null, route: [], alerted: false,
  }
  const doorFixture = { player: { x: 2.5, y: 11.5, heading: 0 }, enemies: [doorEnemy] }

  // A look pointer that starts in the event strip remains a look pointer over A.
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true })
    const { page, errors } = await openFixture(context, doorFixture)
    const log = await page.locator('.event-log').boundingBox(), action = await page.locator('.action-button').boundingBox()
    await page.mouse.move(log.x + 25, log.y + log.height / 2)
    await page.mouse.down()
    await page.mouse.move(action.x + action.width / 2, action.y + action.height / 2, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(50)
    assert.equal(await page.locator('.scene-frame').getAttribute('data-open-doors'), '000000')
    assert.notEqual(Number(await page.locator('.scene-frame').getAttribute('data-heading')), 0)
    assert.deepEqual(errors, [])
    await context.close()
  }

  // Three simultaneous touch pointers move, turn, and operate A independently.
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true })
    const { page, errors } = await openFixture(context, doorFixture)
    await page.evaluate(() => {
      window.__pointerEvents = []
      for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) {
        document.addEventListener(type, event => window.__pointerEvents.push({ type, id: event.pointerId, target: event.target.className ?? event.target.tagName }), true)
      }
    })
    const stick = await page.locator('.joystick').boundingBox()
    const status = await page.locator('.status').boundingBox()
    const action = await page.locator('.action-button').boundingBox()
    const stickPoint = { x: stick.x + stick.width / 2, y: stick.y + stick.height / 2 }
    const lookPoint = { x: status.x + 30, y: status.y + status.height / 2 }
    const actionPoint = { x: action.x + action.width / 2, y: action.y + action.height / 2 }
    const touch = await context.newCDPSession(page)
    const points = [
      { ...stickPoint, id: 1 }, { ...lookPoint, id: 2 }, { ...actionPoint, id: 3 },
    ]
    const before = await page.locator('.scene-frame').evaluate(element => ({ x: +element.dataset.x, y: +element.dataset.y, heading: +element.dataset.heading }))
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points })
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [
      { x: stickPoint.x, y: stickPoint.y - 35, id: 1 },
      { x: lookPoint.x + 55, y: lookPoint.y + 35, id: 2 },
      { ...actionPoint, id: 3 },
    ] })
    await page.waitForTimeout(180)
    const during = await page.locator('.scene-frame').evaluate(element => ({
      x: +element.dataset.x, y: +element.dataset.y, heading: +element.dataset.heading,
      doors: element.dataset.openDoors,
    }))
    assert.equal(during.doors[0], '1', 'A opens the door in range')
    assert.ok(Math.hypot(during.x - before.x, during.y - before.y) > 0.1, 'stick keeps moving while other pointers act')
    assert.ok(Math.abs(during.heading - before.heading) > 0.5, 'view drag runs at the same time as movement and A')
    await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
    await page.waitForTimeout(35)
    const released = await page.locator('.scene-frame').evaluate(element => ({ x: +element.dataset.x, y: +element.dataset.y }))
    await page.waitForTimeout(120)
    const stopped = await page.locator('.scene-frame').evaluate(element => ({ x: +element.dataset.x, y: +element.dataset.y }))
    assert.ok(Math.hypot(stopped.x - released.x, stopped.y - released.y) < 0.03, 'pointercancel stops movement after the release frame')
    const cancelled = await page.evaluate(() => window.__pointerEvents.filter(event => event.type === 'pointercancel').length)
    assert.equal(cancelled, 3, 'each touch pointer receives its own pointercancel')
    assert.deepEqual(errors, [])
    await context.close()
  }

  // A closed door occludes the guard. Opening it reveals the sprite and lets the guard chase.
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true })
    const { page, errors } = await openFixture(context, doorFixture)
    await page.waitForTimeout(80)
    assert.equal(await page.locator('.scene-frame').getAttribute('data-visible-enemies'), '')
    await page.locator('.action-button').click()
    assert.equal((await page.locator('.scene-frame').getAttribute('data-open-doors'))[0], '1')
    await page.waitForFunction(() => document.querySelector('.scene-frame').dataset.visibleEnemies.includes('door-guard'))
    await page.screenshot({ path: `${artifacts}/door-open-enemy-visible.png` })

    await page.locator('.menu-toggle').click()
    const beforePause = await page.locator('.scene-frame').evaluate(element => ({ time: element.dataset.time, y: element.dataset.y }))
    const pausedCanvas = await page.locator('.game-canvas').evaluate(canvas => canvas.toDataURL())
    await page.waitForTimeout(280)
    const duringPause = await page.locator('.scene-frame').evaluate(element => ({ time: element.dataset.time, y: element.dataset.y }))
    assert.deepEqual(duringPause, beforePause, 'enemy decisions and movement stop while menu is open')
    assert.equal(await page.locator('.game-canvas').evaluate(canvas => canvas.toDataURL()), pausedCanvas, 'enemy, door, and light animation stop with the game clock')
    await page.locator('.resume-button').click()
    await page.waitForFunction(() => document.querySelector('.scene-frame').dataset.gameOver === 'true', { timeout: 2500 })
    assert.equal(await page.locator('.game-over-screen').isVisible(), true)
    assert.equal(await page.locator('.scene-frame').evaluate(element => element.dataset.gameOver), 'true')
    const overCanvas = await page.locator('.game-canvas').evaluate(canvas => canvas.toDataURL())
    await page.waitForTimeout(120)
    assert.equal(await page.locator('.game-canvas').evaluate(canvas => canvas.toDataURL()), overCanvas, 'animations stay frozen after game over')
    assert.deepEqual(errors, [])
    await context.close()
  }

  // A wall hides a 2D billboard behind it in the raycaster depth buffer.
  {
    const wallFixture = {
      player: { x: 7.5, y: 6.5, heading: Math.PI / 2 },
      enemies: [{ ...doorEnemy, id: 'behind-wall', x: 12.5, y: 6.5, heading: Math.PI * 1.5 }],
    }
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const { page, errors } = await openFixture(context, wallFixture)
    await page.waitForTimeout(40)
    assert.equal(await page.locator('.scene-frame').getAttribute('data-visible-enemies'), '')
    await page.screenshot({ path: `${artifacts}/wall-occlusion.png` })
    assert.deepEqual(errors, [])
    await context.close()
  }

  // Two world-space billboards keep their independent poses and correct depth order.
  {
    const multiFixture = {
      player: { x: 11.5, y: 2.5, heading: Math.PI / 2 },
      enemies: [
        { id: 'near-mutant', x: 12.65, y: 2.5, heading: Math.PI * 1.5, vision: 6, hearing: 5, destination: null, route: [], alerted: false },
        { id: 'far-mutant', x: 13.65, y: 2.72, heading: Math.PI * 1.5, vision: 6, hearing: 5, destination: null, route: [], alerted: false },
      ],
    }
    const context = await browser.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true })
    const { page, errors } = await openFixture(context, multiFixture)
    await page.waitForFunction(() => {
      const visible = document.querySelector('.scene-frame').dataset.visibleEnemies.split(',')
      return visible.includes('near-mutant') && visible.includes('far-mutant')
    })
    await page.screenshot({ path: `${artifacts}/multiple-enemies-320.png` })
    const frameIntervals = await page.evaluate(() => new Promise(resolve => {
      const samples = []
      let previous
      function sample(timestamp) {
        if (previous !== undefined) samples.push(timestamp - previous)
        previous = timestamp
        if (samples.length === 45) resolve(samples)
        else requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    }))
    const averageFrameMs = frameIntervals.reduce((sum, value) => sum + value, 0) / frameIntervals.length
    console.log(`  320px two-enemy frame cadence: ${averageFrameMs.toFixed(1)}ms average`)
    assert.ok(averageFrameMs < 50, `320px two-enemy rendering stays above 20fps: ${averageFrameMs.toFixed(1)}ms`)
    assert.deepEqual(errors, [])
    await context.close()
  }

  console.log('PASS: independent multitouch movement/look/A, pointer start classification, closed-door visibility, door opening, continuous enemy chase and capture, menu pause, and wall occlusion')
} finally {
  await browser.close()
}
