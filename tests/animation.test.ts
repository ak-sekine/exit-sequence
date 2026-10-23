import test from 'node:test'
import assert from 'node:assert/strict'
import { DOOR_ANIMATION_SECONDS, doorAnimationProgress, mutantAnimationMode, mutantPose } from '../src/animation.ts'

test('mutant animation uses separate idle, walk, and chase poses on the game clock', () => {
  assert.equal(mutantAnimationMode(false, 0), 'idle')
  assert.equal(mutantAnimationMode(false, 0.9), 'walk')
  assert.equal(mutantAnimationMode(true, 0), 'chase')

  const idle = mutantPose('idle', 1.25, 3)
  const walk = mutantPose('walk', 1.25, 3)
  const chase = mutantPose('chase', 1.25, 3)
  assert.notDeepEqual(walk, idle)
  assert.notDeepEqual(chase, walk)
  assert.equal(chase.mouth > idle.mouth, true)
  assert.equal(chase.reach > walk.reach, true)
  assert.deepEqual(mutantPose('walk', 1.25, 3), walk, 'a paused game clock keeps the same pose')
  assert.notDeepEqual(mutantPose('walk', 1.25, 4), walk, 'separate enemies can carry different animation phases')
})

test('door panel animation is short, eased, and follows the logical state', () => {
  const opening = { fromOpen: false, startedAt: 2 }
  assert.equal(doorAnimationProgress(true, opening, 2), 0)
  assert.ok(Math.abs(doorAnimationProgress(true, opening, 2 + DOOR_ANIMATION_SECONDS / 2) - 0.5) < 1e-12)
  assert.equal(doorAnimationProgress(true, opening, 2 + DOOR_ANIMATION_SECONDS), 1)
  assert.equal(doorAnimationProgress(false, opening, 2), 1)

  const closing = { fromOpen: true, startedAt: 4 }
  assert.equal(doorAnimationProgress(false, closing, 4), 0)
  assert.equal(doorAnimationProgress(false, closing, 4 + DOOR_ANIMATION_SECONDS), 1)
})
