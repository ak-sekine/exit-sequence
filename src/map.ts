export const rooms = ['居住', '医療', '観測', '倉庫', '管制', '電力管理', '研究', '整備', '発着'] as const
export type Room = typeof rooms[number]
// Prototype placements only; keep internal facilities grouped by their district.
export const facilities: Readonly<Record<Room, readonly string[]>> = {
  居住: ['居室', '食堂', '共用室'],
  医療: ['診療室', '薬品庫'],
  観測: ['観測室', '機器室'],
  倉庫: ['資材庫', '食糧庫'],
  管制: ['管制室', '通信室'],
  電力管理: ['配電室', '電源設備室'],
  研究: ['研究室', '保管室'],
  整備: ['整備室', '工具庫'],
  発着: ['格納庫', '発着管制室'],
}
export function facilityGuideLines(): string[] {
  return ['施設案内', ...rooms.map(room => `${room === '電力管理' ? '電力' : room}：${facilities[room].join('、')}`)]
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
export function baseMapLines(location: Room): string[] {
  const cell = (room: Room) => '[' + (room === location ? '*' : ' ') + (room === '電力管理' ? '電力' : room) + ']'
  const row = (offset: number) => rooms.slice(offset, offset + 3).map(cell).join('─')
  return ['基地マップ * = 現在地', row(0), ' 　│   　　│   　　│', row(3), ' 　│   　　│   　　│', row(6)]
}
export const edgeKey = (a: Room, b: Room) => [a, b].sort().join(':')
export const neighbors = (room: Room): Room[] => edges.flatMap(([a, b]) => a === room ? [b] : b === room ? [a] : [])
export const costs: Record<Passage, number> = { NORMAL: 1, DARK: 2, BLOCKED: 3, CLOSED: Infinity }
export const descriptions: Record<Room, string> = {
  居住: '生命維持設備と非常灯が居室を支えている。ここに留まる選択肢はない。',
  医療: '医療端末は停止中。予備バッテリーが残っている。',
  観測: '観測装置が無人の月面を記録し続けている。不要設備を停止できる。',
  研究: '研究室の保管箱に帰還船用の修理部品がある。',
  整備: '船体への遠隔整備設備が残っている。修理には研究区の部品が必要だ。',
  倉庫: '帰還用の食糧が保管されている。賞味期限は地球で確認しよう。',
  管制: '通信設備は沈黙している。発進管制の安全ロックを解除できる。',
  電力管理: '残存電力を帰還船へ配電できる。基地全体の復旧は不可能だ。',
  発着: '帰還船が待機している。帰還4条件を確認して発進しよう。',
}
