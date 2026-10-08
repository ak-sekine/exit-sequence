export type Language = 'ja' | 'en'
export type Text = { ja: string; en: string }
export const text = (ja: string, en: string): Text => ({ ja, en })
export const LANGUAGE_STORAGE_KEY = 'exit-sequence-language'
export const messages = {
  start: text('ゲーム開始', 'START'), restart: text('最初から', 'RESTART'),
  status: text('状態', 'STATUS'), inventory: text('持ち物', 'INVENTORY'), knowledge: text('知った事実', 'KNOWLEDGE'),
  settings: text('設定', 'SETTINGS'), help: text('遊び方', 'HELP'), back: text('物語へ戻る', 'BACK TO STORY'),
  language: text('言語', 'LANGUAGE'), log: text('物語ログ', 'Story log'), choices: text('行動を選ぶ', 'Choose an action'),
  empty: text('まだ何もない。', 'Nothing yet.'),
  intro: text('EXIT SEQUENCE\n短編SFゲームブック\n\n音、光、残された記録。読み取ったことが、生き残るための手掛かりになる。', 'EXIT SEQUENCE\nA short SF survival gamebook\n\nSounds, light, abandoned records. What you read becomes what you can act on.'),
  helpText: text('文章を読み、行動を選ぶ。音や光の変化は危険の手掛かりになる。\n知った事実と道具は、新しい行動を可能にする。長い作業や待機は酸素を使い、騒音はロボットの警戒を高める。\n酸素は「十分 → 少ない → 危険」。危険な状態でさらに空気を使うと脱出できない。警戒が高いと、音を出す危険な行動で遭遇する。\n選択は取り消せない。状態・持ち物・知った事実・設定の参照と、文章を読む時間は進行しない。\n文章の表示中はログをタップして全文表示。セーブはない。', 'Read the scene, then choose an action. Changes in sound and light give you evidence of danger.\nFacts and tools make new actions possible. Long work and waiting use oxygen; noise raises robot alert.\nOxygen runs from sufficient to low to critical. Using more air at critical means you cannot escape. At high alert, risky noisy actions cause an encounter.\nChoices cannot be undone. Reading, checking status, inventory, knowledge and settings never advances the story.\nTap the log during text animation to reveal it. There is no save.'),
} satisfies Record<string, Text>
export const t = (key: keyof typeof messages, language: Language) => messages[key][language]
export function initialLanguage(): Language {
  try { const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY); if (stored === 'ja' || stored === 'en') return stored } catch { /* Storage may be blocked. */ }
  return navigator.language.startsWith('ja') ? 'ja' : 'en'
}
export function saveLanguage(language: Language) { try { localStorage.setItem(LANGUAGE_STORAGE_KEY, language) } catch { /* Play without storage. */ } }
