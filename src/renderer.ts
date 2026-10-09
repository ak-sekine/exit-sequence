import { isFloor, VECTORS } from './dungeon.ts'
import type { DungeonMap, Player } from './dungeon.ts'

// Project the visible straight corridor; stop at its first blocking wall.
export function renderDungeon(map: DungeonMap, player: Player): string {
  const forward = VECTORS[player.facing], right = VECTORS[(player.facing + 1) % 4]!
  const lines: string[] = []
  const project = (x: number, y: number, z: number) => [160 + 85 * x / z, 100 + 85 * y / z]
  function line(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) {
    const a = project(x1, y1, z1), b = project(x2, y2, z2)
    lines.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`)
  }
  function wall(x1: number, z1: number, x2: number, z2: number) {
    line(x1, -.5, z1, x2, -.5, z2); line(x1, .5, z1, x2, .5, z2)
    line(x1, -.5, z1, x1, .5, z1); line(x2, -.5, z2, x2, .5, z2)
  }
  for (let depth = 0; depth < 4; depth++) {
    const x = player.x + forward.x * depth, y = player.y + forward.y * depth
    const near = Math.max(.1, depth - .5), far = depth + .5
    for (const side of [-1, 1]) {
      if (!isFloor(map, x + right.x * side, y + right.y * side)) {
        lines.push(`<g data-wall="${side < 0 ? 'left' : 'right'}" data-depth="${depth}">`)
        wall(side * .5, near, side * .5, far)
      } else {
        lines.push(`<g data-opening="${side < 0 ? 'left' : 'right'}" data-depth="${depth}">`)
        let length = 1
        while (length < 4 && isFloor(map, x + right.x * side * (length + 1), y + right.y * side * (length + 1))) length++
        const outer = side * (length + .5)
        for (const height of [-.5, .5]) {
          line(side * .5, height, near, outer, height, near)
          line(side * .5, height, far, outer, height, far)
        }
        if (!isFloor(map, x + right.x * side * (length + 1), y + right.y * side * (length + 1))) wall(outer, near, outer, far)
        line(side * .5, -.5, far, side * .5, .5, far)
      }
      lines.push('</g>')
    }
    if (!isFloor(map, x + forward.x, y + forward.y)) {
      lines.push(`<g data-wall="front" data-depth="${depth}">`)
      wall(-.5, far, .5, far); lines.push('</g>'); break
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1">${lines.join('')}</g></svg>`
}
