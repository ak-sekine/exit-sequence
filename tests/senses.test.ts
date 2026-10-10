import test from 'node:test'
import assert from 'node:assert/strict'
import { character } from '../src/character.ts'
import { VECTORS, move } from '../src/dungeon.ts'
import { hear, see, movementSound, lineOfSight } from '../src/senses.ts'
const map = Array.from({ length: 21 }, () => '#'.repeat(21))
test('vision cone exact widths, distances, all rotations and target facing', () => {
  for (const facing of [0, 1, 2, 3] as const) {
    const observer = character({ x: 10, y: 10, facing }), f = VECTORS[facing], r = VECTORS[(facing + 1) % 4]!
    for (let distance = -1; distance <= 7; distance++) for (let lateral = -4; lateral <= 4; lateral++) {
      const target = { x: 10 + f.x * distance + r.x * lateral, y: 10 + f.y * distance + r.y * lateral, facing: 1 as const }
      const result = see(map, observer, target)
      const width = [0, 1, 1, 2, 2, 3][distance]
      const expected = distance >= 1 && distance <= 5 && Math.abs(lateral) <= width!
      assert.equal(!!result, expected, `${facing}/${distance}/${lateral}`)
      if (result) { assert.equal(result.distance, distance); assert.equal(result.facing, 1); assert.deepEqual(result.position, { x: target.x, y: target.y }) }
    }
  }
})
test('center rays block walls, doors in both orientations and vertex corner grazing', () => {
  assert.equal(lineOfSight(['# #'], { x: 0, y: 0 }, { x: 2, y: 0 }), false)
  assert.equal(lineOfSight(['###'], { x: 0, y: 0 }, { x: 2, y: 0 }, [{ from: { x: 1, y: 0 }, to: { x: 2, y: 0 } }]), false)
  assert.equal(lineOfSight(['#', '#', '#'], { x: 0, y: 2 }, { x: 0, y: 0 }, [{ from: { x: 0, y: 1 }, to: { x: 0, y: 0 } }]), false)
  assert.equal(lineOfSight(['# ', ' #'], { x: 0, y: 0 }, { x: 1, y: 1 }), false)
  assert.equal(lineOfSight(['##', ' #'], { x: 0, y: 0 }, { x: 1, y: 1 }), false)
  assert.equal(lineOfSight(['##', '##'], { x: 0, y: 0 }, { x: 1, y: 1 }), true)
  for (const door of [{ from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }, { from: { x: 1, y: 0 }, to: { x: 1, y: 1 } }]) assert.equal(lineOfSight(['##', '##'], { x: 0, y: 0 }, { x: 1, y: 1 }, [door]), false)
  assert.equal(see(['# #'], character({ x: 0, y: 0, facing: 1 }), { x: 2, y: 0, facing: 3 }), null)
})
test('hearing square, relative eight directions in all orientations, no facing leakage', () => {
  const directions = ['front', 'frontRight', 'right', 'backRight', 'back', 'backLeft', 'left', 'frontLeft']
  const offsets = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]]
  for (const facing of [0, 1, 2, 3] as const) {
    const observer = character({ x: 10, y: 10, facing }), f = VECTORS[facing], r = VECTORS[(facing + 1) % 4]!
    for (let i = 0; i < 8; i++) for (const distance of [1, 2, 3]) {
      const [right, forward] = offsets[i]!
      const position = { x: 10 + distance * (right! * r.x + forward! * f.x), y: 10 + distance * (right! * r.y + forward! * f.y) }
      const result = hear(observer, { sourceId: 'enemy', position })
      if (distance === 3) assert.equal(result, null)
      else { assert.equal(result!.direction, directions[i]); assert.equal(result!.distance, distance); assert.ok(!('facing' in result!)) }
    }
    assert.equal(hear(observer, null), null)
  }
})
test('only successful movement emits sound at destination, independent of occlusion', () => {
  const p = character({ x: 0, y: 0, facing: 1 })
  for (const action of ['left', 'right', 'down', 'up'] as const) assert.equal(movementSound('p', p, move(['#'], p, action).player), null)
  const sound = movementSound('p', p, move(['##'], p, 'up').player)!
  assert.deepEqual(sound.position, { x: 1, y: 0 })
  assert.ok(hear(character({ x: 2, y: 0, facing: 0 }), sound))
  assert.ok(hear(p, { sourceId: 'e', position: { x: 2, y: 0 } }))
})
