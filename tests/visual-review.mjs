import { chromium } from 'playwright'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const dir = process.argv[2] ?? 'docs/visual-review/after'
const before = process.argv[3]
const base = process.env.EXIT_SEQUENCE_URL ?? 'http://127.0.0.1:5173/exit-sequence/'
await mkdir(dir, { recursive: true })

const rendererSource = await readFile(new URL('../src/renderer.ts', import.meta.url), 'utf8')
assert.ok(!rendererSource.includes('drawFacility'), 'decorative facility meshes are removed')
assert.ok(!rendererSource.includes('getImageData'), 'sprite and renderer paths do not read pixels back from Canvas')

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
})

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 })
  await page.route('**/src/main.ts*', async route => {
    const response = await route.fetch()
    const body = (await response.text()).replaceAll('requestAnimationFrame(frame);', '')
    await route.fulfill({ response, body })
  })
  await page.goto(base)
  await page.waitForFunction(() => !!document.querySelector('.game-canvas'))

  const renderScene = async (scene) => page.evaluate(async options => {
    const { renderDungeon } = await import('/exit-sequence/src/renderer.ts')
    const { createGame } = await import('/exit-sequence/src/game.ts')
    const enemies = options.enemy ? [{
      id: options.enemy.id ?? `review-${options.enemy.mode ?? 'idle'}-${options.enemy.distance ?? 1.8}`,
      x: options.enemy.x ?? 2.5,
      y: 14.5 - (options.enemy.distance ?? 1.8),
      heading: Math.PI,
      vision: 6,
      hearing: 5,
      destination: null,
      route: [],
      alerted: options.enemy.mode === 'chase',
    }] : []
    let state = createGame({
      player: { x: options.playerX ?? 2.5, y: options.playerY ?? 14.5, heading: options.heading ?? 0 },
      openDoors: options.openDoors ?? [true, true, true, true, true, true],
      enemies,
    })
    if (options.animateDoor) {
      state = {
        ...state,
        doorMotions: state.doorMotions.map((motion, index) => index === 0
          ? { fromOpen: !state.openDoors[0], startedAt: 0 }
          : motion),
      }
    }
    if (options.enemy?.mode === 'walk') {
      renderDungeon(document.querySelector('.game-canvas'), { ...state, time: 0 })
      const walking = { ...state, enemies: [{ ...state.enemies[0], y: state.enemies[0].y - 0.28 }], time: 0.2 }
      return renderDungeon(document.querySelector('.game-canvas'), walking)
    }
    return renderDungeon(document.querySelector('.game-canvas'), { ...state, time: options.time ?? 1.25 })
  }, scene)

  const capture = async (name, scene, requireVisible = false) => {
    let visible = await renderScene(scene)
    if (requireVisible && !visible.length) {
      await page.waitForTimeout(120)
      visible = await renderScene(scene)
    }
    if (requireVisible) assert.ok(visible.length, `${name} draws its mutant image sprite`)
    await page.locator('.game-canvas').screenshot({ path: `${dir}/${name}.png` })
    return visible
  }

  await capture('corridor', { time: 1.25 })
  await capture('corner', { heading: 0.55, time: 1.25 })
  await capture('door-closed', { openDoors: [false, false, false, false, false, false], time: 0.13 })
  await capture('door-opening', { openDoors: [true, false, false, false, false, false], animateDoor: true, time: 0.13 })
  await capture('door-closing', { openDoors: [false, false, false, false, false, false], animateDoor: true, time: 0.13 })
  await capture('enemy-near', { enemy: { distance: 1.65, mode: 'idle' }, time: 1.25 }, true)
  await page.screenshot({ path: `${dir}/game-enemy-1280.png` })
  await capture('enemy-middle', { enemy: { distance: 3 }, time: 1.25 }, true)
  await capture('enemy-far', { enemy: { distance: 6 }, time: 1.25 }, true)
  await capture('enemy-idle', { enemy: { distance: 2, mode: 'idle' }, time: 1.25 }, true)
  await capture('enemy-walk', { enemy: { distance: 2, mode: 'walk' }, time: 0.2 }, true)
  await capture('enemy-chase', { enemy: { distance: 2, mode: 'chase' }, time: 1.25 }, true)
  const drawMultiple = () => page.evaluate(async () => {
    const { renderDungeon } = await import('/exit-sequence/src/renderer.ts')
    const { createGame } = await import('/exit-sequence/src/game.ts')
    const state = createGame({
      player: { x: 11.5, y: 2.5, heading: Math.PI / 2 },
      openDoors: [true, true, true, true, true, true],
      enemies: [
        { id: 'near-mutant', x: 12.65, y: 2.5, heading: Math.PI * 1.5, vision: 6, hearing: 5, destination: null, route: [], alerted: false },
        { id: 'far-mutant', x: 13.65, y: 2.72, heading: Math.PI * 1.5, vision: 6, hearing: 5, destination: null, route: [], alerted: true },
      ],
    })
    return renderDungeon(document.querySelector('.game-canvas'), { ...state, time: 1.25 })
  })
  let multiple = await drawMultiple()
  if (multiple.length < 2) {
    await page.waitForTimeout(120)
    multiple = await drawMultiple()
  }
  assert.ok(multiple.length >= 2, 'both mutants draw as separate cached sprites')
  await page.locator('.game-canvas').screenshot({ path: `${dir}/enemy-multiple.png` })

  const results = []
  for (const width of [320, 375, 390, 1280]) {
    await page.setViewportSize({ width, height: width === 1280 ? 1000 : 844 })
    const result = await page.evaluate(async () => {
      const { renderDungeon } = await import('/exit-sequence/src/renderer.ts')
      const { createGame } = await import('/exit-sequence/src/game.ts')
      const canvas = document.querySelector('.game-canvas')
      const state = createGame({
        player: { x: 2.5, y: 14.5, heading: 0 },
        openDoors: [true, true, true, true, true, true],
        enemies: [
          { id: 'bench-a', x: 2.5, y: 12.8, heading: Math.PI, vision: 6, hearing: 5, destination: null, route: [], alerted: true },
          { id: 'bench-b', x: 2.55, y: 11.8, heading: Math.PI, vision: 6, hearing: 5, destination: null, route: [], alerted: true },
        ],
      })
      const samples = []
      let visible = []
      for (let index = 0; index < 65; index++) {
        const start = performance.now()
        visible = renderDungeon(canvas, { ...state, time: index / 60 })
        if (index >= 5) samples.push(performance.now() - start)
      }
      const sorted = samples.toSorted((a, b) => a - b)
      const bounds = canvas.getBoundingClientRect()
      return {
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        cssWidth: bounds.width,
        mean: samples.reduce((sum, value) => sum + value, 0) / samples.length,
        p95: sorted[Math.floor(sorted.length * 0.95)],
        visibleEnemies: visible,
      }
    })
    assert.ok(result.visibleEnemies.length >= 1, `enemies are visible at ${width}px`)
    assert.ok(Number.isFinite(result.mean) && result.mean < 50, `render budget at ${width}px: ${result.mean}ms`)
    results.push({ viewport: width, ...result })
    await page.locator('.game-canvas').screenshot({ path: `${dir}/responsive-${width}.png` })
    if (width === 390) await page.screenshot({ path: `${dir}/game-enemy-390.png` })
  }
  await writeFile(`${dir}/measurements.json`, JSON.stringify(results, null, 2) + '\n')
  console.log(results.map(({ viewport, mean, p95 }) => ({ viewport, mean, p95 })))

  if (before) {
    const rows = []
    for (const name of ['corridor', 'corner', 'enemy-near', 'enemy-middle', 'enemy-chase']) {
      const oldImage = (await readFile(`${before}/${name}.png`)).toString('base64')
      const newImage = (await readFile(`${dir}/${name}.png`)).toString('base64')
      rows.push(`<h2>${name}</h2><div class="labels"><span>修正前</span><span>修正後</span></div><div><img src="data:image/png;base64,${oldImage}"><img src="data:image/png;base64,${newImage}"></div>`)
    }
    await page.setViewportSize({ width: 1280, height: 1000 })
    await page.setContent(`<style>body{background:#080c09;color:#baffbb;font:18px monospace;margin:16px}.labels{display:flex;gap:12px;font-size:14px}div:not(.labels){display:flex;gap:12px}img{width:610px}h2{margin:20px 0 8px}</style><h1>EXIT SEQUENCE — Before / After</h1>${rows.join('')}`)
    await page.screenshot({ path: `${dir}/before-after.png`, fullPage: true })
  }

  await browser.close()
} catch (error) {
  await browser.close()
  throw error
}
