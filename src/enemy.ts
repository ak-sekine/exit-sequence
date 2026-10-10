import { character } from './character.ts'
import type { Character } from './character.ts'
import { move } from './dungeon.ts'
import type { Cell, Door, DungeonMap, Facing } from './dungeon.ts'
import { hear, see, movementSound } from './senses.ts'
import type { SoundEvent } from './senses.ts'
import { reachableCells, sameCell, shortestPath } from './pathfinding.ts'
export type Enemy = Character & Readonly<{ id: string; destination: Cell | null }>
export const INITIAL_ENEMY: Enemy = Object.freeze({ ...character({ x: 7, y: 5, facing: 3 }), id: 'enemy-1', destination: null })
export function enemyTurn(map: DungeonMap, enemy: Enemy, player: Character, sound: SoundEvent | null, random: () => number = Math.random, doors?: readonly Door[]) {
  const detection = see(map, enemy, player, doors) ?? hear(enemy, sound)
  let destination = detection?.position ?? enemy.destination
  if (destination && sameCell(enemy, destination)) destination = null
  if (destination) {
    const path = shortestPath(map, enemy, destination, doors)
    if (!path?.length) return { enemy: { ...enemy, destination: null }, sound: null }
    const next: Enemy = { ...enemy, ...move(map, enemy, path[0]!, doors).player, destination }
    const arrived = sameCell(next, destination)
    return { enemy: { ...next, destination: arrived ? null : destination }, sound: movementSound(enemy.id, enemy, next) }
  }
  const candidates = reachableCells(map, enemy, doors)
  if (!candidates.length) return { enemy: { ...enemy, destination: null }, sound: null }
  const pick = (length: number) => Math.min(length - 1, Math.max(0, Math.floor(random() * length)))
  const facing = pick(4) as Facing
  destination = candidates[pick(candidates.length)]!
  return { enemy: { ...enemy, facing, destination }, sound: null }
}
