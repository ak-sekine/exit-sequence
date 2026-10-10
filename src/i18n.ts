export type Language = 'ja' | 'en'
const text = (ja: string, en: string) => ({ ja, en })
export const messages = {
  direction: text('方角', 'Direction'),
  north: text('北', 'N'), east: text('東', 'E'), south: text('南', 'S'), west: text('西', 'W'),
  menu: text('言語メニュー', 'Language menu'),
  dungeon: text('3Dダンジョン', '3D dungeon'), log: text('ログ', 'Log'),
  ready: text('通路にいる。', 'In a corridor.'),
  enteredRoom: text('扉を開けて部屋に入った。', 'Opened the door and entered the room.'),
  returnedCorridor: text('扉を開けて通路に戻った。', 'Opened the door and returned to the corridor.'),
  moved: text('前進した。', 'Moved forward.'),
  blocked: text('これ以上進めない。', 'Cannot go further.'),
  left: text('左を向いた。', 'Turned left.'), right: text('右を向いた。', 'Turned right.'),
  down: text('後ろを向いた。', 'Turned around.'), up: text('前進', 'Move forward'),
}
export type Message = keyof typeof messages
export const t = (key: Message, language: Language) => messages[key][language]
export function initialLanguage(): Language { return navigator.language.startsWith('ja') ? 'ja' : 'en' }
