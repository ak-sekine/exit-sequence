import { t } from './i18n.ts'
import type { Language } from './i18n.ts'
import type { LogEvent } from './game.ts'
export type MenuState = 'normal' | 'movement' | 'inspection' | 'inventory' | 'confirmation' | 'map'
export type CommandId = 'move' | 'inspect' | 'items' | 'forward' | 'turnBack' | 'turnLeft' | 'turnRight' | 'door' | 'itemMap' | 'back' | 'mapUp' | 'mapDown' | 'mapLeft' | 'mapRight' | 'close' | 'yes' | 'no'
export type HistoryEntry = { kind: 'command'; ids: readonly CommandId[] } | { kind: 'event'; event: LogEvent } | { kind: 'message'; message: 'doorConfirmation' }
type Option = { id: CommandId; parent?: boolean; disabled?: boolean }
export function menuOptions(menu: MenuState, door: boolean, gameOver: boolean): (Option | null)[] {
  const option = (id: CommandId, disabled = false): Option => ({ id, disabled })
  switch (menu) {
    case 'normal': return [{ id: 'move', parent: true, disabled: gameOver }, { id: 'inspect', parent: true, disabled: gameOver }, { id: 'items', parent: true }, null, null, null]
    case 'movement': return [option('forward', gameOver), option('turnBack', gameOver), option('turnLeft', gameOver), option('turnRight', gameOver), option('back'), null]
    case 'inspection': return [door ? option('door', gameOver) : null, null, null, null, option('back'), null]
    case 'inventory': return [option('itemMap'), null, null, null, option('back'), null]
    case 'confirmation': return [option('yes', gameOver), option('no'), null, null, null, null]
    case 'map': return [option('mapUp'), option('mapDown'), option('mapLeft'), option('mapRight'), option('close'), null]
  }
}
export function pendingCommand(menu: MenuState): readonly CommandId[] {
  return menu === 'movement' ? ['move'] : menu === 'inspection' ? ['inspect'] : menu === 'inventory' ? ['items'] : []
}
export function commandText(ids: readonly CommandId[], language: Language): string {
  return '>' + (ids.length ? ' ' + ids.map(id => t(id, language)).join(' ') : '')
}
