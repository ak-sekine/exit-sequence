import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { EVENTS } from '../src/events.ts'
import {
  INITIAL_POWER, MAX_POWER, TOTAL_TILES, adjustedPower, createGame, createSeededRandom,
  continueAfterResult, displayedPowerDelta, resolveAction, successProbabilityPercent, toGameView, zoneForTile,
} from '../src/game.ts'
import type { GameState, RandomSource } from '../src/game.ts'

const constant = (value: number): RandomSource => () => value
const expectedActionRules = [
  ['bulkhead','electronic',57,-1,-5],['bulkhead','manual',63,-3,-4],['bulkhead','force',43,1,-8],
  ['generator','restart',48,5,-4],['generator','bypass',68,2,-2],['generator','overload',34,9,-8],
  ['battery','synchronize',66,4,-1],['battery','direct',45,8,-6],['battery','trickle',80,2,-2],
  ['leak','insulate',61,-1,-4],['leak','jump',45,1,-7],['leak','crawl',74,-3,-2],
  ['charger','calibrate',55,5,-3],['charger','full',39,8,-7],['charger','trickle',79,2,-1],
  ['conveyor','ride',53,3,-5],['conveyor','override',68,-1,-3],['conveyor','counterflow',40,1,-7],
  ['emergency','switch',48,6,-4],['emergency','reserve',75,3,-2],['emergency','draw',32,10,-8],
  ['terminal','reboot',56,4,-3],['terminal','manual',82,2,-1],['terminal','exploit',42,8,-7],
  ['cargo-rail','ride',60,-1,-5],['cargo-rail','unlock',47,3,-5],['cargo-rail','bypass',78,-2,-2],
  ['lift','ladder',67,-2,-4],['lift','lift-power',71,-4,-2],['lift','climb-fast',43,1,-8],
] as const
function fixtureAt(tile: number, power: number, eventId = 'bulkhead'): GameState {
  const initial = createGame(constant(0.25), 7)
  return { ...initial, position: tile, power, currentEvent: { tile, zone: zoneForTile(tile), eventId } }
}

test('starts with 20 power, 15 tiles, three five tile story zones, and ten events', () => {
  const state = createGame(constant(0.1), 1234)
  assert.equal(INITIAL_POWER, 20); assert.equal(MAX_POWER, 20); assert.equal(TOTAL_TILES, 15)
  assert.equal(state.power, 20); assert.equal(state.position, 1); assert.equal(state.status, 'playing')
  assert.equal(state.history.length, 0); assert.equal(EVENTS.length, 10)
  assert.deepEqual([1, 5, 6, 10, 11, 15].map(zoneForTile), [1, 1, 2, 2, 3, 3])
})

test('seeded event draws and seeded choices are reproducible', () => {
  const play = (seed: number) => {
    const gameRandom = createSeededRandom(seed), slotRandom = createSeededRandom(seed ^ 0x5eed)
    let state = createGame(gameRandom, seed), action = 0
    while (state.status === 'playing') {
      state = resolveAction(state, action % 3, Math.floor(slotRandom() * 100), gameRandom)
      if (state.pendingNextEvent) state = continueAfterResult(state)
      action++
    }
    return state
  }
  assert.deepEqual(toGameView(play(0xdeadbeef)), toGameView(play(0xdeadbeef)))
  assert.notDeepEqual(toGameView(play(1)).currentEvent, toGameView(play(2)).currentEvent)
  assert.equal(createGame(createSeededRandom(42), 42).currentEvent.eventId, 'emergency', 'the first seeded draw remains the existing event draw')
})

test('all ten events have descriptions and all thirty actions have unique result text and fixed integer chances', () => {
  assert.equal(EVENTS.length, 10)
  const actions = EVENTS.flatMap(event => {
    assert.ok(event.title && event.description)
    assert.equal(event.actions.length, 3)
    return event.actions
  })
  assert.equal(actions.length, 30)
  assert.equal(new Set(actions.map(action => action.successText)).size, 30)
  assert.equal(new Set(actions.map(action => action.failureText)).size, 30)
  for (const action of actions) {
    assert.ok(Number.isInteger(action.successProbabilityPercent))
    assert.ok(action.successProbabilityPercent > 0 && action.successProbabilityPercent < 100)
    assert.ok(action.successText && action.failureText)
  }
})

test('manual copy review covers all 30 failure texts without changing success text or action rules', () => {
  const actions = EVENTS.flatMap(event => event.actions.map(action => [event.id, action.id, action.successProbabilityPercent, action.successDelta, action.failureDelta] as const))
  assert.deepEqual(actions, expectedActionRules)
  const successTextDigest = createHash('sha256').update(EVENTS.flatMap(event => event.actions.map(action => action.successText)).join('\n')).digest('hex')
  assert.equal(successTextDigest, '9b4165b9845e0c8733539c1c3732274a081e7ff7711f9a0c4d5422df3e7d2def')
  assert.equal(EVENTS.flatMap(event => event.actions).length, 30)
})

test('each failed action advances when power remains and reaches GAME OVER at zero', () => {
  for (const event of EVENTS) {
    for (let index = 0; index < event.actions.length; index++) {
      const action = event.actions[index]!
      const withPower = resolveAction(fixtureAt(1, 20, event.id), index, 99, constant(0.5))
      assert.equal(withPower.lastResult?.success, false, `${event.id}/${action.id} is forced to fail`)
      assert.equal(toGameView(withPower).lastResult?.failureText, action.failureText)
      assert.equal(withPower.power, 20 + action.failureDelta)
      assert.ok(withPower.power > 0)
      assert.ok(withPower.pendingNextEvent)
      assert.equal(continueAfterResult(withPower).position, 2)

      const atZero = resolveAction(fixtureAt(1, -action.failureDelta, event.id), index, 99, constant(0.5))
      assert.equal(atZero.power, 0)
      assert.equal(atZero.status, 'lost')
      assert.equal(atZero.pendingNextEvent, null)
    }
  }
})

test('displayed fixed integer chance is the exact strict slot threshold', () => {
  const state = fixtureAt(1, 20)
  for (let index = 0; index < 3; index++) {
    const threshold = successProbabilityPercent(state, index)
    assert.equal(threshold, EVENTS[0]!.actions[index]!.successProbabilityPercent)
    assert.equal(resolveAction(state, index, threshold - 1, constant(0)).lastResult!.success, true)
    assert.equal(resolveAction(state, index, threshold, constant(0)).lastResult!.success, false)
  }
  assert.equal('facilityConditions' in state, false)
  assert.equal(JSON.stringify(state).includes('observation'), false)
  assert.equal(JSON.stringify(toGameView(state)).includes('clues'), false)
})

test('success and failure both hold the turn until continueAfterResult', () => {
  const initial = fixtureAt(1, 20)
  for (const [roll, success, delta] of [[0, true, -1], [99, false, -5]] as const) {
    const result = resolveAction(initial, 0, roll, constant(0.5))
    assert.equal(result.lastResult!.success, success)
    assert.equal(result.lastResult!.powerChange, delta)
    assert.equal(result.position, 1)
    assert.ok(result.pendingNextEvent)
    assert.equal(resolveAction(result, 0, 0, constant(0)), result)
    const next = continueAfterResult(result)
    assert.equal(next.position, 2)
    assert.equal(next.pendingNextEvent, null)
  }
})

test('event sequence consumes seeded draws independent of slot animation draws', () => {
  const seed = 987654
  const firstRandom = createSeededRandom(seed), secondRandom = createSeededRandom(seed)
  const first = createGame(firstRandom, seed), second = createGame(secondRandom, seed)
  const animationRandom = createSeededRandom(seed ^ 0x12345678)
  for (let i = 0; i < 10000; i++) animationRandom()
  const a = resolveAction(first, 0, 42, firstRandom), b = resolveAction(second, 0, 42, secondRandom)
  assert.deepEqual(toGameView(continueAfterResult(a)), toGameView(continueAfterResult(b)))
})

test('power changes clamp at zero and twenty; reaching zero loses', () => {
  assert.equal(adjustedPower(19, 8), 20); assert.equal(adjustedPower(2, -8), 0)
  assert.equal(displayedPowerDelta(19, 8), 1); assert.equal(displayedPowerDelta(2, -8), -2)
  const failed = resolveAction(fixtureAt(4, 1), 0, 99)
  assert.equal(failed.status, 'lost'); assert.equal(failed.power, 0)
})

test('tile 15 with remaining power clears; tile 15 at zero is game over', () => {
  const win = resolveAction(fixtureAt(15, 10), 0, 0)
  assert.equal(win.status, 'won'); assert.equal(win.position, 15); assert.ok(win.power > 0)
  const loss = resolveAction(fixtureAt(15, 4), 0, 99)
  assert.equal(loss.status, 'lost')
})

test('invalid slot values are rejected and invalid action indexes are ignored', () => {
  const state = fixtureAt(1, 20)
  assert.equal(resolveAction(state, 8, 0), state)
  for (const value of [-1, 100, 0.5, Number.NaN]) assert.throws(() => resolveAction(state, 0, value), RangeError)
})
