export type Language = 'ja' | 'en'
export type Text = { ja: string; en: string }
export const text = (ja: string, en: string): Text => ({ ja, en })
export const LANGUAGE_STORAGE_KEY = 'exit-sequence-language'
export const messages = {
  start: text('ゲーム開始', 'START'), restart: text('最初から', 'RESTART'),
  menu: text('メニュー', 'Menu'),
  language: text('言語', 'LANGUAGE'), log: text('物語ログ', 'Story log'), choices: text('行動を選ぶ', 'Choose an action'),
  intro: text('EXIT SEQUENCE\n短編SFゲームブック\n\n音、光、残された記録。読み取ったことが、生き残るための手掛かりになる。', 'EXIT SEQUENCE\nA short SF survival gamebook\n\nSounds, light, abandoned records. What you read becomes what you can act on.'),
} satisfies Record<string, Text>
export const t = (key: keyof typeof messages, language: Language) => messages[key][language]
export function initialLanguage(): Language {
  try { const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY); if (stored === 'ja' || stored === 'en') return stored } catch { /* Storage may be blocked. */ }
  return navigator.language.startsWith('ja') ? 'ja' : 'en'
}
export function saveLanguage(language: Language) { try { localStorage.setItem(LANGUAGE_STORAGE_KEY, language) } catch { /* Play without storage. */ } }
