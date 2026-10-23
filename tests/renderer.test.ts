import test from 'node:test'
import assert from 'node:assert/strict'
import { projectWorldPlanePoint } from '../src/renderer.ts'

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
