import { doorAnimationProgress, mutantAnimationMode, mutantPose } from './animation.ts'
import { DOORS, DUNGEON_MAP, doorSegment, isFloor } from './dungeon.ts'
import type { Door, DungeonMap, Point } from './dungeon.ts'
import type { Enemy } from './enemy.ts'
import type { GameState } from './game.ts'
import { castRay } from './raycast.ts'

const FIELD_OF_VIEW = Math.PI * 0.4
const WALL_HEIGHT = 1
const CAMERA_HEIGHT = 0.5
const BACKGROUND = '#010302'
const NEAR_PLANE = 0.12
const MAX_RENDER_DISTANCE = 24
const MUTANT_WIDTH = 112
const MUTANT_HEIGHT = 176

type PlaneFeature = Readonly<{ x: number; y: number; kind: 'hatch' | 'grate' | 'light'; seed: number }>
type ProjectedLine = Readonly<{ ax: number; ay: number; bx: number; by: number; depth: number }>
type SpriteTexture = { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; opaqueColumns: Uint8Array }
type MotionSample = { x: number; y: number; time: number; speed: number }

const planeFeatureCache = new WeakMap<DungeonMap, readonly PlaneFeature[]>()
const wallPatternCache = new Map<string, number>()
const spriteCache = new Map<string, SpriteTexture>()
const motionSamples = new Map<string, MotionSample>()

function hashCell(x: number, y: number, side = 0): number {
  let value = Math.imul(x + 71, 0x45d9f3b) ^ Math.imul(y + 113, 0x119de1f3) ^ Math.imul(side + 17, 0x3449)
  value ^= value >>> 16
  value = Math.imul(value, 0x45d9f3b)
  value ^= value >>> 16
  return value >>> 0
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619)
  return hash >>> 0
}

function getPlaneFeatures(map: DungeonMap): readonly PlaneFeature[] {
  const cached = planeFeatureCache.get(map)
  if (cached) return cached
  const features: PlaneFeature[] = []
  for (let y = 0; y < map.length; y++) for (let x = 0; x < (map[y]?.length ?? 0); x++) {
    if (!isFloor(map, x, y)) continue
    const seed = hashCell(x, y)
    if (seed % 11 === 0) features.push({ x, y, kind: 'hatch', seed })
    else if (seed % 7 === 0) features.push({ x, y, kind: 'grate', seed })
    if (seed % 19 === 2) features.push({ x, y, kind: 'light', seed })
  }
  planeFeatureCache.set(map, features)
  return features
}

function wallPattern(x: number, y: number, side: 'vertical' | 'horizontal'): number {
  const key = `${x},${y},${side}`
  const cached = wallPatternCache.get(key)
  if (cached !== undefined) return cached
  const pattern = hashCell(x, y, side === 'vertical' ? 1 : 2) % 4
  wallPatternCache.set(key, pattern)
  return pattern
}

function cameraSpace(player: GameState['player'], point: Point): { forward: number; right: number } {
  const dx = point.x - player.x, dy = point.y - player.y
  return {
    forward: dx * Math.sin(player.heading) - dy * Math.cos(player.heading),
    right: dx * Math.cos(player.heading) + dy * Math.sin(player.heading),
  }
}

export type ProjectedWorldPoint = Readonly<{ x: number; y: number; depth: number }>

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

function drawProjectedPolyline(
  context: CanvasRenderingContext2D,
  player: GameState['player'],
  points: readonly Point[],
  width: number,
  horizon: number,
  focal: number,
  plane: 'floor' | 'ceiling',
): number {
  let totalDepth = 0, count = 0
  context.beginPath()
  for (let index = 1; index < points.length; index++) {
    const line = clipAndProjectLine(player, points[index - 1]!, points[index]!, width, horizon, focal, plane)
    if (!line) continue
    context.moveTo(line.ax, line.ay)
    context.lineTo(line.bx, line.by)
    totalDepth += line.depth
    count++
  }
  context.stroke()
  return count ? totalDepth / count : MAX_RENDER_DISTANCE
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
  const minorBuckets: ProjectedLine[][] = Array.from({ length: 5 }, () => [])
  const add = (a: Point, b: Point, minor = false): void => {
    const line = clipAndProjectLine(player, a, b, width, horizon, focal, plane)
    if (!line) return
    const bucket = Math.max(0, Math.min(4, Math.floor(line.depth / 5)))
    const destination = minor ? minorBuckets : buckets
    destination[bucket]!.push(line)
  }

  for (let y = 0; y < map.length; y++) for (let x = 0; x < (map[y]?.length ?? 0); x++) {
    if (!isFloor(map, x, y)) continue
    add({ x: x + 1, y }, { x: x + 1, y: y + 1 })
    add({ x, y: y + 1 }, { x: x + 1, y: y + 1 })
    if (!isFloor(map, x - 1, y)) add({ x, y }, { x, y: y + 1 })
    if (!isFloor(map, x, y - 1)) add({ x, y }, { x: x + 1, y })
    add({ x: x + 0.5, y: y + 0.08 }, { x: x + 0.5, y: y + 0.92 }, true)
    add({ x: x + 0.08, y: y + 0.5 }, { x: x + 0.92, y: y + 0.5 }, true)
  }

  context.save()
  context.lineWidth = plane === 'ceiling' ? 0.8 : 1
  context.lineCap = 'square'
  for (let index = 0; index < buckets.length; index++) {
    const alpha = plane === 'floor' ? [0.3, 0.22, 0.15, 0.1, 0.06][index]! : [0.18, 0.13, 0.09, 0.062, 0.04][index]!
    context.strokeStyle = `rgba(53, 205, 118, ${alpha})`
    context.beginPath()
    for (const line of buckets[index]!) { context.moveTo(line.ax, line.ay); context.lineTo(line.bx, line.by) }
    context.stroke()
    context.strokeStyle = `rgba(47, 178, 105, ${plane === 'floor' ? [0.16, 0.11, 0.075, 0.048, 0.028][index]! : [0.09, 0.065, 0.045, 0.03, 0.02][index]!})`
    context.lineWidth = 0.7
    context.beginPath()
    for (const line of minorBuckets[index]!) { context.moveTo(line.ax, line.ay); context.lineTo(line.bx, line.by) }
    context.stroke()
  }

  for (const feature of getPlaneFeatures(map)) {
    if (plane === 'floor' && feature.kind === 'light') continue
    if (plane === 'ceiling' && feature.kind === 'hatch') continue
    const { x, y } = feature
    const inset = feature.kind === 'hatch' ? 0.2 : 0.27
    const box = [
      { x: x + inset, y: y + inset }, { x: x + 1 - inset, y: y + inset },
      { x: x + 1 - inset, y: y + 1 - inset }, { x: x + inset, y: y + 1 - inset },
      { x: x + inset, y: y + inset },
    ]
    const pulse = 0.55 + Math.sin(feature.seed * 0.003 + (plane === 'ceiling' ? 1.8 : 0)) * 0.04
    const detailAlpha = plane === 'ceiling' ? (feature.kind === 'light' ? pulse : 0.12) : 0.17
    context.save()
    context.lineWidth = plane === 'ceiling' && feature.kind === 'light' ? 1.2 : 0.8
    context.strokeStyle = `rgba(${plane === 'ceiling' ? '105, 255, 170' : '50, 190, 108'}, ${detailAlpha})`
    if (plane === 'ceiling' && feature.kind === 'light') context.shadowColor = 'rgba(64, 255, 150, 0.22)'
    context.shadowBlur = plane === 'ceiling' && feature.kind === 'light' ? 3 : 0
    const depth = drawProjectedPolyline(context, player, box, width, horizon, focal, plane)
    if (feature.kind === 'grate') {
      for (let line = 1; line <= 3; line++) {
        const offset = inset + (1 - inset * 2) * line / 4
        drawProjectedPolyline(context, player, [{ x: x + inset, y: y + offset }, { x: x + 1 - inset, y: y + offset }], width, horizon, focal, plane)
      }
    } else if (feature.kind === 'hatch') {
      drawProjectedPolyline(context, player, [{ x: x + inset, y: y + inset }, { x: x + 0.5, y: y + 0.5 }, { x: x + 1 - inset, y: y + 1 - inset }], width, horizon, focal, plane)
      drawProjectedPolyline(context, player, [{ x: x + 1 - inset, y: y + inset }, { x: x + 0.5, y: y + 0.5 }], width, horizon, focal, plane)
    } else {
      drawProjectedPolyline(context, player, [{ x: x + 0.5, y: y + inset }, { x: x + 0.5, y: y + 1 - inset }], width, horizon, focal, plane)
    }
    // A few near ceiling fixtures carry a restrained animated glow; the feature
    // coordinates remain fixed in the dungeon world while their intensity pulses.
    if (plane === 'ceiling' && feature.kind === 'light' && depth < 9) {
      context.fillStyle = `rgba(71, 255, 151, ${0.12 + pulse * 0.1})`
      const center = clipAndProjectLine(player, { x: x + 0.5, y: y + 0.5 }, { x: x + 0.5, y: y + 0.5 + 0.001 }, width, horizon, focal, plane)
      if (center) context.fillRect(center.ax - 1, center.ay - 1, 2, 2)
    }
    context.restore()
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
  time: number,
): void {
  context.fillStyle = BACKGROUND
  context.fillRect(0, 0, width, height)
  drawPlaneGrid(context, map, player, width, horizon, focal, 'ceiling')
  // The ceiling fixtures use game time too, so this second pass only changes
  // the restrained glow and leaves every panel anchored to world coordinates.
  if (time > 0) drawCeilingPulse(context, map, player, width, horizon, focal, time)
  drawPlaneGrid(context, map, player, width, horizon, focal, 'floor')
}

function drawCeilingPulse(
  context: CanvasRenderingContext2D,
  map: DungeonMap,
  player: GameState['player'],
  width: number,
  horizon: number,
  focal: number,
  time: number,
): void {
  for (const feature of getPlaneFeatures(map)) {
    if (feature.kind !== 'light') continue
    const center = clipAndProjectLine(player, { x: feature.x + 0.5, y: feature.y + 0.5 }, { x: feature.x + 0.501, y: feature.y + 0.5 }, width, horizon, focal, 'ceiling')
    if (!center || center.depth > 13) continue
    const pulse = 0.55 + Math.sin(time * 2.15 + feature.seed * 0.013) * 0.18
    const size = Math.max(1, Math.min(4, focal * 0.012 / center.depth))
    context.save()
    context.fillStyle = `rgba(81, 255, 158, ${0.08 + pulse * 0.11})`
    context.shadowColor = 'rgba(59, 255, 145, 0.36)'
    context.shadowBlur = Math.min(5, size * 1.4)
    context.fillRect(center.ax - size / 2, center.ay - size / 2, size, size)
    context.restore()
  }
}

function fillDetail(context: CanvasRenderingContext2D, x: number, y: number, alpha: number, color = '74, 231, 139'): void {
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
  cell: { x: number; y: number },
  side: 'vertical' | 'horizontal',
  time: number,
): void {
  const h = bottom - top
  if (h < 2) return
  const u = Math.max(0, Math.min(1, offset))
  const pattern = wallPattern(cell.x, cell.y, side)
  const fade = Math.max(0.08, 1 - depth * 0.048)
  const seamColor = '80, 232, 148'
  const brightColor = '127, 255, 174'
  const verticalSeams = [
    [0.055, 0.085, 0.17, 0.5, 0.83, 0.915, 0.945],
    [0.055, 0.11, 0.34, 0.66, 0.89, 0.945],
    [0.055, 0.15, 0.26, 0.74, 0.85, 0.945],
    [0.055, 0.12, 0.46, 0.54, 0.88, 0.945],
  ][pattern]!
  const horizontalSeams = [
    [0.11, 0.14, 0.5, 0.86, 0.89],
    [0.1, 0.46, 0.5, 0.54, 0.9],
    [0.1, 0.28, 0.72, 0.9],
    [0.12, 0.2, 0.8, 0.88],
  ][pattern]!
  for (const seam of verticalSeams) if (Math.abs(u - seam) < 0.013) {
    const inset = seam === 0.055 || seam === 0.945 ? 0 : h * 0.06
    fillDetail(context, x, top + inset, 0.52 * fade, seamColor)
    if (seam === 0.085 || seam === 0.915) fillDetail(context, x, top + inset + 2, 0.3 * fade, seamColor)
    if (seam === 0.5 && pattern === 0) fillDetail(context, x, top + inset, 0.65 * fade, brightColor)
  }
  for (const seam of horizontalSeams) {
    const y = top + h * seam
    // Every ray contributes one short segment, producing continuous world-face panel seams.
    fillDetail(context, x, y, 0.46 * fade, seamColor)
  }

  const grille = pattern === 1 || pattern === 3
  if (grille) {
    const left = pattern === 1 ? 0.17 : 0.58
    const right = pattern === 1 ? 0.31 : 0.72
    if (u >= left && u <= right) {
      const normalizedU = (u - left) / (right - left)
      for (let bar = 0; bar < 5; bar++) {
        const y = top + h * (0.31 + bar * 0.035 + normalizedU * 0.008)
        fillDetail(context, x, y, 0.38 * fade, '61, 194, 117')
      }
      if (Math.abs(u - left) < 0.014 || Math.abs(u - right) < 0.014) {
        fillDetail(context, x, top + h * 0.29, 0.48 * fade)
        fillDetail(context, x, top + h * 0.47, 0.48 * fade)
      }
    }
  }

  // Inspection plates vary by cell: inset rectangles, clipped diagonals and small fasteners.
  const hatchCenter = pattern === 2 ? 0.5 : pattern === 0 ? 0.71 : 0.4
  const hatchHalfWidth = pattern === 2 ? 0.14 : 0.075
  const hatchTop = pattern === 2 ? 0.26 : 0.58
  const hatchBottom = pattern === 2 ? 0.74 : 0.77
  if (Math.abs(u - (hatchCenter - hatchHalfWidth)) < 0.013 || Math.abs(u - (hatchCenter + hatchHalfWidth)) < 0.013) {
    fillDetail(context, x, top + h * hatchTop, 0.55 * fade)
    fillDetail(context, x, top + h * hatchBottom, 0.55 * fade)
  }
  if (u >= hatchCenter - hatchHalfWidth && u <= hatchCenter + hatchHalfWidth) {
    const across = (u - hatchCenter) / hatchHalfWidth
    fillDetail(context, x, top + h * (hatchTop + Math.abs(across) * 0.025), 0.5 * fade)
    fillDetail(context, x, top + h * (hatchBottom - Math.abs(across) * 0.025), 0.5 * fade)
    const diagonalY = top + h * (hatchTop + (hatchBottom - hatchTop) * ((across + 1) / 2))
    if (pattern === 2 && Math.abs(top + h * 0.5 - diagonalY) < 1.5) fillDetail(context, x, top + h * 0.5, 0.28 * fade, '68, 206, 127')
  }

  const indicatorU = (hashCell(cell.x, cell.y, side === 'vertical' ? 31 : 32) % 3) * 0.11 + 0.24
  const indicatorY = 0.2 + (hashCell(cell.x, cell.y, 8) % 5) * 0.11
  if (Math.abs(u - indicatorU) < 0.018 && Math.abs(top + h * indicatorY - Math.round(top + h * indicatorY)) < 2) {
    const pulse = 0.55 + Math.sin(time * 2.6 + cell.x * 2.1 + cell.y * 3.3) * 0.35
    fillDetail(context, x, top + h * indicatorY, (0.55 + pulse * 0.35) * fade, '102, 255, 164')
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
  const h = bottom - top, u = Math.max(0, Math.min(1, offset))
  const fade = Math.max(0.1, 1 - depth * 0.05)
  const motion = state.doorMotions?.[doorIndex]
  const progress = doorAnimationProgress(false, motion, state.time)
  // The opaque shutter follows the logical closed state immediately. Its rails and
  // seam animate within the shutter face, so they never open a visual collision gap.
  if (u < 0.065 || u > 0.935) {
    fillDetail(context, x, top, 0.8 * fade, '105, 255, 171')
    fillDetail(context, x, bottom - 1, 0.8 * fade, '105, 255, 171')
    fillDetail(context, x, top + h * 0.04, 0.48 * fade)
    fillDetail(context, x, bottom - h * 0.04, 0.48 * fade)
  }
  for (const y of [0.12, 0.2, 0.8, 0.88]) fillDetail(context, x, top + h * y, 0.42 * fade)
  if (Math.abs(u - 0.5) < 0.018) {
    fillDetail(context, x, top + h * 0.08, 0.85 * fade, '118, 255, 180')
    fillDetail(context, x, top + h * 0.92, 0.85 * fade, '118, 255, 180')
  }
  const seamU = motion?.fromOpen ? 0.5 - (0.5 - progress * 0.5) : 0.5
  if (Math.abs(u - seamU) < 0.013 || Math.abs(u - (1 - seamU)) < 0.013) {
    fillDetail(context, x, top + h * 0.22, (0.3 + progress * 0.35) * fade)
    fillDetail(context, x, top + h * 0.78, (0.3 + progress * 0.35) * fade)
  }
  const lamp = 0.42 + Math.sin(state.time * 2.8 + doorIndex * 1.7) * 0.2
  if (Math.abs(u - 0.09) < 0.02) fillDetail(context, x, top + h * 0.31, lamp * fade, '111, 255, 162')
}

function openDoorIntersection(player: GameState['player'], direction: Point, door: Door): { distance: number; offset: number } | null {
  const [a, b] = doorSegment(door)
  if (Math.abs(a.x - b.x) < 1e-8) {
    if (Math.abs(direction.x) < 1e-8) return null
    const distance = (a.x - player.x) / direction.x
    const y = player.y + direction.y * distance
    const offset = y - Math.min(a.y, b.y)
    return distance > NEAR_PLANE && offset >= 0 && offset <= 1 ? { distance, offset } : null
  }
  if (Math.abs(direction.y) < 1e-8) return null
  const distance = (a.y - player.y) / direction.y
  const x = player.x + direction.x * distance
  const offset = x - Math.min(a.x, b.x)
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
  zBuffer: Float32Array,
): void {
  const count = zBuffer.length
  for (let x = 0; x < count; x++) {
    const relativeAngle = Math.atan((x + 0.5 - width / 2) / focal)
    const angle = player.heading + relativeAngle
    const direction = { x: Math.sin(angle), y: -Math.cos(angle) }
    for (let index = 0; index < doors.length; index++) {
      if (!state.openDoors[index]) continue
      const intersection = openDoorIntersection(player, direction, doors[index]!)
      if (!intersection) continue
      const depth = intersection.distance * Math.cos(relativeAngle)
      if (depth >= zBuffer[x]!) continue
      const top = horizon - focal * WALL_HEIGHT * 0.5 / depth
      const bottom = horizon + focal * WALL_HEIGHT * 0.5 / depth
      const height = bottom - top
      const fade = Math.max(0.12, 1 - depth * 0.05)
      const u = intersection.offset
      if (u < 0.055 || u > 0.945) {
        fillDetail(context, x, top, 0.74 * fade, '102, 255, 166')
        fillDetail(context, x, top + height * 0.045, 0.35 * fade)
        fillDetail(context, x, bottom - 1, 0.74 * fade, '102, 255, 166')
      }
      fillDetail(context, x, top, 0.38 * fade, '74, 222, 128')
      const progress = doorAnimationProgress(true, state.doorMotions?.[index], state.time)
      if (progress < 1) {
        const leftRail = 0.5 - 0.44 * progress, rightRail = 0.5 + 0.44 * progress
        if (Math.abs(u - leftRail) < 0.013 || Math.abs(u - rightRail) < 0.013) {
          fillDetail(context, x, top + height * 0.32, 0.58 * fade, '125, 255, 178')
          fillDetail(context, x, top + height * 0.68, 0.58 * fade, '125, 255, 178')
        }
      }
      const signal = 0.25 + Math.sin(state.time * 3.2 + index * 1.4) * 0.1
      if (u < 0.07 || u > 0.93) fillDetail(context, x, top + height * 0.28, signal * fade, '107, 255, 165')
    }
  }
}

function drawHead(context: CanvasRenderingContext2D, pose: ReturnType<typeof mutantPose>): void {
  context.save()
  context.translate(51, 27 + pose.headNod)
  context.rotate(pose.headTilt)
  context.strokeStyle = '#47ec91'
  context.lineWidth = 1.5
  context.beginPath()
  context.moveTo(-12, 4); context.lineTo(-15, -7); context.lineTo(-10, -13)
  context.lineTo(-8, -23); context.lineTo(-3, -18); context.lineTo(0, -28)
  context.lineTo(4, -20); context.lineTo(10, -24); context.lineTo(11, -15)
  context.lineTo(16, -8); context.lineTo(14, 5); context.lineTo(10, 13)
  context.lineTo(2, 17); context.lineTo(-8, 13); context.closePath(); context.stroke()
  context.strokeStyle = 'rgba(31, 170, 102, 0.9)'
  context.lineWidth = 0.8
  context.beginPath()
  context.moveTo(-9, -13); context.lineTo(-4, -8); context.lineTo(0, -11); context.lineTo(5, -7); context.lineTo(11, -13)
  context.moveTo(-13, -4); context.lineTo(-7, -1); context.moveTo(13, -2); context.lineTo(8, 1)
  context.moveTo(-6, 13); context.lineTo(-2, 7); context.lineTo(5, 13)
  context.stroke()

  context.strokeStyle = '#79ffb4'
  context.lineWidth = 1.2
  context.beginPath()
  context.moveTo(-8, -4); context.lineTo(-3, -2)
  context.moveTo(5, -2); context.lineTo(10, -5)
  context.stroke()
  context.fillStyle = '#75ffad'
  context.fillRect(-5, -3, 2.2, 1.5)
  context.fillRect(7, -4, 2.2, 1.5)

  const mouthOpen = 3 + pose.mouth * 7
  context.fillStyle = '#010302'
  context.strokeStyle = '#40d783'
  context.lineWidth = 1.1
  context.beginPath()
  context.moveTo(-7, 4); context.quadraticCurveTo(0, 3 - mouthOpen, 8, 3)
  context.lineTo(5, 8 + mouthOpen * 0.4); context.quadraticCurveTo(0, 11 + mouthOpen * 0.45, -6, 8)
  context.closePath(); context.fill(); context.stroke()
  context.fillStyle = '#a3ffc7'
  context.beginPath()
  for (let tooth = 0; tooth < 5; tooth++) {
    const tx = -5 + tooth * 2.4
    context.moveTo(tx, 4); context.lineTo(tx + 1.1, 4); context.lineTo(tx + 0.55, 4 + 2.7 + pose.mouth * 1.2); context.closePath()
  }
  for (let tooth = 0; tooth < 4; tooth++) {
    const tx = -4 + tooth * 2.6
    context.moveTo(tx, 8 + mouthOpen * 0.35); context.lineTo(tx + 1.1, 8 + mouthOpen * 0.35); context.lineTo(tx + 0.55, 6 + mouthOpen * 0.17); context.closePath()
  }
  context.fill()
  context.strokeStyle = 'rgba(104, 255, 170, 0.8)'
  context.beginPath()
  context.moveTo(-12, -15); context.lineTo(-19, -22); context.lineTo(-17, -13)
  context.moveTo(10, -18); context.lineTo(17, -25); context.lineTo(14, -14)
  context.moveTo(1, -21); context.lineTo(5, -31); context.lineTo(7, -20)
  context.stroke()
  context.restore()
}

function drawTorso(context: CanvasRenderingContext2D, pose: ReturnType<typeof mutantPose>): void {
  context.save()
  context.translate(49, 74 + pose.bob)
  context.rotate(pose.lean)
  context.scale(1, pose.breath)
  context.strokeStyle = '#42d982'
  context.lineWidth = 1.5
  context.beginPath()
  context.moveTo(-17, -19); context.lineTo(-8, -29); context.lineTo(2, -27); context.lineTo(13, -22)
  context.lineTo(18, -10); context.lineTo(13, 4); context.lineTo(11, 20); context.lineTo(7, 31)
  context.lineTo(-7, 30); context.lineTo(-12, 19); context.lineTo(-15, 6); context.lineTo(-19, -6); context.closePath()
  context.stroke()
  context.strokeStyle = 'rgba(29, 155, 93, 0.96)'
  context.lineWidth = 0.9
  context.beginPath()
  context.moveTo(-15, -18); context.lineTo(-4, -11); context.lineTo(0, -19); context.lineTo(11, -11)
  context.moveTo(-17, -10); context.quadraticCurveTo(-4, -4, 0, -8); context.quadraticCurveTo(6, -3, 16, -10)
  context.moveTo(-15, -2); context.quadraticCurveTo(-4, 3, 0, -1); context.quadraticCurveTo(7, 4, 14, -2)
  context.moveTo(-13, 6); context.quadraticCurveTo(-4, 11, 0, 7); context.quadraticCurveTo(6, 12, 12, 6)
  context.moveTo(-11, 14); context.lineTo(0, 18); context.lineTo(10, 13)
  context.moveTo(-7, -25); context.lineTo(-3, -17); context.lineTo(2, -24); context.lineTo(7, -17)
  context.moveTo(0, -20); context.lineTo(0, 23); context.moveTo(4, -14); context.lineTo(9, -5); context.lineTo(5, 5)
  context.moveTo(-6, 4); context.lineTo(-10, 11); context.lineTo(-5, 20)
  context.stroke()
  context.strokeStyle = '#63f5a0'
  context.lineWidth = 1.2
  context.beginPath()
  context.moveTo(-12, -27); context.lineTo(-22, -25); context.lineTo(-25, -18)
  context.moveTo(13, -21); context.lineTo(20, -17); context.lineTo(17, -8)
  context.moveTo(-9, 25); context.lineTo(-3, 31); context.lineTo(6, 27)
  context.stroke()
  context.fillStyle = '#54f49a'
  context.fillRect(-2, -5, 3, 3)
  context.restore()
}

function drawArm(context: CanvasRenderingContext2D, side: -1 | 1, angle: number, reach: number): void {
  const shoulder = side < 0 ? 33 : 65
  context.save()
  context.translate(shoulder, 51)
  context.rotate(angle)
  context.scale(side, 1)
  context.strokeStyle = '#40d47f'
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(0, 0); context.lineTo(11, 21); context.lineTo(14, 44); context.lineTo(13 + reach * 16, 61 + reach * 8)
  context.moveTo(4, 3); context.lineTo(15, 17); context.lineTo(18, 41); context.lineTo(18 + reach * 13, 57 + reach * 8)
  context.moveTo(0, 0); context.lineTo(6, -4); context.lineTo(14, 2)
  context.stroke()
  context.strokeStyle = 'rgba(27, 142, 84, 0.98)'
  context.lineWidth = 0.9
  context.beginPath()
  context.moveTo(5, 8); context.lineTo(14, 11); context.lineTo(20, 17); context.lineTo(12, 22)
  context.moveTo(10, 22); context.lineTo(16, 28); context.lineTo(10, 34); context.lineTo(17, 41)
  context.moveTo(10, 28); context.lineTo(4, 39); context.moveTo(16, 42); context.lineTo(22, 48)
  context.moveTo(7, 14); context.lineTo(2, 25); context.lineTo(9, 31)
  context.stroke()
  context.strokeStyle = '#63f4a0'
  context.lineWidth = 1.5
  context.beginPath()
  context.ellipse(14, 43, 5, 3.5, 0.2, 0, Math.PI * 2)
  context.moveTo(14, 44); context.lineTo(14 + reach * 16, 60 + reach * 8)
  context.stroke()
  const clawX = 13 + reach * 16, clawY = 61 + reach * 8
  context.lineWidth = 1.35
  context.beginPath()
  context.moveTo(clawX, clawY); context.quadraticCurveTo(clawX + 8, clawY + 3, clawX + 10, clawY + 14)
  context.quadraticCurveTo(clawX + 4, clawY + 11, clawX + 3, clawY + 5)
  context.moveTo(clawX, clawY + 1); context.quadraticCurveTo(clawX - 8, clawY + 4, clawX - 10, clawY + 15)
  context.quadraticCurveTo(clawX - 4, clawY + 12, clawX - 3, clawY + 6)
  context.moveTo(clawX + 1, clawY + 3); context.lineTo(clawX + 1, clawY + 13)
  context.stroke()
  context.restore()
}

function drawLeg(context: CanvasRenderingContext2D, side: -1 | 1, angle: number, bob: number): void {
  context.save()
  context.translate(side < 0 ? 44 : 55, 101 + bob * 0.35)
  context.rotate(angle)
  context.scale(side, 1)
  context.strokeStyle = '#3ccf78'
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(0, 0); context.lineTo(5, 17); context.lineTo(3, 39); context.lineTo(7, 52)
  context.moveTo(6, 3); context.lineTo(12, 16); context.lineTo(8, 38); context.lineTo(12, 50)
  context.stroke()
  context.strokeStyle = 'rgba(29, 139, 82, 0.98)'
  context.lineWidth = 0.85
  context.beginPath()
  context.moveTo(1, 6); context.lineTo(10, 12); context.lineTo(4, 19); context.lineTo(11, 25)
  context.moveTo(3, 21); context.lineTo(-2, 31); context.lineTo(8, 37); context.moveTo(4, 40); context.lineTo(11, 46)
  context.stroke()
  context.strokeStyle = '#5df29a'
  context.lineWidth = 1.4
  context.beginPath()
  context.ellipse(4, 38, 5, 3, 0, 0, Math.PI * 2)
  context.moveTo(7, 52); context.lineTo(15, 57); context.lineTo(19, 54)
  context.moveTo(8, 52); context.lineTo(11, 61); context.lineTo(15, 59)
  context.stroke()
  context.restore()
}

function getSpriteTexture(id: string): SpriteTexture {
  const cached = spriteCache.get(id)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = MUTANT_WIDTH; canvas.height = MUTANT_HEIGHT
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  const texture = { canvas, context, opaqueColumns: new Uint8Array(MUTANT_WIDTH) }
  spriteCache.set(id, texture)
  return texture
}

function drawMutantTexture(texture: SpriteTexture, pose: ReturnType<typeof mutantPose>): void {
  const context = texture.context
  context.clearRect(0, 0, MUTANT_WIDTH, MUTANT_HEIGHT)
  context.save()
  context.translate(7, 6)
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.shadowColor = 'rgba(36, 255, 125, 0.19)'
  context.shadowBlur = 1.2
  drawLeg(context, -1, pose.leftLeg, pose.bob)
  drawLeg(context, 1, pose.rightLeg, pose.bob)
  drawArm(context, -1, pose.leftArm, pose.reach)
  drawArm(context, 1, pose.rightArm, pose.reach)
  drawTorso(context, pose)
  drawHead(context, pose)
  context.restore()

  const pixels = context.getImageData(0, 0, MUTANT_WIDTH, MUTANT_HEIGHT).data
  texture.opaqueColumns.fill(0)
  for (let x = 0; x < MUTANT_WIDTH; x++) for (let y = 0; y < MUTANT_HEIGHT; y++) {
    if (pixels[(y * MUTANT_WIDTH + x) * 4 + 3]! > 8) { texture.opaqueColumns[x] = 1; break }
  }
}

function drawSprite(
  context: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  opaqueColumns: Uint8Array,
  centerX: number,
  top: number,
  spriteWidth: number,
  spriteHeight: number,
  forward: number,
  zBuffer: Float32Array,
  width: number,
  screenHeight: number,
): boolean {
  const left = centerX - spriteWidth / 2, right = centerX + spriteWidth / 2
  const first = Math.max(0, Math.floor(left)), last = Math.min(width - 1, Math.ceil(right))
  let visible = false
  context.save()
  context.beginPath()
  for (let x = first; x <= last; x++) {
    const sourceX = Math.max(0, Math.min(opaqueColumns.length - 1, Math.floor((x + 0.5 - left) / spriteWidth * opaqueColumns.length)))
    if (zBuffer[x]! <= forward || !opaqueColumns[sourceX]) continue
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
    const speed = enemySpeed(enemy, state.time)
    const mode = mutantAnimationMode(enemy.alerted, speed)
    return { enemy, forward, right, speed, mode }
  }).filter(item => item.forward > 0.12).sort((a, b) => b.forward - a.forward)
  const visible: string[] = []
  const spriteDepth = wallDepth.slice()
  const liveIds = new Set(state.enemies.map(enemy => enemy.id))
  for (const id of spriteCache.keys()) if (!liveIds.has(id)) spriteCache.delete(id)
  for (const id of motionSamples.keys()) if (!liveIds.has(id)) motionSamples.delete(id)

  for (const item of sprites) {
    const pose = mutantPose(item.mode, state.time, hashString(item.enemy.id) % 10000 / 113)
    const texture = getSpriteTexture(item.enemy.id)
    drawMutantTexture(texture, pose)
    const centerX = width / 2 + focal * item.right / item.forward
    const spriteHeight = focal * 1.18 / item.forward
    const spriteWidth = spriteHeight * (MUTANT_WIDTH / MUTANT_HEIGHT) * 1.1
    const bottom = horizon + focal * CAMERA_HEIGHT / item.forward
    const top = bottom - spriteHeight
    if (centerX + spriteWidth / 2 < 0 || centerX - spriteWidth / 2 > width) continue
    if (drawSprite(context, texture.canvas, texture.opaqueColumns, centerX, top, spriteWidth, spriteHeight, item.forward, spriteDepth, Math.ceil(width), height)) {
      visible.push(item.enemy.id)
      const first = Math.max(0, Math.floor(centerX - spriteWidth / 2))
      const last = Math.min(Math.ceil(width) - 1, Math.ceil(centerX + spriteWidth / 2))
      for (let x = first; x <= last; x++) {
        const sourceX = Math.max(0, Math.min(texture.opaqueColumns.length - 1, Math.floor((x + 0.5 - (centerX - spriteWidth / 2)) / spriteWidth * texture.opaqueColumns.length)))
        if (texture.opaqueColumns[sourceX] && spriteDepth[x]! > item.forward) spriteDepth[x] = item.forward
      }
    }
  }
  return visible
}

export function renderDungeon(
  canvas: HTMLCanvasElement,
  state: GameState,
  map: DungeonMap = DUNGEON_MAP,
  doors: readonly Door[] = map === DUNGEON_MAP ? DOORS : [],
): readonly string[] {
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
  drawGround(context, map, state.player, w, h, horizon, focal, state.time)

  const zBuffer = new Float32Array(pixelCount)
  zBuffer.fill(Infinity)
  const tops = new Float32Array(pixelCount), bottoms = new Float32Array(pixelCount)
  const hitKeys: Array<string | undefined> = Array.from({ length: pixelCount })
  const hits: Array<ReturnType<typeof castRay>> = Array.from({ length: pixelCount }, () => null)
  for (let x = 0; x < pixelCount; x++) {
    const relativeAngle = Math.atan((x + 0.5 - w / 2) / focal)
    const angle = state.player.heading + relativeAngle
    const direction = { x: Math.sin(angle), y: -Math.cos(angle) }
    const hit = castRay(map, state.player, direction, doors, state.openDoors, MAX_RENDER_DISTANCE)
    if (!hit) continue
    hits[x] = hit
    hitKeys[x] = `${hit.kind}:${hit.side}:${hit.cell.x},${hit.cell.y}`
    const distance = Math.max(0.04, hit.distance * Math.cos(relativeAngle))
    zBuffer[x] = distance
    const wallHeight = focal * WALL_HEIGHT / distance
    const top = horizon - wallHeight * 0.5
    const bottom = horizon + wallHeight * 0.5
    tops[x] = top; bottoms[x] = bottom
    if (hit.kind === 'door') context.fillStyle = 'rgba(2, 12, 7, 0.995)'
    else context.fillStyle = `rgba(2, 8, 5, ${Math.max(0.88, 0.98 - distance * 0.002)})`
    context.fillRect(x, top, 1.15, wallHeight)
  }

  context.save()
  context.lineWidth = 1
  context.beginPath()
  let open = false
  for (let x = 0; x < pixelCount; x++) {
    if (!Number.isFinite(zBuffer[x])) { open = false; continue }
    context.strokeStyle = `rgba(68, 225, 130, ${Math.max(0.14, 0.69 - zBuffer[x]! * 0.025)})`
    if (!open) { context.moveTo(x, tops[x]!); open = true }
    else context.lineTo(x, tops[x]!)
  }
  context.stroke()
  context.beginPath(); open = false
  for (let x = 0; x < pixelCount; x++) {
    if (!Number.isFinite(zBuffer[x])) { open = false; continue }
    if (!open) { context.moveTo(x, bottoms[x]!); open = true }
    else context.lineTo(x, bottoms[x]!)
  }
  context.stroke()
  context.strokeStyle = 'rgba(74, 222, 128, 0.67)'
  context.beginPath()
  for (let x = 1; x < pixelCount; x++) {
    if (!hitKeys[x] || !hitKeys[x - 1] || hitKeys[x] === hitKeys[x - 1]) continue
    context.moveTo(x, Math.min(tops[x]!, tops[x - 1]!))
    context.lineTo(x, Math.max(bottoms[x]!, bottoms[x - 1]!))
  }
  context.stroke()
  context.restore()

  for (let x = 0; x < pixelCount; x++) {
    const hit = hits[x]
    if (!hit) continue
    if (hit.kind === 'door') {
      const index = findDoorIndex(doors, hit)
      drawClosedDoorColumn(context, x, tops[x]!, bottoms[x]!, hit.offset, zBuffer[x]!, index, state)
    } else drawWallDetails(context, x, tops[x]!, bottoms[x]!, zBuffer[x]!, hit.offset, hit.cell, hit.side, state.time)
  }
  drawOpenDoorFrames(context, state.player, doors, state, w, horizon, focal, zBuffer)
  return drawEnemySprites(context, state, w, h, horizon, focal, zBuffer)
}
