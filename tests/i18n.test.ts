import test from 'node:test'
import assert from 'node:assert/strict'
import { messages, t } from '../src/i18n.ts'
import { Game } from '../src/game.ts'

test('ja/en contain the same explicit rules and translating never changes gameplay or undo', () => {
  const game = new Game(); game.move('down')
  const before = structuredClone(game.state), count = game.undoCount
  for (const language of ['ja', 'en'] as const) {
    for (const key of Object.keys(messages) as (keyof typeof messages)[]) assert.ok(t(key, language).length)
    for (const symbol of ['@', 'R', 'B', 'O', 'G']) assert.ok(t('rules', language).includes(symbol))
    assert.deepEqual(game.state, before); assert.equal(game.undoCount, count)
  }
})
