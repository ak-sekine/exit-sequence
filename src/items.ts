import type { Room } from './map.ts'
export type ItemId = 'map' | 'parts' | 'key' | 'power' | 'food' | 'battery' | 'predictor' | 'short-decoy' | 'long-decoy' | 'remote-decoy' | 'local-key' | 'remote-key' | 'override' | 'controller' | 'sensor'
export type Facility = 'camera' | 'alarm' | 'bulkhead' | 'charger' | 'ship'
export type ItemKind = 'portable' | 'deployable'
export type ItemSpec = { kind: ItemKind; effect: 'map' | 'escape' | 'battery' | 'predict' | 'lure' | 'bulkhead' | 'sensor'; cost: number; range: number; duration: number; consumable: boolean }
// All balance values and placements are prototype values, not release specifications.
export const itemSpecs: Record<ItemId, ItemSpec> = {
  map: { kind: 'portable', effect: 'map', cost: 0, range: 0, duration: 0, consumable: false },
  parts: { kind: 'portable', effect: 'escape', cost: 0, range: 0, duration: 0, consumable: false },
  key: { kind: 'portable', effect: 'escape', cost: 0, range: 0, duration: 0, consumable: false },
  power: { kind: 'portable', effect: 'escape', cost: 0, range: 0, duration: 0, consumable: false },
  food: { kind: 'portable', effect: 'escape', cost: 0, range: 0, duration: 0, consumable: false },
  battery: { kind: 'portable', effect: 'battery', cost: 0, range: 0, duration: 0, consumable: true },
  predictor: { kind: 'portable', effect: 'predict', cost: 1, range: 6, duration: 1, consumable: false },
  'short-decoy': { kind: 'portable', effect: 'lure', cost: 1, range: 2, duration: 2, consumable: true },
  'long-decoy': { kind: 'portable', effect: 'lure', cost: 4, range: 6, duration: 4, consumable: true },
  'remote-decoy': { kind: 'deployable', effect: 'lure', cost: 2, range: 6, duration: 5, consumable: false },
  'local-key': { kind: 'portable', effect: 'bulkhead', cost: 1, range: 1, duration: 3, consumable: false },
  'remote-key': { kind: 'portable', effect: 'bulkhead', cost: 4, range: 6, duration: 3, consumable: false },
  override: { kind: 'portable', effect: 'bulkhead', cost: 0, range: 6, duration: 3, consumable: true },
  controller: { kind: 'deployable', effect: 'bulkhead', cost: 1, range: 6, duration: 3, consumable: false },
  sensor: { kind: 'deployable', effect: 'sensor', cost: 1, range: 1, duration: 1, consumable: false },
}
export const escapeItems = ['parts', 'key', 'power', 'food'] as const satisfies readonly ItemId[]
export const placements: Partial<Record<Room, readonly ItemId[]>> = {
  医療: ['map', 'battery'], 観測: ['remote-decoy'], 倉庫: ['food'], 管制: ['key', 'long-decoy'],
  電力管理: ['remote-key'], 蓄電: ['power', 'battery'], 研究: ['parts'], 整備: ['override'],
  計測: ['sensor'], 隔壁: ['controller'], 資材: ['short-decoy'],
}
export const facilities: Partial<Record<Room, readonly Facility[]>> = {
  観測: ['camera'], 管制: ['camera', 'alarm'], 電力管理: ['charger'], 隔壁: ['bulkhead'], 発着: ['ship'],
}
export type Installation = { id: number; item: 'remote-decoy' | 'controller' | 'sensor'; room: Room; edge?: string }
