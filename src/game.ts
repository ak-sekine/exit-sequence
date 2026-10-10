import { character } from './character.ts'
import type { Character } from './character.ts'
import { DUNGEON_MAP, INITIAL_PLAYER, move, passDoor } from './dungeon.ts'
import type { Direction, Door, DungeonMap } from './dungeon.ts'
import { enemyTurn, INITIAL_ENEMY } from './enemy.ts'
import type { Enemy } from './enemy.ts'
import { hear, movementSound, see } from './senses.ts'
import type { Detection, EnemyDetection } from './senses.ts'
import type { Message } from './i18n.ts'
import { sameCell } from './pathfinding.ts'
export type LogEvent = Message | Detection
export type GameState = Readonly<{ player: Character; enemies: readonly Enemy[]; detections: readonly EnemyDetection[]; turn: number; gameOver: boolean; logs: readonly LogEvent[] }>
export const createGame = (): GameState => ({ player: character(INITIAL_PLAYER), enemies: [INITIAL_ENEMY], detections: [], turn: 0, gameOver: false, logs: ['ready'] })
export function advanceTurn(state: GameState, action: Direction | 'a', random: () => number = Math.random, map: DungeonMap = DUNGEON_MAP, doors?: readonly Door[]): GameState {
  if (state.gameOver) return state
  const result = action === 'a' ? passDoor(map, state.player, doors) : move(map, state.player, action, doors)
  if (!result) return state
  const player = { ...state.player, ...result.player }, logs: LogEvent[] = [...state.logs]
  // Only warnings and door events enter history; ordinary actions still run the full turn.
  if (result.message === 'blocked' || result.message === 'enteredRoom' || result.message === 'returnedCorridor') logs.push(result.message)
  let next: GameState = { ...state, player, turn: state.turn + 1, logs, detections: [] }
  const caught = (enemies: readonly Enemy[]) => enemies.some(enemy => sameCell(player, enemy))
  if (caught(state.enemies)) return { ...next, gameOver: true, logs: [...logs, 'gameOver'] }
  const sound = movementSound('player', state.player, player)
  const enemies: Enemy[] = [], sounds = []
  for (const enemy of state.enemies) {
    const result = enemyTurn(map, enemy, player, sound, random, doors)
    enemies.push(result.enemy); sounds.push(result.sound)
    if (sameCell(player, result.enemy)) {
      // Stop immediately; later enemies retain their previous states.
      enemies.push(...state.enemies.slice(enemies.length))
      next = { ...next, gameOver: true }; break
    }
  }
  const detections: EnemyDetection[] = []
  for (let i = 0; i < enemies.length; i++) {
    const detection = see(map, player, enemies[i]!, doors) ?? hear(player, sounds[i] ?? null)
    if (detection) {
      logs.push(detection)
      detections.push({ ...detection, enemyId: enemies[i]!.id })
    }
  }
  if (next.gameOver) logs.push('gameOver')
  return { ...next, enemies, logs, detections }
}
