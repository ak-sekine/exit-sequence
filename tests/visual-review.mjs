import { chromium } from 'playwright'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const dir = process.argv[2] ?? 'docs/visual-review/after'
await mkdir(dir, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
await page.route('**/src/main.ts*', async (route) => {
  const r = await route.fetch()
  await route.fulfill({ response: r, body: (await r.text()).replaceAll('requestAnimationFrame(frame);', '') })
})
await page.goto('http://127.0.0.1:5173/exit-sequence/')
for (const [name, heading, distance, chase] of [
  ['corridor', 0, 0, false],
  ['wall', 0.55, 0, false],
  ['mutant-front', 0, 1.65, false],
  ['mutant-middle', 0, 2.8, false],
  ['mutant-chase', 0, 1.8, true],
]) {
  await page.evaluate(
    async ({ heading, distance, chase }) => {
      const { renderDungeon } = await import('/exit-sequence/src/renderer.ts')
      const { createGame } = await import('/exit-sequence/src/game.ts')
      const state = createGame({
        player: { x: 2.5, y: 14.5, heading },
        openDoors: [true, true, true, true, true, true],
        enemies: distance
          ? [
              {
                id: 'review',
                x: 2.5,
                y: 14.5 - distance,
                heading: Math.PI,
                vision: 6,
                hearing: 5,
                destination: null,
                route: [],
                alerted: chase,
              },
            ]
          : [],
      })
      renderDungeon(document.querySelector('.game-canvas'), { ...state, time: 1.25 })
    },
    { heading, distance, chase },
  )
  await page.locator('.game-canvas').screenshot({ path: `${dir}/${name}.png` })
}
const results = []
for (const width of [320, 375, 390, 1280]) {
  await page.setViewportSize({ width, height: width === 1280 ? 1000 : 844 })
  const result = await page.evaluate(async () => {
    const { renderDungeon } = await import('/exit-sequence/src/renderer.ts')
    const { createGame } = await import('/exit-sequence/src/game.ts')
    const { drawFacility } = await import('/exit-sequence/src/facility.ts')
    const canvas = document.querySelector('.game-canvas'),
      w = canvas.getBoundingClientRect().width,
      h = canvas.getBoundingClientRect().height
    const state = createGame({
      player: { x: 2.5, y: 14.5, heading: 0 },
      openDoors: [true, true, true, true, true, true],
      enemies: [
        {
          id: 'bench-a',
          x: 2.5,
          y: 12.8,
          heading: Math.PI,
          vision: 6,
          hearing: 5,
          destination: null,
          route: [],
          alerted: true,
        },
        {
          id: 'bench-b',
          x: 2.55,
          y: 11.8,
          heading: Math.PI,
          vision: 6,
          hearing: 5,
          destination: null,
          route: [],
          alerted: true,
        },
      ],
    })
    const samples = []
    for (let i = 0; i < 65; i++) {
      const start = performance.now()
      renderDungeon(canvas, { ...state, time: i / 60 })
      if (i >= 5) samples.push(performance.now() - start)
    }
    // Check actual surface depth: a crate hides pixels below its top, not the air above.
    const c = document.createElement('canvas')
    c.width = 320
    c.height = 320
    const map = ['   ', ' # ', ' # ', ' # ', ' # ', '   '],
      walls = new Float32Array(320)
    walls.fill(Infinity)
    const depth = drawFacility(
      c.getContext('2d'),
      map,
      { x: 1.5, y: 4.5, heading: 0 },
      320,
      320,
      160,
      220,
      walls,
    )
    const crate = depth[205 * 320 + 118],
      air = depth[150 * 320 + 118]
    walls.fill(0.05)
    const hidden = drawFacility(
      c.getContext('2d'),
      map,
      { x: 1.5, y: 4.5, heading: 0 },
      320,
      320,
      160,
      220,
      walls,
    )
    const mean = samples.reduce((a, b) => a + b) / samples.length,
      p95 = samples.toSorted((a, b) => a - b)[Math.floor(samples.length * 0.95)]
    return {
      canvasWidth: w,
      canvasHeight: h,
      mean,
      p95,
      crate,
      air: Number.isFinite(air) ? air : null,
      behindWall: hidden.some(Number.isFinite),
    }
  })
  assert.ok(Number.isFinite(result.crate), 'crate produces physical surface depth')
  assert.ok(result.air === null || result.air > result.crate + 0.3, 'space above the crate does not inherit its depth')
  assert.equal(result.behindWall, false, 'near wall hides all facility geometry')
  assert.ok(result.mean < 50, `render budget at ${width}px: ${result.mean}ms`)
  results.push({ viewport: width, ...result })
  await page.locator('.game-canvas').screenshot({ path: `${dir}/chase-${width}.png` })
}
await writeFile(`${dir}/measurements.json`, JSON.stringify(results, null, 2) + '\n')
console.log(results)
// A review sheet compares actual browser captures from the same camera and game clock.
const before = process.argv[3]
if (before) {
  const rows = []
  for (const name of ['corridor', 'wall', 'mutant-front', 'mutant-middle', 'mutant-chase']) {
    const a = (await readFile(`${before}/${name}.png`)).toString('base64'),
      b = (await readFile(`${dir}/${name}.png`)).toString('base64')
    rows.push(
      `<h2>${name}</h2><div><img src="data:image/png;base64,${a}"><img src="data:image/png;base64,${b}"></div>`,
    )
  }
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.setContent(
    `<style>body{background:#080c09;color:#baffbb;font:18px monospace;margin:16px}div{display:flex;gap:12px}img{width:610px}h2{margin:20px 0 8px}</style><h1>EXIT SEQUENCE — Before / After</h1>${rows.join('')}`,
  )
  await page.screenshot({ path: `${dir}/before-after.png`, fullPage: true })
}
await browser.close()
