export const DOOR_ANIMATION_SECONDS = 0.26

export type DoorMotion = Readonly<{
  fromOpen: boolean
  startedAt: number
}>

export type MutantAnimationMode = 'idle' | 'walk' | 'chase'

export function mutantAnimationMode(alerted: boolean, speed: number): MutantAnimationMode {
  if (alerted) return 'chase'
  return speed > 0.12 ? 'walk' : 'idle'
}

export function doorAnimationProgress(open: boolean, motion: DoorMotion | undefined, gameTime: number): number {
  if (!motion || motion.fromOpen === open) return 1
  const elapsed = Math.max(0, gameTime - motion.startedAt)
  const raw = Math.max(0, Math.min(1, elapsed / DOOR_ANIMATION_SECONDS))
  return raw * raw * (3 - 2 * raw)
}
