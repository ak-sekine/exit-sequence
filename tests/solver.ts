import { createState, push, robotTurn, step, terrainAt } from '../src/game.ts'
import { directions } from '../src/model.ts'
import type { Direction, GameState } from '../src/model.ts'
import type { PushResult } from '../src/game.ts'

export const events = ['PLAYER_PUSH_BOX', 'PLAYER_PUSH_ROBOT', 'ROBOT_PUSH_BOX', 'ROBOT_PUSH_PLAYER', 'BOX_DROPPED_IN_HOLE', 'ROBOT_DROPPED_IN_HOLE', 'CHAIN_PUSH', 'PLAYER_PUSHED_TO_GOAL'] as const
export const bit = (name: typeof events[number]) => 1 << events.indexOf(name)
export const signature = (mask: number) => events.filter(name => mask & bit(name))
export const robotInteraction = bit('PLAYER_PUSH_ROBOT') | bit('ROBOT_PUSH_BOX') | bit('ROBOT_PUSH_PLAYER') | bit('ROBOT_DROPPED_IN_HOLE')
export const pushes = bit('PLAYER_PUSH_BOX') | bit('PLAYER_PUSH_ROBOT') | bit('ROBOT_PUSH_BOX') | bit('ROBOT_PUSH_PLAYER')
export function stateKey(state: GameState): string {
  return `${state.status}:${state.clearBy ?? ''}:${state.entities.map(e => `${e.kind[0]}${e.x},${e.y}`).sort().join(';')}`
}
// Observe both general push phases, including events hidden by the final UI message.
export function transitionEvents(state: GameState, input: Direction): number {
  let mask = 0
  function observe(before: GameState, result: PushResult, actor: 'PLAYER' | 'ROBOT') {
    for (const id of result.moved.slice(1)) {
      const kind = before.entities.find(e => e.id === id)!.kind
      if (kind === 'box') mask |= bit(actor === 'PLAYER' ? 'PLAYER_PUSH_BOX' : 'ROBOT_PUSH_BOX')
      if (kind === 'robot' && actor === 'PLAYER') mask |= bit('PLAYER_PUSH_ROBOT')
      if (kind === 'player' && actor === 'ROBOT') mask |= bit('ROBOT_PUSH_PLAYER')
    }
    if (result.moved.length >= 3) mask |= bit('CHAIN_PUSH')
    if (result.fallen.includes('box')) mask |= bit('BOX_DROPPED_IN_HOLE')
    if (result.fallen.includes('robot')) mask |= bit('ROBOT_DROPPED_IN_HOLE')
    const player = result.state.entities.find(e => e.kind === 'player')
    if (actor === 'ROBOT' && player && terrainAt(result.state, player) === 'goal') mask |= bit('PLAYER_PUSHED_TO_GOAL')
  }
  const player = state.entities.find(e => e.kind === 'player')
  const result = player && push(state, player.id, input)
  if (!result) return 0
  observe(state, result, 'PLAYER')
  const after = result.state, remaining = after.entities.find(e => e.kind === 'player')
  if (remaining && terrainAt(after, remaining) !== 'goal') {
    const robot = robotTurn(after)
    if (robot) observe(after, robot, 'ROBOT')
  }
  return mask
}
interface Edge { to: number; input: Direction; mask: number }
export interface Witness { route: Direction[]; state: GameState; signature: readonly string[] }
export function explore(stageIndex: number) {
  const states = [createState(stageIndex)], graph: Edge[][] = [], ids = new Map([[stateKey(states[0]!), 0]])
  for (let i = 0; i < states.length; i++) {
    if (states.length > 600_000) throw new Error('Incomplete search: state bound exceeded')
    const state = states[i]!, edges: Edge[] = []; graph.push(edges)
    if (state.status !== 'playing') continue
    for (const input of directions) {
      const next = step(state, input)
      if (next === state) continue
      const key = stateKey(next)
      let to = ids.get(key)
      if (to === undefined) { to = states.length; ids.set(key, to); states.push(next) }
      edges.push({ to, input, mask: transitionEvents(state, input) })
    }
  }
  const isClear = (i: number) => ['clear', 'all-clear'].includes(states[i]!.status)
  // Exhaustive forbidden-event subgraphs prove universal requirements, even with cycles.
  function clearsWithout(forbidden: number) {
    const seen = new Set([0]), queue = [0]
    for (const i of queue) for (const edge of graph[i]!) {
      if (edge.mask & forbidden || seen.has(edge.to)) continue
      seen.add(edge.to); queue.push(edge.to)
    }
    return queue.filter(isClear).length
  }
  // Product graph retains history classification separately from board deduplication.
  const nodes = [{ id: 0, mask: 0, parent: -1, input: null as Direction | null }]
  const seen = new Set(['0:0'])
  const witnesses: Partial<Record<'clear' | 'fail' | 'boxKept' | 'boxDropped' | 'robotRemoved' | 'robotAlive' | 'robotPush', Witness>> = {}
  function witness(index: number): Witness | undefined {
    const route: Direction[] = [], boards = new Set<number>(); let cursor = index
    while (cursor >= 0) {
      const n = nodes[cursor]!
      if (boards.has(n.id)) return undefined // No detour-created strategy witnesses.
      boards.add(n.id)
      if (n.input) route.push(n.input)
      cursor = n.parent
    }
    const node = nodes[index]!
    return { route: route.reverse(), state: states[node.id]!, signature: signature(node.mask) }
  }
  let unpreparedRobotGoal = 0
  for (let i = 0; i < nodes.length; i++) {
    if (nodes.length > 2_000_000) throw new Error('Incomplete signature search: bound exceeded')
    const n = nodes[i]!, state = states[n.id]!
    if (state.status !== 'playing') {
      if (isClear(n.id) && state.clearBy === 'robot' && !(n.mask & (bit('PLAYER_PUSH_BOX') | bit('PLAYER_PUSH_ROBOT')))) unpreparedRobotGoal++
      const w = witness(i)
      if (!w) continue
      if (state.status === 'fail') { witnesses.fail ??= w; continue }
      witnesses.clear ??= w
      if (stageIndex === 0) witnesses[n.mask & bit('BOX_DROPPED_IN_HOLE') ? 'boxDropped' : 'boxKept'] ??= w
      else if (n.mask & robotInteraction) {
        if (!state.entities.some(e => e.kind === 'robot')) witnesses.robotRemoved ??= w
        else if (state.clearBy === 'player' && n.mask & pushes) witnesses.robotAlive ??= w
        if (state.clearBy === 'robot') witnesses.robotPush ??= w
      }
      continue
    }
    for (const edge of graph[n.id]!) {
      const mask = n.mask | edge.mask, key = `${edge.to}:${mask}`
      if (seen.has(key)) continue
      seen.add(key); nodes.push({ id: edge.to, mask, parent: i, input: edge.input })
    }
  }
  return { robotClearEndpoints: states.filter(s => s.clearBy === 'robot').length, visited: states.length, classified: nodes.length, walkOnlyClears: clearsWithout(255), noBoxPushClears: clearsWithout(bit('PLAYER_PUSH_BOX')), noRobotInteractionClears: clearsWithout(robotInteraction), noPushClears: clearsWithout(pushes), unpreparedRobotGoal, witnesses }
}
