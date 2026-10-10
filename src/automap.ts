import { DUNGEON_MAP, DOORS, doorBetween, isFloor, VECTORS } from './dungeon.ts'
import type { Cell, Door, DungeonMap, Player } from './dungeon.ts'

export const cellKey = (cell: Cell) => `${cell.x},${cell.y}`
export const initialVisited = (player: Player): Set<string> => new Set([cellKey(player)])
export function recordMovement(visited: Set<string>, before: Player, after: Player): void {
  if (before.x !== after.x || before.y !== after.y) visited.add(cellKey(after))
}

// World axes stay fixed; oversized explored bounds follow the player per axis.
export function renderMap(map: DungeonMap, player: Player, visited: ReadonlySet<string>, doors: readonly Door[] = map === DUNGEON_MAP ? DOORS : []): string {
  const size = 24
  const explored = [...visited].map(key => key.split(',').map(Number)).filter(([x, y]) => Number.isInteger(x) && Number.isInteger(y) && isFloor(map, x!, y!))
  const xs = explored.map(([x]) => x!), ys = explored.map(([, y]) => y!)
  const centerX = xs.length && (Math.max(...xs) - Math.min(...xs) + 1) * size <= 320 ? (Math.min(...xs) + Math.max(...xs)) / 2 : player.x
  const centerY = ys.length && (Math.max(...ys) - Math.min(...ys) + 1) * size <= 200 ? (Math.min(...ys) + Math.max(...ys)) / 2 : player.y
  const cells: string[] = [], edges: string[] = [], seen = new Set<string>()
  for (const [x, y] of explored) {
    const px = 160 + (x! - centerX) * size, py = 100 + (y! - centerY) * size
    if (px + size / 2 < 0 || px - size / 2 > 320 || py + size / 2 < 0 || py - size / 2 > 200) continue
    const current = x === player.x && y === player.y
    cells.push(`<g data-map-cell="${x},${y}"${current ? ' data-current="true"' : ''}><rect x="${px - 12}" y="${py - 12}" width="24" height="24" fill="${current ? '#245c38' : '#123c24'}"/></g>`)
    for (const vector of VECTORS) {
      const cell = { x: x!, y: y! }, target = { x: x! + vector.x, y: y! + vector.y }
      const door = doorBetween(doors, cell, target)
      if (!door && isFloor(map, target.x, target.y)) continue
      const key = `${x! + vector.x / 2},${y! + vector.y / 2}`
      if (seen.has(key)) continue
      seen.add(key)
      const cx = px + vector.x * 12, cy = py + vector.y * 12
      // Canonical orientation makes geometry identical from either adjacent cell.
      const horizontal = vector.y !== 0
      const point = (along: number, across = 0) => horizontal ? `${cx + along},${cy + across}` : `${cx + across},${cy + along}`
      const d = door
        ? [-2, 2].map(offset => `M${point(-10, offset)} L${point(-3, offset)} M${point(3, offset)} L${point(10, offset)}`).join(' ')
        : `M${point(-12)} L${point(12)}`
      edges.push(`<path data-map-${door ? 'door' : 'wall'}="${key}" d="${d}"/>`)
    }
  }
  const px = 160 + (player.x - centerX) * size, py = 100 + (player.y - centerY) * size
  const arrow = visited.has(cellKey(player)) && isFloor(map, player.x, player.y)
    ? `<path data-map-arrow="${player.facing}" fill="#e5fff0" d="M0,-8 L6,6 L0,3 L-6,6 Z" transform="translate(${px} ${py}) rotate(${player.facing * 90})"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" aria-hidden="true"><rect width="320" height="200" fill="#000"/>${cells.join('')}<g fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="butt">${edges.join('')}</g>${arrow}</svg>`
}
