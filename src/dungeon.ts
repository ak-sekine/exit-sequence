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
export type Facing = 0 | 1 | 2 | 3
export type Player = Readonly<{ x: number; y: number; facing: Facing }>
export type Cell = Readonly<{ x: number; y: number }>
export type Door = Readonly<{ from: Cell; to: Cell }>
export const DOORS: readonly Door[] = Object.freeze([
  { from: { x: 2, y: 11 }, to: { x: 2, y: 10 } },
  { from: { x: 2, y: 4 }, to: { x: 2, y: 3 } },
  { from: { x: 9, y: 2 }, to: { x: 10, y: 2 } },
  { from: { x: 12, y: 5 }, to: { x: 12, y: 4 } },
  { from: { x: 7, y: 5 }, to: { x: 7, y: 6 } },
  { from: { x: 12, y: 9 }, to: { x: 12, y: 10 } },
])
export type Direction = 'up' | 'left' | 'right' | 'down'
export const INITIAL_PLAYER: Player = Object.freeze({ x: 2, y: 14, facing: 0 })
export const VECTORS = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }] as const
export const isFloor = (map: DungeonMap, x: number, y: number) => map[y]?.[x] === '#'
// Inclusive room bounds from docs/dungeon-sample.md; only the sample map has room metadata.
const ROOM_REGIONS = [
  { minX: 1, maxX: 4, minY: 1, maxY: 3 },
  { minX: 10, maxX: 14, minY: 1, maxY: 4 },
  { minX: 6, maxX: 8, minY: 6, maxY: 8 },
  { minX: 1, maxX: 4, minY: 8, maxY: 10 },
  { minX: 10, maxX: 14, minY: 10, maxY: 13 },
] as const
export function locationKind(map: DungeonMap, cell: Cell): 'room' | 'corridor' | null {
  if (!isFloor(map, cell.x, cell.y)) return null
  return map === DUNGEON_MAP && ROOM_REGIONS.some(room =>
    cell.x >= room.minX && cell.x <= room.maxX && cell.y >= room.minY && cell.y <= room.maxY)
    ? 'room' : 'corridor'
}
const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y
export function doorBetween(doors: readonly Door[], a: Cell, b: Cell): Door | undefined {
  return doors.find(d => (sameCell(d.from, a) && sameCell(d.to, b)) || (sameCell(d.to, a) && sameCell(d.from, b)))
}
function ahead(player: Player): Cell {
  const vector = VECTORS[player.facing]
  return { x: player.x + vector.x, y: player.y + vector.y }
}
export function move(map: DungeonMap, player: Player, direction: Direction, doors: readonly Door[] = map === DUNGEON_MAP ? DOORS : []) {
  if (direction !== 'up') {
    const turn = { left: 3, right: 1, down: 2 }[direction]
    return { player: { ...player, facing: (player.facing + turn) % 4 as Facing }, message: direction }
  }
  const target = ahead(player)
  return isFloor(map, target.x, target.y) && !doorBetween(doors, player, target)
    ? { player: { ...player, ...target }, message: 'moved' as const }
    : { player, message: 'blocked' as const }
}
export function passDoor(map: DungeonMap, player: Player, doors: readonly Door[] = map === DUNGEON_MAP ? DOORS : []) {
  const target = ahead(player), door = doorBetween(doors, player, target)
  if (!door || !isFloor(map, player.x, player.y) || !isFloor(map, target.x, target.y)) return null
  return { player: { ...player, ...target }, message: sameCell(target, door.to) ? 'enteredRoom' as const : 'returnedCorridor' as const }
}
