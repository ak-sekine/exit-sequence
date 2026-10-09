export type Language = 'ja' | 'en'
export type Text = { ja: string; en: string }
export const text = (ja: string, en: string): Text => ({ ja, en })
export const LANGUAGE_STORAGE_KEY = 'exit-sequence-language'
export const messages = {
  start: text('ゲーム開始', 'START'), restart: text('最初から', 'RESTART'),
  menu: text('メニュー', 'Menu'),
  language: text('言語', 'LANGUAGE'), log: text('物語ログ', 'Story log'), choices: text('行動を選ぶ', 'Choose an action'),
  intro: text('EXIT SEQUENCE\n短編SFダンジョンRPG\n\n能力を選び、探索・戦闘・成長を重ねて月面基地から帰還船へ。HPが0になるとGAME OVER。10～15分を想定した試作です。', 'EXIT SEQUENCE\nA short SF dungeon RPG\n\nBuild your character. Explore, fight and grow on your way from the Moon base to the return ship. HP 0 means GAME OVER. A prototype aiming for 10–15 minutes.'),
} satisfies Record<string, Text>
export const t = (key: keyof typeof messages, language: Language) => messages[key][language]
export function initialLanguage(): Language {
  try { const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY); if (stored === 'ja' || stored === 'en') return stored } catch { /* Storage may be blocked. */ }
  return navigator.language.startsWith('ja') ? 'ja' : 'en'
}
export function saveLanguage(language: Language) { try { localStorage.setItem(LANGUAGE_STORAGE_KEY, language) } catch { /* Play without storage. */ } }
