import type { EntityKind, Level, Terrain } from './model.ts'

// Parse authoring notation once. Runtime state separates terrain from entities.
export function defineLevel(rows: readonly string[]): Level {
  if (!rows.length || rows.some(row => row.length !== rows[0]!.length)) throw new Error('Level must be rectangular')
  const entities: Level['entities'] = []
  const terrain = rows.map((row, y) => Array.from(row, (symbol, x): Terrain => {
    const kind: EntityKind | undefined = symbol === '@' ? 'player' : symbol === 'R' ? 'robot' : symbol === 'B' ? 'box' : undefined
    if (kind) entities.push({ id: `${kind}-${entities.length}`, kind, x, y })
    if (symbol === '#') return 'wall'
    if (symbol === 'O') return 'hole'
    if (symbol === 'G') return 'goal'
    if (kind || symbol === '.' || symbol === ' ') return 'floor'
    throw new Error(`Unknown level symbol: ${symbol}`)
  }))
  if (entities.filter(e => e.kind === 'player').length !== 1 || entities.filter(e => e.kind === 'robot').length > 1 || terrain.flat().filter(t => t === 'goal').length !== 1) throw new Error('Level needs one player, one goal, at most one robot')
  return { terrain, entities }
}

export const levels: readonly Level[] = [
  defineLevel([
    '########',
    '#......#',
    '#.@BB.O#',
    '#..#...#',
    '#......#',
    '#.O..G.#',
    '#......#',
    '########',
  ]),
  defineLevel([
    '########',
    '#......#',
    '#.@B...#',
    '#..R.O.#',
    '#..#...#',
    '#O...G.#',
    '#......#',
    '########',
  ]),
  defineLevel([
    '########',
    '#......#',
    '#..B@..#',
    '#....O.#',
    '#.RB.G.#',
    '#O.....#',
    '#......#',
    '########',
  ]),
]
