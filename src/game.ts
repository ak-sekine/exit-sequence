import type { Language } from './i18n.ts'
import { scenes } from './scenario.ts'
import type { Choice, Condition, Effect, GameState } from './model.ts'
export type { GameState } from './model.ts'
export function matches(state: GameState, condition: Condition = {}): boolean {
  return (!condition.knowledge || condition.knowledge.every(id => state.knowledge.includes(id)))
    && (!condition.items || condition.items.every(id => state.items.includes(id)))
    && (!condition.absentItems || condition.absentItems.every(id => !state.items.includes(id)))
    && (!condition.unused || !state.used.includes(condition.unused))
    && (!condition.body || condition.body === state.body)
    && (condition.oxygenMin === undefined || state.oxygen >= condition.oxygenMin)
    && (condition.oxygenMax === undefined || state.oxygen <= condition.oxygenMax)
    && (condition.threatMin === undefined || state.threat >= condition.threatMin)
    && (condition.threatMax === undefined || state.threat <= condition.threatMax)
}
export function narrative(state: GameState, language: Language): string[] {
  const scene = scenes[state.scene]
  return [scene.title[language], ...scene.narrative.map(line => line[language]),
    ...(scene.additions ?? []).filter(addition => matches(state, addition.when)).map(addition => addition.text[language])]
}
export const availableChoices = (state: GameState): Choice[] => state.status !== 'playing' ? [] : scenes[state.scene].choices.filter(choice => matches(state, choice.when))
const level = (value: number): 0 | 1 | 2 => Math.min(2, Math.max(0, value)) as 0 | 1 | 2
export class Game {
  state!: GameState
  restart() { this.state = { scene: 'wake', body: 'normal', oxygen: 0, threat: 0, knowledge: [], items: [], used: [], status: 'playing' } }
  constructor() { this.restart() }
  choices() { return availableChoices(this.state) }
  choose(id: string): { before: GameState; after: GameState; choice: Choice; result: Choice['result'] } | null {
    const choice = this.choices().find(choice => choice.id === id)
    if (!choice) return null
    const before = structuredClone(this.state), next = structuredClone(this.state)
    const route = choice.routes?.find(route => matches(before, route.when))
    const effect: Effect = { ...choice.effect, ...route?.effect }
    // Guard consumption separately even if a malformed scenario omits an item condition.
    if (effect.consume?.some(item => !before.items.includes(item))) return null
    next.scene = route?.next ?? choice.next
    next.body = effect.body ?? next.body
    next.threat = level(next.threat + (effect.threat ?? 0))
    const oxygen = effect.refill ? 0 : next.oxygen + (effect.oxygen ?? 0)
    next.oxygen = level(oxygen)
    next.items = [...new Set([...next.items.filter(item => !effect.consume?.includes(item)), ...(effect.gain ?? [])])]
    next.knowledge = [...new Set([...next.knowledge, ...(effect.learn ?? [])])]
    if (effect.once) next.used.push(effect.once)
    // Resource exhaustion has priority over completion and encounter escapes.
    if (oxygen > 2) next.scene = 'oxygen-over'
    next.status = scenes[next.scene].ending ?? 'playing'
    this.state = next
    return { before, after: structuredClone(next), choice, result: route?.result ?? choice.result }
  }
}
