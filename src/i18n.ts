export type Language = 'ja' | 'en'
const text = (ja: string, en: string) => ({ ja, en })

export const messages = {
  menu: text('メニュー', 'Menu'),
  resume: text('再開', 'Resume'),
  showMap: text('マップ', 'Map'),
  closeMap: text('マップを閉じる', 'Close map'),
  language: text('言語', 'Language'),
  paused: text('一時停止中', 'Paused'),
  direction: text('方向', 'Direction'),
  coordinates: text('位置', 'Position'),
  corridor: text('通路', 'Corridor'),
  room: text('部屋', 'Room'),
  action: text('A', 'A'),
  joystick: text('移動スティック', 'Movement stick'),
  log: text('イベントログ', 'Event log'),
  dungeon: text('ダンジョン', 'Dungeon'),
  mapLabel: text('探索マップ', 'Explored map'),
  gameOver: text('敵に捕まった。ゲームオーバー', 'Caught by the enemy. GAME OVER'),
  ready: text('探索を開始。', 'Exploration started.'),
  doorAhead: text('正面に扉がある。', 'There is a door ahead.'),
  doorOpened: text('扉を開けた。', 'Door opened.'),
  doorClosed: text('扉を閉めた。', 'Door closed.'),
  doorJammed: text('敵が近くにいて、扉を閉められない。', 'The door is blocked by someone nearby.'),
  enemySpotted: text('敵に発見された。', 'The enemy spotted you.'),
  enemyDetected: text('敵の姿を捉えた。', 'Enemy spotted.'),
  heardMovement: text('近くで物音が聞こえる。', 'You hear movement nearby.'),
} as const

export type Message = keyof typeof messages
export const t = (key: Message, language: Language): string => messages[key][language]
export function initialLanguage(preferred = typeof navigator === 'undefined' ? 'en' : navigator.language): Language {
  return preferred.toLowerCase().startsWith('ja') ? 'ja' : 'en'
}

const COMPASS = {
  ja: ['北', '北東', '東', '南東', '南', '南西', '西', '北西'],
  en: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
} as const

export function compass(heading: number, language: Language): string {
  const index = Math.round((((heading % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8
  return COMPASS[language][index]!
}
