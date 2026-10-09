import test from 'node:test'
import assert from 'node:assert/strict'
import { createState, step } from '../src/game.ts'
import { bit, explore, signature, stateKey, transitionEvents } from './solver.ts'

test('complete state/signature search: required interactions and distinct uses of push', () => {
  for (const stage of [0, 1, 2]) {
    const result = explore(stage), w = result.witnesses
    assert.ok(w.clear); assert.ok(w.fail)
    assert.equal(result.walkOnlyClears, 0)
    assert.equal(result.noPushClears, 0)
    if (stage === 0) {
      assert.equal(result.noBoxPushClears, 0)
      assert.ok(w.boxKept); assert.ok(w.boxDropped)
      assert.equal(w.boxKept.state.entities.filter(e => e.kind === 'box').length, 2)
      assert.equal(w.boxDropped.state.entities.filter(e => e.kind === 'box').length, 1)
      assert.ok(w.boxDropped.signature.includes('BOX_DROPPED_IN_HOLE'))
      assert.ok(!w.boxKept.signature.includes('BOX_DROPPED_IN_HOLE'))
      const initialBoxes = createState(stage).entities.filter(e => e.kind === 'box')
      assert.ok(initialBoxes.some(box => {
        const kept = w.boxKept!.state.entities.find(e => e.id === box.id)
        return kept && (kept.x !== box.x || kept.y !== box.y) && !w.boxDropped!.state.entities.some(e => e.id === box.id)
      }), 'the same obstructing box is relocated in one method and removed in the other')
    } else {
      assert.equal(result.noRobotInteractionClears, 0)
      assert.ok(w.robotRemoved); assert.ok(w.robotAlive)
      assert.ok(!w.robotRemoved.state.entities.some(e => e.kind === 'robot'))
      assert.ok(w.robotAlive.state.entities.some(e => e.kind === 'robot'))
      assert.equal(w.robotAlive.state.clearBy, 'player')
      assert.ok(w.robotAlive.signature.some(s => ['PLAYER_PUSH_ROBOT', 'ROBOT_PUSH_BOX', 'ROBOT_PUSH_PLAYER'].includes(s)))
      if (stage === 2) {
        assert.ok(w.robotPush)
        assert.ok(w.robotPush.signature.includes('ROBOT_PUSH_PLAYER'))
        assert.ok(w.robotPush.signature.includes('PLAYER_PUSHED_TO_GOAL'))
        assert.equal(result.unpreparedRobotGoal, 0, 'every robot-goal clear requires player setup')
        assert.equal(new Set([w.robotRemoved, w.robotAlive, w.robotPush].map(v => v.signature.join(','))).size, 3)
      }
    }
    for (const witness of Object.values(w)) {
      let state = createState(stage), mask = 0
      const visited = new Set([stateKey(state)])
      for (const input of witness.route) {
        mask |= transitionEvents(state, input)
        const next = step(state, input)
        assert.notEqual(next, state)
        assert.equal(visited.has(stateKey(next)), false, 'strategy witness cannot revisit board states')
        visited.add(stateKey(next)); state = next
      }
      assert.deepEqual(state, witness.state)
      assert.deepEqual(signature(mask), witness.signature)
    }
    console.log(`STAGE ${stage + 1}: WALK-ONLY=0; shortest ${w.clear.route.length}: ${w.clear.route.join(' ')}; ${w.clear.signature.join(', ')}`)
  }
})
test('solver ignores turns/logs and treats box identities as interchangeable', () => {
  const state = createState(), equivalent = structuredClone(state)
  equivalent.turns = 999; equivalent.message = 'pushed'
  equivalent.entities.reverse(); equivalent.entities.forEach(e => { e.id = `changed-${e.id}` })
  assert.equal(stateKey(state), stateKey(equivalent))
})
test('phase observation includes chain, drops and robot push to goal', () => {
  // Fixtures exercise general transitions, never stage-specific turn handling.
  const state = createState(0, { terrain: [['wall','wall','wall','wall','wall','wall'], ['wall','floor','floor','floor','goal','wall'], ['wall','floor','floor','floor','floor','wall'], ['wall','wall','wall','wall','wall','wall']], entities: [{ id:'p',kind:'player',x:3,y:2 },{ id:'r',kind:'robot',x:1,y:1 },{ id:'b',kind:'box',x:2,y:1 }] })
  const mask = transitionEvents(state, 'up')
  for (const name of ['ROBOT_PUSH_BOX', 'ROBOT_PUSH_PLAYER', 'CHAIN_PUSH', 'PLAYER_PUSHED_TO_GOAL'] as const) assert.ok(mask & bit(name))
})
