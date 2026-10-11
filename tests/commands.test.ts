import { test } from 'node:test'
import assert from 'node:assert/strict'
import { menuOptions, pendingCommand, commandText } from '../src/commands.ts'
test('six stable slots with back and close at bottom left', () => {
  for (const state of ['normal', 'movement', 'inspection', 'inventory', 'confirmation', 'map'] as const) assert.equal(menuOptions(state, true, false).length, 6)
  for (const state of ['movement', 'inspection', 'inventory'] as const) assert.equal(menuOptions(state, false, false)[4]?.id, 'back')
  assert.equal(menuOptions('map', false, true)[4]?.id, 'close')
  assert.deepEqual(menuOptions('inspection', false, false).filter(Boolean).map(o => o?.id), ['back'])
  assert.deepEqual(menuOptions('confirmation', true, false).filter(Boolean).map(o => o?.id), ['yes', 'no'])
})
test('pending paths and translated structured command history', () => {
  assert.equal(commandText(pendingCommand('normal'), 'ja'), '>')
  assert.equal(commandText(pendingCommand('movement'), 'ja'), '> 移動')
  assert.equal(commandText(['move', 'forward'], 'ja'), '> 移動 前進')
  assert.equal(commandText(['move', 'turnLeft'], 'en'), '> Move Turn left')
  assert.equal(commandText(['items', 'itemMap', 'mapUp'], 'en'), '> Items Map Up')
  assert.equal(commandText(['yes'], 'ja'), '> はい')
  assert.deepEqual(pendingCommand('confirmation'), [])
  assert.deepEqual(pendingCommand('map'), [])
})
test('game over disables game operations but preserves inventory and map', () => {
  assert.deepEqual(menuOptions('normal', true, true).filter(o => o && !o.disabled).map(o => o?.id), ['items'])
  assert.ok(menuOptions('movement', true, true).slice(0, 4).every(o => o?.disabled))
  assert.ok(menuOptions('map', true, true).filter(Boolean).every(o => !o?.disabled))
})
