import test from 'node:test'
import assert from 'node:assert/strict'
import { mutantSpriteFrameIndex, projectWorldPlanePoint } from '../src/renderer.ts'

test('floor and ceiling grid projection follows world position and camera heading', () => {
  const worldPoint = { x: 2.5, y: 13.5 }
  const camera = { x: 2.5, y: 14.5, heading: 0 }
  const floor = projectWorldPlanePoint(camera, worldPoint, 320, 160, 220, 'floor')!
  const ceiling = projectWorldPlanePoint(camera, worldPoint, 320, 160, 220, 'ceiling')!
  assert.equal(floor.x, 160)
  assert.equal(floor.y, 270)
  assert.equal(ceiling.y, 50)

  const moved = projectWorldPlanePoint({ ...camera, y: 14 }, worldPoint, 320, 160, 220, 'floor')!
  assert.ok(moved.depth < floor.depth)
  assert.ok(moved.y > floor.y, 'a fixed floor point grows toward the bottom as the player approaches')

  const turned = projectWorldPlanePoint({ ...camera, heading: Math.PI / 6 }, worldPoint, 320, 160, 220, 'floor')!
  assert.ok(turned)
  assert.notEqual(turned.x, floor.x, 'a fixed world point shifts across the view as the player turns')
})

test('sprite animation selects cached frames from game time for all three modes', () => {
  assert.equal(mutantSpriteFrameIndex('idle', 0), 0)
  assert.equal(mutantSpriteFrameIndex('idle', 0.5), 1)
  assert.equal(mutantSpriteFrameIndex('idle', 1), 2)
  assert.equal(mutantSpriteFrameIndex('walk', 0), 0)
  assert.equal(mutantSpriteFrameIndex('walk', 1 / 9), 1)
  assert.equal(mutantSpriteFrameIndex('walk', 4 / 9), 0)
  assert.equal(mutantSpriteFrameIndex('chase', 1 / 11), 1)
  assert.equal(mutantSpriteFrameIndex('chase', 4 / 11), 0)
  assert.equal(mutantSpriteFrameIndex('chase', 1.25), mutantSpriteFrameIndex('chase', 1.25), 'a frozen game clock keeps the same frame')
  assert.equal(mutantSpriteFrameIndex('idle', -1), 0)
})
