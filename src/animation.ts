export const DOOR_ANIMATION_SECONDS = 0.26

export type DoorMotion = Readonly<{
  fromOpen: boolean
  startedAt: number
}>

export type MutantAnimationMode = 'idle' | 'walk' | 'chase'

export type MutantPose = Readonly<{
  bob: number
  breath: number
  headTilt: number
  headNod: number
  leftArm: number
  rightArm: number
  leftLeg: number
  rightLeg: number
  lean: number
  reach: number
  clawFlex: number
  mouth: number
}>

export function mutantAnimationMode(alerted: boolean, speed: number): MutantAnimationMode {
  if (alerted) return 'chase'
  return speed > 0.12 ? 'walk' : 'idle'
}

export function mutantPose(mode: MutantAnimationMode, gameTime: number, seed = 0): MutantPose {
  const t = Math.max(0, gameTime)
  const idleWobble = Math.sin(t * 2.1 + seed)
  const cycle = t * (mode === 'chase' ? 10.4 : 7.5) + seed
  const stride = Math.sin(cycle)
  const walking = mode !== 'idle'
  const aggressive = mode === 'chase'

  return {
    bob: walking ? Math.abs(Math.sin(cycle * 2)) * (aggressive ? 2.2 : 1.5) : Math.sin(t * 1.25 + seed) * 1.15,
    breath: 1 + Math.sin(t * 1.45 + seed) * (aggressive ? 0.032 : 0.022),
    headTilt: Math.sin(t * (aggressive ? 3.1 : 1.35) + seed * 1.7) * (aggressive ? 0.11 : 0.055),
    headNod: Math.sin(t * (aggressive ? 5 : 1.8) + seed) * (aggressive ? 1.8 : 0.8),
    leftArm: walking ? stride * (aggressive ? 0.44 : 0.31) - (aggressive ? 0.18 : 0) : idleWobble * 0.1,
    rightArm: walking ? -stride * (aggressive ? 0.39 : 0.28) - (aggressive ? 0.22 : 0) : Math.sin(t * 2.7 + seed * 2) * 0.12,
    leftLeg: walking ? -stride * (aggressive ? 0.36 : 0.3) : Math.sin(t * 0.9 + seed) * 0.025,
    rightLeg: walking ? stride * (aggressive ? 0.34 : 0.3) : Math.sin(t * 1.1 + seed + 1) * 0.03,
    lean: aggressive ? 0.14 : walking ? 0.045 : 0,
    reach: aggressive ? 0.12 + (0.5 + 0.5 * Math.sin(cycle)) * 0.12 : 0,
    clawFlex: Math.sin(t * (aggressive ? 8.2 : 2.4) + seed) * (aggressive ? 1.8 : 0.55),
    mouth: aggressive ? 0.76 + (0.5 + 0.5 * Math.sin(cycle * 0.7)) * 0.24 : 0.18 + (0.5 + 0.5 * Math.sin(t * 1.7 + seed)) * 0.16,
  }
}

export function doorAnimationProgress(open: boolean, motion: DoorMotion | undefined, gameTime: number): number {
  if (!motion || motion.fromOpen === open) return 1
  const elapsed = Math.max(0, gameTime - motion.startedAt)
  const raw = Math.max(0, Math.min(1, elapsed / DOOR_ANIMATION_SECONDS))
  return raw * raw * (3 - 2 * raw)
}
