import { t, mapNames, roomName, roomDescriptions, facilityNames } from './i18n.ts'
import type { Language, FacilityId } from './i18n.ts'
export const rooms = ['居住', '医療', '観測', '倉庫', '管制', '電力管理', '研究', '整備', '発着'] as const
export type Room = typeof rooms[number]
// Prototype placements only; keep internal facilities grouped by their district.
export const facilityIds: Readonly<Record<Room, readonly FacilityId[]>> = {
  居住: ["quarters","cafeteria","lounge"],
  医療: ["clinic","pharmacy"],
  観測: ["observationRoom","equipmentRoom"],
  倉庫: ["supplyStorage","foodStorage"],
  管制: ["controlRoom","communications"],
  電力管理: ["distributionRoom","powerSystems"],
  研究: ["laboratory","storageRoom"],
  整備: ["workshop","toolStorage"],
  発着: ["hangar","launchControl"],
}
// Compatibility view; display text is owned by i18n, not facility identity.
export const facilities = Object.fromEntries(rooms.map(room => [room, facilityIds[room].map(id => facilityNames('ja')[id])])) as Record<Room, string[]>
export function facilityGuideLines(language: Language = 'ja'): string[] {
  const names = facilityNames(language)
  return [t('facilityGuide', language), ...rooms.map(room =>
    language === 'ja'
      ? mapNames[room].ja + '：' + facilityIds[room].map(id => names[id]).join('、')
      : roomName(room, language) + ': ' + facilityIds[room].map(id => names[id]).join(', '))]
}
export type Passage = 'NORMAL' | 'DARK' | 'BLOCKED' | 'CLOSED'
export const edges: readonly (readonly [Room, Room])[] = [
  ['居住', '医療'], ['医療', '観測'],
  ['倉庫', '管制'], ['管制', '電力管理'],
  ['研究', '整備'], ['整備', '発着'],
  ['居住', '倉庫'], ['倉庫', '研究'],
  ['医療', '管制'], ['管制', '整備'],
  ['観測', '電力管理'], ['電力管理', '発着'],
]
// Reserve one ASCII column for the marker so vertical connections stay aligned.
export function baseMapLines(location: Room, language: Language = 'ja'): string[] {
  const cell = (room: Room) => '[' + (room === location ? '*' : ' ') + mapNames[room][language] + ']'
  const row = (offset: number) => rooms.slice(offset, offset + 3).map(cell).join('─')
  const vertical = language === 'ja' ? ' 　│   　　│   　　│' : '   │      │      │'
  return [t('baseMapYou', language), row(0), vertical, row(3), vertical, row(6)]
}
export const edgeKey = (a: Room, b: Room) => [a, b].sort().join(':')
export const neighbors = (room: Room): Room[] => edges.flatMap(([a, b]) => a === room ? [b] : b === room ? [a] : [])
export const costs: Record<Passage, number> = { NORMAL: 1, DARK: 2, BLOCKED: 3, CLOSED: Infinity }
export const descriptions: Record<Room, string> = roomDescriptions('ja')
