import { move } from './dungeon.ts'
import type { Cell, Direction, Door, DungeonMap, Player } from './dungeon.ts'
export const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y
const key = (p: Player) => `${p.x},${p.y},${p.facing}`
export function shortestPath(map: DungeonMap, start: Player, goal: Cell, doors?: readonly Door[]): Direction[] | null {
  const queue = [{ player: start, parent: -1, action: null as Direction | null }], visited = new Set([key(start)])
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i]!
    if (sameCell(node.player, goal)) {
      const path: Direction[] = []
      for (let index = i; queue[index]!.parent >= 0; index = queue[index]!.parent) path.push(queue[index]!.action!)
      return path.reverse()
    }
    for (const action of ['up', 'left', 'right', 'down'] as const) {
      const next = move(map, node.player, action, doors).player
      if (visited.has(key(next))) continue
      visited.add(key(next)); queue.push({ player: next, parent: i, action })
    }
  }
  return null
}
export function reachableCells(map: DungeonMap, start: Player, doors?: readonly Door[]): Cell[] {
  const queue: Player[] = [start], visited = new Set([`${start.x},${start.y}`])
  for (let i = 0; i < queue.length; i++) for (const facing of [0, 1, 2, 3] as const) {
    const next = move(map, { ...queue[i]!, facing }, 'up', doors).player, k = `${next.x},${next.y}`
    if (!visited.has(k)) { visited.add(k); queue.push(next) }
  }
  return queue.slice(1).map(({ x, y }) => ({ x, y }))
}
