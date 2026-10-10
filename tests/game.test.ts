import test from 'node:test'
import assert from 'node:assert/strict'
import { character } from '../src/character.ts'
import { enemyTurn, INITIAL_ENEMY } from '../src/enemy.ts'
import { advanceTurn, createGame } from '../src/game.ts'
import type { GameState } from '../src/game.ts'
import { shortestPath } from '../src/pathfinding.ts'
import { move, DUNGEON_MAP, INITIAL_PLAYER, isFloor } from '../src/dungeon.ts'
import { translateLog } from '../src/i18n.ts'
const enemy = (x: number, y: number, facing: 0 | 1 | 2 | 3 = 1) => ({ ...character({ x, y, facing }), id: 'e', destination: null })
const fixture = (player = character({ x: 0, y: 0, facing: 1 }), e = enemy(3, 0)): GameState => ({ ...createGame(), player, enemies: [e] })
test('ordinary forward movement and every rotation advance turns without entering log history', () => {
  let state = { ...fixture(), enemies: [] }
  for (const action of ['up', 'left', 'right', 'down'] as const) {
    const before = state
    state = advanceTurn(state, action, () => 0, ['###']) as typeof state
    assert.equal(state.turn, before.turn + 1)
    assert.deepEqual(state.player, { ...before.player, ...move(['###'], before.player, action).player })
    assert.deepEqual(state.logs, ['ready'])
  }
  assert.equal(state.player.x, 1)
  for (const language of ['ja', 'en'] as const) {
    assert.deepEqual(state.logs.map(event => translateLog(event, language)), [translateLog('ready', language)])
  }
})
test('failed movement and both door passage events remain in history', () => {
  const door = [{ from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }]
  let state = { ...fixture(), enemies: [] }
  state = advanceTurn(state, 'up', () => 0, ['##'], door) as typeof state
  assert.deepEqual(state.logs, ['ready', 'blocked'])
  assert.equal(state.player.x, 0); assert.equal(state.turn, 1)
  state = advanceTurn(state, 'a', () => 0, ['##'], door) as typeof state
  assert.deepEqual(state.logs, ['ready', 'blocked', 'enteredRoom'])
  assert.equal(state.player.x, 1); assert.equal(state.turn, 2)
  state = advanceTurn(state, 'down', () => 0, ['##'], door) as typeof state
  state = advanceTurn(state, 'a', () => 0, ['##'], door) as typeof state
  assert.deepEqual(state.logs, ['ready', 'blocked', 'enteredRoom', 'returnedCorridor'])
  assert.equal(state.player.x, 0); assert.equal(state.turn, 4)
  const wall = advanceTurn(state, 'up', () => 0, ['##'], door)
  assert.equal(wall.logs.at(-1), 'blocked'); assert.equal(wall.turn, 5)
})
test('silent forward action still creates sound for enemy hearing and retains detection logs', () => {
  // Player walks east while the nearby enemy faces away from the player.
  const state = fixture(character({ x: 0, y: 0, facing: 1 }), enemy(3, 0, 1))
  const next = advanceTurn(state, 'up', () => 0, ['#####'])
  assert.deepEqual(next.enemies[0]!.destination, { x: 1, y: 0 })
  assert.equal(next.enemies[0]!.facing, 3); assert.equal(next.enemies[0]!.x, 3)
  assert.deepEqual(next.logs.map(event => typeof event === 'string' ? event : event.kind), ['ready', 'sight'])
  assert.equal(next.turn, 1)
})
test('initial enemy valid, distinct and in accessible corridor', () => {
  assert.ok(isFloor(DUNGEON_MAP, INITIAL_ENEMY.x, INITIAL_ENEMY.y))
  assert.notDeepEqual([INITIAL_ENEMY.x, INITIAL_ENEMY.y], [INITIAL_PLAYER.x, INITIAL_PLAYER.y])
  assert.ok(shortestPath(DUNGEON_MAP, INITIAL_ENEMY, INITIAL_PLAYER))
})
test('AI prioritizes vision, then sound, then remembered destination', () => {
  const map = ['#######'], e = enemy(0, 0), p = character({ x: 4, y: 0, facing: 3 })
  const sight = enemyTurn(map, e, p, { sourceId: 'p', position: { x: 2, y: 0 } })
  assert.deepEqual(sight.enemy.destination, { x: 4, y: 0 }); assert.equal(sight.enemy.x, 1)
  const hearing = enemyTurn(map, { ...e, facing: 3 }, p, { sourceId: 'p', position: { x: 2, y: 0 } })
  assert.deepEqual(hearing.enemy.destination, { x: 2, y: 0 }); assert.equal(hearing.enemy.x, 0); assert.equal(hearing.enemy.facing, 1); assert.equal(hearing.sound, null)
  const remembered = enemyTurn(map, { ...e, facing: 3, destination: { x: 3, y: 0 } }, p, null)
  assert.deepEqual(remembered.enemy.destination, { x: 3, y: 0 })
})
test('arrival clears destination and next idle turn picks reproducible direction and goal', () => {
  const e = { ...enemy(0, 0), destination: { x: 1, y: 0 } }, p = character({ x: 9, y: 0, facing: 0 })
  const arrived = enemyTurn(['###'], e, p, null, () => .5)
  assert.equal(arrived.enemy.x, 1); assert.equal(arrived.enemy.destination, null); assert.ok(arrived.sound)
  const idle = enemyTurn(['###'], arrived.enemy, p, null, () => .5)
  assert.equal(idle.enemy.x, 1); assert.equal(idle.enemy.facing, 2); assert.ok(idle.enemy.destination); assert.equal(idle.sound, null)
  assert.deepEqual(idle, enemyTurn(['###'], arrived.enemy, p, null, () => .5))
  assert.equal(enemyTurn(['#'], enemy(0, 0), p, null, () => .5).enemy.destination, null)
})
test('BFS counts turns including 180 turn, never crosses wall or closed door', () => {
  assert.deepEqual(shortestPath(['###'], enemy(0, 0, 3), { x: 2, y: 0 }), ['down', 'up', 'up'])
  const map = ['###', '# #', '###']
  const route = shortestPath(map, enemy(0, 1, 1), { x: 2, y: 1 })!
  assert.equal(route.length, 7)
  let p = enemy(0, 1, 1)
  for (const action of route) p = { ...p, ...move(map, p, action).player }
  assert.equal(p.x, 2); assert.equal(p.y, 1)
  const door = [{ from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }]
  assert.equal(shortestPath(['##'], enemy(0, 0), { x: 1, y: 0 }, door), null)
  const failed = enemyTurn(['# #'], { ...enemy(0, 0), destination: { x: 2, y: 0 } }, character({ x: 9, y: 0, facing: 0 }), null)
  assert.equal(failed.enemy.destination, null); assert.equal(failed.enemy.x, 0)
})
test('turns consume failed advances and rotations, invalid A and game over freeze', () => {
  let state = { ...fixture(), enemies: [] }
  for (const action of ['up', 'left', 'right', 'down'] as const) state = advanceTurn(state, action, () => 0, ['#']) as typeof state
  assert.equal(state.turn, 4)
  assert.equal(advanceTurn(state, 'a', () => 0, ['#']), state)
  const door = [{ from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }]
  const passage = advanceTurn({ ...fixture(), enemies: [enemy(2, 0, 3)] }, 'a', () => 0, ['###'], door)
  assert.equal(passage.player.x, 1); assert.equal(passage.turn, 1); assert.equal(passage.gameOver, true)
  const over = { ...state, gameOver: true }
  for (const action of ['up', 'left', 'right', 'down', 'a'] as const) assert.equal(advanceTurn(over, action), over)
})
test('each player rotation triggers exactly one enemy action, rotation and advance separate', () => {
  const state = fixture(character({ x: 0, y: 0, facing: 1 }), enemy(3, 0, 1))
  const next = advanceTurn(state, 'left', () => 0, ['####'])
  assert.equal(next.enemies[0]!.x, 3); assert.equal(next.enemies[0]!.facing, 0); assert.equal(next.turn, 1)
  const chasing = advanceTurn({ ...state, enemies: [{ ...enemy(3, 0, 1), destination: { x: 0, y: 0 } }] }, 'right', () => 0, ['####'])
  assert.equal(chasing.enemies[0]!.x, 3); assert.equal(chasing.enemies[0]!.facing, 3)
  const second = advanceTurn(chasing, 'right', () => 0, ['####'])
  assert.equal(second.enemies[0]!.x, 2)
})
test('both collision phases end game, player collision prevents enemy action', () => {
  const a = advanceTurn(fixture(character({ x: 0, y: 0, facing: 1 }), enemy(1, 0)), 'up', () => 0, ['##'])
  assert.ok(a.gameOver); assert.equal(a.enemies[0]!.facing, 1); assert.equal(a.logs.at(-1), 'gameOver')
  const b = advanceTurn(fixture(character({ x: 0, y: 0, facing: 0 }), enemy(1, 0, 3)), 'right', () => 0, ['##'])
  assert.ok(b.gameOver); assert.equal(b.enemies[0]!.x, 0)
  assert.equal(b.logs.at(-1), 'gameOver')
  assert.deepEqual(a.logs, ['ready', 'gameOver'])
})
test('sight log wins over simultaneous movement sound, repeated detection logs are retained', () => {
  const state = fixture(character({ x: 0, y: 0, facing: 0 }), enemy(3, 0, 3))
  const next = advanceTurn(state, 'right', () => 0, ['####'])
  assert.equal(next.logs.at(-1)?.['kind'], 'sight')
  assert.equal(next.logs.filter(e => typeof e !== 'string').length, 1)
  assert.equal(translateLog(next.logs.at(-1)!, 'ja'), 'すぐ近くに敵がいる。敵は西を向いている。')
  assert.match(translateLog(next.logs.at(-1)!, 'en'), /very close.*west/)
  const stationary = fixture(character({ x: 0, y: 0, facing: 0 }), enemy(3, 0, 1))
  const first = advanceTurn(stationary, 'right', () => .25, ['####'])
  const second = advanceTurn(first, 'up', () => .25, ['####'])
  assert.equal(second.logs.filter(e => typeof e !== 'string').length, 2)
})
test('hearing logs translate relative direction and distance without enemy facing', () => {
  const event = { kind: 'hearing', position: { x: 1, y: 2 }, direction: 'backLeft', distance: 2 } as const
  assert.equal(translateLog(event, 'ja'), '左斜め後ろの方、遠くで敵の音が聞こえる。')
  assert.equal(translateLog(event, 'en'), 'You hear an enemy behind to the left, far away.')
  assert.equal(translateLog({ ...event, direction: 'right', distance: 1 }, 'ja'), '右の方、近くで敵の音が聞こえる。')
  assert.equal(translateLog('gameOver', 'en'), 'Caught by the enemy. GAME OVER')
})
test('no detection adds no enemy log; doors block AI but not hearing', () => {
  const door = [{ from: { x: 1, y: 0 }, to: { x: 2, y: 0 } }]
  const e = { ...enemy(0, 0, 1), destination: { x: 2, y: 0 } }
  const p = character({ x: 2, y: 0, facing: 3 })
  const heard = enemyTurn(['###'], e, p, { sourceId: 'p', position: { x: 2, y: 0 } }, () => 0, door)
  assert.equal(heard.enemy.destination, null); assert.equal(heard.enemy.x, 0)
  const state = fixture(character({ x: 0, y: 0, facing: 1 }), enemy(3, 0, 1))
  const next = advanceTurn(state, 'down', () => .25, ['####'])
  assert.equal(next.logs.filter(e => typeof e !== 'string').length, 0)
  assert.deepEqual(next.logs, ['ready'])
})
test('all sight distances and compass directions survive language changes', () => {
  for (const facing of [0, 1, 2, 3] as const) for (let distance = 1; distance <= 5; distance++) {
    const event = { kind: 'sight', position: { x: 0, y: 0 }, facing, distance } as const
    assert.ok(translateLog(event, 'ja').includes(['北', '東', '南', '西'][facing]!))
    assert.ok(translateLog(event, 'en').includes(['north', 'east', 'south', 'west'][facing]!))
    assert.ok(translateLog(event, 'ja').startsWith(['', '目の前', 'すぐ近く', '近く', '遠く', 'すごく遠く'][distance]!))
    assert.equal(event.distance, distance)
  }
})
