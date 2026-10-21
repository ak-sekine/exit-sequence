export type DungeonMap = readonly string[]

export const DUNGEON_MAP: DungeonMap = Object.freeze([
  '                ',
  ' ####     ##### ',
  ' #### ######### ',
  ' ####  #  ##### ',
  '  #    #  ##### ',
  '  ###########   ',
  '  #   ###   #   ',
  '  #   ###   #   ',
  ' #### ###   #   ',
  ' ####  #    #   ',
  ' ####  #  ##### ',
  ' ############## ',
  '  #       ##### ',
  '  #       ##### ',
  '  #           # ',
  '                ',
])

export type Cell = Readonly<{ x: number; y: number }>
export type Point = Readonly<{ x: number; y: number }>
// Heading is radians clockwise from north. World coordinates address cell centers at n + .5.
export type Player = Readonly<{ x: number; y: number; heading: number }>
export type Door = Readonly<{ from: Cell; to: Cell }>

export const DOORS: readonly Door[] = Object.freeze([
  { from: { x: 2, y: 11 }, to: { x: 2, y: 10 } },
  { from: { x: 2, y: 4 }, to: { x: 2, y: 3 } },
  { from: { x: 9, y: 2 }, to: { x: 10, y: 2 } },
  { from: { x: 12, y: 5 }, to: { x: 12, y: 4 } },
  { from: { x: 7, y: 5 }, to: { x: 7, y: 6 } },
  { from: { x: 12, y: 9 }, to: { x: 12, y: 10 } },
])

export const INITIAL_PLAYER: Player = Object.freeze({ x: 2.5, y: 14.5, heading: 0 })
export const TAU = Math.PI * 2
export const PLAYER_RADIUS = 0.2
export const PLAYER_SPEED = 2.4
export const DOOR_INTERACT_DISTANCE = 1.25
export const DOOR_INTERACT_ANGLE = Math.PI / 3

export const VECTORS = [
  { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 },
] as const

export const isFloor = (map: DungeonMap, x: number, y: number): boolean => map[y]?.[x] === '#'
export const cellAt = (point: Point): Cell => ({ x: Math.floor(point.x), y: Math.floor(point.y) })
export const cellKey = (cell: Cell): string => `${cell.x},${cell.y}`
export const sameCell = (a: Cell, b: Cell): boolean => a.x === b.x && a.y === b.y
export const wrapAngle = (angle: number): number => ((angle % TAU) + TAU) % TAU
export function angleDifference(from: number, to: number): number {
  const value = wrapAngle(to - from)
  return value > Math.PI ? value - TAU : value
}
export function headingTo(dx: number, dy: number): number {
  return wrapAngle(Math.atan2(dx, -dy))
}

export function doorIndexBetween(doors: readonly Door[], a: Cell, b: Cell): number {
  return doors.findIndex(d =>
    (sameCell(d.from, a) && sameCell(d.to, b)) ||
    (sameCell(d.to, a) && sameCell(d.from, b)))
}

export function doorBetween(doors: readonly Door[], a: Cell, b: Cell): Door | undefined {
  const index = doorIndexBetween(doors, a, b)
  return index < 0 ? undefined : doors[index]
}

export function canCross(map: DungeonMap, doors: readonly Door[], openDoors: readonly boolean[], from: Cell, to: Cell): boolean {
  if (!isFloor(map, to.x, to.y)) return false
  const doorIndex = doorIndexBetween(doors, from, to)
  return doorIndex < 0 || !!openDoors[doorIndex]
}

function pointSegmentDistance(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const length2 = dx * dx + dy * dy
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length2))
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy))
}

export function doorSegment(door: Door): readonly [Point, Point] {
  if (door.from.x !== door.to.x) {
    const x = Math.max(door.from.x, door.to.x)
    return [{ x, y: door.from.y }, { x, y: door.from.y + 1 }]
  }
  const y = Math.max(door.from.y, door.to.y)
  return [{ x: door.from.x, y }, { x: door.from.x + 1, y }]
}

function circleTouchesBox(x: number, y: number, radius: number, cellX: number, cellY: number): boolean {
  const closestX = Math.max(cellX, Math.min(x, cellX + 1))
  const closestY = Math.max(cellY, Math.min(y, cellY + 1))
  return (x - closestX) ** 2 + (y - closestY) ** 2 < radius ** 2
}

export function canOccupy(
  map: DungeonMap,
  x: number,
  y: number,
  radius = PLAYER_RADIUS,
  doors: readonly Door[] = map === DUNGEON_MAP ? DOORS : [],
  openDoors: readonly boolean[] = [],
): boolean {
  const minX = Math.floor(x - radius), maxX = Math.floor(x + radius)
  const minY = Math.floor(y - radius), maxY = Math.floor(y + radius)
  for (let cy = minY; cy <= maxY; cy++) for (let cx = minX; cx <= maxX; cx++) {
    if (!isFloor(map, cx, cy) && circleTouchesBox(x, y, radius, cx, cy)) return false
  }
  for (let index = 0; index < doors.length; index++) {
    if (openDoors[index]) continue
    const [a, b] = doorSegment(doors[index]!)
    if (pointSegmentDistance({ x, y }, a, b) < radius - 1e-8) return false
  }
  return true
}

export function moveWithCollision(
  map: DungeonMap,
  point: Point,
  dx: number,
  dy: number,
  radius = PLAYER_RADIUS,
  doors: readonly Door[] = map === DUNGEON_MAP ? DOORS : [],
  openDoors: readonly boolean[] = [],
): Point {
  const maxPart = 0.08
  const parts = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / maxPart))
  const stepX = dx / parts, stepY = dy / parts
  let x = point.x, y = point.y
  for (let i = 0; i < parts; i++) {
    if (canOccupy(map, x + stepX, y, radius, doors, openDoors)) x += stepX
    if (canOccupy(map, x, y + stepY, radius, doors, openDoors)) y += stepY
  }
  return { x, y }
}

// Room bounds describe the authored sample map only.
const ROOM_REGIONS = [
  { minX: 1, maxX: 4, minY: 1, maxY: 3 },
  { minX: 10, maxX: 14, minY: 1, maxY: 4 },
  { minX: 6, maxX: 8, minY: 6, maxY: 8 },
  { minX: 1, maxX: 4, minY: 8, maxY: 10 },
  { minX: 10, maxX: 14, minY: 10, maxY: 13 },
] as const

export function locationKind(map: DungeonMap, point: Point): 'room' | 'corridor' | null {
  const cell = cellAt(point)
  if (!isFloor(map, cell.x, cell.y)) return null
  return map === DUNGEON_MAP && ROOM_REGIONS.some(room =>
    cell.x >= room.minX && cell.x <= room.maxX && cell.y >= room.minY && cell.y <= room.maxY)
    ? 'room' : 'corridor'
}
