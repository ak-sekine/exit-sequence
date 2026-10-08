import test from 'node:test'
import assert from 'node:assert/strict'
import { Game, narrative } from '../src/game.ts'
import { scenes, knowledge } from '../src/scenario.ts'
import { items } from '../src/items.ts'
import type { GameState } from '../src/model.ts'
import { toolkit, lightRobot, toolSeal, toolPower, launch, expert, remembered, newcomer, decoyRoute, equipmentRoute, manualRoute, refillRoute, injuryOver, oxygenOver, launchOver, recklessRobot } from './routes.ts'

export function play(route: string[], game = new Game()) {
  for (const id of route) assert.ok(game.choose(id), `Legal choice ${id} in ${game.state.scene}`)
  return game
}
test('invalid and stale choices do not mutate State; returned snapshots are independent', () => {
  const g = new Game(), before = structuredClone(g.state)
  assert.equal(g.choose('launch-ignite'), null); assert.deepEqual(g.state, before)
  const transition = g.choose('open-supplies')!
  assert.equal(g.choose('open-supplies'), null)
  transition.after.items.push('flask')
  assert.deepEqual(g.state.items, [])
  g.restart(); assert.deepEqual(g.state, before)
})
test('observations and records give concrete facts without exposing unseen future information', () => {
  const g = play(toolkit), snapshot = structuredClone(g.state)
  for (const lang of ['ja', 'en'] as const) {
    const unseen = narrative(g.state, lang).join('\n')
    assert.doesNotMatch(unseen, lang === 'ja' ? /白い作業灯|点火時|三度の音のあと/ : /work lamp|Backflow|After three clicks/)
  }
  play(['watch-robot'], g)
  assert.ok(g.state.challenges.robot.observations.includes('robot-motion'))
  assert.ok(g.state.knowledge.includes('arm-cycle'))
  assert.equal(g.state.oxygen, snapshot.oxygen + 1)
  assert.match(narrative(g.state, 'ja').join(''), /折り返す|配管の下/)
  assert.match(narrative(g.state, 'en').join(''), /turns|beneath the pipe/)
  const record = play(['open-supplies', 'leave-supplies', 'read-records'])
  assert.ok(record.state.knowledge.includes('light-response'))
  assert.doesNotMatch(narrative(snapshot, 'ja').join(''), /記録の白い作業灯/)
  play(['leave-records', 'resume-challenge'], record)
  assert.match(narrative(record.state, 'ja').join(''), /記録の白い作業灯/)
})
test('preparation does not cross the obstacle; combining independent slots changes the result', () => {
  const upright = play([...toolkit, 'prepare-robot', 'ready-light', 'stance-upright'])
  const low = play([...toolkit, 'prepare-robot', 'ready-light', 'stance-low'])
  assert.equal(upright.state.challenges.robot.outcome, 'untried')
  assert.equal(low.state.challenges.robot.attempts, 0)
  assert.equal(low.state.scene, 'robot-act')
  upright.choose('robot-cross'); low.choose('robot-cross')
  assert.equal(upright.state.challenges.robot.outcome, 'failure')
  assert.equal(upright.state.status, 'playing')
  assert.equal(low.state.challenges.robot.outcome, 'clean')
  assert.equal(low.state.body, 'normal')
  assert.equal(low.state.oxygen, 0)
})
test('failed light experiment reveals its limited effect, supports a better retry, and never gives an AI solution', () => {
  const g = play([...toolkit, 'prepare-robot', 'ready-light', 'stance-upright'])
  const failed = g.choose('robot-cross')!
  assert.match(failed.result.ja, /赤い走査が止まる/)
  assert.match(failed.result.ja, /アームが頭の高さ/)
  assert.match(failed.result.en, /red scan stops/)
  assert.match(failed.result.en, /arm sweeps at head height/)
  assert.doesNotMatch(failed.result.ja, /次は|配管を使/)
  assert.equal(g.state.body, 'bruised')
  assert.ok(g.state.challenges.robot.observations.includes('white-test'))
  const air = g.state.oxygen
  play(['robot-result-retry', 'prepare-robot', 'ready-light', 'stance-low', 'robot-cross'], g)
  assert.equal(g.state.challenges.robot.attempts, 2)
  assert.equal(g.state.challenges.robot.outcome, 'clean')
  assert.equal(g.state.oxygen, air)
  assert.equal(g.state.body, 'bruised')
  assert.match(narrative(g.state, 'ja').join(''), /新しい痛みは増えていない/)
})
test('each obstacle has multiple solutions with different consequences', () => {
  const light = play([...toolkit, ...lightRobot])
  const gap = play(remembered.slice(0, toolkit.length + 5))
  const decoy = play(decoyRoute.slice(0, 12))
  assert.equal(light.state.challenges.robot.outcome, 'clean')
  assert.equal(gap.state.challenges.robot.outcome, 'costly')
  assert.ok(gap.state.oxygen > light.state.oxygen)
  assert.equal(decoy.state.challenges.robot.outcome, 'costly')
  assert.ok(!decoy.state.items.includes('decoy'))

  const sealed = play([...toolkit, ...lightRobot, ...toolSeal])
  const leaking = play([...toolkit, ...lightRobot, 'prepare-seal', 'hold-pressure', 'seal-to-act', 'equalise-pressure', 'open-airlock'])
  const supplied = play(equipmentRoute.slice(0, equipmentRoute.indexOf('seal-result-continue') + 1))
  assert.equal(sealed.state.challenges.seal.outcome, 'clean')
  assert.equal(leaking.state.challenges.seal.outcome, 'costly')
  assert.equal(leaking.state.oxygen - sealed.state.oxygen, 2)
  assert.equal(supplied.state.challenges.seal.outcome, 'costly')
  assert.ok(!supplied.state.items.includes('flask'))

  const motor = play([...toolkit, ...lightRobot, ...toolSeal, ...toolPower])
  const hand = play(manualRoute.slice(0, -launch.length))
  const vibrating = play(equipmentRoute.slice(0, equipmentRoute.indexOf('power-result-continue') + 1))
  assert.equal(motor.state.challenges.power.outcome, 'clean')
  assert.equal(hand.state.challenges.power.outcome, 'costly')
  assert.equal(hand.state.body, 'bruised')
  assert.ok(hand.state.oxygen > motor.state.oxygen)
  assert.equal(vibrating.state.challenges.power.outcome, 'costly')
  assert.ok(!vibrating.state.items.includes('decoy'))
})
test('player memory can replace GameState Knowledge, with no correct-choice unlock', () => {
  const g = play(remembered)
  assert.deepEqual(g.state.knowledge, [])
  assert.equal(g.state.status, 'clear')
  for (const s of Object.values(scenes)) for (const c of s.choices) {
    assert.equal(c.when?.knowledge, undefined, `Knowledge must not gate ${c.id}`)
    assert.ok(!c.routes?.some(route => route.when.knowledge), `Knowledge must not decide success for ${c.id}`)
  }
})
test('repeated dangerous attempts worsen State, with warnings before fatal accumulation', () => {
  const g = play(['start-without-kit', ...recklessRobot])
  const first = structuredClone(g.state)
  play(['robot-result-retry', ...recklessRobot], g)
  assert.equal(g.state.status, 'playing')
  assert.equal(g.state.body, 'injured')
  assert.ok(g.state.threat > first.threat)
  assert.ok(g.state.oxygen > first.oxygen)
  for (const lang of ['ja', 'en'] as const) assert.match(narrative(g.state, lang).join(''), lang === 'ja' ? /移動を続けられません/ : /unable to move/)
  play(['robot-result-retry', ...recklessRobot], g)
  assert.equal(g.state.scene, 'injury-over')
  assert.equal(play(oxygenOver).state.scene, 'oxygen-over')
  const fourth = play(oxygenOver.slice(0, -4))
  assert.equal(fourth.state.status, 'playing')
  assert.ok(fourth.state.oxygen >= 10)
  assert.match(narrative(fourth.state, 'ja').join(''), /残りの空気はわずか/)
})
test('withdrawal preserves learned facts, resets temporary setup, and supplies cannot be farmed', () => {
  const g = play([...toolkit, 'watch-robot', 'watch-to-prep', 'ready-light', 'stance-low', 'robot-cancel'])
  assert.equal(g.state.scene, 'refuge')
  assert.equal(g.state.challenges.robot.preparation.signal, 'none')
  assert.ok(g.state.knowledge.includes('arm-cycle'))
  assert.ok(g.state.items.includes('light'))
  play(['return-supplies', 'take-decoy', 'leave-supplies', 'resume-challenge', 'prepare-robot', 'ready-decoy', 'stance-quiet', 'robot-cross'], g)
  assert.ok(!g.state.items.includes('decoy'))
  // The player cannot return to a completed obstacle or retrieve a spent item.
  const saved = structuredClone(g.state)
  assert.equal(g.choose('robot-result-withdraw'), null)
  assert.deepEqual(g.state, saved)
  assert.ok(g.state.collected.includes('decoy'))
})
test('installed pipe repairs persist across retreat while pressure preparation is cleared', () => {
  const g = play([...toolkit, ...lightRobot, 'prepare-seal', 'patch-pipe', 'seal-to-act', 'open-airlock', 'seal-result-withdraw'])
  assert.equal(g.state.challenges.seal.preparation.patch, 'tools')
  assert.equal(g.state.challenges.seal.preparation.lock, 'open')
  assert.equal(g.state.challenges.seal.preparation.pressure, 'unequal')
  play(['resume-challenge'], g)
  assert.match(narrative(g.state, 'ja').join(''), /漏れる音はない/)
  play(['prepare-seal', 'hold-pressure', 'seal-to-act', 'equalise-pressure', 'open-airlock'], g)
  assert.equal(g.state.challenges.seal.outcome, 'clean')
})
test('every major item has distinct meaningful uses in ordinary play', () => {
  const lightPlate = play([...toolkit, ...lightRobot, ...toolSeal, ...toolPower, 'inspect-plate'])
  assert.equal(lightPlate.state.oxygen, 0)
  const noLightPlate = play(decoyRoute.slice(0, -launch.length))
  const airBeforeReading = noLightPlate.state.oxygen
  play(['inspect-plate'], noLightPlate)
  assert.equal(noLightPlate.state.oxygen, airBeforeReading + 1)
  assert.equal(play(equipmentRoute).state.status, 'clear') // flask feeds pipe; decoy releases brake
  const refill = play(['open-supplies', 'take-flask', 'leave-supplies', 'return-supplies', 'leave-supplies', 'breathe-reserve'])
  assert.equal(refill.state.oxygen, 0)
  assert.ok(!refill.state.items.includes('flask'))
  assert.equal(refill.choose('breathe-reserve'), null)
  play(['return-supplies'], refill)
  assert.equal(refill.choose('take-flask'), null)
  // Light influences robot AND plate; tools influence pipe, brake AND cable.
  assert.ok(lightPlate.state.items.includes('tools'))
  assert.ok(play(decoyRoute).state.status === 'clear') // decoy sound differs from its vibration use
})
test('repeating risky observation costs air and alert; safe reading cannot grant more supplies', () => {
  const g = play([...toolkit, 'watch-robot', 'watch-to-door'])
  const first = structuredClone(g.state)
  play(['watch-robot'], g)
  assert.equal(g.state.oxygen, first.oxygen + 1)
  assert.equal(g.state.threat, first.threat + 1)
  assert.deepEqual(g.state.knowledge, first.knowledge)
  assert.deepEqual(g.state.items, first.items)
})
test('final launch requires separate pressure, power and ignition operations; several mistakes can be repaired', () => {
  const g = play([...toolkit, ...lightRobot, ...toolSeal, ...toolPower, 'board-ship', 'to-electric'])
  assert.equal(g.state.challenges.launch.outcome, 'untried')
  g.choose('launch-ignite')
  assert.equal(g.state.status, 'playing')
  assert.equal(g.state.scene, 'ship-result')
  play(['launch-retry', 'to-pressure', 'launch-lock', 'launch-equalise', 'pressure-to-electric', 'launch-arm'], g)
  // Arming is distinct from disconnecting; external connection still blocks ignition.
  assert.equal(g.state.challenges.launch.preparation.supply, 'external')
  g.choose('launch-ignite')
  assert.equal(g.state.status, 'playing')
  play(['launch-retry', 'to-electric', 'launch-disconnect', 'launch-ignite'], g)
  assert.equal(g.state.status, 'clear')
  assert.equal(g.state.challenges.launch.outcome, 'costly')
  const loss = play([...toolkit, ...lightRobot, ...toolSeal, ...toolPower, ...launch.slice(0, -1), 'electric-to-pressure', 'launch-release'])
  assert.equal(loss.state.challenges.launch.preparation.ignition, 'cold')
  assert.equal(loss.state.challenges.launch.preparation.pressure, 'open')
  assert.equal(play(launchOver).state.scene, 'launch-over')
})
test('accumulated exhaustion precedes CLEAR and never narrates a completed launch', () => {
  const g = play([...toolkit, ...lightRobot, ...toolSeal, ...toolPower, 'board-ship', 'to-electric', 'launch-ignite'])
  for (let i = 0; i < 3; i++) play(['launch-retry', 'to-electric', 'launch-ignite'], g)
  assert.equal(g.state.oxygen, 10)
  play(['launch-retry', 'to-electric', 'launch-arm'], g)
  assert.equal(g.state.oxygen, 13)
  play(['launch-retry', 'to-pressure', 'launch-lock', 'launch-equalise', 'pressure-to-electric', 'launch-disconnect', 'launch-arm'], g)
  const last = g.choose('launch-ignite')!
  assert.equal(g.state.scene, 'oxygen-over')
  assert.equal(g.state.challenges.launch.outcome, 'failure')
  assert.match(last.result.ja, /操作を終える前/)
  assert.doesNotMatch(last.result.en, /ship leaves|flew|base falls/)
})
test('newcomer, expert and three alternative CLEAR routes work through actual choices deterministically', () => {
  for (const route of [newcomer, expert, remembered, decoyRoute, equipmentRoute, manualRoute]) {
    const first = play(route), again = play(route)
    assert.equal(first.state.status, 'clear'); assert.deepEqual(first.state, again.state)
    assert.equal(first.choose('launch-ignite'), null)
  }
  assert.ok(play(newcomer).state.oxygen > play(expert).state.oxygen)
  assert.equal(play(newcomer).state.body, 'bruised')
  assert.equal(play(expert).state.body, 'normal')
  assert.equal(play(injuryOver).state.status, 'over')
})
test('ja/en share logic, and rendering or choosing a language cannot advance State', () => {
  const games = [new Game(), new Game()]
  for (const id of newcomer) {
    games.forEach((g, index) => {
      const before = structuredClone(g.state)
      narrative(g.state, index === 0 ? 'ja' : 'en'); g.choices()
      assert.deepEqual(g.state, before)
      assert.ok(g.choose(id))
    })
    assert.deepEqual(games[0].state, games[1].state)
  }
})
test('scenario structure has typed targets, 2–5 choices, localized facts and correct AI prefixes', () => {
  const ids = new Set<string>()
  const checkText = (text: { ja: string; en: string }) => {
    assert.ok(text.ja.trim() && text.en.trim())
    assert.doesNotMatch(text.ja, /AI:/); assert.doesNotMatch(text.en, /AI：/)
  }
  for (const scene of Object.values(scenes)) {
    assert.ok(scene.choices.length === 0 ? scene.ending : scene.choices.length >= 2 && scene.choices.length <= 5)
    checkText(scene.title); scene.narrative.forEach(checkText)
    scene.additions?.forEach(line => checkText(line.text))
    for (const c of scene.choices) {
      assert.ok(!ids.has(c.id)); ids.add(c.id)
      assert.ok(scenes[c.next]); checkText(c.label); checkText(c.result)
      for (const r of c.routes ?? []) { assert.ok(scenes[r.next]); if (r.result) checkText(r.result) }
    }
  }
  Object.values(knowledge).forEach(checkText); Object.values(items).forEach(checkText)
})
test('representative routes reach every Scene and choice screen without dead ends', () => {
  const visited = new Set<string>(), exercised = new Set<string>()
  const routes = [newcomer, expert, remembered, decoyRoute, equipmentRoute, manualRoute, injuryOver, oxygenOver, launchOver,
    ['open-supplies', 'take-light', 'leave-supplies', 'read-records', 'record-details', 'resume-challenge', 'robot-withdraw', 'resume-challenge', 'watch-robot', 'watch-to-door', 'prepare-robot', 'prep-to-window']]
  const assertScreen = (g: Game) => {
    visited.add(g.state.scene)
    if (g.state.status === 'playing') assert.ok(g.choices().length >= 1 && g.choices().length <= 5)
  }
  for (const route of routes) {
    const g = new Game(); assertScreen(g)
    for (const id of route) { exercised.add(id); assert.ok(g.choose(id)); assertScreen(g) }
  }
  assert.deepEqual(Object.keys(scenes).filter(id => !visited.has(id)), [])
  assert.ok(exercised.has('robot-result-retry') && exercised.has('launch-ignite'))
})
test('all action variants and consequence branches are executable from legal play snapshots', () => {
  // A bounded frontier avoids an unbounded graph of harmless panel adjustments.
  // Seeds are actual player routes; no State field is modified to unlock a choice.
  const seeds: GameState[] = []
  for (const route of [newcomer, expert, remembered, decoyRoute, equipmentRoute, manualRoute, refillRoute, injuryOver, oxygenOver, launchOver]) {
    const g = new Game(); seeds.push(structuredClone(g.state))
    for (const id of route) { assert.ok(g.choose(id)); seeds.push(structuredClone(g.state)) }
  }
  const exercised = new Set<string>(), routeCoverage = new Set<object>()
  const seen = new Set<string>()
  const queue = seeds.map(state => ({ state, depth: 0 }))
  while (queue.length) {
    const { state, depth } = queue.pop()!, key = JSON.stringify(state)
    if (seen.has(key)) continue
    seen.add(key)
    const g = new Game(); g.state = structuredClone(state)
    for (const c of g.choices()) {
      const branch = new Game(); branch.state = structuredClone(state)
      const result = branch.choose(c.id)!
      assert.ok(result)
      exercised.add(c.id)
      assert.ok(branch.state.oxygen >= 0 && branch.state.threat >= 0 && branch.state.threat <= 4)
      if (branch.state.status === 'playing') assert.ok(branch.choices().length >= 1 && branch.choices().length <= 5)
      c.routes?.forEach(route => { if (result.result === route.result) routeCoverage.add(route) })
      if (depth < 2) queue.push({ state: branch.state, depth: depth + 1 })
    }
  }
  const missing = Object.values(scenes).flatMap(s => s.choices).filter(c => !exercised.has(c.id)).map(c => c.id)
  assert.deepEqual(missing, [])
  assert.ok(routeCoverage.size >= 15)
})
