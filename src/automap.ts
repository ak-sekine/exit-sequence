import { isFloor } from './dungeon.ts'
import type { Cell, DungeonMap, Player } from './dungeon.ts'

export const cellKey = (cell: Cell) => `${cell.x},${cell.y}`
export const initialVisited = (player: Player): Set<string> => new Set([cellKey(player)])
export function recordMovement(visited: Set<string>, before: Player, after: Player): void {
  if (before.x !== after.x || before.y !== after.y) visited.add(cellKey(after))
}

// A fixed-size viewport follows the player without rotating the world axes.
// Only visited floor cells produce geometry; map bounds and unknown edges stay hidden.
export function renderMap(map: DungeonMap, player: Player, visited: ReadonlySet<string>): string {
  const size = 32, arrows = ['↑', '→', '↓', '←']
  const explored = [...visited].map(key => key.split(',').map(Number)).filter(([x, y]) => Number.isInteger(x) && Number.isInteger(y) && isFloor(map, x!, y!))
  const xs = explored.map(([x]) => x!), ys = explored.map(([, y]) => y!)
  const centerX = xs.length && (Math.max(...xs) - Math.min(...xs) + 1) * size <= 320 ? (Math.min(...xs) + Math.max(...xs)) / 2 : player.x
  const centerY = ys.length && (Math.max(...ys) - Math.min(...ys) + 1) * size <= 200 ? (Math.min(...ys) + Math.max(...ys)) / 2 : player.y
  const cells: string[] = []
  for (const key of visited) {
    const [x, y] = key.split(',').map(Number)
    if (!Number.isInteger(x) || !Number.isInteger(y) || !isFloor(map, x!, y!)) continue
    const px = 160 + (x! - centerX) * size, py = 100 + (y! - centerY) * size
    if (px + size / 2 < 0 || px - size / 2 > 320 || py + size / 2 < 0 || py - size / 2 > 200) continue
    const current = x === player.x && y === player.y
    cells.push(`<g data-map-cell="${key}"${current ? ' data-current="true"' : ''}><rect x="${px - size / 2}" y="${py - size / 2}" width="${size}" height="${size}" fill="${current ? '#18382f' : 'var(--dungeon-background, #030806)'}" stroke="currentColor"/>${current ? `<text x="${px}" y="${py}" text-anchor="middle" dominant-baseline="central" fill="currentColor" font-family="sans-serif" font-weight="bold" font-size="30">${arrows[player.facing]}</text>` : ''}</g>`)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" aria-hidden="true">${cells.join('')}</svg>`
}
