import { createGame, createSeededRandom, estimateSuccessProbability, resolveAction } from '../src/game.ts'
import { eventById } from '../src/events.ts'

const RUNS = 12_000
const FIRST_SEED = 0x5eed0000

function clamp(value) {
  return Math.max(0, Math.min(20, value))
}

function expectedValue(state, event, action, chance) {
  const good = clamp(state.power + action.successDelta)
  const bad = clamp(state.power + action.failureDelta)
  return chance * good + (1 - chance) * bad
}

const policies = [
  {
    name: 'uniform random',
    choose(state, event, random) {
      return Math.floor(random() * event.actions.length)
    },
  },
  {
    name: 'always option 1',
    choose() { return 0 },
  },
  {
    name: 'least costly failure',
    choose(state, event) {
      return event.actions.reduce((best, action, index, actions) =>
        action.failureDelta > actions[best].failureDelta ? index : best, 0)
    },
  },
  {
    name: 'largest success gain',
    choose(state, event) {
      return event.actions.reduce((best, action, index, actions) =>
        action.successDelta > actions[best].successDelta ? index : best, 0)
    },
  },
  {
    name: 'clue based, survival weighted',
    choose(state, event) {
      let bestIndex = 0
      let bestScore = Number.NEGATIVE_INFINITY
      for (let index = 0; index < event.actions.length; index++) {
        const action = event.actions[index]
        const chance = estimateSuccessProbability(state, index)
        const expectedPower = expectedValue(state, event, action, chance)
        const survives = (state.power + action.successDelta > 0 ? chance : 0)
          + (state.power + action.failureDelta > 0 ? 1 - chance : 0)
        const score = expectedPower + 8 * survives
        if (score > bestScore) {
          bestIndex = index
          bestScore = score
        }
      }
      return bestIndex
    },
  },
]

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))]
}

function runPolicy(policy) {
  const finalPowers = []
  const clearPowers = []
  const finalPositions = []
  let clears = 0

  for (let index = 0; index < RUNS; index++) {
    const seed = (FIRST_SEED + index) >>> 0
    const gameRandom = createSeededRandom(seed)
    const policyRandom = createSeededRandom(seed ^ 0xA5A5_5A5A)
    let state = createGame(gameRandom, seed)
    while (state.status === 'playing') {
      const event = eventById(state.currentEvent.eventId)
      const actionIndex = policy.choose(state, event, policyRandom)
      state = resolveAction(state, actionIndex, gameRandom)
    }
    if (state.status === 'won') {
      clears++
      clearPowers.push(state.power)
    }
    finalPowers.push(state.power)
    finalPositions.push(state.position)
  }

  const powerDistribution = `P10/P50/P90 ${percentile(finalPowers, 0.10)}/${percentile(finalPowers, 0.50)}/${percentile(finalPowers, 0.90)}`
  const clearResidual = clearPowers.length
    ? `${(clearPowers.reduce((sum, power) => sum + power, 0) / clearPowers.length).toFixed(2)} (n=${clearPowers.length})`
    : 'n/a'
  const meanPosition = finalPositions.reduce((sum, position) => sum + position, 0) / RUNS
  return {
    policy: policy.name,
    clearRate: `${(100 * clears / RUNS).toFixed(1)}%`,
    meanPower: (finalPowers.reduce((sum, power) => sum + power, 0) / RUNS).toFixed(2),
    powerDistribution,
    clearResidual,
    meanStoppingTile: meanPosition.toFixed(2),
  }
}

console.log(`Exit Sequence balance sample: ${RUNS.toLocaleString()} runs/policy; seeds ${FIRST_SEED}–${FIRST_SEED + RUNS - 1}`)
console.table(policies.map(runPolicy))
