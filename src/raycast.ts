import { cellAt, canCross, doorIndexBetween, isFloor } from './dungeon.ts'
import type { Cell, Door, DungeonMap, Point } from './dungeon.ts'

export type RayHit = Readonly<{
  distance: number
  kind: 'wall' | 'door'
  side: 'vertical' | 'horizontal'
  offset: number
  cell: Cell
}>

function blockedBoundary(
  doors: readonly Door[],
  from: Cell,
  to: Cell,
  distance: number,
  origin: Point,
  direction: Point,
): RayHit {
  const side: 'vertical' | 'horizontal' = from.x !== to.x ? 'vertical' : 'horizontal'
  const offsetValue = side === 'vertical'
    ? origin.y + direction.y * distance
    : origin.x + direction.x * distance
  const offset = ((offsetValue % 1) + 1) % 1
  const doorIndex = doorIndexBetween(doors, from, to)
  return { distance, kind: doorIndex >= 0 ? 'door' : 'wall', side, offset, cell: to }
}

export function castRay(
  map: DungeonMap,
  origin: Point,
  direction: Point,
  doors: readonly Door[] = [],
  openDoors: readonly boolean[] = [],
  maxDistance = 24,
): RayHit | null {
  let cellX = Math.floor(origin.x), cellY = Math.floor(origin.y)
  if (!isFloor(map, cellX, cellY)) return { distance: 0, kind: 'wall', side: 'vertical', offset: 0, cell: { x: cellX, y: cellY } }
  const deltaX = direction.x === 0 ? Infinity : Math.abs(1 / direction.x)
  const deltaY = direction.y === 0 ? Infinity : Math.abs(1 / direction.y)
  const stepX = Math.sign(direction.x), stepY = Math.sign(direction.y)
  let nextX = stepX > 0 ? (cellX + 1 - origin.x) * deltaX : (origin.x - cellX) * deltaX
  let nextY = stepY > 0 ? (cellY + 1 - origin.y) * deltaY : (origin.y - cellY) * deltaY
  for (let count = 0; count < 128; count++) {
    if (Math.abs(nextX - nextY) < 1e-10) {
      const distance = nextX
      if (!Number.isFinite(distance) || distance > maxDistance) return null
      const current = { x: cellX, y: cellY }
      const sideX = { x: cellX + stepX, y: cellY }
      const sideY = { x: cellX, y: cellY + stepY }
      const diagonal = { x: cellX + stepX, y: cellY + stepY }
      const boundaries: Array<readonly [Cell, Cell]> = [
        [current, sideX], [current, sideY], [sideX, diagonal], [sideY, diagonal],
      ]
      const blocked = boundaries.find(([from, to]) => !canCross(map, doors, openDoors, from, to))
      if (blocked) return blockedBoundary(doors, blocked[0], blocked[1], distance, origin, direction)
      cellX = diagonal.x; cellY = diagonal.y
      nextX += deltaX; nextY += deltaY
      continue
    }
    const side: 'vertical' | 'horizontal' = nextX < nextY ? 'vertical' : 'horizontal'
    const distance = side === 'vertical' ? nextX : nextY
    if (!Number.isFinite(distance) || distance > maxDistance) return null
    const next = side === 'vertical' ? { x: cellX + stepX, y: cellY } : { x: cellX, y: cellY + stepY }
    const current = { x: cellX, y: cellY }
    const open = canCross(map, doors, openDoors, current, next)
    if (!open) {
      return blockedBoundary(doors, current, next, distance, origin, direction)
    }
    if (side === 'vertical') { cellX = next.x; nextX += deltaX }
    else { cellY = next.y; nextY += deltaY }
  }
  return null
}

export function lineOfSight(
  map: DungeonMap,
  from: Point,
  to: Point,
  doors: readonly Door[] = [],
  openDoors: readonly boolean[] = [],
): boolean {
  const start = cellAt(from), end = cellAt(to)
  if (!isFloor(map, start.x, start.y) || !isFloor(map, end.x, end.y)) return false
  const dx = to.x - from.x, dy = to.y - from.y, distance = Math.hypot(dx, dy)
  if (distance < 1e-8) return true
  const hit = castRay(map, from, { x: dx / distance, y: dy / distance }, doors, openDoors, distance + 0.02)
  return !hit || hit.distance >= distance - 0.025
}
