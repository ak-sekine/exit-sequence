export const rooms = ['居住', '医療', '観測', '研究', '整備', '倉庫', '生命維持', '通信', '管制', '電力管理', '発着'] as const
export type Room = typeof rooms[number]
export type Passage = 'NORMAL' | 'DARK' | 'BLOCKED' | 'CLOSED'
export const edges: readonly (readonly [Room, Room])[] = [
  ['居住', '医療'], ['医療', '観測'], ['観測', '研究'], ['研究', '整備'], ['整備', '倉庫'], ['倉庫', '居住'],
  ['生命維持', '通信'], ['通信', '管制'], ['管制', '電力管理'], ['電力管理', '生命維持'],
  ['居住', '生命維持'], ['医療', '通信'], ['観測', '管制'], ['研究', '管制'], ['整備', '電力管理'], ['倉庫', '電力管理'],
  ['整備', '発着'], ['電力管理', '発着'],
]
export const edgeKey = (a: Room, b: Room) => [a, b].sort().join(':')
export const neighbors = (room: Room): Room[] => edges.flatMap(([a, b]) => a === room ? [b] : b === room ? [a] : [])
export const costs: Record<Passage, number> = { NORMAL: 1, DARK: 2, BLOCKED: 3, CLOSED: Infinity }
export const descriptions: Record<Room, string> = {
  居住: '非常灯が居室を照らしている。ここに留まる選択肢はない。',
  医療: '医療端末は停止中。予備バッテリーが残っている。',
  観測: '観測装置が無人の月面を記録し続けている。不要設備を停止できる。',
  研究: '研究室の保管箱に帰還船用の修理部品がある。',
  整備: '船体への遠隔整備設備が残っている。修理には研究区の部品が必要だ。',
  倉庫: '帰還用の食糧が保管されている。賞味期限は地球で確認しよう。',
  生命維持: '最低限の空気循環は維持されている。操作可能な設備はない。',
  通信: '地球との通信は途絶している。操作可能な設備はない。',
  管制: '発進管制の安全ロックを解除できる。',
  電力管理: '残存電力を帰還船へ配電できる。基地全体の復旧は不可能だ。',
  発着: '帰還船が待機している。帰還4条件を確認して発進しよう。',
}
