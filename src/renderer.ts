import { DUNGEON_MAP, DOORS, doorBetween, isFloor, VECTORS } from './dungeon.ts'
import type { Door, DungeonMap, Player } from './dungeon.ts'

type Point = { x: number; z: number }
type Face = { a: Point; b: Point; door: boolean }

// Axis-aligned grid faces form a BSP: partition by a wall plane, then paint
// the half-space away from the camera first. Unlike midpoint distance sorting,
// this also orders long side corridors correctly behind nearer side walls.
function paintOrder(faces: Face[]): Face[] {
  if (!faces.length) return []
  // A stable plane choice also keeps shared-edge antialiasing independent
  // of additional geometry behind an occluder.
  const rank = (face: Face) => face.a.z === face.b.z ? Math.abs(face.a.z) : 1e6 + Math.abs(face.a.x)
  const pivot = faces.reduce((best, face) => rank(face) < rank(best) ? face : best)
  const axis = pivot.a.x === pivot.b.x ? 'x' : 'z'
  const plane = pivot.a[axis]
  const low: Face[] = [], high: Face[] = [], on: Face[] = []
  for (const face of faces) {
    const a = face.a[axis] - plane, b = face.b[axis] - plane
    if (a === 0 && b === 0) on.push(face)
    else if (a <= 0 && b <= 0) low.push(face)
    else if (a >= 0 && b >= 0) high.push(face)
    else {
      const t = a / (a - b)
      const cut = { x: face.a.x + t * (face.b.x - face.a.x), z: face.a.z + t * (face.b.z - face.a.z) }
      const first = { ...face, b: cut }, second = { ...face, a: cut }
      ;(a < 0 ? low : high).push(first)
      ;(a < 0 ? high : low).push(second)
    }
  }
  return plane >= 0 ? [...paintOrder(high), ...on, ...paintOrder(low)] : [...paintOrder(low), ...on, ...paintOrder(high)]
}

export function renderDungeon(map: DungeonMap, player: Player, doors: readonly Door[] = map === DUNGEON_MAP ? DOORS : []): string {
  const forward = VECTORS[player.facing], right = VECTORS[(player.facing + 1) % 4]!
  const camera = (x: number, y: number): Point => ({ x: (x - player.x) * right.x + (y - player.y) * right.y, z: (x - player.x) * forward.x + (y - player.y) * forward.y })
  // Closed boundaries also exclude disconnected floor regions entirely.
  // They cannot be seen through a wall or door, including at rasterized edges.
  const reachable = new Set<string>([`${player.x},${player.y}`])
  const pending = [{ x: player.x, y: player.y }]
  for (let i = 0; i < pending.length; i++) {
    const cell = pending[i]!
    for (const vector of VECTORS) {
      const target = { x: cell.x + vector.x, y: cell.y + vector.y }
      const key = `${target.x},${target.y}`
      if (!reachable.has(key) && isFloor(map, target.x, target.y) && !doorBetween(doors, cell, target)) {
        reachable.add(key); pending.push(target)
      }
    }
  }
  const faces: Face[] = [], seen = new Set<string>()
  for (let y = 0; y < map.length; y++) for (let x = 0; x < map[y]!.length; x++) {
    if (!isFloor(map, x, y) || !reachable.has(`${x},${y}`)) continue
    for (const vector of VECTORS) {
      const target = { x: x + vector.x, y: y + vector.y }
      const door = !!doorBetween(doors, { x, y }, target)
      if (isFloor(map, target.x, target.y) && !door) continue
      const cx = x + vector.x / 2, cy = y + vector.y / 2
      const key = `${cx},${cy}`
      if (seen.has(key)) continue
      seen.add(key)
      const a = camera(cx - vector.y / 2, cy + vector.x / 2)
      const b = camera(cx + vector.y / 2, cy - vector.x / 2)
      faces.push({ a, b, door })
    }
  }
  const project = (p: Point, height: number) => `${160 + 85 * p.x / p.z},${100 + 85 * height / p.z}`
  const output: string[] = []
  for (const face of paintOrder(faces)) {
    let { a, b } = face
    // Clip at the near plane before perspective projection, including walls
    // of the player's own cell. Never project points behind the camera.
    const near = .05
    if (a.z < near && b.z < near) continue
    if (a.z < near) a = { x: a.x + (b.x - a.x) * (near - a.z) / (b.z - a.z), z: near }
    if (b.z < near) b = { x: b.x + (a.x - b.x) * (near - b.z) / (a.z - b.z), z: near }
    const side = a.z === b.z ? 'front' : a.x < 0 ? 'left' : 'right'
    output.push(`<g data-wall="${side}"${face.door ? ' data-door="true"' : ''}><polygon fill="var(--dungeon-background, #030806)" points="${project(a, -.5)} ${project(b, -.5)} ${project(b, .5)} ${project(a, .5)}"/>`)
    if (face.door) {
      const inset = (t: number): Point => ({ x: face.a.x + (face.b.x - face.a.x) * t, z: face.a.z + (face.b.z - face.a.z) * t })
      const left = inset(.18), right = inset(.82), handle1 = inset(.68), handle2 = inset(.76)
      if (left.z >= near && right.z >= near) {
        output.push(`<path fill="none" d="M${project(left, .5)} L${project(left, -.35)} L${project(right, -.35)} L${project(right, .5)} M${project(left, .05)} L${project(right, .05)} M${project(handle1, .15)} L${project(handle2, .15)}"/>`)
      }
    }
    output.push('</g>')
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" aria-hidden="true"><g stroke="currentColor" stroke-width="1" stroke-linejoin="round">${output.join('')}</g></svg>`
}
