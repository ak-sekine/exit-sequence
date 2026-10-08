import { text } from './i18n.ts'
export const items = {
  light: text('携帯ライト — 白い照射と手元の照明。', 'Portable light — a white beam or close lighting.'),
  tools: text('工具 — 締める、外す、固定する。', 'Tools — tighten, remove or brace parts.'),
  decoy: text('簡易デコイ — 音と振動を一度だけ出す。', 'Simple decoy — makes sound and vibration once.'),
  flask: text('予備酸素 — 呼吸か、小さな配管への一回分。', 'Reserve oxygen — one use for breathing or a small pipe.'),
}
export type ItemId = keyof typeof items
