import { text } from './i18n.ts'
export const items = {
  light: text('携帯ライト — 強い照射と通常照明を切り替えられる。', 'Portable light — switches between a flood beam and ordinary lighting.'),
  tools: text('工具 — ネジと手動弁を静かに扱える。', 'Tools — let me work screws and manual valves quietly.'),
  decoy: text('簡易デコイ — 一度だけ金属音を繰り返す。', 'Simple decoy — repeats metallic sounds once, then burns out.'),
  flask: text('予備酸素 — 一回分。使えば酸素を十分まで戻せる。', 'Reserve oxygen — one refill. Restores oxygen to sufficient.'),
}
export type ItemId = keyof typeof items
