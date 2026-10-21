import { cellAt, cellKey, doorBetween, isFloor } from './dungeon.ts'
import type { Door, DungeonMap, Player } from './dungeon.ts'
import type { EnemyDetection } from './senses.ts'

export const MAP_CELL_SIZE = 20
export const MAP_VIEW_SIZE = 320
export const initialVisited = (player: Player): Set<string> => new Set([cellKey(cellAt(player))])

export function recordMovement(visited: ReadonlySet<string>, before: Player, after: Player): ReadonlySet<string> {
  const beforeCell = cellAt(before), afterCell = cellAt(after)
  if (beforeCell.x === afterCell.x && beforeCell.y === afterCell.y) return visited
  return new Set([...visited, cellKey(afterCell)])
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
}

export function renderMap(
  map: DungeonMap,
  player: Player,
  visited: ReadonlySet<string>,
  doors: readonly Door[] = [],
  openDoors: readonly boolean[] = [],
  detections: readonly EnemyDetection[] = [],
): string {
  const size = MAP_CELL_SIZE
  const explored = [...visited].map(key => key.split(',').map(Number))
    .filter(([x, y]) => Number.isInteger(x) && Number.isInteger(y) && isFloor(map, x!, y!))
  const cells: string[] = [], boundaries: string[] = [], drawnDoors = new Set<number>()
  const known = new Set(explored.map(([x, y]) => `${x},${y}`))
  for (const [xValue, yValue] of explored) {
    const x = xValue!, y = yValue!, cell = { x, y }, px = x * size, py = y * size
    const current = Math.floor(player.x) === x && Math.floor(player.y) === y
    cells.push(`<rect data-map-cell="${x},${y}"${current ? ' data-current="true"' : ''} x="${px}" y="${py}" width="${size}" height="${size}" fill="${current ? '#245c38' : '#123c24'}"/>`)
    const edges = [
      { x: 0, y: -1, x1: px, y1: py, x2: px + size, y2: py },
      { x: 1, y: 0, x1: px + size, y1: py, x2: px + size, y2: py + size },
      { x: 0, y: 1, x1: px, y1: py + size, x2: px + size, y2: py + size },
      { x: -1, y: 0, x1: px, y1: py, x2: px, y2: py + size },
    ]
    for (const edge of edges) {
      const target = { x: x + edge.x, y: y + edge.y }
      const doorIndex = doors.findIndex(door => doorBetween([door], cell, target) !== undefined)
      if (doorIndex >= 0) {
        const actualIndex = doors.indexOf(doors[doorIndex]!)
        if (drawnDoors.has(actualIndex)) continue
        drawnDoors.add(actualIndex)
        const gap = edge.x === 0 ? `M${edge.x1 + 5},${edge.y1} L${edge.x1 + 15},${edge.y1}`
          : edge.y === 0 ? `M${edge.x1},${edge.y1 + 5} L${edge.x1},${edge.y1 + 15}`
            : edge.y1 === py ? `M${edge.x1 + 5},${edge.y1} L${edge.x1 + 15},${edge.y1}`
              : `M${edge.x1},${edge.y1 + 5} L${edge.x1},${edge.y1 + 15}`
        boundaries.push(`<path data-map-door="${actualIndex}" data-open="${!!openDoors[actualIndex]}" d="${gap}"/>`)
      } else if (!isFloor(map, target.x, target.y) && !known.has(cellKey(target))) {
        boundaries.push(`<path data-map-wall="${x},${y},${edge.x},${edge.y}" d="M${edge.x1},${edge.y1} L${edge.x2},${edge.y2}"/>`)
      } else if (known.has(cellKey(target)) && !isFloor(map, target.x, target.y)) {
        boundaries.push(`<path data-map-wall="${x},${y},${edge.x},${edge.y}" d="M${edge.x1},${edge.y1} L${edge.x2},${edge.y2}"/>`)
      }
    }
  }

  const markers = detections.map(detection => {
    const x = detection.position.x * size, y = detection.position.y * size
    const id = esc(detection.enemyId)
    const attrs = `data-map-enemy="${id}" data-detection="${detection.kind}"`
    return detection.kind === 'sight'
      ? `<path ${attrs} fill="#fb7185" d="M0,-7 L5,5 L0,2 L-5,5 Z" transform="translate(${x} ${y}) rotate(${detection.heading * 180 / Math.PI})"/>`
      : `<circle ${attrs} cx="${x}" cy="${y}" r="6" fill="none" stroke="#fb7185" stroke-width="2"/>`
  }).join('')
  const playerCell = cellAt(player)
  const playerArrow = known.has(cellKey(playerCell))
    ? `<path data-map-player="true" fill="#e5fff0" d="M0,-8 L6,7 L0,4 L-6,7 Z" transform="translate(${player.x * size} ${player.y * size}) rotate(${player.heading * 180 / Math.PI})"/>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MAP_VIEW_SIZE} ${MAP_VIEW_SIZE}" aria-hidden="true"><rect width="${MAP_VIEW_SIZE}" height="${MAP_VIEW_SIZE}" fill="#000"/><g>${cells.join('')}</g><g fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="square">${boundaries.join('')}</g>${markers}${playerArrow}</svg>`
}
