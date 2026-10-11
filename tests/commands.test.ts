import { test } from 'node:test'
import assert from 'node:assert/strict'
import { menuOptions, pendingCommand, commandText, canGoBack, optionPage } from '../src/commands.ts'
test('six stable slots exclude back and retain map close', () => {
  for (const state of ['normal', 'movement', 'inspection', 'inventory', 'confirmation', 'map'] as const) assert.equal(optionPage(menuOptions(state, true, false), 0).slots.length, 6)
  for (const state of ['movement', 'inspection', 'inventory'] as const) { assert.ok(canGoBack(state)); assert.ok(menuOptions(state, false, false).every(o => o?.id !== 'back')) }
  assert.equal(menuOptions('map', false, true)[4]?.id, 'close')
  assert.deepEqual(menuOptions('inspection', false, false).filter(Boolean).map(o => o?.id), [])
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

test('paging slices six options, pads last page and clamps boundaries without mutation', () => {
  const options = Array.from({ length: 13 }, (_, i) => ({ id: (i % 2 ? 'forward' : 'turnLeft') as 'forward' | 'turnLeft' }))
  const original = structuredClone(options)
  assert.deepEqual(optionPage(options, 0).slots, options.slice(0, 6))
  assert.deepEqual(optionPage(options, 1).slots, options.slice(6, 12))
  assert.equal(optionPage(options, 1).totalPages, 3)
  assert.deepEqual(optionPage(options, 9).slots, [options[12], null, null, null, null, null])
  assert.equal(optionPage(options, -1).page, 0)
  assert.equal(optionPage([], 0).totalPages, 1)
  assert.deepEqual(options, original)
  for (const menu of ['normal', 'confirmation', 'map'] as const) assert.equal(canGoBack(menu), false)
})
