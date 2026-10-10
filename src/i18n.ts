import type { LogEvent } from './game.ts'
export type Language = 'ja' | 'en'
const text = (ja: string, en: string) => ({ ja, en })
export const messages = {
  playerControls: text('移動・回転', 'Move / turn'),
  mapControls: text('マップ移動', 'Scroll map'),
  scrollup: text('マップを北へスクロール', 'Scroll map north'),
  scrolldown: text('マップを南へスクロール', 'Scroll map south'),
  scrollleft: text('マップを西へスクロール', 'Scroll map west'),
  scrollright: text('マップを東へスクロール', 'Scroll map east'),
  direction: text('方角', 'Direction'),
  north: text('北', 'N'), east: text('東', 'E'), south: text('南', 'S'), west: text('西', 'W'),
  map: text('2Dマップ', '2D map'),
  showMap: text('2Dマップを表示', 'Show 2D map'),
  showDungeon: text('3Dダンジョンを表示', 'Show 3D dungeon'),
  gameOver: text('敵に捕まった。GAME OVER', 'Caught by the enemy. GAME OVER'),
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

export function translateLog(event: LogEvent, language: Language): string {
  if (typeof event === 'string') return t(event, language)
  if (event.kind === 'sight') {
    const ja = ['', '目の前に敵がいる。', 'すぐ近くに敵がいる。', '近くに敵が見える。', '遠くに敵が見える。', 'すごく遠くに敵が見える。']
    const en = ['', 'An enemy is right in front of you.', 'An enemy is very close.', 'An enemy is visible nearby.', 'An enemy is visible far away.', 'An enemy is visible very far away.']
    const facing = (language === 'ja' ? ['北', '東', '南', '西'] : ['north', 'east', 'south', 'west'])[event.facing]
    return language === 'ja' ? `${ja[event.distance]}敵は${facing}を向いている。` : `${en[event.distance]} The enemy is facing ${facing}.`
  }
  const directions = {
    front: ['前', 'ahead'], frontRight: ['右斜め前', 'ahead to the right'], right: ['右', 'to the right'],
    backRight: ['右斜め後ろ', 'behind to the right'], back: ['後ろ', 'behind'], backLeft: ['左斜め後ろ', 'behind to the left'],
    left: ['左', 'to the left'], frontLeft: ['左斜め前', 'ahead to the left'],
  }
  return language === 'ja'
    ? `${directions[event.direction][0]}の方、${event.distance <= 1 ? '近く' : '遠く'}で敵の音が聞こえる。`
    : `You hear an enemy ${directions[event.direction][1]}, ${event.distance <= 1 ? 'nearby' : 'far away'}.`
}
