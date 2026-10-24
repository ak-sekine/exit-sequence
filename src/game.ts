import { EVENTS, OBSERVATION_LIKELIHOOD, eventById, successChance } from './events.ts'
import type { ActionDefinition, EventDefinition, FacilityCondition, Observation } from './events.ts'

export const TOTAL_TILES = 15
export const TILES_PER_ZONE = 5
export const ZONE_COUNT = 3
export const INITIAL_POWER = 20
export const MAX_POWER = 20

export type GameStatus = 'playing' | 'won' | 'lost'
export type RandomSource = () => number

export interface EventEncounter {
  tile: number
  zone: number
  eventId: string
  observation: Observation
}

export interface HistoryEntry {
  tile: number
  zone: number
  eventId: string
  actionId: string
  observation: Observation
  success: boolean
  powerBefore: number
  powerAfter: number
  powerChange: number
}

export interface GameState {
  readonly seed: number
  readonly position: number
  readonly power: number
  readonly status: GameStatus
  readonly facilityConditions: readonly FacilityCondition[]
  readonly currentEvent: EventEncounter
  readonly history: readonly HistoryEntry[]
  readonly lastResult: HistoryEntry | null
  readonly pendingNextEvent: EventEncounter | null
}

export interface ActionView {
  id: string
  label: string
  detail: string
  successProbabilityPercent: number
  successDelta: number
  failureDelta: number
}

export interface EventView {
  id: string
  tile: number
  zone: number
  title: string
  description: string
  observationText: string
  actions: ActionView[]
}

export interface HistoryView {
  tile: number
  zone: number
  title: string
  actionLabel: string
  observationText: string
  success: boolean
  powerBefore: number
  powerAfter: number
  powerChange: number
}

export interface GameView {
  position: number
  power: number
  status: GameStatus
  currentEvent: EventView
  history: HistoryView[]
  lastResult: HistoryView | null
}

function draw(random: RandomSource): number {
  const value = random()
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError('RandomSource must return a number in [0, 1)')
  }
  return value
}

export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000
  }
}

export function randomSeed(random: RandomSource = Math.random): number {
  return Math.floor(draw(random) * 0x1_0000_0000) >>> 0
}

function sampleObservation(condition: FacilityCondition, random: RandomSource): Observation {
  const roll = draw(random)
  const likelihood = OBSERVATION_LIKELIHOOD[condition]
  if (roll < likelihood.steady) return 'steady'
  if (roll < likelihood.steady + likelihood.flicker) return 'flicker'
  return 'drop'
}

function createEncounter(tile: number, random: RandomSource): EventEncounter {
  const event = EVENTS[Math.floor(draw(random) * EVENTS.length)]!
  const zone = Math.floor((tile - 1) / TILES_PER_ZONE) + 1
  return { tile, zone, eventId: event.id, observation: 'steady' }
}

function withObservation(encounter: EventEncounter, conditions: readonly FacilityCondition[], random: RandomSource): EventEncounter {
  const condition = conditions[encounter.zone - 1]!
  return { ...encounter, observation: sampleObservation(condition, random) }
}

export function createGame(random: RandomSource = Math.random, seed = 0): GameState {
  const facilityConditions = Array.from({ length: ZONE_COUNT }, () => draw(random) < 0.5 ? 'stable' : 'degraded')
  const encounter = withObservation(createEncounter(1, random), facilityConditions, random)
  return {
    seed: seed >>> 0,
    position: 1,
    power: INITIAL_POWER,
    status: 'playing',
    facilityConditions,
    currentEvent: encounter,
    history: [],
    lastResult: null,
    pendingNextEvent: null,
  }
}

function clampPower(power: number): number {
  return Math.max(0, Math.min(MAX_POWER, power))
}

export function adjustedPower(power: number, delta: number): number {
  return clampPower(power + delta)
}

export function displayedPowerDelta(power: number, delta: number): number {
  return adjustedPower(power, delta) - power
}

export function successProbabilityPercent(state: GameState, actionIndex: number): number {
  return Math.round(estimateSuccessProbability(state, actionIndex) * 100)
}

export function resolveAction(
  state: GameState,
  actionIndex: number,
  rollValue: number,
  random: RandomSource = Math.random,
): GameState {
  if (state.status !== 'playing' || state.pendingNextEvent) return state
  const event = eventById(state.currentEvent.eventId)
  const action = event.actions[actionIndex]
  if (!action) return state
  if (!Number.isInteger(rollValue) || rollValue < 0 || rollValue > 99) {
    throw new RangeError('Slot roll must be an integer in [0, 99]')
  }

  const success = rollValue < successProbabilityPercent(state, actionIndex)
  const powerBefore = state.power
  const powerAfter = adjustedPower(powerBefore, success ? action.successDelta : action.failureDelta)
  const entry: HistoryEntry = {
    tile: state.currentEvent.tile,
    zone: state.currentEvent.zone,
    eventId: event.id,
    actionId: action.id,
    observation: state.currentEvent.observation,
    success,
    powerBefore,
    powerAfter,
    powerChange: powerAfter - powerBefore,
  }
  const history = [...state.history, entry]
  const lastResult = entry

  if (powerAfter === 0) {
    return { ...state, power: 0, status: 'lost', history, lastResult }
  }
  if (state.position === TOTAL_TILES) {
    return { ...state, power: powerAfter, status: 'won', history, lastResult }
  }

  const nextPosition = state.position + 1
  const nextEncounter = withObservation(createEncounter(nextPosition, random), state.facilityConditions, random)
  if (success) {
    return {
      ...state,
      power: powerAfter,
      history,
      lastResult,
      pendingNextEvent: nextEncounter,
    }
  }
  return {
    ...state,
    position: nextPosition,
    power: powerAfter,
    currentEvent: nextEncounter,
    history,
    lastResult,
    pendingNextEvent: null,
  }
}

export function continueAfterSuccess(state: GameState): GameState {
  if (state.status !== 'playing' || !state.pendingNextEvent) return state
  const nextEvent = state.pendingNextEvent
  return {
    ...state,
    position: nextEvent.tile,
    currentEvent: nextEvent,
    pendingNextEvent: null,
  }
}

function actionById(event: EventDefinition, actionId: string): ActionDefinition {
  const action = event.actions.find(candidate => candidate.id === actionId)
  if (!action) throw new Error(`Unknown action ${actionId} for event ${event.id}`)
  return action
}

export function inferStableProbability(state: GameState, zone: number): number {
  let stableLikelihood = 0.5
  let degradedLikelihood = 0.5

  const applyObservation = (observation: Observation) => {
    stableLikelihood *= OBSERVATION_LIKELIHOOD.stable[observation]
    degradedLikelihood *= OBSERVATION_LIKELIHOOD.degraded[observation]
  }
  for (const entry of state.history) {
    if (entry.zone !== zone) continue
    applyObservation(entry.observation)
  }
  if (state.status === 'playing' && !state.pendingNextEvent && state.currentEvent.zone === zone) {
    applyObservation(state.currentEvent.observation)
  }

  const total = stableLikelihood + degradedLikelihood
  return total === 0 ? 0.5 : stableLikelihood / total
}

export function estimateSuccessProbability(state: GameState, actionIndex: number): number {
  const event = eventById(state.currentEvent.eventId)
  const action = event.actions[actionIndex]
  if (!action) throw new RangeError(`No action at index ${actionIndex}`)
  const stableProbability = inferStableProbability(state, state.currentEvent.zone)
  return stableProbability * successChance(action, 'stable')
    + (1 - stableProbability) * successChance(action, 'degraded')
}

function historyView(entry: HistoryEntry): HistoryView {
  const event = eventById(entry.eventId)
  const action = actionById(event, entry.actionId)
  return {
    tile: entry.tile,
    zone: entry.zone,
    title: event.title,
    actionLabel: action.label,
    observationText: event.clues[entry.observation],
    success: entry.success,
    powerBefore: entry.powerBefore,
    powerAfter: entry.powerAfter,
    powerChange: entry.powerChange,
  }
}

export function toGameView(state: GameState): GameView {
  const definition = eventById(state.currentEvent.eventId)
  return {
    position: state.position,
    power: state.power,
    status: state.status,
    currentEvent: {
      id: definition.id,
      tile: state.currentEvent.tile,
      zone: state.currentEvent.zone,
      title: definition.title,
      description: definition.description,
      observationText: definition.clues[state.currentEvent.observation],
      actions: definition.actions.map((action, index) => ({
        id: action.id,
        label: action.label,
        detail: action.detail,
        successProbabilityPercent: successProbabilityPercent(state, index),
        successDelta: action.successDelta,
        failureDelta: action.failureDelta,
      })),
    },
    history: state.history.map(historyView),
    lastResult: state.lastResult ? historyView(state.lastResult) : null,
  }
}

export function zoneForTile(tile: number): number {
  if (!Number.isInteger(tile) || tile < 1 || tile > TOTAL_TILES) throw new RangeError(`Invalid tile: ${tile}`)
  return Math.floor((tile - 1) / TILES_PER_ZONE) + 1
}
