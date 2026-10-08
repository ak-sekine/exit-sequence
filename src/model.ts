import type { Text } from './i18n.ts';
export type ProblemId = 'door' | 'valve' | 'power';
export type Observation = 0 | 1 | 2;
export type HintLevel = 0 | 1 | 2 | 3;
export interface ProblemState {
    observation: Observation;
    hintLevel: HintLevel;
    resolution: 'unresolved' | 'changed' | 'resolved';
}
export type SceneId = 'wake' | 'door' | 'door-inspect' | 'door-cause' | 'door-result' | 'valve' | 'valve-inspect' | 'valve-cause' | 'valve-warm' | 'valve-result' | 'power' | 'power-inspect' | 'power-cause' | 'power-result' | 'clear';
export interface GameState {
    scene: SceneId;
    problems: Record<ProblemId, ProblemState>;
    status: 'playing' | 'clear';
}
export interface Effect {
    problem: ProblemId;
    observation?: Observation;
    hint?: true;
    resolution?: ProblemState['resolution'];
}
export interface Choice {
    id: string;
    label: Text;
    next: SceneId;
    result: Text;
    effect?: Effect;
}
export interface Scene {
    id: SceneId;
    title: Text;
    narrative: Text[];
    choices: Choice[];
    problem?: ProblemId;
    ending?: 'clear';
}
export interface Clues {
    initial: Text;
    inspect: Text;
    deeper: Text;
    hints: readonly [
        Text,
        Text,
        Text
    ];
}
