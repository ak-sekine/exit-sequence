import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initialLanguage, saveLanguage, LANGUAGE_STORAGE_KEY, messages, t, roomNames, mapNames, roomDescriptions } from '../src/i18n.ts'
import { rooms, baseMapLines, initialKnowledge, edges, edgeKey } from '../src/map.ts'

const storage = (value: string | null) => ({ getItem: () => value, setItem: (_key: string, next: string) => { value = next } })

test('language resolution honors valid storage, browser locale, and unavailable globals', () => {
  for (const saved of ['ja', 'en'] as const) {
    assert.equal(initialLanguage({ localStorage: storage(saved), navigator: { language: saved === 'ja' ? 'en-US' : 'ja-JP' } }), saved)
  }
  for (const locale of ['ja', 'ja-JP', 'ja-x-test', 'JA-jp', 'en-US', 'fr', 'japanese']) {
    for (const saved of [null, 'invalid', 'EN', '']) {
      assert.equal(initialLanguage({ localStorage: storage(saved), navigator: { language: locale } }), /^ja(?:-|$)/i.test(locale) ? 'ja' : 'en')
    }
  }
  assert.equal(initialLanguage({}), 'ja')
  const denied = { get localStorage(): never { throw new Error('SecurityError') } }
  assert.equal(initialLanguage(denied), 'ja')
  assert.equal(initialLanguage(Object.assign(Object.create(denied), { navigator: { language: 'en-US' } })), 'en')
  assert.doesNotThrow(() => saveLanguage('en', denied))
  const deniedNavigator = { get navigator(): never { throw new Error('Unavailable') } }
  assert.equal(initialLanguage(deniedNavigator), 'ja')
  assert.equal(initialLanguage(Object.assign(Object.create(deniedNavigator), { localStorage: storage('en') })), 'en')
})

test('language persistence uses only the designated key and restores a new session', () => {
  const values = new Map<string, string>()
  const environment = { localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } } }
  for (const language of ['en', 'ja'] as const) {
    saveLanguage(language, environment)
    assert.deepEqual([...values], [[LANGUAGE_STORAGE_KEY, language]])
    assert.equal(initialLanguage(environment), language)
  }
})

test('every catalog entry has matching placeholders and no Japanese in English output', () => {
  const placeholders = (text: string) => [...text.matchAll(/\{(\d+)\}/g)].map(match => match[1]).sort()
  for (const [key, message] of Object.entries(messages)) {
    assert.deepEqual(Object.keys(message).sort(), ['en', 'ja'], key)
    assert.deepEqual(placeholders(message.ja), placeholders(message.en), key)
    assert.ok(!/[\u3040-\u30ff\u3400-\u9fff]/u.test(message.en), key)
  }
  // Replacement values stay literal, including dollar syntax and HTML characters.
  assert.equal(t('locationStatus', 'en', '<b>$&{0}</b>'), 'LOCATION : <b>$&{0}</b>')
})

test('map abbreviations, current marker, unknowns and maximum width agree across languages', () => {
  const knowledge = initialKnowledge(), knownEdges = edges.map(([a, b]) => edgeKey(a, b))
  for (const language of ['ja', 'en'] as const) {
    const unknown = baseMapLines('居住', knowledge, knownEdges, language)
    assert.equal(unknown.join('').match(/\?/g)?.length, 15)
    const all = Object.fromEntries(rooms.map(room => [room, 'mapped'])) as typeof knowledge
    for (const room of rooms) {
      assert.match(mapNames[room].en, /^[A-Z]{3}$/)
      const map = baseMapLines(room, all, knownEdges, language)
      assert.equal(map.length, 8)
      assert.equal(map.slice(1).join('').match(/\*/g)?.length, 1)
      assert.ok(map.slice(1).every(line => [...line].reduce((width, c) => width + (/[^\x00-\x7f─│]/u.test(c) ? 2 : 1), 0) <= 27))
      assert.ok(map.join('').includes(`[*${mapNames[room][language].slice(0, language === 'ja' ? 1 : 3)}]`))
      assert.ok(roomDescriptions(language)[room]); assert.ok(roomNames[room][language])
    }
  }
})
