import test from 'node:test'
import assert from 'node:assert/strict'
import { messages, t } from '../src/i18n.ts'
test('all sample messages exist in Japanese and English', () => {
  for (const key of Object.keys(messages) as (keyof typeof messages)[]) for (const lang of ['ja', 'en'] as const) assert.ok(t(key, lang).length)
  assert.equal(t('ready', 'ja'), '通路にいる。')
  assert.equal(t('blocked', 'ja'), 'これ以上進めない。')
})

test('direction label and four compass values are translated', () => {
  assert.equal(t('direction', 'ja'), '方角')
  assert.equal(t('direction', 'en'), 'Direction')
  const keys = ['north', 'east', 'south', 'west'] as const
  assert.deepEqual(keys.map(key => t(key, 'ja')), ['北', '東', '南', '西'])
  assert.deepEqual(keys.map(key => t(key, 'en')), ['N', 'E', 'S', 'W'])
})
