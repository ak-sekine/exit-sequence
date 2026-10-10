import { DUNGEON_MAP, DOORS, doorBetween, isFloor, VECTORS } from './dungeon.ts'
import type { Cell, Direction, Door, DungeonMap, Player } from './dungeon.ts'
import type { EnemyDetection } from './senses.ts'

export const cellKey = (cell: Cell) => `${cell.x},${cell.y}`
export const initialVisited = (player: Player): Set<string> => new Set([cellKey(player)])
export function recordMovement(visited: Set<string>, before: Player, after: Player): void {
  if (before.x !== after.x || before.y !== after.y) visited.add(cellKey(after))
}

export const MAP_CELL_SIZE = 24
export const MAP_VIEW_WIDTH = 320
export const MAP_VIEW_HEIGHT = 200
// Centers use world cell coordinates, independently of the player and history.
export function clampMapCenter(map: DungeonMap, center: Cell): Cell {
  const clampAxis = (value: number, cells: number, viewport: number) => {
    if (cells * MAP_CELL_SIZE <= viewport) return (cells - 1) / 2
    const half = viewport / (2 * MAP_CELL_SIZE)
    return Math.max(half - .5, Math.min(cells - .5 - half, value))
  }
  return {
    x: clampAxis(center.x, Math.max(0, ...map.map(row => row.length)), MAP_VIEW_WIDTH),
    y: clampAxis(center.y, map.length, MAP_VIEW_HEIGHT),
  }
}
export function scrollMap(map: DungeonMap, center: Cell, direction: Direction): Cell {
  const delta = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[direction]
  return clampMapCenter(map, { x: center.x + delta.x, y: center.y + delta.y })
}

export function renderMap(map: DungeonMap, player: Player, visited: ReadonlySet<string>, doors: readonly Door[] = map === DUNGEON_MAP ? DOORS : [], center: Cell = clampMapCenter(map, player), detections: readonly EnemyDetection[] = []): string {
  const size = MAP_CELL_SIZE
  const explored = [...visited].map(key => key.split(',').map(Number)).filter(([x, y]) => Number.isInteger(x) && Number.isInteger(y) && isFloor(map, x!, y!))
  const { x: centerX, y: centerY } = center
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
  const markers = detections.map(detection => {
    const x = 160 + (detection.position.x - centerX) * size, y = 100 + (detection.position.y - centerY) * size
    if (x < 0 || x > 320 || y < 0 || y > 200) return ''
    const id = detection.enemyId.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
    const attributes = `data-map-enemy="${id}" data-detection="${detection.kind}"`
    return detection.kind === 'sight'
      ? `<path ${attributes} fill="#fb7185" d="M0,-8 L6,6 L0,3 L-6,6 Z" transform="translate(${x} ${y}) rotate(${detection.facing * 90})"/>`
      : `<circle ${attributes} cx="${x}" cy="${y}" r="7" fill="none" stroke="#fb7185" stroke-width="2"/>`
  }).join('')
  const arrow = px >= 0 && px <= 320 && py >= 0 && py <= 200 && visited.has(cellKey(player)) && isFloor(map, player.x, player.y)
    ? `<path data-map-arrow="${player.facing}" fill="#e5fff0" d="M0,-8 L6,6 L0,3 L-6,6 Z" transform="translate(${px} ${py}) rotate(${player.facing * 90})"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" aria-hidden="true"><rect width="320" height="200" fill="#000"/><svg width="320" height="200" viewBox="0 0 320 200" overflow="hidden">${cells.join('')}<g fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="butt">${edges.join('')}</g>${markers}${arrow}</svg></svg>`
}
