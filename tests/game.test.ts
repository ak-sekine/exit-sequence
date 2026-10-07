import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Game, taskInfo } from '../src/game.ts'
import { costs, edgeKey, edges, neighbors, rooms, baseMapLines } from '../src/map.ts'

function fixture(random = () => 0.99) {
  const game = new Game(random)
  for (const key of Object.keys(game.state.passages)) game.state.passages[key] = 'NORMAL'
  game.state.enemy = '研究'
  return game
}
test('passage costs, CLOSED rejection and fatal cost before task results', () => {
  for (const passage of ['NORMAL', 'DARK', 'BLOCKED', 'CLOSED'] as const) {
    const game = fixture()
    game.state.passages[edgeKey('居住', '医療')] = passage
    game.act({ type: 'move', target: '医療' })
    assert.equal(game.state.energy, passage === 'CLOSED' ? 20 : 20 - costs[passage])
    assert.equal(game.state.turn, passage === 'CLOSED' ? 0 : 1)
    assert.equal(game.state.location, passage === 'CLOSED' ? '居住' : '医療')
  }
  const game = fixture(); game.state.location = '研究'; game.state.energy = 1
  const log = game.act({ type: 'task', task: 'parts' })
  assert.equal(game.state.status, 'over'); assert.deepEqual(game.state.items, [])
  assert.ok(log.includes('GAME OVER'))
})
test('camera captures after world, costs one, and becomes stale on next action', () => {
  const game = fixture()
  assert.equal(game.freshness('居住', '医療'), '未確認')
  const log = game.act({ type: 'camera', target: '医療' })
  assert.equal(game.state.energy, 19); assert.equal(game.state.turn, 1)
  assert.equal(game.freshness('居住', '医療'), '最新')
  assert.ok(log.includes('通路：NORMAL'))
  game.statusLines(); assert.equal(game.state.turn, 1)
  game.act({ type: 'move', target: '医療' })
  assert.equal(game.freshness('居住', '医療'), '古い')
})
test('repair requires parts; full return loop consumes parts and retains food', () => {
  const game = fixture(() => 0.79)
  game.state.location = '整備'
  game.act({ type: 'task', task: 'repair' })
  assert.equal(game.state.turn, 0); assert.equal(game.state.energy, 20)
  game.state.location = '居住'
  const move = (target: typeof game.state.location) => {
    if (game.state.encounter) game.act({ type: 'hide' })
    game.act({ type: 'move', target })
  }
  const task = (task: Parameters<Game['taskDone']>[0]) => {
    if (game.state.encounter) game.act({ type: 'hide' })
    game.act({ type: 'task', task })
  }
  move('医療'); task('medical'); move('観測'); task('observe')
  move('電力管理'); task('power'); move('管制'); task('control'); move('倉庫'); task('food'); move('研究'); task('parts')
  move('整備'); task('repair'); move('発着'); task('launch')
  assert.equal(game.state.status, 'clear'); assert.equal(game.ready(), true)
  assert.deepEqual(game.state.items, ['食糧'])
  game.restart()
  assert.equal(game.state.location, '居住'); assert.equal(game.state.energy, 20)
  assert.equal(game.state.turn, 0); assert.equal(game.state.status, 'playing')
  assert.deepEqual(game.state.items, []); assert.deepEqual(game.state.feeds, {})
  assert.equal(Object.values(game.state.conditions).some(Boolean), false)
  assert.equal(Object.values(game.state.supplies).some(Boolean), false)
})
test('supplies cap ENERGY, are single use, and incomplete launch is free', () => {
  const game = fixture(); game.state.location = '医療'; game.state.energy = 18
  game.act({ type: 'task', task: 'medical' })
  assert.equal(game.state.energy, 20); assert.equal(game.state.turn, 1)
  game.act({ type: 'task', task: 'medical' }); assert.equal(game.state.turn, 1)
  game.state.location = '発着'
  game.act({ type: 'task', task: 'launch' }); assert.equal(game.state.turn, 1)
  assert.equal(game.state.status, 'playing')
})
test('enemy arrival, hide/force success and failure, flee use exactly one turn', () => {
  const arrival = fixture(); arrival.state.enemy = '医療'
  arrival.act({ type: 'move', target: '医療' }); assert.equal(arrival.state.encounter, true)
  for (const type of ['hide', 'force'] as const) for (const success of [true, false]) {
    const game = fixture(() => success ? 0.1 : 0.99)
    game.state.enemy = '居住'; game.state.encounter = true
    game.act({ type })
    assert.equal(game.state.energy, 20 - (type === 'hide' ? 1 : 2) - (success ? 0 : 1))
    assert.equal(game.state.turn, 1); assert.equal(game.state.encounter, false)
  }
  const game = fixture(); game.state.encounter = true; game.state.enemy = '居住'
  game.state.passages[edgeKey('居住', '医療')] = 'DARK'
  game.act({ type: 'flee', target: '医療' })
  assert.equal(game.state.turn, 1); assert.equal(game.state.energy, 18)
  assert.equal(game.state.location, '医療'); assert.equal(game.state.encounter, false)
})
test('random restarts and 10,000 world updates preserve all-room reachability', () => {
  let changes = 0, moves = 0
  for (let i = 0; i < 100; i++) {
    const game = new Game()
    assert.equal(game.connected(), true)
    assert.ok(['研究', '整備', '管制'].includes(game.state.enemy))
    for (let turn = 0; turn < 100; turn++) {
      const old = JSON.stringify(game.state.passages), enemy = game.state.enemy
      // Restore budget only in this stress fixture, never in production UI.
      game.state.energy = 20
      game.act(game.state.encounter ? { type: 'hide' } : { type: 'camera', target: neighbors(game.state.location)[0]! })
      assert.equal(game.connected(), true)
      assert.ok(Object.values(game.state.passages).filter(p => p !== 'NORMAL').length <= 6)
      if (old !== JSON.stringify(game.state.passages)) changes++
      if (enemy !== game.state.enemy) {
        assert.ok(neighbors(enemy).includes(game.state.enemy))
        assert.notEqual(game.passage(enemy, game.state.enemy), 'CLOSED'); moves++
      }
    }
  }
  assert.ok(changes > 100); assert.ok(moves > 100)
})
test('GAME OVER restart restores all gameplay state', () => {
  const game = fixture(); game.state.energy = 1
  game.act({ type: 'camera', target: '医療' })
  assert.equal(game.state.status, 'over')
  game.restart()
  assert.equal(game.state.status, 'playing'); assert.equal(game.state.encounter, false)
  assert.equal(game.state.enemyPrevious, null); assert.equal(game.state.energy, 20)
})

test('nine rooms, twelve orthogonal edges and fixed map agree', () => {
  assert.deepEqual(rooms, ['居住','医療','観測','倉庫','管制','電力管理','研究','整備','発着'])
  const expected = rooms.flatMap((room,i) => [
    ...(i % 3 < 2 ? [[room, rooms[i+1]!]] : []),
    ...(i < 6 ? [[room, rooms[i+3]!]] : []),
  ])
  assert.equal(edges.length, 12)
  assert.deepEqual(edges.map(([a,b]) => edgeKey(a,b)).sort(), expected.map(([a,b]) => edgeKey(a!,b!)).sort())
  for (const room of rooms) {
    assert.deepEqual(neighbors(room).sort(), expected.flatMap(([a,b]) => a === room ? [b] : b === room ? [a] : []).sort())
    const lines = baseMapLines(room), diagram = lines.slice(1).join('')
    assert.equal(diagram.split('*').length, 2)
    assert.ok(diagram.includes('[*' + (room === '電力管理' ? '電力' : room) + ']'))
    assert.equal(diagram.match(/─/g)?.length, 6)
    assert.equal(diagram.match(/│/g)?.length, 6)
    const names = [lines[1]!, lines[3]!, lines[5]!].flatMap(line => [...line.matchAll(/\[([ *])([^\]]+)\]/g)].map(m => m[2] === '電力' ? '電力管理' : m[2]))
    assert.deepEqual(names, rooms)
    assert.ok(!/NORMAL|DARK|BLOCKED|CLOSED|ENERGY|防災/.test(diagram))
  }
  assert.deepEqual(Object.fromEntries(Object.entries(taskInfo).map(([task,info]) => [task,info.room])), {power:'電力管理',control:'管制',repair:'整備',parts:'研究',food:'倉庫',medical:'医療',observe:'観測',launch:'発着'})
})
test('four initial candidates and diagonal rejection preserve existing rules', () => {
  let draws = 0
  const game = new Game(() => { draws++; return 0.5 })
  assert.equal(draws, 9)
  assert.equal(Object.values(game.state.passages).filter(p => p !== 'NORMAL').length, 4)
  assert.ok(['研究','整備','管制'].includes(game.state.enemy))
  for (const type of ['move','camera','flee'] as const) {
    game.state.encounter = type === 'flee'
    const before = JSON.stringify(game.state)
    game.act({type, target:'管制'})
    assert.equal(JSON.stringify(game.state), before)
  }
})
