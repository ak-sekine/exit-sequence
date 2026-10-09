import test from 'node:test'
import assert from 'node:assert/strict'
import { messages, t } from '../src/i18n.ts'
test('all sample messages exist in Japanese and English', () => {
  for (const key of Object.keys(messages) as (keyof typeof messages)[]) for (const lang of ['ja', 'en'] as const) assert.ok(t(key, lang).length)
  assert.equal(t('ready', 'ja'), '通路にいる。')
  assert.equal(t('blocked', 'ja'), 'これ以上進めない。')
})
