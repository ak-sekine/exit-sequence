import test from 'node:test'
import assert from 'node:assert/strict'
import { character } from '../src/character.ts'
import { createGame, rotatePlayer, stepGame } from '../src/game.ts'
import { renderMap } from '../src/automap.ts'
import { cellAt, cellKey, DOORS } from '../src/dungeon.ts'

test('sight and hearing markers are current detections, while visited cells persist', () => {
  const map = ['       ', ' ##### ', ' ##### ', '       ']
  const player = character({ x: 2.5, y: 1.5, heading: Math.PI / 2 })
  const enemy = { ...character({ x: 4.5, y: 1.5, heading: Math.PI * 1.5 }), id: 'visible', destination: null, route: [], alerted: false }
  let state = createGame({ player, enemies: [enemy], doors: [] })
  state = stepGame(state, { forward: 0, strafe: 0 }, 0.05, map, [])
  assert.equal(state.detections[0]?.kind, 'sight')
  assert.equal(state.visited.has(cellKey(cellAt(player))), true)
  const svg = renderMap(map, state.player, state.visited, [], [], state.detections)
  assert.match(svg, /data-map-enemy="visible" data-detection="sight"/)
  assert.match(svg, /data-map-player="true"/)

  state = rotatePlayer(state, Math.PI)
  state = stepGame(state, { forward: 0, strafe: 0 }, 0.05, map, [])
  assert.deepEqual(state.detections, [])
  const lost = renderMap(map, state.player, state.visited, [], [], state.detections)
  assert.doesNotMatch(lost, /data-map-enemy=/)
  assert.equal(state.visited.has('2,1'), true)
})

test('map detection markers do not reveal hidden cells and continuous heading is preserved', () => {
  const visited = new Set(['2,14', '2,13'])
  const player = { x: 2.6, y: 13.4, heading: 5.7 }
  const hearing = { enemyId: 'echo', kind: 'hearing', position: { x: 12.5, y: 11.5 }, direction: 'right', distance: 3 } as const
  const svg = renderMap(['#####'], { x: 2.5, y: 0.5, heading: 1.1 }, new Set(['2,0']), [], [], [hearing])
  assert.match(svg, /data-map-enemy="echo" data-detection="hearing"/)
  assert.match(svg, /<circle data-map-enemy="echo"[^>]*r="6"/)
  assert.doesNotMatch(svg, /data-map-cell="12,11"/)
  const explored = renderMap(['#####'], { x: 2.5, y: 0.5, heading: 1.1 }, new Set(['2,0']))
  assert.match(explored, /rotate\(63\.025357/)
  assert.equal(DOORS.length, 6)
})
