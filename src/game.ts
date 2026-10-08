import type { Language } from './i18n.ts'
import { scenes, terminalConsequences } from './scenario.ts'
import type { ChallengeEffect, Choice, Condition, Effect, GameState, Preparations } from './model.ts'
export type { GameState } from './model.ts'

export const initialPreparations = (): Preparations => ({
  robot: { signal: 'none', stance: 'upright' },
  seal: { lock: 'open', patch: 'none', pressure: 'unequal' },
  power: { source: 'none', drive: 'none' },
  launch: { pressure: 'open', supply: 'external', ignition: 'cold' },
})
export function matches(state: GameState, condition: Condition = {}): boolean {
  return (!condition.knowledge || condition.knowledge.every(id => state.knowledge.includes(id)))
    && (!condition.items || condition.items.every(id => state.items.includes(id)))
    && (!condition.uncollected || condition.uncollected.every(id => !state.collected.includes(id)))
    && (!condition.body || condition.body === state.body)
    && (condition.oxygenMin === undefined || state.oxygen >= condition.oxygenMin)
    && (condition.threatMin === undefined || state.threat >= condition.threatMin)
    && (condition.challenges ?? []).every(condition => {
      const challenge = state.challenges[condition.id]
      return (!condition.outcomes || condition.outcomes.includes(challenge.outcome))
        && (!condition.observed || challenge.observations.includes(condition.observed))
        && (condition.attemptsMin === undefined || challenge.attempts >= condition.attemptsMin)
        && Object.entries(condition.preparation ?? {}).every(([key, value]) => Reflect.get(challenge.preparation, key) === value)
    })
}
export function narrative(state: GameState, language: Language): string[] {
  const scene = scenes[state.scene]
  return [scene.title[language], ...scene.narrative.map(line => line[language]),
    ...(scene.additions ?? []).filter(addition => matches(state, addition.when)).map(addition => addition.text[language])]
}
export const availableChoices = (state: GameState): Choice[] => state.status !== 'playing' ? [] : scenes[state.scene].choices.filter(choice => matches(state, choice.when))

function applyChallenge<K extends keyof Preparations>(state: GameState, effect: Extract<ChallengeEffect, { id: K }>) {
  const challenge = state.challenges[effect.id]
  if (effect.reset) Object.assign(challenge.preparation, initialPreparations()[effect.id])
  Object.assign(challenge.preparation, effect.preparation)
  if (effect.observe && !challenge.observations.includes(effect.observe)) challenge.observations.push(effect.observe)
  // Repeated attempts cost more air; preparation and reading do not count as attempts.
  if (effect.attempt) { state.oxygen += Math.floor(challenge.attempts / 2); challenge.attempts++ }
  if (effect.outcome) challenge.outcome = effect.outcome
}
export class Game {
  state!: GameState
  restart() {
    const preparations = initialPreparations()
    this.state = { scene: 'wake', body: 'normal', oxygen: 0, threat: 0, knowledge: [], items: [], collected: [], status: 'playing', challenges: {
      robot: { preparation: preparations.robot, observations: [], attempts: 0, outcome: 'untried' },
      seal: { preparation: preparations.seal, observations: [], attempts: 0, outcome: 'untried' },
      power: { preparation: preparations.power, observations: [], attempts: 0, outcome: 'untried' },
      launch: { preparation: preparations.launch, observations: [], attempts: 0, outcome: 'untried' },
    } }
  }
  constructor() { this.restart() }
  choices() { return availableChoices(this.state) }
  choose(id: string): { before: GameState; after: GameState; choice: Choice; result: Choice['result'] } | null {
    const choice = this.choices().find(choice => choice.id === id)
    if (!choice) return null
    const before = structuredClone(this.state), next = structuredClone(this.state)
    const route = choice.routes?.find(route => matches(before, route.when))
    // A routed consequence replaces the fallback, including its costs.
    // This prevents failure injury/cost from leaking into a successful branch.
    const effect: Effect = route?.effect ?? choice.effect ?? {}
    if (effect.consume?.some(item => !before.items.includes(item))) return null
    next.scene = route?.next ?? choice.next
    next.threat = Math.min(4, Math.max(0, next.threat + (effect.threat ?? 0)))
    next.oxygen = effect.refill ? Math.max(0, next.oxygen - 7) : next.oxygen + (effect.oxygen ?? 0)
    const fatalInjury = effect.hurt && next.body === 'injured'
    if (effect.hurt) next.body = next.body === 'normal' ? 'bruised' : 'injured'
    next.items = [...new Set([...next.items.filter(item => !effect.consume?.includes(item)), ...(effect.gain ?? [])])]
    next.collected = [...new Set([...next.collected, ...(effect.gain ?? [])])]
    next.knowledge = [...new Set([...next.knowledge, ...(effect.learn ?? [])])]
    for (const change of effect.challenges ?? []) applyChallenge(next, change)
    // Accumulated exhaustion takes priority over a successful last action.
    let result = route?.result ?? choice.result
    if (next.oxygen >= 14) { next.scene = 'oxygen-over'; result = terminalConsequences.oxygen }
    else if (fatalInjury) { next.scene = 'injury-over'; result = terminalConsequences.injury }
    if (next.oxygen >= 14 || fatalInjury) {
      for (const change of effect.challenges ?? []) {
        if (change.attempt) next.challenges[change.id].outcome = 'failure'
      }
    }
    next.status = scenes[next.scene].ending ?? 'playing'
    this.state = next
    return { before, after: structuredClone(next), choice, result }
  }
}
