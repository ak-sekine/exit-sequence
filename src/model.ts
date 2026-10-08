import type { Text } from './i18n.ts'
import type { ItemId } from './items.ts'

export type KnowledgeId = 'light-response' | 'arm-cycle' | 'pressure-link' | 'independent-power' | 'launch-interlock'
export type ObservationId = 'robot-motion' | 'white-test' | 'seal-gauge' | 'power-label' | 'launch-plate'
export type Outcome = 'untried' | 'clean' | 'costly' | 'retreat' | 'failure'
export interface Preparations {
  robot: { signal: 'none' | 'light' | 'decoy'; stance: 'upright' | 'low' | 'quiet' }
  seal: { lock: 'open' | 'held'; patch: 'none' | 'tools' | 'oxygen'; pressure: 'unequal' | 'equal' }
  power: { source: 'none' | 'blue' | 'main'; drive: 'none' | 'tools' | 'decoy' | 'hand' }
  launch: { pressure: 'open' | 'locked' | 'equal'; supply: 'external' | 'internal'; ignition: 'cold' | 'armed' }
}
export type ChallengeId = keyof Preparations
export type Challenges = { [K in ChallengeId]: {
  preparation: Preparations[K]; observations: ObservationId[]; attempts: number; outcome: Outcome
} }
export type ChallengeCondition = { [K in ChallengeId]: {
  id: K; preparation?: Partial<Preparations[K]>; observed?: ObservationId
  outcomes?: Outcome[]; attemptsMin?: number
} }[ChallengeId]
export type ChallengeEffect = { [K in ChallengeId]: {
  id: K; preparation?: Partial<Preparations[K]>; observe?: ObservationId
  reset?: boolean; attempt?: boolean; outcome?: Outcome
} }[ChallengeId]
export type SceneId = 'wake' | 'supplies' | 'records' | 'refuge'
  | 'robot' | 'robot-watch' | 'robot-prep' | 'robot-stance' | 'robot-act' | 'robot-result'
  | 'seal' | 'seal-watch' | 'seal-prep' | 'seal-act' | 'seal-result'
  | 'power' | 'power-watch' | 'power-prep' | 'power-drive' | 'power-act' | 'power-result'
  | 'ship' | 'ship-read' | 'ship-check' | 'ship-pressure' | 'ship-electric' | 'ship-result'
  | 'clear' | 'oxygen-over' | 'injury-over' | 'launch-over'
export interface GameState {
  scene: SceneId
  body: 'normal' | 'bruised' | 'injured'
  /** Cumulative air expenditure, deliberately absent from the UI. */
  oxygen: number
  threat: number
  knowledge: KnowledgeId[]
  items: ItemId[]
  collected: ItemId[]
  challenges: Challenges
  status: 'playing' | 'clear' | 'over'
}
export interface Condition {
  knowledge?: KnowledgeId[]
  items?: ItemId[]
  uncollected?: ItemId[]
  body?: GameState['body']
  oxygenMin?: number
  threatMin?: number
  challenges?: ChallengeCondition[]
}
export interface Effect {
  oxygen?: number
  refill?: boolean
  threat?: number
  hurt?: boolean
  learn?: KnowledgeId[]
  gain?: ItemId[]
  consume?: ItemId[]
  challenges?: ChallengeEffect[]
}
export interface Choice {
  id: string
  label: Text
  when?: Condition
  effect?: Effect
  result: Text
  next: SceneId
  /** Ordered, deterministic alternatives examine the state before the action. */
  routes?: { when: Condition; next: SceneId; result?: Text; effect?: Effect }[]
}
export interface Scene {
  id: SceneId
  title: Text
  narrative: Text[]
  additions?: { when: Condition; text: Text }[]
  choices: Choice[]
  challenge?: ChallengeId
  ending?: 'clear' | 'over'
}
