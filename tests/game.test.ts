import test from 'node:test'
import assert from 'node:assert/strict'
import { Game, matches, narrative } from '../src/game.ts'
import { scenes, knowledge } from '../src/scenario.ts'
import { items } from '../src/items.ts'
import { ordinary, informed, service, decoy, robotOver, oxygenOver, highAlert } from './routes.ts'
function play(route: string[]) { const game = new Game(); for (const id of route) assert.ok(game.choose(id), `Legal choice ${id} in ${game.state.scene}`); return game }

test('initial scene, transition and invalid/stale choices are immutable', () => {
  const g = new Game(); assert.equal(g.state.scene, 'wake')
  const initial = structuredClone(g.state); assert.equal(g.choose('known-launch'), null); assert.deepEqual(g.state, initial)
  g.choose('check-kit'); assert.equal(g.state.scene, 'kit')
  const after = structuredClone(g.state); assert.equal(g.choose('check-kit'), null); assert.equal(g.choose('back'), null); assert.deepEqual(g.state, after)
})
test('ordinary, informed, service and item escape routes clear using legal operations', () => {
  for (const route of [ordinary, informed, service, decoy]) { const g = play(route); assert.equal(g.state.status, 'clear'); assert.equal(g.choose('check-kit'), null) }
  assert.ok(play(informed).state.knowledge.includes('arm-traces'))
  assert.ok(!play(ordinary).state.knowledge.includes('arm-traces'))
})
test('knowledge unlocks a reading of earlier marks and a new action', () => {
  const g = play(informed.slice(0, 6)); assert.equal(g.state.scene, 'marks')
  assert.ok(g.choices().some(c => c.id === 'trace-shadow'))
  const unlearned = structuredClone(g.state); unlearned.knowledge = []
  assert.ok(narrative(g.state, 'ja').join('').includes('あの映像と同じ痕'))
  assert.ok(!narrative(unlearned, 'ja').join('').includes('あの映像と同じ痕'))
  assert.ok(!matches(unlearned, scenes.marks.choices[0].when))
  assert.equal(narrative(new Game().state, 'ja').join('').includes('アームが旋回'), false)
})
test('items unlock actions and single-use decoy and oxygen are consumed', () => {
  const g = play(decoy.slice(0, 5)); assert.equal(g.state.scene, 'encounter'); assert.ok(g.state.items.includes('decoy'))
  assert.ok(g.choose('use-decoy')); assert.ok(!g.state.items.includes('decoy')); assert.equal(g.state.threat, 0)
  const without = play(robotOver.slice(0, 2)); const before = structuredClone(without.state)
  assert.equal(without.choose('use-decoy'), null); assert.deepEqual(without.state, before)
  const flask = play(['check-kit', 'take-both', 'service-hatch', 'inspect-bench', 'unscrew-tools', 'hand-seal', 'step-plate', 'blue-power'])
  assert.equal(flask.state.oxygen, 2); assert.ok(flask.choose('airlock-refill')); assert.equal(flask.state.oxygen, 0); assert.ok(!flask.state.items.includes('flask'))
  assert.equal(flask.choose('airlock-refill'), null)
})
test('oxygen, injury and alert affect text, choices and deterministic encounters', () => {
  const low = play(['leave-case', 'service-hatch', 'crawl-through', 'hold-seal', 'step-plate'])
  assert.equal(low.state.body, 'injured'); assert.equal(low.state.threat, 1)
  assert.ok(!low.choices().some(c => c.id === 'manual-lift'))
  const high = play(highAlert); assert.equal(high.state.threat, 2)
  assert.match(narrative(high.state, 'ja').join(''), /駆動音が止まった/)
  assert.ok(high.choose('wait-relay')); assert.equal(high.state.threat, 1); assert.equal(high.state.oxygen, 1)
  assert.match(narrative(high.state, 'ja').join(''), /金属音が何度も近づいて/)
  assert.equal(high.choose('wait-relay'), null)
  const zero = play(['leave-case', 'service-hatch', 'inspect-bench', 'leave-bench', 'hand-seal', 'step-plate', 'wait-relay'])
  assert.equal(zero.state.threat, 0); assert.match(narrative(zero.state, 'en').join(''), /Something moves far away/)
  assert.equal(play([...highAlert, 'alarm-power']).state.scene, 'encounter')
  assert.equal(play([...highAlert, 'wait-relay', 'alarm-power']).state.scene, 'airlock')
})
test('robot and oxygen failures; oxygen exhaustion precedes transition results', () => {
  assert.equal(play(robotOver).state.scene, 'robot-over'); assert.equal(play(oxygenOver).state.scene, 'oxygen-over')
  assert.equal(play(['leave-case', 'service-hatch', 'inspect-bench', 'leave-bench', 'hand-seal', 'step-plate', 'blue-power', 'equalise', 'ignite-first']).state.status, 'over')
})
test('all read-only panels and both languages leave state untouched', () => {
  const g = play(informed.slice(0, 6)), before = structuredClone(g.state)
  for (const language of ['ja', 'en'] as const) for (const panel of ['status', 'inventory', 'knowledge', 'help', 'settings', 'language'] as const) { g.read(panel, language); narrative(g.state, language); g.choices(); assert.deepEqual(g.state, before) }
})
test('all reachable play states have actions (normally 2–5; constraints can narrow them); every scene and choice is reachable', () => {
  const queue = [new Game().state], seen = new Set<string>(), visited = new Set<string>(), choices = new Set<string>()
  while (queue.length) {
    const s = queue.pop()!, key = JSON.stringify(s); if (seen.has(key)) continue; seen.add(key); visited.add(s.scene)
    const g = new Game(); g.state = structuredClone(s)
    if (s.status === 'playing') { assert.ok(g.choices().length >= 1 && g.choices().length <= 5, `${s.scene}: ${g.choices().length}`) }
    for (const c of g.choices()) { const branch = new Game(); branch.state = structuredClone(s); assert.ok(branch.choose(c.id)); choices.add(c.id); queue.push(branch.state) }
  }
  assert.equal(visited.size, Object.keys(scenes).length)
  assert.deepEqual(Object.values(scenes).flatMap(s => s.choices).filter(c => !choices.has(c.id)).map(c => c.id), [])
})
test('localized prose has matched semantic units and correct AI speaker prefixes', () => {
  assert.equal(Object.keys(scenes).length, 18); assert.equal(Object.keys(items).length, 4); assert.equal(Object.keys(knowledge).length, 4)
  for (const scene of Object.values(scenes)) {
    assert.equal(scene.id in scenes, true)
    for (const pair of [...scene.narrative, ...(scene.additions ?? []).map(a => a.text), ...scene.choices.flatMap(c => [c.label, c.result, ...(c.routes ?? []).flatMap(r => r.result ? [r.result] : [])])]) {
      assert.ok(pair.ja.trim() && pair.en.trim())
      assert.equal(pair.ja.startsWith('AI：'), pair.en.startsWith('AI:'))
      assert.ok(!pair.ja.startsWith('AI:')); assert.ok(!pair.en.startsWith('AI：'))
    }
    for (const choice of scene.choices) { assert.ok(scenes[choice.next]); for (const route of choice.routes ?? []) assert.ok(scenes[route.next]) }
  }
  // Language is a rendering parameter; it is absent from every choice/effect/route.
  const ja = new Game(), en = new Game()
  for (const id of informed) { narrative(ja.state, 'ja'); narrative(en.state, 'en'); ja.choose(id); en.choose(id); assert.deepEqual(ja.state, en.state) }
})
