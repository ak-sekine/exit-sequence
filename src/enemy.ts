import { character } from './character.ts'
import type { Character } from './character.ts'
import type { Cell, Point } from './dungeon.ts'

export const ENEMY_SPEED = 0.9
export const ENEMY_RADIUS = 0.18
export const ENEMY_VISION_RANGE = 6
export const ENEMY_HEARING_RANGE = 5
export const ENEMY_FIELD_OF_VIEW = Math.PI * 0.62
export const ENEMY_THINK_INTERVAL = 0.3

export type Enemy = Character & Readonly<{
  id: string
  destination: Cell | null
  route: readonly Point[]
  alerted: boolean
}>

export const INITIAL_ENEMY: Enemy = Object.freeze({
  ...character({ x: 7.5, y: 5.5, heading: Math.PI * 1.5 }, ENEMY_VISION_RANGE, ENEMY_HEARING_RANGE),
  id: 'enemy-1', destination: null, route: [], alerted: false,
})
