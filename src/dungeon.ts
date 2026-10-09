export type DungeonMap = readonly string[]
export const DUNGEON_MAP: DungeonMap = Object.freeze(['  #  ', '#####', '  #  ', '  #  ', '  #  '])
export type Facing = 0 | 1 | 2 | 3
export type Player = Readonly<{ x: number; y: number; facing: Facing }>
export type Cell = Readonly<{ x: number; y: number }>
export type Door = Readonly<{ from: Cell; to: Cell }>
export const DOORS: readonly Door[] = Object.freeze([{ from: { x: 2, y: 1 }, to: { x: 2, y: 0 } }])
export type Direction = 'up' | 'left' | 'right' | 'down'
export const INITIAL_PLAYER: Player = Object.freeze({ x: 2, y: 4, facing: 0 })
export const VECTORS = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }] as const
export const isFloor = (map: DungeonMap, x: number, y: number) => map[y]?.[x] === '#'
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
