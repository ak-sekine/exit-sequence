import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeStick, POINTER_TURN_RADIANS_PER_PIXEL } from '../src/controls.ts'

test('virtual stick has a dead zone and scales analog speed to its radial tilt', () => {
  assert.deepEqual(normalizeStick(0.05, 0.04), { x: 0, y: 0 })
  const half = normalizeStick(0, -0.56)
  const full = normalizeStick(0, -2)
  assert.ok(half.y < 0 && half.y > -1)
  assert.deepEqual(full, { x: 0, y: -1 })
})

test('diagonal stick input is normalized and a horizontal swipe can turn around', () => {
  const diagonal = normalizeStick(1, -1)
  assert.ok(Math.hypot(diagonal.x, diagonal.y) <= 1)
  assert.ok(POINTER_TURN_RADIANS_PER_PIXEL * 190 > Math.PI)
  assert.ok(POINTER_TURN_RADIANS_PER_PIXEL > 0)
})
