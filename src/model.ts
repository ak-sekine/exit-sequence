import type { Text } from './i18n.ts'
import type { ItemId } from './items.ts'
export type KnowledgeId = 'light-response' | 'arm-traces' | 'independent-power' | 'launch-order'
export type SceneId = 'wake' | 'kit' | 'door' | 'records' | 'playback' | 'service' | 'workbench' | 'seal' | 'marks' | 'relay' | 'encounter' | 'refuge' | 'airlock' | 'ship' | 'checklist' | 'clear' | 'robot-over' | 'oxygen-over'
export interface GameState {
  scene: SceneId
  body: 'normal' | 'injured'
  oxygen: 0 | 1 | 2
  threat: 0 | 1 | 2
  knowledge: KnowledgeId[]
  items: ItemId[]
  used: string[]
  status: 'playing' | 'clear' | 'over'
}
export interface Condition {
  knowledge?: KnowledgeId[]
  items?: ItemId[]
  absentItems?: ItemId[]
  unused?: string
  body?: GameState['body']
  oxygenMin?: number
  oxygenMax?: number
  threatMin?: number
  threatMax?: number
}
export interface Effect {
  oxygen?: number
  refill?: boolean
  threat?: number
  body?: GameState['body']
  learn?: KnowledgeId[]
  gain?: ItemId[]
  consume?: ItemId[]
  once?: string
}
export interface Choice {
  id: string
  label: Text
  when?: Condition
  effect?: Effect
  result: Text
  next: SceneId
  // Deterministic overrides examine the state before applying effects.
  routes?: { when: Condition; next: SceneId; result?: Text; effect?: Effect }[]
}
export interface Scene {
  id: SceneId
  title: Text
  narrative: Text[]
  additions?: { when: Condition; text: Text }[]
  choices: Choice[]
  ending?: 'clear' | 'over'
}
