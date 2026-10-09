export type DungeonMap = readonly string[]
export const DUNGEON_MAP: DungeonMap = Object.freeze(['#####', '  #  ', '  #  ', '  #  '])
export type Facing = 0 | 1 | 2 | 3
export type Player = Readonly<{ x: number; y: number; facing: Facing }>
export type Direction = 'up' | 'left' | 'right' | 'down'
export const INITIAL_PLAYER: Player = Object.freeze({ x: 2, y: 3, facing: 0 })
export const VECTORS = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }] as const
export const isFloor = (map: DungeonMap, x: number, y: number) => map[y]?.[x] === '#'
export function move(map: DungeonMap, player: Player, direction: Direction) {
  if (direction !== 'up') {
    const turn = { left: 3, right: 1, down: 2 }[direction]
    return { player: { ...player, facing: (player.facing + turn) % 4 as Facing }, message: direction }
  }
  const vector = VECTORS[player.facing]
  const x = player.x + vector.x, y = player.y + vector.y
  return isFloor(map, x, y) ? { player: { ...player, x, y }, message: 'moved' as const } : { player, message: 'blocked' as const }
}
