import type { Player } from './dungeon.ts'
export type Character = Player & Readonly<{ vision: number; hearing: number }>
export const character = (player: Player): Character => ({ ...player, vision: 5, hearing: 2 })
