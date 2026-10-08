import type { Action } from '../src/game.ts'
// Reproducible normal patrol, with no changes to ENERGY, positions, inventory or passages.
export const escapeSeed = 26
export function seededRandom(seed: number) {
  let value = seed
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 2 ** 32 }
}
export const escapeRoute: Action[] = [
  { type: 'move', target: '医療' }, { type: 'collect', item: 'battery' }, { type: 'collect', item: 'local-key' },
  { type: 'move', target: '観測' }, { type: 'camera', fixed: true },
  { type: 'move', target: '中継' }, { type: 'collect', item: 'predictor' }, { type: 'use', item: 'predictor' },
  { type: 'move', target: '観測' }, { type: 'move', target: '医療' }, { type: 'move', target: '居住' },
  { type: 'move', target: '倉庫' }, { type: 'collect', item: 'food' },
  { type: 'move', target: '管制' }, { type: 'collect', item: 'key' }, { type: 'collect', item: 'long-decoy' },
  { type: 'move', target: '電力管理' }, { type: 'collect', item: 'map' },
  { type: 'facility', facility: 'charger' }, { type: 'camera' },
  { type: 'move', target: '観測' }, { type: 'move', target: '中継' }, { type: 'move', target: '蓄電' },
  { type: 'collect', item: 'power' }, { type: 'collect', item: 'battery' }, { type: 'use', item: 'battery' },
  { type: 'move', target: '資材' }, { type: 'move', target: '計測' }, { type: 'move', target: '整備' },
  { type: 'move', target: '管制' }, { type: 'move', target: '倉庫' }, { type: 'move', target: '研究' },
  { type: 'collect', item: 'parts' }, { type: 'use', item: 'battery' },
  { type: 'move', target: '隔壁' }, { type: 'move', target: '通信' }, { type: 'move', target: '前室' },
  { type: 'move', target: '発着' }, { type: 'facility', facility: 'ship' },
]
