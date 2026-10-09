export type Language = 'ja' | 'en'
export type Text = { ja: string; en: string }
const text = (ja: string, en: string): Text => ({ ja, en })
export const messages = {
  menu: text('言語メニュー', 'Language menu'),
  board: text('盤面', 'Board'),
  up: text('上へ', 'Move up'), down: text('下へ', 'Move down'),
  left: text('左へ', 'Move left'), right: text('右へ', 'Move right'),
  legend: text('@ YOU · R ROBOT · B BOX\nO HOLE · G EXIT · # WALL', '@ YOU · R ROBOT · B BOX\nO HOLE · G EXIT · # WALL'),
  rules: text('@ を G へ\n@ / R / B は連なって押される\nO に入ると消える（@ は FAIL）\n@ が動くと R も1回動く\nR は横を優先、無理なら縦へ近づく', '@ → G\n@ / R / B push in chains\nO removes objects (@ = FAIL)\n@ moves → R acts once\nR: horizontal first; blocked → vertical'),
  ready: text('方向ボタンで移動', 'Tap an arrow to move'),
  moved: text('移動した。', 'Moved.'), blocked: text('動かせない。', 'Blocked.'),
  pushed: text('連なった物体を押した。', 'Objects pushed.'),
  'box-fell': text('BOX が HOLE に落ちた。', 'BOX fell into HOLE.'),
  'robot-fell': text('ROBOT が HOLE に落ちた。', 'ROBOT fell into HOLE.'),
  fail: text('FAIL · UNDO で戻れる', 'FAIL · Try UNDO'),
  clear: text('STAGE CLEAR', 'STAGE CLEAR'),
  'all-clear': text('ALL CLEAR', 'ALL CLEAR'),
  undo: text('UNDO', 'UNDO'), restart: text('RESTART', 'RESTART'),
  next: text('NEXT STAGE', 'NEXT STAGE'), again: text('PLAY AGAIN', 'PLAY AGAIN'),
} satisfies Record<string, Text>
export const t = (key: keyof typeof messages, language: Language) => messages[key][language]
export function initialLanguage(): Language { return navigator.language.startsWith('ja') ? 'ja' : 'en' }
