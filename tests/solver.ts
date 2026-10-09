import { createState, step } from '../src/game.ts'
import { directions } from '../src/model.ts'
import type { Direction, GameState } from '../src/model.ts'

export function stateKey(state: GameState): string {
  // Boxes are interchangeable. Turns, messages, and undo history do not affect rules.
  return `${state.status}:${state.clearBy ?? ''}:${state.entities.map(e => `${e.kind[0]}${e.x},${e.y}`).sort().join(';')}`
}
interface Node { state: GameState; parent: number; input: Direction | null }
export interface Witness { route: Direction[]; state: GameState }
export interface Exploration {
  visited: number
  clearEndpoints: number
  witnesses: Partial<Record<'robotRemoved' | 'robotAlive' | 'robotPush' | 'clear' | 'fail', Witness>>
}
export function explore(stageIndex: number): Exploration {
  const nodes: Node[] = [{ state: createState(stageIndex), parent: -1, input: null }]
  const visited = new Set([stateKey(nodes[0]!.state)])
  const witnesses: Exploration['witnesses'] = {}
  let clearEndpoints = 0
  function witness(index: number): Witness {
    const route: Direction[] = []
    let cursor = index
    while (nodes[cursor]!.parent >= 0) { route.push(nodes[cursor]!.input!); cursor = nodes[cursor]!.parent }
    return { route: route.reverse(), state: nodes[index]!.state }
  }
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index]!
    if (nodes.length > 600_000) throw new Error('Exploration exceeded safety bound; not a complete search')
    if (node.state.status === 'fail') { witnesses.fail ??= witness(index); continue }
    if (node.state.status !== 'playing') {
      clearEndpoints++
      witnesses.clear ??= witness(index)
      if (stageIndex > 0) {
        const category = node.state.entities.some(e => e.kind === 'robot') ? 'robotAlive' : 'robotRemoved'
        if (category === 'robotRemoved' || node.state.clearBy === 'player') witnesses[category] ??= witness(index)
        if (node.state.clearBy === 'robot') witnesses.robotPush ??= witness(index)
      }
      continue
    }
    for (const input of directions) {
      const state = step(node.state, input)
      if (state === node.state) continue
      const key = stateKey(state)
      if (visited.has(key)) continue
      visited.add(key)
      nodes.push({ state, parent: index, input })
    }
  }
  return { visited: visited.size, clearEndpoints, witnesses }
}
