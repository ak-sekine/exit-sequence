import test from 'node:test'
import assert from 'node:assert/strict'
import { Game, narrative } from '../src/game.ts'
import { scenes } from '../src/scenario.ts'
import { expert } from './routes.ts'
import type { Language } from '../src/i18n.ts'

// Concept checks allow wording changes without pinning whole sentences.
const premises: Record<Language, RegExp[]> = {
  ja: [/月面/, /基地/, /居住区/, /損傷|破損/, /生命維持/, /留ま.*危険/, /返事.*ない|応答.*ない/, /確認できる生存者.*一人/, /生死.*確認できません/, /地球.*帰還船/, /別区画.*ドック/, /設備.*停止/, /復旧/, /ロボット/, /認識系.*異常/, /拘束/, /アーム.*負傷/, /まず.*非常隔壁.*開け/],
  en: [/Moon/i, /base/i, /living quarters/i, /damaged/i, /life support/i, /staying.*dangerous/i, /no one answers|no reply/i, /only survivor.*currently confirm/i, /cannot confirm.*whether they are alive/i, /return ship.*Earth/i, /dock.*another section/i, /equipment.*stopped/i, /restore/i, /robots?/i, /recognition.*malfunction/i, /restrain/i, /arms.*injure/i, /first.*open.*bulkhead/i],
}
const areas: Record<Language, Record<'door' | 'valve' | 'power', RegExp[]>> = {
  ja: {
    door: [/居住区.*出口/, /非常隔壁/, /環境制御通路/, /帰還船ドック/, /扉.*開かず.*出られない/],
    valve: [/環境制御通路/, /帰還船ドック/, /入口.*空気不足.*開かない/, /バルブ.*開け.*空気.*送る/],
    power: [/帰還船ドック.*着いた/, /目の前.*船/, /地球.*戻る/, /空気.*満たせば.*乗り込める/, /電源.*最後.*障害/],
  },
  en: {
    door: [/living quarters.*exit/i, /emergency bulkhead/i, /environmental control passage/i, /return ship dock/i, /stuck door.*keeps me here/i],
    valve: [/environmental control passage/i, /return ship dock/i, /entrance.*not open.*too little air/i, /open.*valve.*send air.*dock/i],
    power: [/reach.*return ship dock/i, /ship.*stands before me/i, /back to Earth/i, /cabin.*air.*board/i, /power supply.*last obstacle/i],
  },
}
for (const language of ['ja', 'en'] as const) {
  test(`${language}: opening states the setting, escape goal and robot danger before any choice`, () => {
    const prose = narrative(new Game().state, language).join('\n')
    for (const concept of premises[language]) assert.match(prose, concept)
    assert.equal(scenes.wake.choices.length, 1)
  })
  test(`${language}: area entrances explain location, next goal, obstacle and reason`, () => {
    for (const id of ['door', 'valve', 'power'] as const) {
      const prose = scenes[id].narrative.map(line => line[language]).join('\n')
      for (const concept of areas[language][id]) assert.match(prose, concept)
    }
  })
  test(`${language}: solved problems move toward escape; ending leaves other people and cause unknown`, () => {
    const g = new Game(), results = new Map<string, string>()
    for (const id of expert) results.set(id, g.choose(id)!.result[language])
    const patterns = language === 'ja'
      ? { 'door-open': /居住区.*出て.*環境制御通路/, 'valve-turn': /ドック.*送気.*通行可能/, 'to-power': /通路.*ドック入口.*足音/, leave: /帰還船.*乗り込.*扉.*閉め/ }
      : { 'door-open': /leave.*living quarters.*enter.*passage/i, 'valve-turn': /air reaches the dock.*access ready/i, 'to-power': /passage.*dock entrance.*footsteps/i, leave: /board.*return ship.*close.*hatch/i }
    for (const [id, pattern] of Object.entries(patterns)) assert.match(results.get(id)!, pattern)
    const ending = narrative(g.state, language).join('\n')
    for (const concept of language === 'ja'
      ? [/帰還船.*月面基地.*離れる/, /脱出できた/, /ロボット.*届かない/, /あなた以外.*確認できません/, /生死.*原因.*不明/]
      : [/return ship.*away from the Moon base/i, /made it out/i, /robots.*cannot reach/i, /no human response.*apart from you/i, /fate.*cause.*unknown/i]) assert.match(ending, concept)
  })
}
test('story additions retain 15 scenes and 30 choice definitions', () => {
  assert.equal(Object.keys(scenes).length, 15)
  assert.equal(Object.values(scenes).flatMap(scene => scene.choices).length, 30)
})
