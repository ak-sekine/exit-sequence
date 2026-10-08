export type Language = 'ja' | 'en'
export type Text = { ja: string; en: string }
export const text = (ja: string, en: string): Text => ({ ja, en })
export const LANGUAGE_STORAGE_KEY = 'exit-sequence-language'
export const messages = {
  start: text('ゲーム開始', 'START'), restart: text('最初から', 'RESTART'),
  menu: text('メニュー', 'Menu'),
  language: text('言語', 'LANGUAGE'), log: text('物語ログ', 'Story log'), choices: text('行動を選ぶ', 'Choose an action'),
  intro: text('EXIT SEQUENCE\n短編SFゲームブック\n\n壊れた月面基地から、AIと帰還船を目指そう。音や光、残された記録を手掛かりに、次の行動を選ぶ。', 'EXIT SEQUENCE\nA short SF survival gamebook\n\nEscape a damaged Moon base with your AI companion. Follow sounds, light and old records to choose your next move toward the return ship.'),
} satisfies Record<string, Text>
export const t = (key: keyof typeof messages, language: Language) => messages[key][language]
export function initialLanguage(): Language {
  try { const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY); if (stored === 'ja' || stored === 'en') return stored } catch { /* Storage may be blocked. */ }
  return navigator.language.startsWith('ja') ? 'ja' : 'en'
}
export function saveLanguage(language: Language) { try { localStorage.setItem(LANGUAGE_STORAGE_KEY, language) } catch { /* Play without storage. */ } }
