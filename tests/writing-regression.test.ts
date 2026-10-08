import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './ui-harness.ts'
import { t } from '../src/i18n.ts'

test('localized intro separates scene, AI mission, unknown locations, tools and numeric risk', () => {
  for (const language of ['ja', 'en'] as const) {
    const ui = fixture(true, { navigator: { language } }); ui.click(t('start', language))
    const lines = ui.lines().join('\n')
    assert.ok(lines.includes(t('introRequirements', language))); assert.ok(lines.includes(t('introTools', language)))
    assert.match(lines, /28 \/ 40/); assert.match(lines, /25%/)
    assert.ok(!/4つの帰還条件|Four return requirements/.test(lines))
    if (language === 'en') assert.ok(!/[\u3040-\u30ff\u3400-\u9fff]/u.test(lines))
  }
})

test('ja/en confirmation prose and decline cannot change gameplay or consume randomness', () => {
  for (const language of ['ja', 'en'] as const) {
    const ui = fixture(true, { navigator: { language } }); ui.click(t('start', language))
    ui.game.state.location = '電力管理'; ui.render('investigate')
    const before = structuredClone(ui.game.state)
    ;(ui.game as unknown as { random: () => number }).random = () => { throw Error('confirmation draws RNG') }
    ui.click(language === 'ja' ? '基地配置図' : 'LAYOUT MAP')
    assert.equal(ui.navigation.children[0]!.disabled, true)
    assert.ok(ui.lines().includes(t('collectQuestion', language)))
    ui.click(t('no', language)); assert.deepEqual(ui.game.state, before)
    assert.ok(ui.lines().includes(t('declined', language)))
  }
})
