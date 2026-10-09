import type { Text } from './i18n.ts'
export type Stat = 'BODY' | 'TECH' | 'SENSE'
export type SceneId = 'wake' | 'create' | 'explore' | 'event' | 'combat' | 'victory' | 'levelup' | 'warehouse' | 'launch' | 'clear' | 'over'
export type EnemyId = 'maintenance' | 'security' | 'boss'
export type Intent = 'arm' | 'heavy' | 'recover' | 'armor' | 'scan' | 'burst'
export type Tool = 'wrench' | 'terminal' | 'visor'
export type Item = 'kit' | 'battery'
export interface Enemy { id: EnemyId; hp: number; maxHp: number; turn: number; exposed: boolean; focused: boolean; lastTech: boolean }
export interface GameState {
 scene: SceneId; location: 0 | 1 | 2; level: number; hp: number; maxHp: number
 stats: Record<Stat, number>; points: number; equipment: { tool: Tool | null; vest: boolean }
 items: Record<Item, number>; enemy: Enemy | null; status: 'playing' | 'clear' | 'over'
 explored: boolean[]; optionalCombat: boolean; bonus: number; defeats: number; turns: number
}
export interface Choice { id: string; label: Text }
