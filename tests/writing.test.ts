import { test } from 'node:test'
import assert from 'node:assert/strict'
import { messages, roomDescriptions, t } from '../src/i18n.ts'
import { rooms } from '../src/map.ts'
import { Game } from '../src/game.ts'

test('new narrative retains first-person short scenes and language-specific AI prefixes', () => {
  for (const language of ['ja', 'en'] as const) {
    assert.deepEqual(Object.keys(roomDescriptions(language)).sort(), [...rooms].sort())
    for (const text of Object.values(roomDescriptions(language))) {
      assert.equal(text.split('\n').length, 2)
      if (language === 'en') assert.ok(!/[\u3040-\u30ff\u3400-\u9fff]/u.test(text))
    }
    for (const [key, pair] of Object.entries(messages)) for (const line of pair[language].split('\n')) {
      if (line.startsWith('AI') && !['ai', 'aiMenu'].includes(key)) assert.ok(line.startsWith(language === 'ja' ? 'AI：' : 'AI:'), `${key}: ${line}`)
    }
    assert.match(t('launchResult', language), language === 'ja' ? /シートに身を/ : /I settle/)
    assert.match(t('robotFatal', language), language === 'ja' ? /AI：/ : /AI:/)
    assert.match(t('encounterInstructions', language), /25%/)
    assert.ok(!/80%|60%/.test(Object.values(messages).map(pair => pair[language]).join('')))
  }
})

test('fatal ENERGY result precedes explicit GAME OVER without success prose', () => {
  for (const language of ['ja', 'en'] as const) {
    const game = new Game(() => 0.999); game.state.energy = 1
    const log = game.act({ type: 'move', target: '医療' }, language)
    assert.equal(log.at(-1), 'GAME OVER')
    assert.ok(!log.join('').includes(t('movementResult', language, 'x')))
    assert.equal(game.state.location, '居住')
    assert.ok(log.at(-2)!.includes(language === 'ja' ? 'AI：' : 'AI:'))
  }
})
