import type { Character } from './character.ts'
import { angleDifference, headingTo } from './dungeon.ts'
import type { Door, DungeonMap, Point } from './dungeon.ts'
import { ENEMY_FIELD_OF_VIEW, ENEMY_HEARING_RANGE, ENEMY_VISION_RANGE } from './enemy.ts'
import { lineOfSight } from './raycast.ts'

export type SoundEvent = Readonly<{ sourceId: string; position: Point }>
export type RelativeDirection = 'front' | 'frontRight' | 'right' | 'backRight' | 'back' | 'backLeft' | 'left' | 'frontLeft'
export type Sight = Readonly<{ kind: 'sight'; position: Point; heading: number; distance: number }>
export type Hearing = Readonly<{ kind: 'hearing'; position: Point; direction: RelativeDirection; distance: number }>
export type Detection = Sight | Hearing
export type EnemyDetection = Detection & Readonly<{ enemyId: string }>

export function movementSound(sourceId: string, before: Point, after: Point): SoundEvent | null {
  return Math.hypot(after.x - before.x, after.y - before.y) < 0.02
    ? null : { sourceId, position: { x: after.x, y: after.y } }
}

export function see(
  map: DungeonMap,
  observer: Character,
  target: Character,
  doors: readonly Door[] = [],
  openDoors: readonly boolean[] = [],
  range = observer.vision,
  fieldOfView = ENEMY_FIELD_OF_VIEW,
): Sight | null {
  const dx = target.x - observer.x, dy = target.y - observer.y
  const distance = Math.hypot(dx, dy)
  if (distance < 1e-5 || distance > range) return null
  if (Math.abs(angleDifference(observer.heading, headingTo(dx, dy))) > fieldOfView / 2) return null
  if (!lineOfSight(map, observer, target, doors, openDoors)) return null
  return { kind: 'sight', position: { x: target.x, y: target.y }, heading: target.heading, distance }
}

function directionFor(observer: Character, position: Point): RelativeDirection {
  const angle = angleDifference(observer.heading, headingTo(position.x - observer.x, position.y - observer.y))
  if (Math.abs(angle) < Math.PI / 8) return 'front'
  if (Math.abs(angle) > Math.PI * 7 / 8) return 'back'
  if (angle >= Math.PI * 3 / 8 && angle <= Math.PI * 5 / 8) return 'right'
  if (angle <= -Math.PI * 3 / 8 && angle >= -Math.PI * 5 / 8) return 'left'
  if (angle > 0) return angle < Math.PI / 2 ? 'frontRight' : 'backRight'
  return angle > -Math.PI / 2 ? 'frontLeft' : 'backLeft'
}

export function hear(observer: Character, sound: SoundEvent | null, range = observer.hearing): Hearing | null {
  if (!sound) return null
  const distance = Math.hypot(sound.position.x - observer.x, sound.position.y - observer.y)
  if (distance > range) return null
  return { kind: 'hearing', position: { ...sound.position }, direction: directionFor(observer, sound.position), distance }
}

export const playerVisionRange = 6
export const playerHearingRange = 4
export const enemyVisionRange = ENEMY_VISION_RANGE
export const enemyHearingRange = ENEMY_HEARING_RANGE
