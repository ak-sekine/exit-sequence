import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { Game, taskInfo } from '../src/game.ts'
import type { Action } from '../src/game.ts'
import { edgeKey, neighbors } from '../src/map.ts'

// Captured from main 5e4d301 before the writing change. Each digest includes
// the entire State and cumulative RNG count after every action, not log text.
const baseline = {
  sequences: 'b42ad54ac19d4be9dd956c0d155a00ded183b0c058d10ae10e6ea2af7157a693',
  branches: '76f79e37aa2fa965b1def8c7ed56be74da0daf92a7754cb08188e89d94361b08',
}
function digest(language: 'ja' | 'en', kind: keyof typeof baseline) {
  const hash = createHash('sha256')
  let draws = 0
  const record = (game: Game) => hash.update(JSON.stringify({ state: game.state, draws }))
  if (kind === 'sequences') {
    for (let seed = 1; seed <= 100; seed++) {
      let value = seed
      draws = 0
      const game = new Game(() => { draws++; value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 2 ** 32 })
      record(game)
      for (let step = 0; step < 80; step++) {
        const s = game.state, targets = neighbors(s.location)
        const task = (Object.keys(taskInfo) as (keyof typeof taskInfo)[]).find(task => taskInfo[task].room === s.location && !game.taskDone(task))
        const action: Action = s.encounter
          ? step % 3 === 0 ? { type: 'flee', target: targets[step % targets.length]! } : { type: step % 2 === 0 ? 'hide' : 'force' }
          : task && step % 2 === 0 ? { type: 'task', task } : { type: step % 5 === 0 ? 'camera' : 'move', target: targets[(step + seed) % targets.length]! }
        game.act(action, language); record(game)
      }
    }
  } else {
    for (const roll of [0.1, 0.99]) for (const energy of [1, 2, 17, 20]) {
      const fixture = () => {
        draws = 0
        const game = new Game(() => { draws++; return roll })
        for (const key of Object.keys(game.state.passages)) game.state.passages[key] = 'NORMAL'
        game.state.enemy = '研究'; game.state.energy = energy
        return game
      }
      for (const task of Object.keys(taskInfo) as (keyof typeof taskInfo)[]) for (const available of [false, true]) {
        const game = fixture(); game.state.location = taskInfo[task].room
        if (available) { game.state.items = ['修理部品']; game.state.conditions = { power: true, control: true, repair: true, food: true } }
        if (task === 'power' || task === 'control' || task === 'repair' || task === 'food') game.state.conditions[task] = false
        record(game); game.act({ type: 'task', task }, language); record(game)
        game.act({ type: 'task', task }, language); record(game)
      }
      for (const passage of ['NORMAL', 'DARK', 'BLOCKED', 'CLOSED'] as const) for (const type of ['move', 'flee', 'camera'] as const) {
        const game = fixture(); game.state.passages[edgeKey('居住', '医療')] = passage
        game.state.encounter = type === 'flee'; record(game)
        game.act({ type, target: '医療' }, language); record(game)
      }
      for (const type of ['hide', 'force'] as const) {
        const game = fixture(); game.state.enemy = '居住'; game.state.encounter = true
        record(game); game.act({ type }, language); record(game)
      }
    }
  }
  return hash.digest('hex')
}
for (const language of ['ja', 'en'] as const) for (const kind of ['sequences', 'branches'] as const) {
  test(`writing preserves pre-change full State and RNG: ${language} ${kind}`, () => {
    assert.equal(digest(language, kind), baseline[kind])
  })
}
