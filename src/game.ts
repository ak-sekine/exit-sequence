import type { Language } from './i18n.ts';
import { scenes, clues } from './scenario.ts';
import type { Choice, GameState, HintLevel } from './model.ts';
export type { GameState } from './model.ts';
export function narrative(state: GameState, language: Language): string[] {
    const scene = scenes[state.scene];
    return [scene.title[language], ...scene.narrative.map(line => line[language])];
}
export const availableChoices = (state: GameState): Choice[] => state.status === 'playing' ? scenes[state.scene].choices.filter(c => !c.effect?.hint || state.problems[c.effect.problem].hintLevel < 3) : [];
export class Game {
    state!: GameState;
    constructor() { this.restart(); }
    restart() {
        this.state = { scene: 'wake', status: 'playing', problems: {
                door: { observation: 0, hintLevel: 0, resolution: 'unresolved' },
                valve: { observation: 0, hintLevel: 0, resolution: 'unresolved' },
                power: { observation: 0, hintLevel: 0, resolution: 'unresolved' },
            } };
    }
    choices() { return availableChoices(this.state); }
    choose(id: string) {
        const choice = this.choices().find(c => c.id === id);
        if (!choice)
            return null;
        const before = structuredClone(this.state), next = structuredClone(before);
        next.scene = choice.next;
        let result = choice.result;
        if (choice.effect) {
            const effect = choice.effect, problem = next.problems[effect.problem];
            if (effect.observation !== undefined)
                problem.observation = Math.max(problem.observation, effect.observation) as typeof problem.observation;
            if (effect.resolution)
                problem.resolution = effect.resolution;
            if (effect.hint) {
                result = clues[effect.problem].hints[problem.hintLevel as 0 | 1 | 2];
                // An explicit explanation includes the actual inspection, even when requested early.
                if (problem.hintLevel >= 1 && problem.observation < 2) {
                    const c = clues[effect.problem];
                    result = { ja: c.inspect.ja + '\n\n' + c.deeper.ja + '\n\n' + result.ja, en: c.inspect.en + '\n\n' + c.deeper.en + '\n\n' + result.en };
                    problem.observation = 2;
                    next.scene = `${effect.problem}-cause`;
                }
                problem.hintLevel = (problem.hintLevel + 1) as HintLevel;
            }
        }
        next.status = scenes[next.scene].ending ?? 'playing';
        this.state = next;
        return { before, after: structuredClone(next), choice, result };
    }
}
