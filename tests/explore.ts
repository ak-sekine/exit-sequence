import assert from 'node:assert/strict'
import { explore } from './solver.ts'
import { writeFileSync } from 'node:fs'
const results = [0, 1, 2].map(stage => ({ stage: stage + 1, ...explore(stage) }))
for (const r of results) {
  assert.ok(r.witnesses.clear)
  assert.equal(r.walkOnlyClears, 0); assert.equal(r.noPushClears, 0)
  if (r.stage === 1) {
    assert.equal(r.noBoxPushClears, 0); assert.ok(r.witnesses.boxKept); assert.ok(r.witnesses.boxDropped)
  } else {
    assert.equal(r.noRobotInteractionClears, 0); assert.ok(r.witnesses.robotRemoved); assert.ok(r.witnesses.robotAlive)
    if (r.stage === 3) { assert.ok(r.witnesses.robotPush); assert.equal(r.unpreparedRobotGoal, 0) }
  }
}
console.log(JSON.stringify(results.map(({ witnesses, ...summary }) => ({ ...summary, strategies: Object.fromEntries(Object.entries(witnesses).map(([name, w]) => [name, { moves: w.route.length, route: w.route, signature: w.signature }])) })), null, 2))
writeFileSync('/tmp/exit-sequence-search.json', JSON.stringify(results, null, 2) + '\n')
