import type { Player } from './dungeon.ts'

export type Character = Player & Readonly<{ vision: number; hearing: number }>

export function character(player: Player, vision = 6, hearing = 4): Character {
  return { ...player, vision, hearing }
}
