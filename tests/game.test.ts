import test from 'node:test'
import assert from 'node:assert/strict'
import { EVENTS } from '../src/events.ts'
import {
  INITIAL_POWER, MAX_POWER, TOTAL_TILES, adjustedPower, createGame, createSeededRandom,
  continueAfterResult, displayedPowerDelta, resolveAction, successProbabilityPercent, toGameView, zoneForTile,
} from '../src/game.ts'
import type { GameState, RandomSource } from '../src/game.ts'

const constant = (value: number): RandomSource => () => value
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
