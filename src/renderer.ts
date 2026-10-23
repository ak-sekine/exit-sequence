import { doorAnimationProgress, mutantAnimationMode } from './animation.ts'
import type { MutantAnimationMode } from './animation.ts'
import { DOORS, DUNGEON_MAP, isFloor } from './dungeon.ts'
import type { Door, DungeonMap, Point } from './dungeon.ts'
import type { Enemy } from './enemy.ts'
import type { GameState } from './game.ts'
import { castRay } from './raycast.ts'

const FIELD_OF_VIEW = Math.PI * 0.4
const WALL_HEIGHT = 1
const CAMERA_HEIGHT = 0.5
const BACKGROUND = '#000000'
const NEAR_PLANE = 0.12
const MAX_RENDER_DISTANCE = 24
const MUTANT_FRAME_RATE: Readonly<Record<MutantAnimationMode, number>> = { idle: 2, walk: 9, chase: 11 }

type ProjectedLine = Readonly<{ ax: number; ay: number; bx: number; by: number; depth: number }>
type MotionSample = { x: number; y: number; time: number; speed: number }
type RenderBuffers = {
  wallDepth: Float32Array
  tops: Float32Array
  bottoms: Float32Array
  hitKeys: Array<string | undefined>
  hits: Array<ReturnType<typeof castRay>>
}

const mutantSpriteSources: Readonly<Record<MutantAnimationMode, readonly string[]>> = {
  idle: [
    new URL('./assets/mutant/idle-1.png', import.meta.url).href,
    new URL('./assets/mutant/idle-2.png', import.meta.url).href,
    new URL('./assets/mutant/idle-3.png', import.meta.url).href,
    new URL('./assets/mutant/idle-4.png', import.meta.url).href,
  ],
  walk: [
    new URL('./assets/mutant/walk-1.png', import.meta.url).href,
    new URL('./assets/mutant/walk-2.png', import.meta.url).href,
    new URL('./assets/mutant/walk-3.png', import.meta.url).href,
    new URL('./assets/mutant/walk-4.png', import.meta.url).href,
  ],
  chase: [
    new URL('./assets/mutant/chase-1.png', import.meta.url).href,
    new URL('./assets/mutant/chase-2.png', import.meta.url).href,
    new URL('./assets/mutant/chase-3.png', import.meta.url).href,
    new URL('./assets/mutant/chase-4.png', import.meta.url).href,
  ],
}
const mutantSpriteCache = new Map<MutantAnimationMode, readonly HTMLImageElement[]>()
const motionSamples = new Map<string, MotionSample>()
const renderBufferCache = new WeakMap<HTMLCanvasElement, RenderBuffers>()

function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619)
  return hash >>> 0
}

export function mutantSpriteFrameIndex(mode: MutantAnimationMode, gameTime: number, phase = 0): number {
  const count = mutantSpriteSources[mode].length
  const frame = Math.floor(Math.max(0, gameTime) * MUTANT_FRAME_RATE[mode] + phase)
  return ((frame % count) + count) % count
}

function preloadMutantSprites(): void {
  if (mutantSpriteCache.size) return
  for (const mode of ['idle', 'walk', 'chase'] as const) {
    mutantSpriteCache.set(mode, mutantSpriteSources[mode].map(source => {
      const image = new Image()
      image.decoding = 'async'
      image.src = source
      void image.decode().catch(() => undefined)
      return image
    }))
  }
}

export type ProjectedWorldPoint = Readonly<{ x: number; y: number; depth: number }>

function cameraSpace(player: GameState['player'], point: Point): { forward: number; right: number } {
  const dx = point.x - player.x, dy = point.y - player.y
  return {
    forward: dx * Math.sin(player.heading) - dy * Math.cos(player.heading),
    right: dx * Math.cos(player.heading) + dy * Math.sin(player.heading),
  }
}

export function projectWorldPlanePoint(
  player: GameState['player'],
  point: Point,
  width: number,
  horizon: number,
  focal: number,
  plane: 'floor' | 'ceiling',
): ProjectedWorldPoint | null {
  const space = cameraSpace(player, point)
  if (space.forward < NEAR_PLANE || space.forward > MAX_RENDER_DISTANCE) return null
  return {
    x: width * 0.5 + focal * space.right / space.forward,
    y: horizon + (plane === 'floor' ? 1 : -1) * focal * CAMERA_HEIGHT / space.forward,
    depth: space.forward,
  }
}

function clipAndProjectLine(
  player: GameState['player'],
  a: Point,
  b: Point,
  width: number,
  horizon: number,
  focal: number,
  plane: 'floor' | 'ceiling',
): ProjectedLine | null {
  let start = { x: a.x, y: a.y }, end = { x: b.x, y: b.y }
  let da = cameraSpace(player, start).forward, db = cameraSpace(player, end).forward
  if ((da < NEAR_PLANE && db < NEAR_PLANE) || (da > MAX_RENDER_DISTANCE && db > MAX_RENDER_DISTANCE)) return null
  const clip = (limit: number, keepGreater: boolean): void => {
    const inA = keepGreater ? da >= limit : da <= limit
    const inB = keepGreater ? db >= limit : db <= limit
    if (inA === inB) return
    const t = (limit - da) / (db - da)
    const point = { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t }
    if (!inA) { start = point; da = limit }
    else { end = point; db = limit }
  }
  clip(NEAR_PLANE, true)
  clip(MAX_RENDER_DISTANCE, false)
  const projectedA = projectWorldPlanePoint(player, start, width, horizon, focal, plane)
  const projectedB = projectWorldPlanePoint(player, end, width, horizon, focal, plane)
  if (!projectedA || !projectedB) return null
  return { ax: projectedA.x, ay: projectedA.y, bx: projectedB.x, by: projectedB.y, depth: (projectedA.depth + projectedB.depth) * 0.5 }
}

function drawPlaneGrid(
  context: CanvasRenderingContext2D,
  map: DungeonMap,
  player: GameState['player'],
  width: number,
  horizon: number,
  focal: number,
  plane: 'floor' | 'ceiling',
): void {
  const buckets: ProjectedLine[][] = Array.from({ length: 5 }, () => [])
  const add = (a: Point, b: Point): void => {
    const line = clipAndProjectLine(player, a, b, width, horizon, focal, plane)
    if (!line) return
    buckets[Math.max(0, Math.min(4, Math.floor(line.depth / 5)))]!.push(line)
  }

  // Major grid lines are world anchored and spaced two cells apart.
  for (let y = 0; y < map.length; y++) for (let x = 0; x < (map[y]?.length ?? 0); x++) {
    if (!isFloor(map, x, y)) continue
    if (x % 2 === 0) add({ x, y }, { x, y: y + 1 })
    if (y % 2 === 0) add({ x, y }, { x: x + 1, y })
  }

  const alpha = plane === 'floor'
    ? [0.19, 0.13, 0.085, 0.05, 0.028]
    : [0.1, 0.07, 0.045, 0.026, 0.014]
  context.save()
  context.lineWidth = 0.8
  context.lineCap = 'square'
  for (let index = 0; index < buckets.length; index++) {
    context.strokeStyle = `rgba(55, 215, 110, ${alpha[index]!})`
    context.beginPath()
    for (const line of buckets[index]!) {
      context.moveTo(line.ax, line.ay)
      context.lineTo(line.bx, line.by)
    }
    context.stroke()
  }
  context.restore()
}

function drawGround(
  context: CanvasRenderingContext2D,
  map: DungeonMap,
  player: GameState['player'],
  width: number,
  height: number,
  horizon: number,
  focal: number,
): void {
  context.fillStyle = BACKGROUND
  context.fillRect(0, 0, width, height)
  drawPlaneGrid(context, map, player, width, horizon, focal, 'ceiling')
  drawPlaneGrid(context, map, player, width, horizon, focal, 'floor')
}

function fillDetail(context: CanvasRenderingContext2D, x: number, y: number, alpha: number, color = '70, 225, 130'): void {
  if (alpha <= 0.015 || !Number.isFinite(y)) return
  context.fillStyle = `rgba(${color}, ${Math.min(0.9, alpha)})`
  context.fillRect(x, y, 1.2, 1.05)
}

function drawWallDetails(
  context: CanvasRenderingContext2D,
  x: number,
  top: number,
  bottom: number,
  depth: number,
  offset: number,
): void {
  const height = bottom - top
  if (height < 2) return
  const fade = Math.max(0.035, 1 - depth / MAX_RENDER_DISTANCE)
  // One quiet horizontal panel break and one center seam are enough to read the wall plane.
  fillDetail(context, x, top + height * 0.5, 0.14 * fade, '55, 175, 95')
  if (Math.abs(offset - 0.5) < 0.7 / height) {
    context.fillStyle = `rgba(62, 190, 105, ${0.18 * fade})`
    context.fillRect(x, top + height * 0.12, 1, height * 0.76)
  }
}

function findDoorIndex(doors: readonly Door[], hit: { cell: { x: number; y: number }; side: 'vertical' | 'horizontal' }): number {
  return doors.findIndex(door => {
    if (hit.side === 'vertical' && door.from.x !== door.to.x) {
      const lowX = Math.min(door.from.x, door.to.x), highX = Math.max(door.from.x, door.to.x)
      return hit.cell.y === door.from.y && (hit.cell.x === lowX || hit.cell.x === highX)
    }
    if (hit.side === 'horizontal' && door.from.y !== door.to.y) {
      const lowY = Math.min(door.from.y, door.to.y), highY = Math.max(door.from.y, door.to.y)
      return hit.cell.x === door.from.x && (hit.cell.y === lowY || hit.cell.y === highY)
    }
    return false
  })
}

function drawClosedDoorColumn(
  context: CanvasRenderingContext2D,
  x: number,
  top: number,
  bottom: number,
  offset: number,
  depth: number,
  doorIndex: number,
  state: GameState,
): void {
  const height = bottom - top, u = Math.max(0, Math.min(1, offset))
  const fade = Math.max(0.12, 1 - depth / MAX_RENDER_DISTANCE)
  const motion = state.doorMotions?.[doorIndex]
  const progress = doorAnimationProgress(false, motion, state.time)
  if (u < 0.055 || u > 0.945) {
    fillDetail(context, x, top, 0.78 * fade, '103, 255, 165')
    fillDetail(context, x, bottom - 1, 0.78 * fade, '103, 255, 165')
  }
  const seam = motion?.fromOpen ? progress * 0.5 : 0.5
  if (Math.abs(u - seam) < 0.018 || Math.abs(u - (1 - seam)) < 0.018) {
    context.fillStyle = `rgba(88, 238, 143, ${0.46 * fade})`
    context.fillRect(x, top + height * 0.12, 1, height * 0.76)
  }
}

function openDoorIntersection(player: GameState['player'], directionX: number, directionY: number, door: Door): { distance: number; offset: number } | null {
  if (door.from.x !== door.to.x) {
    if (Math.abs(directionX) < 1e-8) return null
    const boundaryX = Math.max(door.from.x, door.to.x)
    const distance = (boundaryX - player.x) / directionX
    const y = player.y + directionY * distance
    const offset = y - Math.min(door.from.y, door.to.y)
    return distance > NEAR_PLANE && offset >= 0 && offset <= 1 ? { distance, offset } : null
  }
  if (Math.abs(directionY) < 1e-8) return null
  const boundaryY = Math.max(door.from.y, door.to.y)
  const distance = (boundaryY - player.y) / directionY
  const x = player.x + directionX * distance
  const offset = x - Math.min(door.from.x, door.to.x)
  return distance > NEAR_PLANE && offset >= 0 && offset <= 1 ? { distance, offset } : null
}

function drawOpenDoorFrames(
  context: CanvasRenderingContext2D,
  player: GameState['player'],
  doors: readonly Door[],
  state: GameState,
  width: number,
  horizon: number,
  focal: number,
  wallDepth: Float32Array,
): void {
  const openDoorIndices = doors.flatMap((_, index) => state.openDoors[index] ? [index] : [])
  if (!openDoorIndices.length) return
  for (let x = 0; x < wallDepth.length; x++) {
    const relativeAngle = Math.atan((x + 0.5 - width / 2) / focal)
    const angle = player.heading + relativeAngle
    const directionX = Math.sin(angle), directionY = -Math.cos(angle)
    for (const index of openDoorIndices) {
      const intersection = openDoorIntersection(player, directionX, directionY, doors[index]!)
      if (!intersection) continue
      const depth = intersection.distance * Math.cos(relativeAngle)
      if (depth >= wallDepth[x]!) continue
      const top = horizon - focal * WALL_HEIGHT * 0.5 / depth
      const bottom = horizon + focal * WALL_HEIGHT * 0.5 / depth
      const height = bottom - top, u = intersection.offset
      const fade = Math.max(0.12, 1 - depth / MAX_RENDER_DISTANCE)
      if (u < 0.055 || u > 0.945) {
        fillDetail(context, x, top, 0.76 * fade, '103, 255, 165')
        fillDetail(context, x, bottom - 1, 0.76 * fade, '103, 255, 165')
      }
      const progress = doorAnimationProgress(true, state.doorMotions?.[index], state.time)
      const leftRail = 0.5 - 0.44 * progress, rightRail = 0.5 + 0.44 * progress
      if (Math.abs(u - leftRail) < 0.018 || Math.abs(u - rightRail) < 0.018) {
        context.fillStyle = `rgba(103, 255, 165, ${0.65 * fade})`
        context.fillRect(x, top + height * 0.06, 1, height * 0.88)
      }
    }
  }
}

function drawWallOutlines(
  context: CanvasRenderingContext2D,
  wallDepth: Float32Array,
  tops: Float32Array,
  bottoms: Float32Array,
  hitKeys: Array<string | undefined>,
): void {
  for (let bucket = 0; bucket < 5; bucket++) {
    const alpha = [0.56, 0.4, 0.29, 0.19, 0.12][bucket]!
    for (const edges of [tops, bottoms]) {
      context.beginPath()
      let open = false
      for (let x = 0; x < wallDepth.length; x++) {
        if (!Number.isFinite(wallDepth[x]) || Math.floor(wallDepth[x]! / 5) !== bucket) { open = false; continue }
        if (!open) { context.moveTo(x, edges[x]!); open = true }
        else context.lineTo(x, edges[x]!)
      }
      context.strokeStyle = `rgba(78, 225, 130, ${alpha})`
      context.lineWidth = 1
      context.stroke()
    }
  }

  context.beginPath()
  for (let x = 1; x < wallDepth.length; x++) {
    if (!hitKeys[x] || !hitKeys[x - 1] || hitKeys[x] === hitKeys[x - 1]) continue
    context.moveTo(x, Math.min(tops[x]!, tops[x - 1]!))
    context.lineTo(x, Math.max(bottoms[x]!, bottoms[x - 1]!))
  }
  context.strokeStyle = 'rgba(74, 218, 128, 0.36)'
  context.lineWidth = 1
  context.stroke()
}

function drawSprite(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  centerX: number,
  top: number,
  spriteWidth: number,
  spriteHeight: number,
  forward: number,
  wallDepth: Float32Array,
  width: number,
  screenHeight: number,
): boolean {
  const left = centerX - spriteWidth / 2, right = centerX + spriteWidth / 2
  const first = Math.max(0, Math.floor(left)), last = Math.min(width - 1, Math.ceil(right))
  if (first > last) return false
  let visible = false
  context.save()
  context.beginPath()
  for (let x = first; x <= last; x++) {
    if (wallDepth[x]! <= forward) continue
    context.rect(x, 0, 1, screenHeight)
    visible = true
  }
  if (visible) {
    context.clip()
    context.imageSmoothingEnabled = true
    context.drawImage(image, left, top, spriteWidth, spriteHeight)
  }
  context.restore()
  return visible
}

function enemySpeed(enemy: Enemy, gameTime: number): number {
  const previous = motionSamples.get(enemy.id)
  if (!previous) {
    motionSamples.set(enemy.id, { x: enemy.x, y: enemy.y, time: gameTime, speed: 0 })
    return 0
  }
  if (gameTime > previous.time + 1e-5) {
    const speed = Math.hypot(enemy.x - previous.x, enemy.y - previous.y) / (gameTime - previous.time)
    motionSamples.set(enemy.id, { x: enemy.x, y: enemy.y, time: gameTime, speed })
    return speed
  }
  return previous.speed
}

function drawEnemySprites(
  context: CanvasRenderingContext2D,
  state: GameState,
  width: number,
  height: number,
  horizon: number,
  focal: number,
  wallDepth: Float32Array,
): string[] {
  const player = state.player
  const sprites = state.enemies.map(enemy => {
    const dx = enemy.x - player.x, dy = enemy.y - player.y
    const forward = dx * Math.sin(player.heading) - dy * Math.cos(player.heading)
    const right = dx * Math.cos(player.heading) + dy * Math.sin(player.heading)
    const mode = mutantAnimationMode(enemy.alerted, enemySpeed(enemy, state.time))
    return { enemy, forward, right, mode }
  }).filter(item => item.forward > NEAR_PLANE).sort((a, b) => b.forward - a.forward)

  const visible: string[] = []
  const liveIds = new Set(state.enemies.map(enemy => enemy.id))
  for (const id of motionSamples.keys()) if (!liveIds.has(id)) motionSamples.delete(id)

  for (const item of sprites) {
    const frames = mutantSpriteCache.get(item.mode)
    if (!frames?.length) continue
    const phase = hashString(item.enemy.id) % frames.length
    const image = frames[mutantSpriteFrameIndex(item.mode, state.time, phase)]!
    if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) continue

    const centerX = width / 2 + focal * item.right / item.forward
    const spriteHeight = focal * 1.18 / item.forward
    const spriteWidth = spriteHeight * 0.82
    const bottom = horizon + focal * CAMERA_HEIGHT / item.forward
    const top = bottom - spriteHeight
    if (centerX + spriteWidth / 2 < 0 || centerX - spriteWidth / 2 > width) continue
    if (drawSprite(context, image, centerX, top, spriteWidth, spriteHeight, item.forward, wallDepth, Math.ceil(width), height)) {
      visible.push(item.enemy.id)
    }
  }
  return visible
}

function getRenderBuffers(canvas: HTMLCanvasElement, pixelCount: number): RenderBuffers {
  let buffers = renderBufferCache.get(canvas)
  if (!buffers || buffers.wallDepth.length !== pixelCount) {
    buffers = {
      wallDepth: new Float32Array(pixelCount),
      tops: new Float32Array(pixelCount),
      bottoms: new Float32Array(pixelCount),
      hitKeys: Array.from({ length: pixelCount }),
      hits: Array.from({ length: pixelCount }, () => null),
    }
    renderBufferCache.set(canvas, buffers)
  }
  buffers.wallDepth.fill(Infinity)
  buffers.tops.fill(0)
  buffers.bottoms.fill(0)
  buffers.hitKeys.fill(undefined)
  buffers.hits.fill(null)
  return buffers
}

export function renderDungeon(
  canvas: HTMLCanvasElement,
  state: GameState,
  map: DungeonMap = DUNGEON_MAP,
  doors: readonly Door[] = map === DUNGEON_MAP ? DOORS : [],
): readonly string[] {
  preloadMutantSprites()
  const bounds = canvas.getBoundingClientRect()
  const cssWidth = Math.max(1, bounds.width), cssHeight = Math.max(1, bounds.height)
  const ratio = Math.min(2, window.devicePixelRatio || 1)
  const width = Math.max(1, Math.round(cssWidth * ratio)), height = Math.max(1, Math.round(cssHeight * ratio))
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height }
  const context = canvas.getContext('2d')!
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  const w = cssWidth, h = cssHeight, horizon = h * 0.49
  const focal = w / (2 * Math.tan(FIELD_OF_VIEW / 2))
  const pixelCount = Math.ceil(w)
  drawGround(context, map, state.player, w, h, horizon, focal)

  const { wallDepth, tops, bottoms, hitKeys, hits } = getRenderBuffers(canvas, pixelCount)
  const rayDirection = { x: 0, y: 0 }
  for (let x = 0; x < pixelCount; x++) {
    const relativeAngle = Math.atan((x + 0.5 - w / 2) / focal)
    const angle = state.player.heading + relativeAngle
    rayDirection.x = Math.sin(angle)
    rayDirection.y = -Math.cos(angle)
    const hit = castRay(map, state.player, rayDirection, doors, state.openDoors, MAX_RENDER_DISTANCE)
    if (!hit) continue
    hits[x] = hit
    hitKeys[x] = `${hit.kind}:${hit.side}:${hit.cell.x},${hit.cell.y}`
    const distance = Math.max(0.04, hit.distance * Math.cos(relativeAngle))
    wallDepth[x] = distance
    const projectedHeight = focal * WALL_HEIGHT / distance
    const top = horizon - projectedHeight * 0.5
    const bottom = horizon + projectedHeight * 0.5
    tops[x] = top
    bottoms[x] = bottom
    context.fillStyle = BACKGROUND
    context.fillRect(x, top, 1.15, projectedHeight)
  }

  context.save()
  drawWallOutlines(context, wallDepth, tops, bottoms, hitKeys)
  context.restore()

  for (let x = 0; x < pixelCount; x++) {
    const hit = hits[x]
    if (!hit) continue
    if (hit.kind === 'door') {
      const index = findDoorIndex(doors, hit)
      drawClosedDoorColumn(context, x, tops[x]!, bottoms[x]!, hit.offset, wallDepth[x]!, index, state)
    } else drawWallDetails(context, x, tops[x]!, bottoms[x]!, wallDepth[x]!, hit.offset)
  }
  drawOpenDoorFrames(context, state.player, doors, state, w, horizon, focal, wallDepth)
  return drawEnemySprites(context, state, w, h, horizon, focal, wallDepth)
}
