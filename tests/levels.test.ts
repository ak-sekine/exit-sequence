import test from 'node:test'
import assert from 'node:assert/strict'
import { createState, step } from '../src/game.ts'
import { explore, stateKey } from './solver.ts'

test('complete duplicate-free BFS: all stages clear, stages 2/3 have distinct strategies', () => {
  for (const stage of [0, 1, 2]) {
    const result = explore(stage)
    assert.ok(result.clearEndpoints > 1)
    assert.ok(result.witnesses.clear); assert.ok(result.witnesses.fail)
    if (stage > 0) { assert.ok(result.witnesses.robotRemoved); assert.ok(result.witnesses.robotAlive) }
    if (stage === 2) assert.ok(result.witnesses.robotPush)
    for (const witness of Object.values(result.witnesses)) {
      let state = createState(stage)
      const visited = new Set([stateKey(state)])
      for (const input of witness.route) {
        const next = step(state, input)
        assert.notEqual(next, state)
        assert.equal(visited.has(stateKey(next)), false, 'witness must not revisit any gameplay state')
        visited.add(stateKey(next)); state = next
      }
      assert.deepEqual(state, witness.state)
    }
    console.log(`STAGE ${stage + 1}: ${result.visited} states, ${result.clearEndpoints} distinct clear endpoints; ${JSON.stringify(Object.fromEntries(Object.entries(result.witnesses).map(([k,v]) => [k,v.route])))}`)
  }
})
test('solver ignores turns/logs and treats box identities as interchangeable', () => {
  const state = createState(), equivalent = structuredClone(state)
  equivalent.turns = 999; equivalent.message = 'pushed'
  equivalent.entities.reverse(); equivalent.entities.forEach(e => { e.id = `changed-${e.id}` })
  assert.equal(stateKey(state), stateKey(equivalent))
})
