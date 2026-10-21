export const STICK_DEAD_ZONE = 0.12
export const POINTER_TURN_RADIANS_PER_PIXEL = 0.017

export function normalizeStick(x: number, y: number): { x: number; y: number } {
  const length = Math.hypot(x, y)
  if (!Number.isFinite(length) || length <= STICK_DEAD_ZONE) return { x: 0, y: 0 }
  const clampedLength = Math.min(1, length)
  const strength = (clampedLength - STICK_DEAD_ZONE) / (1 - STICK_DEAD_ZONE)
  return { x: x / length * strength, y: y / length * strength }
}
