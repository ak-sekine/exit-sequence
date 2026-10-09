import { text as t } from './i18n.ts'
import type { EnemyId, Intent } from './model.ts'
export const locations = [t('居住区', 'Living quarters'), t('整備区画', 'Maintenance section'), t('帰還船ドック', 'Return ship dock')]
export const enemies: Record<EnemyId, { name: ReturnType<typeof t>; hp: number; cycle: Intent[] }> = {
 maintenance: { name: t('整備ロボット', 'Maintenance robot'), hp: 8, cycle: ['arm', 'heavy', 'recover'] },
 security: { name: t('警備ロボット', 'Security robot'), hp: 12, cycle: ['armor', 'scan', 'burst', 'recover'] },
 boss: { name: t('大型警備ロボット', 'Heavy security robot'), hp: 19, cycle: ['armor', 'scan', 'burst', 'heavy', 'recover', 'recover'] },
}
export const intents: Record<Intent, ReturnType<typeof t>> = {
 arm: t('アームを振り下ろす · 2ダメージ', 'Arm strike · 2 damage'),
 heavy: t('アームを大きく振り上げた · 強攻撃 7', 'Arm raised high · heavy strike 7'),
 recover: t('アームを戻す · 攻撃なし、装甲が開く', 'Recovering · no attack, armor open'),
 armor: t('装甲を閉じて接近 · 攻撃は1まで、体当たり 2', 'Armor closed · attack capped at 1, ram 2'),
 scan: t('センサーで照準 · 攻撃は1まで、次の射撃を強化', 'Scanning target · attack capped at 1, strengthens next shot'),
 burst: t('拘束弾を発射 · 4ダメージ（照準中は8）', 'Restraint burst · 4 damage (8 when locked on)'),
}
export const opening = [
 t('居住区で目を覚ます。割れた窓の向こうは月面と黒い空。壁には亀裂。呼びかけても返事はない。', 'I wake in the living quarters. Beyond the cracked window: the Moon and black sky. Cracks run through the walls. No one answers my call.'),
 t('AI：現在確認できる生存者はあなた一人です。他の人の生死と事故原因は不明。生命維持は不安定です。地球へ戻る帰還船を目指しましょう。整備区画の先にドックがあります。', 'AI: You are the only survivor I can currently confirm. The others’ fate and the accident’s cause are unknown. Life support is unstable. The return ship can take you to Earth. Its dock is beyond maintenance.'),
 t('AI：ロボットの認識系が異常です。人間を拘束し、アームで攻撃する危険があります。私は同行します。腕は貸せませんが。\n\n「口だけでも、いないよりいい」', 'AI: Robot recognition systems are malfunctioning. They may restrain humans and attack with their arms. I will accompany you. Lending a hand is beyond my hardware.\n\n“Your voice will have to do.”'),
]
export const areaProse = [
 t('出口には整備ロボット。医務室の戸は半開きだ。薬を探すか、先へ進むか。帰還船はまだ遠い。', 'A maintenance robot waits by the exit. The infirmary door is ajar. Search for supplies, or move on? The return ship is still far away.'),
 t('整備区画。帰還船ドックへの矢印が光る。工具倉庫から金属の足音。「買い物には、ちょっと物騒だな」', 'Maintenance section. An arrow glows toward the return ship dock. Metal footsteps come from the tool store. “A rough place to go shopping.”'),
 t('帰還船が見えた。搭乗路には大型警備ロボット。脇の更衣室には未使用のロッカーがある。', 'The return ship is in sight. A heavy security robot blocks the boarding ramp. An unused locker stands in the changing room nearby.'),
]
export const eventProse = [
 t('出口の通路に瓦礫が崩れている。押しのけるか、保守扉を開けるか、隙間を通るか。どの道も整備区画へ続く。', 'Rubble blocks the exit passage. Move it, open a service door, or find a gap. Every route leads to maintenance.'),
 t('ドックへ続く昇降路が止まっている。梯子を引き下ろす、制御盤をつなぐ、点検足場を探す。どれでも上へ行ける。', 'The lift to the dock has stopped. Pull down a ladder, reconnect the controls, or find inspection steps. Each route leads up.'),
 t('搭乗路の向こうに帰還船。倒れた荷物を動かす、搬送機を操作する、荷物の間を抜ける。最後の一歩を自分のやり方で。', 'The return ship waits beyond the ramp. Shift fallen cargo, operate its mover, or slip between crates. One last crossing, my way.'),
]
