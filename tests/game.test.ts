import test from 'node:test'
import assert from 'node:assert/strict'
import { EVENTS, OBSERVATION_LIKELIHOOD, successChance } from '../src/events.ts'
import {
  INITIAL_POWER,
  MAX_POWER,
  TOTAL_TILES,
  adjustedPower,
  createGame,
  createSeededRandom,
  continueAfterResult,
  displayedPowerDelta,
  estimateSuccessProbability,
  inferStableProbability,
  resolveAction,
  successProbabilityPercent,
  toGameView,
  zoneForTile,
} from '../src/game.ts'
import type { GameState, RandomSource } from '../src/game.ts'

const constant = (value: number): RandomSource => () => value

function fixtureAt(tile: number, power: number, seed = 7): GameState {
  const initial = createGame(constant(0.25), seed)
  return {
    ...initial,
    position: tile,
    power,
    currentEvent: { tile, zone: zoneForTile(tile), eventId: 'bulkhead', observation: 'flicker' },
  }
}

test('initial state has 20 power, 15 tiles, three fixed facility zones, and a live first event', () => {
  const state = createGame(constant(0.1), 1234)
  assert.equal(INITIAL_POWER, 20)
  assert.equal(MAX_POWER, 20)
  assert.equal(TOTAL_TILES, 15)
  assert.equal(state.power, 20)
  assert.equal(state.position, 1)
  assert.equal(state.status, 'playing')
  assert.equal(state.facilityConditions.length, 3)
  assert.equal(state.currentEvent.tile, 1)
  assert.equal(state.currentEvent.zone, 1)
  assert.equal(state.history.length, 0)
  assert.equal(EVENTS.length >= 8, true)
  assert.ok(state.facilityConditions.every(condition => condition === 'stable'))
})

test('event draw and seeded play are reproducible', () => {
  const play = (seed: number) => {
    const gameRandom = createSeededRandom(seed)
    const slotRandom = createSeededRandom(seed ^ 0x5eed)
    let state = createGame(gameRandom, seed)
    let action = 0
    for (let i = 0; i < 15 && state.status === 'playing'; i++) {
      const count = EVENTS.find(event => event.id === state.currentEvent.eventId)!.actions.length
      state = resolveAction(state, action % count, Math.floor(slotRandom() * 100), gameRandom)
      if (state.pendingNextEvent) state = continueAfterResult(state)
      action++
    }
    return state
  }
  assert.deepEqual(toGameView(play(0xdeadbeef)), toGameView(play(0xdeadbeef)))
  assert.notDeepEqual(toGameView(play(1)).currentEvent, toGameView(play(2)).currentEvent)
})

test('all ten event definitions contain two or three choices and no 0% or 100% action', () => {
  assert.equal(EVENTS.length, 10)
  for (const event of EVENTS) {
    assert.ok(event.actions.length >= 2 && event.actions.length <= 3, event.id)
    for (const action of event.actions) {
      for (const condition of ['stable', 'degraded'] as const) {
        const chance = successChance(action, condition)
        assert.ok(chance > 0 && chance < 1, `${event.id}/${action.id}/${condition}`)
      }
    }
  }
})

test('event draw is uniform over the catalog when random values span [0, 1)', () => {
  const observed = new Set<string>()
  for (let index = 0; index < EVENTS.length; index++) {
    const value = (index + 0.5) / EVENTS.length
    observed.add(createGame(constant(value), 42).currentEvent.eventId)
  }
  assert.equal(observed.size, EVENTS.length)
})

test('action success chance changes with the hidden zone condition', () => {
  const stableState = createGame(constant(0), 1)
  const degradedState = createGame(constant(0.99), 2)
  assert.equal(stableState.currentEvent.eventId, 'bulkhead')
  assert.equal(degradedState.currentEvent.eventId, 'lift')
  const stableSensitive = successChance(EVENTS[0]!.actions[0]!, 'stable')
  const degradedSensitive = successChance(EVENTS[0]!.actions[0]!, 'degraded')
  assert.ok(Math.abs(stableSensitive - 0.78) < 1e-12)
  assert.ok(Math.abs(degradedSensitive - 0.36) < 1e-12)
  assert.notEqual(stableSensitive, degradedSensitive)

  const bulkheadManual = EVENTS[0]!.actions[1]!
  assert.ok(successChance(bulkheadManual, 'degraded') > successChance(bulkheadManual, 'stable'))
})

test('facility condition and observation sampling have a stable statistical link without certainty', () => {
  const counts = {
    stable: { steady: 0, flicker: 0, drop: 0, total: 0 },
    degraded: { steady: 0, flicker: 0, drop: 0, total: 0 },
  }
  for (let seed = 1; seed <= 12_000; seed++) {
    const state = createGame(createSeededRandom(seed), seed)
    const condition = state.facilityConditions[0]!
    counts[condition][state.currentEvent.observation]++
    counts[condition].total++
  }
  for (const condition of ['stable', 'degraded'] as const) {
    for (const observation of ['steady', 'flicker', 'drop'] as const) {
      const rate = counts[condition][observation] / counts[condition].total
      const expected = OBSERVATION_LIKELIHOOD[condition][observation]
      assert.ok(Math.abs(rate - expected) < 0.035, `${condition}/${observation}: ${rate} vs ${expected}`)
      assert.ok(rate > 0.04, `${condition}/${observation} must remain possible`)
    }
  }
  assert.ok(counts.stable.total > 5_000 && counts.degraded.total > 5_000)
})

test('current and past observations update a repeatable estimate exposed only as an integer percent', () => {
  const state = createGame(constant(0), 2)
  const posterior = inferStableProbability(state, 1)
  assert.ok(Math.abs(posterior - (0.62 / (0.62 + 0.15))) < 1e-10)
  const estimate = estimateSuccessProbability(state, 0)
  assert.ok(estimate > 0 && estimate < 1)
  assert.equal(successProbabilityPercent(state, 0), Math.round(estimate * 100))
  const view = toGameView(state)
  assert.equal(view.currentEvent.id, state.currentEvent.eventId)
  assert.ok(view.currentEvent.actions.every(action => Number.isInteger(action.successProbabilityPercent)))
  assert.equal('facilityConditions' in view, false)
  assert.equal(JSON.stringify(view).includes('stable'), false)
  assert.equal(JSON.stringify(view).includes('degraded'), false)
  assert.equal(JSON.stringify(view).includes('baseChance'), false)
  assert.equal(JSON.stringify(view).includes('successChance'), false)

  let withHistory = resolveAction(state, 0, 0, constant(0))
  withHistory = continueAfterResult(withHistory)
  withHistory = resolveAction(withHistory, 0, 0, constant(0))
  assert.equal(withHistory.history.length, 2)
  assert.notEqual(inferStableProbability(withHistory, 1), posterior)
})

test('success and failure outcomes do not inform facility-state estimates after slot judging', () => {
  const state = createGame(constant(0), 12)
  const result = resolveAction(state, 0, 0, constant(0))
  const entry = result.history[0]!
  const oppositeResult = {
    ...result,
    history: [{ ...entry, success: !entry.success }, ...result.history.slice(1)],
  }
  assert.equal(inferStableProbability(result, 1), inferStableProbability(oppositeResult, 1))
})

test('the displayed integer percent is the exact strict slot threshold', () => {
  const candidate = (() => {
    for (const event of EVENTS) {
      for (const observation of ['steady', 'flicker', 'drop'] as const) {
        const base = fixtureAt(1, 20)
        const state = { ...base, currentEvent: { ...base.currentEvent, eventId: event.id, observation } }
        for (let index = 0; index < event.actions.length; index++) {
          if (successProbabilityPercent(state, index) === 65) return { state, index }
        }
      }
    }
    throw new Error('No 65% fixture found')
  })()
  assert.equal(successProbabilityPercent(candidate.state, candidate.index), 65)
  assert.equal(resolveAction(candidate.state, candidate.index, 64, constant(0)).history[0]!.success, true)
  assert.equal(resolveAction(candidate.state, candidate.index, 65, constant(0)).history[0]!.success, false)
  assert.equal(resolveAction(candidate.state, candidate.index, 0, constant(0)).history[0]!.success, true)
  assert.equal(resolveAction(candidate.state, candidate.index, 99, constant(0)).history[0]!.success, false)
})

test('slot animation draws do not change the seeded next-event sequence', () => {
  const seed = 987654
  const firstRandom = createSeededRandom(seed)
  const secondRandom = createSeededRandom(seed)
  const first = createGame(firstRandom, seed)
  const second = createGame(secondRandom, seed)
  const slotAnimationRandom = createSeededRandom(seed ^ 0x12345678)
  for (let tick = 0; tick < 10_000; tick++) slotAnimationRandom()
  const withLongAnimation = resolveAction(first, 0, 42, firstRandom)
  const withShortAnimation = resolveAction(second, 0, 42, secondRandom)
  assert.deepEqual(toGameView(continueAfterResult(withLongAnimation)), toGameView(continueAfterResult(withShortAnimation)))
  assert.equal(withLongAnimation.history[0]!.success, withShortAnimation.history[0]!.success)
})

test('zone assignment changes every five tiles and internal zone states stay fixed', () => {
  assert.deepEqual([1, 5, 6, 10, 11, 15].map(zoneForTile), [1, 1, 2, 2, 3, 3])
  const random = constant(0)
  let state = createGame(random, 1)
  const initialConditions = [...state.facilityConditions]
  for (let i = 0; i < 5; i++) state = continueAfterResult(resolveAction(state, 0, 0, random))
  assert.equal(state.position, 6)
  assert.equal(state.currentEvent.zone, 2)
  assert.deepEqual(state.facilityConditions, initialConditions)
})

test('success, failure, logged power deltas, cap, and floor are applied correctly', () => {
  const starting = createGame(constant(0), 9)
  const success = resolveAction(starting, 0, 0, constant(0))
  assert.equal(success.history[0]!.success, true)
  assert.equal(success.history[0]!.powerBefore, 20)
  assert.equal(success.history[0]!.powerAfter, 19)
  assert.equal(success.history[0]!.powerChange, -1)
  assert.equal(success.position, 1)
  assert.ok(success.pendingNextEvent)
  assert.equal(success.currentEvent.eventId, starting.currentEvent.eventId)
  assert.equal(resolveAction(success, 0, 0, constant(0)), success, 'a held success cannot resolve another action')
  const continued = continueAfterResult(success)
  assert.equal(continued.position, 2)
  assert.equal(continued.currentEvent.tile, 2)
  assert.equal(continued.pendingNextEvent, null)

  const failure = resolveAction(starting, 0, 99, constant(0.99999))
  assert.equal(failure.history[0]!.success, false)
  assert.equal(failure.history[0]!.powerAfter, 15)
  assert.equal(failure.history[0]!.powerChange, -5)
  assert.equal(failure.position, 1)
  assert.equal(failure.currentEvent.eventId, starting.currentEvent.eventId)
  assert.ok(failure.pendingNextEvent)
  assert.equal(resolveAction(failure, 0, 0, constant(0)), failure, 'a held failure cannot resolve another action')
  const continuedFailure = continueAfterResult(failure)
  assert.equal(continuedFailure.position, 2)
  assert.equal(continuedFailure.currentEvent.tile, 2)
  assert.equal(continuedFailure.pendingNextEvent, null)
  assert.equal(continueAfterResult(continuedFailure), continuedFailure, 'a duplicate continuation cannot advance another tile')

  assert.equal(adjustedPower(19, 8), 20)
  assert.equal(adjustedPower(2, -8), 0)
  assert.equal(displayedPowerDelta(19, 8), 1)
  assert.equal(displayedPowerDelta(2, -8), -2)
  const cappedSuccess = resolveAction({ ...starting, power: 19 }, 0, 0, constant(0))
  assert.ok(cappedSuccess.power <= MAX_POWER)

  let draws = 0
  const countedRandom = () => { draws++; return 0 }
  const countedStart = createGame(countedRandom, 11)
  const heldSuccess = resolveAction(countedStart, 0, 0, countedRandom)
  const drawsAtResolution = draws
  assert.ok(heldSuccess.pendingNextEvent)
  continueAfterResult(heldSuccess)
  assert.equal(draws, drawsAtResolution, 'continuing applies the next event without consuming more randomness')
  const heldFailure = resolveAction(countedStart, 0, 99, countedRandom)
  const drawsAtFailureResolution = draws
  assert.ok(heldFailure.pendingNextEvent)
  assert.equal(heldFailure.position, countedStart.position)
  continueAfterResult(heldFailure)
  assert.equal(draws, drawsAtFailureResolution, 'failure continuation also uses its pre-drawn event without more randomness')
})

test('power reaching zero is a game over and prevents further choices', () => {
  const state = fixtureAt(4, 1)
  const failed = resolveAction(state, 0, 99, constant(0.99999))
  assert.equal(failed.power, 0)
  assert.equal(failed.status, 'lost')
  assert.equal(failed.position, 4)
  assert.equal(resolveAction(failed, 1, 0, constant(0)), failed)
})

test('reaching tile 15 with power succeeds, while zero power there is still a loss', () => {
  const finalSuccess = resolveAction(fixtureAt(15, 10), 0, 0, constant(0))
  assert.equal(finalSuccess.status, 'won')
  assert.equal(finalSuccess.position, 15)
  assert.ok(finalSuccess.power > 0)
  assert.equal(resolveAction(finalSuccess, 0, 99, constant(0)), finalSuccess)

  const finalFailure = resolveAction(fixtureAt(15, 4), 0, 99, constant(0.99999))
  assert.equal(finalFailure.status, 'lost')
  assert.equal(finalFailure.power, 0)

  const finalFailureWithPower = resolveAction(fixtureAt(15, 10), 0, 99, constant(0.99999))
  assert.equal(finalFailureWithPower.history[0]!.success, false)
  assert.equal(finalFailureWithPower.status, 'won', 'a failed final action still clears when power remains')
  assert.ok(finalFailureWithPower.power > 0)
  assert.equal(finalFailureWithPower.pendingNextEvent, null, 'terminal clear does not enter the continuation wait')
})

test('restart from the same seed reconstructs a clean initial run', () => {
  const first = createGame(createSeededRandom(314159), 314159)
  let finished = first
  const random = createSeededRandom(314159)
  const slotRandom = createSeededRandom(271828)
  for (let index = 0; index < 15 && finished.status === 'playing'; index++) {
    finished = resolveAction(finished, 0, Math.floor(slotRandom() * 100), random)
    if (finished.pendingNextEvent) finished = continueAfterResult(finished)
  }
  const restarted = createGame(createSeededRandom(314159), 314159)
  assert.deepEqual(toGameView(restarted), toGameView(first))
  assert.equal(restarted.position, 1)
  assert.equal(restarted.power, 20)
  assert.equal(restarted.history.length, 0)
})

test('invalid action indexes are ignored and invalid slot values are rejected', () => {
  const state = createGame(constant(0.2), 4)
  assert.equal(resolveAction(state, 5, 0), state)
  for (const invalid of [-1, 100, 0.5, Number.NaN]) {
    assert.throws(() => resolveAction(state, 0, invalid), RangeError)
  }
})
