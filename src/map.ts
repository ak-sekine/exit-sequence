import { t, mapNames, roomName } from './i18n.ts'
import type { Language } from './i18n.ts'
export const rooms = ['居住', '医療', '観測', '中継', '倉庫', '管制', '電力管理', '蓄電', '研究', '整備', '計測', '資材', '隔壁', '通信', '前室', '発着'] as const
export type Room = typeof rooms[number]
export type Knowledge = 'unexplored' | 'connected' | 'visited' | 'mapped'
export type Passage = 'NORMAL' | 'DARK' | 'BLOCKED' | 'CLOSED'
export const edges: readonly (readonly [Room, Room])[] = rooms.flatMap((room, index) => [
  ...(index % 4 < 3 ? [[room, rooms[index + 1]!] as const] : []),
  ...(index < 12 ? [[room, rooms[index + 4]!] as const] : []),
])
export const edgeKey = (a: Room, b: Room) => [a, b].sort().join(':')
export const neighbors = (room: Room): Room[] => edges.flatMap(([a, b]) => a === room ? [b] : b === room ? [a] : [])
export const coordinates = (room: Room) => ({ x: rooms.indexOf(room) % 4, y: Math.floor(rooms.indexOf(room) / 4) })
export const cellCode = (room: Room) => { const { x, y } = coordinates(room); return `${'ABCD'[x]}${y + 1}` }
export const distance = (a: Room, b: Room) => { const p = coordinates(a), q = coordinates(b); return Math.abs(p.x - q.x) + Math.abs(p.y - q.y) }
// At diagonal distance 2, vertical direction wins. No diagonal vocabulary required.
export function direction(a: Room, b: Room, language: Language) {
  const p = coordinates(a), q = coordinates(b)
  return t(q.y < p.y ? 'north' : q.y > p.y ? 'south' : q.x > p.x ? 'east' : 'west', language)
}
export const costs: Record<Passage, number> = { NORMAL: 1, DARK: 2, BLOCKED: Infinity, CLOSED: Infinity }
export const passable = (value: Passage) => value === 'NORMAL' || value === 'DARK'
export const named = (value: Knowledge) => value === 'visited' || value === 'mapped'
export function initialKnowledge(): Record<Room, Knowledge> {
  const result = Object.fromEntries(rooms.map(room => [room, 'unexplored'])) as Record<Room, Knowledge>
  result.居住 = 'visited'
  for (const room of neighbors('居住')) result[room] = 'connected'
  return result
}
export function knownRoom(room: Room, knowledge: Record<Room, Knowledge>, language: Language) {
  return named(knowledge[room]) ? roomName(room, language) : t('unknownRoom', language, cellCode(room))
}
// A compact grid uses one-character JA names / three-character EN names, at most 27 columns.
// Only learned static connections are drawn; this diagram never reads passage/robot/item state.
export function baseMapLines(location: Room, knowledge: Record<Room, Knowledge>, knownEdges: readonly string[], language: Language = 'ja'): string[] {
  const width = language === 'ja' ? 1 : 3
  const cell = (room: Room) => '[' + (room === location ? '*' : ' ') + (named(knowledge[room]) ? mapNames[room][language].slice(0, width) : '?'.padEnd(language === 'ja' ? 2 : width)) + ']'
  const lines = [t('baseMapYou', language)]
  for (let y = 0; y < 4; y++) {
    let row = ''
    for (let x = 0; x < 4; x++) {
      const room = rooms[y * 4 + x]!
      row += cell(room)
      if (x < 3) row += knownEdges.includes(edgeKey(room, rooms[y * 4 + x + 1]!)) ? '─' : ' '
    }
    lines.push(row)
    if (y < 3) lines.push(Array.from({ length: 4 }, (_, x) => {
      const room = rooms[y * 4 + x]!
      return (knownEdges.includes(edgeKey(room, rooms[(y + 1) * 4 + x]!)) ? '  │' : '   ') + (language === 'ja' ? '   ' : '    ')
    }).join('').trimEnd())
  }
  return lines
}
