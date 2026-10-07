import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initialLanguage, saveLanguage, LANGUAGE_STORAGE_KEY, messages, t, roomNames, mapNames, roomDescriptions, facilityNames } from '../src/i18n.ts'
import { rooms, baseMapLines, facilityGuideLines, facilityIds } from '../src/map.ts'

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
  assert.equal(t('cameraDirection', 'en', '<b>$&{0}</b>'), 'Toward <b>$&{0}</b>')
})

test('map markers, three-letter abbreviations and facility membership agree across languages', () => {
  assert.deepEqual(baseMapLines('居住'), ['基地マップ * = 現在地', '[*居住]─[ 医療]─[ 観測]', ' 　│   　　│   　　│', '[ 倉庫]─[ 管制]─[ 電力]', ' 　│   　　│   　　│', '[ 研究]─[ 整備]─[ 発着]'])
  assert.deepEqual(baseMapLines('居住', 'en'), ['BASE MAP * = YOU', '[*HAB]─[ MED]─[ OBS]', '   │      │      │', '[ STO]─[ CTL]─[ PWR]', '   │      │      │', '[ LAB]─[ MNT]─[ PAD]'])
  for (const room of rooms) {
    assert.match(mapNames[room].en, /^[A-Z]{3}$/)
    const map = baseMapLines(room, 'en')
    assert.equal(map.join('').split('*').length - 1, 2) // header plus current district
    assert.ok(map.join('\n').includes(`[*${mapNames[room].en}]`))
    assert.ok(map.every(line => line.length <= 20))
    assert.ok(roomDescriptions('en')[room])
  }
  for (const language of ['ja', 'en'] as const) {
    const guide = facilityGuideLines(language), names = facilityNames(language)
    assert.equal(guide.length, 10)
    rooms.forEach((room, index) => {
      for (const id of facilityIds[room]) assert.ok(guide[index + 1]!.includes(names[id]))
      if (language === 'en') assert.ok(guide[index + 1]!.startsWith(roomNames[room].en + ': '))
    })
  }
  assert.equal(Object.values(facilityIds).flat().length, 19)
})
