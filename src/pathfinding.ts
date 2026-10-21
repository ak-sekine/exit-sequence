import { canCross, cellAt, cellKey, isFloor } from './dungeon.ts'
import type { Cell, Door, DungeonMap, Point } from './dungeon.ts'

export function shortestPath(
  map: DungeonMap,
  start: Cell,
  goal: Cell,
  doors: readonly Door[] = [],
  openDoors: readonly boolean[] = [],
): Cell[] | null {
  if (!isFloor(map, start.x, start.y) || !isFloor(map, goal.x, goal.y)) return null
  if (start.x === goal.x && start.y === goal.y) return []
  const queue: Cell[] = [start]
  const parents = new Map<string, string | null>([[cellKey(start), null]])
  const cells = new Map<string, Cell>([[cellKey(start), start]])
  const vectors = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }]
  for (let index = 0; index < queue.length; index++) {
    const cell = queue[index]!
    for (const vector of vectors) {
      const next = { x: cell.x + vector.x, y: cell.y + vector.y }
      const key = cellKey(next)
      if (parents.has(key) || !canCross(map, doors, openDoors, cell, next)) continue
      parents.set(key, cellKey(cell)); cells.set(key, next); queue.push(next)
      if (next.x === goal.x && next.y === goal.y) {
        const path: Cell[] = []
        let cursor: string | null = key
        while (cursor !== null && cursor !== cellKey(start)) {
          path.push(cells.get(cursor)!)
          cursor = parents.get(cursor) ?? null
        }
        return path.reverse()
      }
    }
  }
  return null
}

export function reachableCells(
  map: DungeonMap,
  start: Cell,
  doors: readonly Door[] = [],
  openDoors: readonly boolean[] = [],
): Cell[] {
  if (!isFloor(map, start.x, start.y)) return []
  const queue: Cell[] = [start], visited = new Set([cellKey(start)])
  const vectors = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }]
  for (let index = 0; index < queue.length; index++) for (const vector of vectors) {
    const cell = queue[index]!, next = { x: cell.x + vector.x, y: cell.y + vector.y }, key = cellKey(next)
    if (visited.has(key) || !canCross(map, doors, openDoors, cell, next)) continue
    visited.add(key); queue.push(next)
  }
  return queue.slice(1)
}

export const cellCenter = (cell: Cell): Point => ({ x: cell.x + 0.5, y: cell.y + 0.5 })
export const pointCell = cellAt
