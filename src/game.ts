import { text as t } from './i18n.ts'
import type { Language, Text } from './i18n.ts'
import type { Choice, GameState, Stat, EnemyId, Intent } from './model.ts'
import { enemies, intents, locations, opening, areaProse, eventProse } from './scenario.ts'
import { equipment } from './items.ts'
export type { GameState } from './model.ts'
export function intent(state: GameState): Intent | null {
 const e = state.enemy; if (!e) return null
 const cycle = enemies[e.id].cycle; return cycle[e.turn % cycle.length]!
}
export function forecast(s: GameState): Text | null {
 const i = intent(s); if (!i) return null
 if (i === 'armor' && s.enemy!.exposed) return t('装甲を閉じられない · 体当たり 2', 'Armor cannot close · ram 2')
 return s.enemy!.id === 'boss' && i === 'heavy' ? t('アームを大きく振り上げた · 強攻撃 10', 'Arm raised high · heavy strike 10') : intents[i]
}
const c = (id: string, ja: string, en: string): Choice => ({ id, label: t(ja, en) })
export function availableChoices(s: GameState): Choice[] {
 if (s.status !== 'playing') return []
 if (s.scene === 'wake') return [c('begin', '自分の得意を思い出す', 'Recall my strengths')]
 if (s.scene === 'create' || s.scene === 'levelup') return (['BODY', 'TECH', 'SENSE'] as Stat[]).map(stat => c(stat, `${stat} +1`, `${stat} +1`))
 if (s.scene === 'explore') return [c('forward', '先へ進む', 'Move onward'), ...(!s.explored[s.location] ? [c('explore', ['医務室を探索する', '工具倉庫を探索する', '更衣室を探索する'][s.location]!, ['Search the infirmary', 'Search the tool store', 'Search the changing room'][s.location]!)] : [])]
 if (s.scene === 'event') return [c('BODY', 'BODY · 力で道を開く', 'BODY · Force a path'), c('TECH', 'TECH · 機械を操作する', 'TECH · Operate machinery'), c('SENSE', 'SENSE · 安全な隙間を探す', 'SENSE · Find a safe gap')]
 if (s.scene === 'warehouse') return (['wrench', 'terminal', 'visor'] as const).map(id => ({ id, label: equipment[id] }))
 if (s.scene === 'combat') return [c('attack', '攻撃 · BODY', 'Attack · BODY'), c('defend', '防御 · 強攻撃を軽減', 'Defend · Reduce heavy strikes'), c('tech', '技術 · TECH', 'Technology · TECH'), c('observe', '観察 · SENSE', 'Observe · SENSE'), c('items', 'アイテム', 'Items')]
 if (s.scene === 'victory') return [c('continue', '戦利品を持って進む', 'Take the salvage and continue')]
 if (s.scene === 'launch') return [c('launch', '帰還船で地球へ出発する', 'Launch toward Earth')]
 return []
}
export function narrative(s: GameState, lang: Language): string[] {
 let lines: Text[] = []
 switch (s.scene) {
 case 'wake': lines = opening; break
 case 'create': lines = [t(`得意な能力を2回選ぶ。残り ${s.points} ポイント。`, `Choose a strength twice. ${s.points} points left.`), t('BODY：攻撃と防御。TECH：機械への干渉。SENSE：観察と物資発見。', 'BODY: attack and defense. TECH: machine interference. SENSE: observation and finding supplies.')]; break
 case 'explore': lines = [areaProse[s.location]!]; break
 case 'event': lines = [eventProse[s.location]!, t('能力3以上なら無傷。2ならHP -1、1ならHP -2。それでも先へ進める。BODYはキット、TECHは回復、SENSEはバッテリーを得る。', 'Stat 3+: unharmed. Stat 2: HP -1; stat 1: HP -2. All paths advance. BODY finds a kit, TECH restores health, SENSE finds a battery.')]; break
 case 'combat': lines = [t('AI：行動予告を受信。通常攻撃はBODY +1。技術はTECHダメージ。連続干渉は遮断されます。', 'AI: Intent received. Attack deals BODY +1. Technology deals TECH damage. Consecutive interference is blocked.'), t('観察は次の攻撃・技術を強化。スキャン中なら照準も外す。防御はダメージを大幅軽減。技術は閉じた装甲を開き、スキャンを止めるが、振り上げたアームは止まらない。', 'Observation boosts the next attack or technology. During a scan it also spoils aim. Defense greatly reduces damage. Technology opens closed armor and interrupts scans, but cannot stop a raised arm.')]; break
 case 'victory': lines = [t('金属の足音が止まる。「今のは、私が勝ったってことでいいよね」\nAI：あなたはまだ立っています。十分な証拠です。', 'The metal footsteps stop. “That counts as winning, right?”\nAI: You are still standing. Strong evidence.')]; break
 case 'levelup': lines = [t(`LV${s.level}。最大HP +2、HP +4。能力を一つ伸ばす。`, `LV${s.level}. Max HP +2, HP +4. Improve one stat.`), t('AI：経験は役に立ちます。次も同じやり方で進む義務はありません。', 'AI: Experience helps. It does not oblige you to use the same approach next time.')]; break
 case 'warehouse': lines = [t('工具ラックが開いた。持てる武器／ツールは一つ。装備は自動で使われる。', 'The tool rack opens. Carry one weapon/tool. Its effect applies automatically.')]; break
 case 'launch': lines = [t('船の扉を閉める。座席に体を預けた。「帰ろう。今は、それだけでいい」', 'I close the ship’s hatch and sink into a seat. “Let’s go home. That is enough for now.”')]; break
 case 'clear': lines = [t('CLEAR\n帰還船が月面基地を離れる。ロボットも警報も届かない。自分の力で脱出できた。', 'CLEAR\nThe return ship lifts away from the Moon base. The robots and alarms cannot reach me. I made it out on my own feet.'), t('AI：他の人の生死と事故原因は、まだ不明です。\n地球へ向かう窓の外で、基地の灯が遠ざかる。', 'AI: The others’ fate and the accident’s cause remain unknown.\nThe base lights fade as we head toward Earth.')]; break
 case 'over': lines = [t('GAME OVER\n膝が折れた。ロボットのアームが迫る。\nAI：応答してください。……通信を維持します。', 'GAME OVER\nMy knees give way. A robot arm closes in.\nAI: Please respond. …I will keep the channel open.')]; break
 }
 if (s.scene === 'combat' && s.enemy!.turn > 0) lines = [t(`AI：敵はまだ動いています。${s.bonus ? `次の攻撃／技術 +${s.bonus}。` : '行動予告を更新。'}`, `AI: The enemy is still moving. ${s.bonus ? `Next attack/technology +${s.bonus}.` : 'Intent updated.'}`)]
 return [locations[s.location]![lang], ...lines.map(x => x[lang])]
}
export class Game {
 state!: GameState
 constructor() { this.restart() }
 restart() { this.itemMenu = false; this.state = { scene: 'wake', location: 0, level: 1, hp: 12, maxHp: 12, stats: { BODY: 1, TECH: 1, SENSE: 1 }, points: 2, equipment: { tool: null, vest: false }, items: { kit: 2, battery: 1 }, enemy: null, status: 'playing', explored: [false,false,false], optionalCombat: false, bonus: 0, defeats: 0, turns: 0 } }
 itemMenu = false
 choices(): Choice[] { if (this.itemMenu && this.state.scene === 'combat') return [...(['kit','battery'] as const).filter(id => this.state.items[id] > 0).map(id => ({ id, label: t(`${equipment[id].ja} ×${this.state.items[id]}`, `${equipment[id].en} ×${this.state.items[id]}`) })), c('back', '戻る（ターン消費なし）', 'Back (no turn)')]; return availableChoices(this.state) }
 private encounter(id: EnemyId) { const s = this.state; s.scene = 'combat'; s.bonus = 0; s.enemy = { id, hp: enemies[id].hp, maxHp: enemies[id].hp, turn: 0, exposed: false, focused: false, lastTech: false } }
 choose(id: string) {
 const choice = this.choices().find(x => x.id === id); if (!choice) return null
 const before = structuredClone(this.state), s = this.state
 let result = t('先へ進む。', 'I move onward.')
 const heal = (n: number) => { s.hp = Math.min(s.maxHp, s.hp + n) }
 if (id === 'items' || id === 'back') { this.itemMenu = id === 'items'; return { before, after: structuredClone(s), choice, result: t('持ち物を確認する。ターンは進まない。', 'I check supplies. No turn passes.') } }
 this.itemMenu = false
 switch (s.scene) {
 case 'wake': s.scene = 'create'; break
 case 'create': case 'levelup': {
 const stat = id as Stat; s.stats[stat]++; result = t(`${stat} が ${s.stats[stat]} になった。`, `${stat} is now ${s.stats[stat]}.`)
 if (s.scene === 'create') { s.points--; if (!s.points) s.scene = 'explore' } else { s.location = (s.location + 1) as GameState['location']; s.scene = 'explore'; s.explored[s.location] = false }
 break }
 case 'explore':
 if (id === 'explore') {
 s.explored[s.location] = true
 if (s.location === 0) { heal(3); s.items.kit = Math.min(3,s.items.kit+1); result = t('医務室でHP +3、応急キットを取得。記録：「事故の直前、認識設定の更新要求」。送信者は空欄。AI：空欄は便利な署名ですね。', 'Infirmary: HP +3, first aid kit acquired. Record: “Recognition update requested before the accident.” Sender blank. AI: A convenient signature.') }
 if (s.location === 1) { s.optionalCombat = true; this.encounter('maintenance'); result = t('倉庫の整備ロボットが動いた。倒せば工具ラックに手が届く。', 'A store-room maintenance robot wakes. Defeat it to reach the tool rack.') }
 if (s.location === 2) { s.equipment.vest = true; heal(2); result = t('防護ベストを装備。被ダメージ -1。HP +2。記録：「外部衝撃を検出。照合不能」。それ以上は読めない。', 'Protective vest equipped: damage -1. HP +2. Record: “External impact detected. Unable to match.” The rest is unreadable.') }
 } else { this.encounter((['maintenance','security','boss'] as const)[s.location]!) }
 break
 case 'warehouse': s.equipment.tool = id as GameState['equipment']['tool']; s.scene = 'explore'; result = t(`${equipment[id as 'wrench'].ja} を装備。`, `Equipped ${equipment[id as 'wrench'].en}.`); break
 case 'victory': if (s.optionalCombat) { s.optionalCombat = false; s.scene = 'warehouse' } else s.scene = 'event'; break
 case 'event': {
 const stat = id as Stat, cost = Math.max(0,3-s.stats[stat]); s.hp -= cost
 if (s.hp <= 0) { result = t(`${stat}で進む途中、HP -${cost}。もう立てない。`, `During the ${stat} crossing, HP -${cost}. I cannot stand.`); break }
 if (stat === 'BODY') s.items.kit = Math.min(3,s.items.kit+1)
 if (stat === 'TECH') heal(2)
 if (stat === 'SENSE') s.items.battery = Math.min(2,s.items.battery+1)
 result = t(`${stat}で突破。HP -${cost}。${stat === 'BODY' ? '応急キットを回収。' : stat === 'TECH' ? '救護装置でHP +2。' : 'スタンバッテリーを発見。'}「このやり方なら、いける」`, `${stat} crossing. HP -${cost}. ${stat === 'BODY' ? 'Kit salvaged.' : stat === 'TECH' ? 'Aid station: HP +2.' : 'Stun battery found.'} “This way works for me.”`)
 if (s.location < 2) { s.level++; s.maxHp += 2; heal(4); s.scene = 'levelup' } else s.scene = 'launch'
 break }
 case 'launch': s.scene = 'clear'; s.status = 'clear'; break
 case 'combat': {
 const e = s.enemy!, next = intent(s)!, tool = s.equipment.tool
 let damage = 0, cancel = false, detail = t('', '')
 if (id === 'attack') { damage = s.stats.BODY + 1 + (tool === 'wrench' ? 1 : 0) + s.bonus; if ((next === 'armor' && !e.exposed) || next === 'scan') damage = Math.min(1,damage); s.bonus = 0 }
 if (id === 'tech') {
 if (e.lastTech) detail = t('再干渉を遮断された。技術ダメージ 0。', 'Repeated interference blocked. Tech damage 0.')
 else { damage = s.stats.TECH + (tool === 'terminal' ? 1 : 0) + s.bonus; e.exposed = true; cancel = next === 'scan'; if (cancel) e.focused = false; detail = t('回路に干渉。装甲を開いた。スキャン中なら照準を解除。', 'Circuit interference opens armor. A scan loses its lock.') }
 s.bonus = 0
 }
 if (id === 'observe') { s.bonus = s.stats.SENSE + 1 + (tool === 'visor' ? 1 : 0); if (next === 'scan') { cancel = true; e.focused = false }; detail = t(`関節が弱点。次の攻撃／技術 +${s.bonus}。射撃は照準で4→8。スキャン中の観察は照準を外す。`, `Joint weakness: next attack/technology +${s.bonus}. Lock-on raises burst 4→8. Observing a scan spoils aim.`) }
 if (id === 'kit') { s.items.kit--; heal(6); detail = t('応急キット：HP +6。敵は動く。', 'First aid kit: HP +6. The enemy still acts.') }
 if (id === 'battery') { s.items.battery--; cancel = true; detail = t('スタンバッテリー。敵の行動を停止。', 'Stun battery cancels the enemy action.') }
 e.hp = Math.max(0,e.hp-damage); s.turns++; e.lastTech = id === 'tech'
 let incoming = 0
 if (e.hp > 0 && !cancel) {
 incoming = next === 'heavy' ? (e.id === 'boss' ? 10 : 7) : next === 'burst' ? (e.focused ? 8 : 4) : next === 'arm' || next === 'armor' ? 2 : 0
 if (next === 'scan') e.focused = true
 if (next === 'burst') e.focused = false
 if (id === 'defend') incoming = Math.max(0, incoming - 5 - Math.floor(s.stats.BODY / 2))
 if (s.equipment.vest) incoming = Math.max(0,incoming-1)
 s.hp = Math.max(0,s.hp-incoming)
 }
 result = t(`${detail.ja}\n敵HP -${damage} ／ 自分HP -${incoming}。${cancel ? '敵の行動を止めた。' : ''}`, `${detail.en}\nEnemy HP -${damage} / My HP -${incoming}. ${cancel ? 'Enemy action canceled.' : ''}`)
 e.turn++
 if (e.hp === 0) { s.defeats++; s.items.kit = Math.min(3,s.items.kit+1); s.enemy = null; s.scene = 'victory'; result = t(`${result.ja}\n撃破。応急キットを回収。`, `${result.en}\nDefeated. First aid kit salvaged.`) }
 break }
 }
 if (s.hp <= 0) { s.hp = 0; s.status = 'over'; s.scene = 'over'; s.enemy = null }
 return { before, after: structuredClone(s), choice, result }
 }
}
