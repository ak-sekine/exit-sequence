import { DUNGEON_MAP, DOORS, VECTORS, isFloor, doorBetween } from './dungeon.ts'
import type { Cell, Door, DungeonMap, Facing, Player } from './dungeon.ts'
import type { Character } from './character.ts'
export type SoundEvent = Readonly<{ sourceId: string; position: Cell }>
export type RelativeDirection = 'front' | 'frontRight' | 'right' | 'backRight' | 'back' | 'backLeft' | 'left' | 'frontLeft'
export type Sight = Readonly<{ kind: 'sight'; position: Cell; facing: Facing; distance: number }>
export type Hearing = Readonly<{ kind: 'hearing'; position: Cell; direction: RelativeDirection; distance: number }>
export type Detection = Sight | Hearing
export function movementSound(sourceId: string, before: Cell, after: Cell): SoundEvent | null {
  return before.x === after.x && before.y === after.y ? null : { sourceId, position: { x: after.x, y: after.y } }
}
// Grid traversal of the center-to-center segment. At a vertex all four
// incident boundaries and both touched side cells must be clear (supercover).
export function lineOfSight(map: DungeonMap, from: Cell, to: Cell, doors: readonly Door[] = map === DUNGEON_MAP ? DOORS : []): boolean {
  if (!isFloor(map, from.x, from.y) || !isFloor(map, to.x, to.y)) return false
  let cell = { ...from }
  const dx = to.x - from.x, dy = to.y - from.y
  const sx = Math.sign(dx), sy = Math.sign(dy)
  const stepX = dx ? 1 / Math.abs(dx) : Infinity, stepY = dy ? 1 / Math.abs(dy) : Infinity
  let tx = stepX / 2, ty = stepY / 2
  const clear = (a: Cell, b: Cell) => isFloor(map, b.x, b.y) && !doorBetween(doors, a, b)
  while (cell.x !== to.x || cell.y !== to.y) {
    if (Math.abs(tx - ty) < 1e-10) {
      const x = { x: cell.x + sx, y: cell.y }, y = { x: cell.x, y: cell.y + sy }
      const next = { x: x.x, y: y.y }
      if (!clear(cell, x) || !clear(cell, y) || !clear(x, next) || !clear(y, next)) return false
      cell = next; tx += stepX; ty += stepY
    } else if (tx < ty) {
      const next = { x: cell.x + sx, y: cell.y }
      if (!clear(cell, next)) return false
      cell = next; tx += stepX
    } else {
      const next = { x: cell.x, y: cell.y + sy }
      if (!clear(cell, next)) return false
      cell = next; ty += stepY
    }
  }
  return true
}
function relative(observer: Player, target: Cell) {
  const dx = target.x - observer.x, dy = target.y - observer.y
  const f = VECTORS[observer.facing], r = VECTORS[(observer.facing + 1) % 4]!
  return { forward: dx * f.x + dy * f.y, right: dx * r.x + dy * r.y }
}
export function see(map: DungeonMap, observer: Character, target: Player, doors?: readonly Door[]): Sight | null {
  const { forward, right } = relative(observer, target)
  const width = [0, 1, 1, 2, 2, 3][forward]
  if (forward < 1 || forward > Math.min(5, observer.vision) || width === undefined || Math.abs(right) > width || !lineOfSight(map, observer, target, doors)) return null
  return { kind: 'sight', position: { x: target.x, y: target.y }, facing: target.facing, distance: forward }
}
export function hear(observer: Character, sound: SoundEvent | null): Hearing | null {
  if (!sound) return null
  const distance = Math.max(Math.abs(sound.position.x - observer.x), Math.abs(sound.position.y - observer.y))
  if (distance > observer.hearing) return null
  const { forward, right } = relative(observer, sound.position)
  const direction: RelativeDirection = forward > 0 ? (right > 0 ? 'frontRight' : right < 0 ? 'frontLeft' : 'front') : forward < 0 ? (right > 0 ? 'backRight' : right < 0 ? 'backLeft' : 'back') : right > 0 ? 'right' : right < 0 ? 'left' : 'front'
  return { kind: 'hearing', position: { ...sound.position }, direction, distance }
}
