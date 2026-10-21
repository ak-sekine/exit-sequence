import test from 'node:test'
import assert from 'node:assert/strict'
import { character } from '../src/character.ts'
import { see, hear, movementSound } from '../src/senses.ts'
import { castRay, lineOfSight } from '../src/raycast.ts'

test('continuous vision uses distance, angle and wall occlusion', () => {
  const map = ['       ', ' ####  ', ' # # # ', ' ####  ', '       ']
  const observer = character({ x: 1.5, y: 1.5, heading: Math.PI / 2 }, 6, 4)
  const ahead = character({ x: 3.5, y: 1.5, heading: 0 })
  const behindWall = character({ x: 3.5, y: 2.5, heading: 0 })
  const tooFar = character({ x: 5.5, y: 1.5, heading: 0 })
  assert.equal(see(map, observer, ahead, [], [], 4)?.kind, 'sight')
  assert.equal(see(map, observer, behindWall, [], [], 6), null)
  assert.equal(see(map, observer, tooFar, [], [], 4), null)
  assert.equal(see(map, { ...observer, heading: Math.PI }, ahead, [], [], 6), null)
})

test('a closed door blocks rays and visibility while opening the same boundary clears it', () => {
  const map = ['###']
  const door = [{ from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }]
  const hit = castRay(map, { x: 0.5, y: 0.5 }, { x: 1, y: 0 }, door, [false], 3)
  assert.equal(hit?.kind, 'door')
  assert.equal(hit?.distance, 0.5)
  assert.equal(lineOfSight(map, { x: 0.5, y: 0.5 }, { x: 1.5, y: 0.5 }, door, [false]), false)
  assert.equal(lineOfSight(map, { x: 0.5, y: 0.5 }, { x: 1.5, y: 0.5 }, door, [true]), true)
})

test('sight does not leak diagonally through a blocked corner', () => {
  assert.equal(lineOfSight(['# ', ' #'], { x: 0.5, y: 0.5 }, { x: 1.5, y: 1.5 }), false)
  assert.equal(lineOfSight(['##', '##'], { x: 0.5, y: 0.5 }, { x: 1.5, y: 1.5 }), true)
})

test('hearing detects movement by continuous distance and supplies relative direction', () => {
  const listener = character({ x: 1.5, y: 1.5, heading: Math.PI / 2 }, 5, 3)
  const nearby = { sourceId: 'player', position: { x: 3.5, y: 1.5 } }
  const heard = hear(listener, nearby)
  assert.equal(heard?.kind, 'hearing')
  assert.equal(heard?.direction, 'front')
  assert.equal(heard?.distance, 2)
  assert.equal(hear(listener, { ...nearby, position: { x: 5, y: 1.5 } }), null)
  assert.equal(hear(listener, null), null)
})

test('movement noise is absent when an actor stands still', () => {
  assert.equal(movementSound('player', { x: 1, y: 1 }, { x: 1.005, y: 1 }), null)
  assert.deepEqual(movementSound('player', { x: 1, y: 1 }, { x: 1.2, y: 1 }), {
    sourceId: 'player', position: { x: 1.2, y: 1 },
  })
})
