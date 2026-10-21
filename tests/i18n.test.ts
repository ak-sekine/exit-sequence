import test from 'node:test'
import assert from 'node:assert/strict'
import { compass, initialLanguage, messages, t } from '../src/i18n.ts'

test('all visible realtime messages exist in Japanese and English', () => {
  for (const key of Object.keys(messages) as (keyof typeof messages)[]) {
    assert.ok(t(key, 'ja').length, `Japanese ${key}`)
    assert.ok(t(key, 'en').length, `English ${key}`)
  }
  assert.equal(t('doorOpened', 'ja'), '扉を開けた。')
  assert.equal(t('enemySpotted', 'en'), 'The enemy spotted you.')
  assert.equal(t('gameOver', 'ja'), '敵に捕まった。ゲームオーバー')
})

test('eight-way compass labels track continuous heading and language preference', () => {
  assert.deepEqual([0, 1, 2, 3].map(i => compass(i * Math.PI / 2, 'en')), ['N', 'E', 'S', 'W'])
  assert.deepEqual([0, 1, 2, 3].map(i => compass(i * Math.PI / 2, 'ja')), ['北', '東', '南', '西'])
  assert.equal(compass(Math.PI / 4, 'en'), 'NE')
  assert.equal(initialLanguage('ja-JP'), 'ja')
  assert.equal(initialLanguage('en-US'), 'en')
})
