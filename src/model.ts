export type Terrain = 'floor' | 'wall' | 'hole' | 'goal'
export type EntityKind = 'player' | 'robot' | 'box'
export type Direction = 'up' | 'down' | 'left' | 'right'
export interface Position { x: number; y: number }
export interface Entity extends Position { id: string; kind: EntityKind }
export interface Level { terrain: Terrain[][]; entities: Entity[] }
export type Status = 'playing' | 'fail' | 'clear' | 'all-clear'
export type Message = 'ready' | 'moved' | 'blocked' | 'pushed' | 'box-fell' | 'robot-fell' | 'fail' | 'clear' | 'all-clear'
export interface GameState extends Level {
  stageIndex: number
  turns: number
  status: Status
  message: Message
  clearBy: 'player' | 'robot' | null
}
export const directions: readonly Direction[] = ['up', 'down', 'left', 'right']
export const vectors: Record<Direction, Position> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
}
