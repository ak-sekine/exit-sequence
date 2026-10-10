import { DUNGEON_MAP, INITIAL_PLAYER, move, passDoor } from '../src/dungeon.ts'
import type { DungeonMap, Door, Player, Direction } from '../src/dungeon.ts'
import { cellKey } from '../src/automap.ts'

export type Action = Direction | 'a'
const stateKey = (p: Player) => `${cellKey(p)},${p.facing}`
// Explore actual input transitions, including turns and A; adjacency alone is insufficient.
export function explore(map: DungeonMap = DUNGEON_MAP, start: Player = INITIAL_PLAYER, doors?: readonly Door[], useDoors = true) {
  const pending = [{ player: start, route: [] as Action[] }]
  const states = new Set([stateKey(start)])
  const routes = new Map<string, Action[]>([[cellKey(start), []]])
  for (let i = 0; i < pending.length; i++) {
    const { player, route } = pending[i]!
    for (const action of ['up', 'left', 'right', 'down', ...(useDoors ? ['a'] : [])] as Action[]) {
      const next = action === 'a' ? passDoor(map, player, doors)?.player : move(map, player, action, doors).player
      if (!next || states.has(stateKey(next))) continue
      states.add(stateKey(next))
      const nextRoute = [...route, action]
      pending.push({ player: next, route: nextRoute })
      if (!routes.has(cellKey(next))) routes.set(cellKey(next), nextRoute)
    }
  }
  return { states, routes }
}
