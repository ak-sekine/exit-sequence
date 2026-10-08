import { text as t } from './i18n.ts'
import type { Text } from './i18n.ts'
import type { ChallengeId, Choice, Condition, Effect, KnowledgeId, ObservationId, Outcome, Preparations, Scene, SceneId } from './model.ts'

export const knowledge: Record<KnowledgeId, Text> = {
  'light-response': t('白い光の中で赤い走査が止まった。アームは動いた。', 'The red scan stopped in white light. The arm kept moving.'),
  'arm-cycle': t('三度の音のあと、走査が折り返す。頭の高さに二本の跡。', 'After three clicks, the scan turns. Two scrapes at head height.'),
  'pressure-link': t('固定を離すと、均圧の針が戻る。', 'When the latch is released, the pressure needle falls back.'),
  'independent-power': t('青い系統は小さな独立電源。主電源とは別の回路。', 'The blue circuit has its own small battery, separate from the mains.'),
  'launch-interlock': t('固定が均圧を保つ。外部ケーブルには逆流の警告。', 'The latch holds equal pressure. The external cable carries a backflow warning.'),
}
const a = (id: string, label: Text, next: SceneId, result: Text, extra: Partial<Pick<Choice, 'when' | 'effect' | 'routes'>> = {}): Choice => ({ id, label, next, result, ...extra })
// The tuple union enforces the relationship between a challenge and its slots.
type Setup = { [K in ChallengeId]: [id: K, preparation: Partial<Preparations[K]>] }[ChallengeId]
const ready = (...[id, preparation]: Setup): Condition => ({ challenges: [{ id, preparation } as NonNullable<Condition['challenges']>[number]] })
const quality = (id: ChallengeId, outcomes: Outcome[]): Condition => ({ challenges: [{ id, outcomes }] })
const done = (id: ChallengeId) => quality(id, ['clean', 'costly'])
const pending = (id: ChallengeId) => quality(id, ['untried', 'failure', 'retreat'])
const set = (...[id, preparation]: Setup): Effect => ({ challenges: [{ id, preparation } as NonNullable<Effect['challenges']>[number]] })
const finish = (id: ChallengeId, outcome: Outcome, oxygen = 0, extra: Effect = {}, observe?: ObservationId): Effect => ({
  oxygen, ...extra, challenges: [{ id, attempt: true, outcome, observe }],
})
const setupReset: Record<ChallengeId, Effect> = {
  robot: { challenges: [{ id: 'robot', reset: true }] },
  // A repaired or replaced pipe remains installed when the latch is released.
  seal: { challenges: [{ id: 'seal', preparation: { lock: 'open', pressure: 'unequal' } }] },
  power: { challenges: [{ id: 'power', reset: true }] },
  launch: { challenges: [{ id: 'launch', reset: true }] },
}
const reset = (id: ChallengeId): Effect => setupReset[id]
const retreat = (id: ChallengeId): Effect => ({ oxygen: 1, challenges: reset(id).challenges!.map(change => ({ ...change, outcome: 'retreat' })) })
export const terminalConsequences = {
  oxygen: t('操作を終える前に、息が胸へ届かなくなった。', 'Before I can finish the operation, air no longer reaches my chest.'),
  injury: t('痛む腕が体を支えきれず、操作の途中で崩れ落ちた。', 'My aching arm cannot support me. I collapse before finishing the operation.'),
}
const stateProse: NonNullable<Scene['additions']> = [
  { when: { oxygenMin: 6 }, text: t('ファンが耳元で忙しい。息を整えてから手を伸ばす。', 'The fan works hard beside my ear. I steady my breathing before reaching out.') },
  { when: { oxygenMin: 10 }, text: t('息が浅い。表示が点滅している。\n\nAI：残りの空気はわずかです。長い試行は危険です。', 'My breaths are shallow. The display blinks.\n\nAI: Very little air remains. A long attempt is dangerous.') },
  { when: { body: 'bruised' }, text: t('左腕がまだ痛む。さっきの勢いは、もう出せそうにない。', 'My left arm still aches. I cannot manage another move like that easily.') },
  { when: { body: 'injured' }, text: t('左腕に力が入らない。\n\nAI：もう一度強く傷めれば、移動を続けられません。', 'My left arm will not hold my weight.\n\nAI: Another hard injury will leave you unable to move.') },
  { when: { threatMin: 3 }, text: t('すぐ近くで金属音が止まる。床まで細かく震えている。', 'Metal clicks stop close by. Even the floor trembles.') },
]
const launchReadings: NonNullable<Scene['additions']> = [
  { when: ready('launch', { pressure: 'open' }), text: t('固定灯は消え、圧力の針は端にある。', 'The latch lamp is dark. The pressure needle is at the edge.') },
  { when: ready('launch', { pressure: 'locked' }), text: t('固定灯は点くが、圧力の針は端にある。', 'The latch lamp is lit, but the pressure needle is at the edge.') },
  { when: ready('launch', { pressure: 'equal' }), text: t('固定灯が点き、圧力の針は中央にある。', 'The latch lamp is lit, and the pressure needle is centred.') },
  { when: ready('launch', { supply: 'external' }), text: t('外部の線はつながっている。', 'The external line is connected.') },
  { when: ready('launch', { supply: 'internal' }), text: t('外部の線は切れている。船内電池の灯りが残る。', 'The external line is disconnected. The internal battery lamp remains on.') },
  { when: ready('launch', { ignition: 'cold' }), text: t('青い点火準備灯は消えている。', 'The blue arming lamp is dark.') },
  { when: ready('launch', { ignition: 'armed' }), text: t('青い点火準備灯は点いたままだ。', 'The blue arming lamp is steady.') },
]
const resultScene = (id: SceneId, challenge: ChallengeId, next: SceneId, retry: SceneId): Scene => ({
  id, challenge, title: t('残ったもの', 'What remains'),
  narrative: [t('振り返って、通った場所と手元を確かめる。', 'I look back at the passage, then at my hands.')],
  additions: [
    ...stateProse,
    { when: quality(challenge, ['clean']), text: t('呼吸は乱れていない。道具も残っている。「よし。今のは、うまくやれた」', 'My breathing is steady. My tools are still here. “Yes. That went well.”') },
    { when: { challenges: [{ id: challenge, outcomes: ['clean'], attemptsMin: 2 }] }, text: t('さっき引き返した場所を、今は通り抜けている。痛む腕に、新しい痛みは増えていない。', 'I have crossed the place that sent me back before. No fresh pain joins the ache in my arm.') },
    { when: quality(challenge, ['costly']), text: t('通れた。でも、使った空気や道具は戻らない。「次なら、もう少し上手くできそうだ」', 'I made it. The air or supplies I spent will not come back. “I could do that better next time.”') },
    { when: quality(challenge, ['failure', 'retreat']), text: t('まだ先へは進めない。失敗したときの光と音が、頭に残っている。', 'I cannot move on yet. The light and sound of that attempt stay with me.') },
    { when: { challenges: [{ id: challenge, outcomes: ['failure', 'retreat'], attemptsMin: 2 }] }, text: t('何度も手を動かして、息が弾む。次の試行は前より空気を使いそうだ。', 'Repeated work leaves me panting. The next attempt will use more air than before.') },
  ],
  choices: [
    a(id + '-continue', t('先の設備へ進む', 'Go on to the next equipment'), next, t('一度だけ深く息を吐いて、先へ進む。', 'I let out one slow breath and move on.'), { when: done(challenge) }),
    a(id + '-retry', t('準備を外して、もう一度向き合う', 'Clear the setup and try again'), retry, t('手元を空ける。見たことまで、消えるわけじゃない。', 'I clear my hands. That does not erase what I saw.'), { when: pending(challenge), effect: reset(challenge) }),
    a(id + '-withdraw', t('点検室へ引き返す', 'Withdraw to the service room'), 'refuge', t('安全な扉の内側まで戻る。少し時間がかかった。', 'I get back behind a safe door. It takes a little time.'), { when: pending(challenge), effect: retreat(challenge) }),
  ],
})
const robotFailure = t('赤い光が胸を捉える。頭の高さをアームが横切り、左腕を打つ。扉の陰へ転がり戻った。\n\n「くそ。動くものが、ひとつじゃない」\n\nAI：観察対象は増えましたね。', 'The red beam catches my chest. An arm sweeps at head height and hits my left arm. I tumble back behind the door.\n\n“Damn. More than one thing moves.”\n\nAI: Your list of observations has grown.')
const lightFailure = t('白い光の中で、赤い走査が止まる。喜びかけた瞬間、アームが頭の高さを通った。腕をぶつけて戻る。\n\n「止まったのは、赤い光だけか」\n\nAI：実験結果としては、そう見えますね。', 'The red scan stops in the white beam. Just as I start to smile, the arm sweeps at head height. I hit my arm and scramble back.\n\n“Only the red light stopped.”\n\nAI: That is what the experiment suggests.')
const robotRules: NonNullable<Choice['routes']> = [
  { when: { ...ready('robot', { signal: 'none' }), threatMin: 3 }, next: 'robot-result', result: t('走査が折り返す前に、もう一つの音が来る。近すぎる。扉を閉めて引き返す。', 'Another click arrives before the scan turns. Too close. I close the door and retreat.'), effect: finish('robot', 'retreat', 2, { threat: 1 }) },
  { when: ready('robot', { signal: 'light', stance: 'low' }), next: 'robot-result', result: t('赤い線が白く薄れる。配管の下を進むと、アームは背中の上を空振りした。\n\n「二つとも、届かない。やった！」\n\nAI：声量は控えめに。', 'The red line fades into white. Under the pipe, the arm swings above my back.\n\n“Neither can reach me. Yes!”\n\nAI: A quieter celebration, please.'), effect: finish('robot', 'clean', 0, { threat: -1 }) },
  { when: ready('robot', { signal: 'decoy', stance: 'quiet' }), next: 'robot-result', result: t('奥の箱が鳴る。走査とアームがそちらへ向いた。靴を引きずらずに抜ける。箱は最後の音で黙った。', 'The box rattles farther away. The scan and arm turn toward it. I slip through without scraping my boots. The box falls silent after its final click.'), effect: finish('robot', 'costly', 1, { consume: ['decoy'], threat: -2 }) },
  { when: ready('robot', { signal: 'light' }), next: 'robot-result', result: lightFailure, effect: finish('robot', 'failure', 2, { hurt: true, threat: 1, learn: ['light-response'] }, 'white-test') },
  { when: ready('robot', { signal: 'decoy' }), next: 'robot-result', result: t('奥の箱へ光が向く。だが靴が床板を鳴らすと、光が戻ってきた。腕を打って退く。箱はもう鳴らない。\n\n「こっちまで鳴らしちゃ、だめか」\n\nAI：にぎやかな実験でした。', 'The light turns toward the box. My boot rattles a floor plate, and it turns back. I strike my arm while retreating. The box is silent now.\n\n“I made noise too.”\n\nAI: A lively experiment.'), effect: finish('robot', 'failure', 2, { hurt: true, threat: 1, consume: ['decoy'] }) },
]
const sceneList: Scene[] = [
  { id: 'wake', title: t('目が覚める', 'Waking up'), narrative: [
    t('ひび割れた窓の向こうに、月の地面が見える。扉には二本の黒いこすれた跡。遠くで、金属音が三度鳴る。', 'Moon dust lies beyond a cracked window. Two black scrapes cross the door. Far away, metal clicks three times.'),
    t('「できれば、夢であってほしかった」\n\nAI：夢の判定はできません。基地の空気が失われていることは確かです。帰還船を目指しましょう。', '“I was hoping this was a dream.”\n\nAI: I cannot test that. I can confirm the base is losing air. We should reach the return ship.'),
  ], choices: [
    a('open-supplies', t('救急ケースと工具棚を見る', 'Check the case and tool shelf'), 'supplies', t('壁際に、小さなケースと工具棚が残っている。', 'A small case and tool shelf remain by the wall.')),
    a('start-without-kit', t('扉の窓から外を見る', 'Look through the door window'), 'robot', t('窓の先を、赤い線が横切った。', 'A red line sweeps past the window.')),
  ] },
  { id: 'supplies', title: t('持っていくもの', 'What to take'), narrative: [
    t('ライトと工具はすぐ取れる。音と振動を出す試験箱、予備酸素の容器には固定帯がある。外すには少し時間が要る。', 'The light and tools are within reach. Straps hold a test box that makes sound and vibration, and a reserve oxygen flask. Undoing them takes time.'),
    t('AI：箱と容器は一回分です。使った後に補充はできません。', 'AI: The box and flask each have one use. There are no replacements.'),
  ], additions: stateProse, choices: [
    a('take-light', t('ライトを持つ', 'Take the light'), 'supplies', t('白い光が手のひらを照らす。「頼りにしてるよ、小さい太陽」', 'White light fills my palm. “Counting on you, little sun.”'), { when: { uncollected: ['light'] }, effect: { gain: ['light'] } }),
    a('take-tools', t('工具を持つ', 'Take the tools'), 'supplies', t('工具を腰に留める。握りはしっかりしている。', 'I clip the tools to my waist. The grip feels solid.'), { when: { uncollected: ['tools'] }, effect: { gain: ['tools'] } }),
    a('take-decoy', t('試験箱の帯を外す', 'Unstrap the test box'), 'supplies', t('箱を外す間、呼吸の音だけを聞く。まだ鳴らさない。', 'I hear only my breathing as I undo the strap. I leave the box silent.'), { when: { uncollected: ['decoy'] }, effect: { gain: ['decoy'], oxygen: 1 } }),
    a('take-flask', t('予備酸素の帯を外す', 'Unstrap the oxygen flask'), 'supplies', t('細い管の付いた容器を外す。ひとつだけだ。', 'I free the flask and its thin hose. Just one.'), { when: { uncollected: ['flask'] }, effect: { gain: ['flask'], oxygen: 1 } }),
    a('leave-supplies', t('扉の前へ戻る', 'Return to the door'), 'refuge', t('ケースを閉じる。全部を持つことが、準備とは限らない。', 'I close the case. Taking everything may not be the preparation I need.')),
  ] },
  { id: 'refuge', title: t('点検室', 'Service room'), narrative: [
    t('扉の内側は静かだ。来た道の記録端末と、物資の棚へ戻れる。休んでも、空気が増えるわけではない。', 'It is quiet behind the door. I can return to the record terminal and supply shelf. Resting will not make more air.'),
  ], additions: stateProse, choices: [
    a('resume-challenge', t('残っている設備に向き合う', 'Return to the unfinished equipment'), 'robot', t('さっきの光と音を思い返し、扉を開ける。', 'I recall the light and sound, then open the door.'), { routes: [
      { when: { challenges: [{ id: 'robot', outcomes: ['clean', 'costly'] }, { id: 'seal', outcomes: ['clean', 'costly'] }, { id: 'power', outcomes: ['clean', 'costly'] }] }, next: 'ship' },
      { when: { challenges: [{ id: 'robot', outcomes: ['clean', 'costly'] }, { id: 'seal', outcomes: ['clean', 'costly'] }] }, next: 'power' },
      { when: done('robot'), next: 'seal' },
    ] }),
    a('return-supplies', t('物資の棚を確かめる', 'Check the supply shelf'), 'supplies', t('棚へ戻る。空の固定帯は、空のままだ。', 'I return to the shelf. Empty straps are still empty.'), { effect: { oxygen: 1 } }),
    a('read-records', t('記録端末を開く', 'Open the record terminal'), 'records', t('画面のひびを指で避けて、記録を開く。', 'I avoid the cracked glass and open the records.'), { effect: { learn: ['light-response', 'independent-power'] } }),
    a('breathe-reserve', t('予備酸素をスーツにつなぐ', 'Connect reserve oxygen to the suit'), 'refuge', t('息が胸まで入る。容器は空になった。「空気って、こんなにおいしかったっけ」\n\nAI：今なら高評価でしょうね。', 'Air fills my chest. The flask is empty. “Has air always tasted this good?”\n\nAI: You seem inclined to give it a high rating.'), { when: { items: ['flask'] }, effect: { refill: true, consume: ['flask'] } }),
  ] },
  { id: 'records', title: t('切れた記録', 'Broken records'), narrative: [
    t('短い映像で、白い作業灯がつく。赤い線は止まるが、画面の上を金属の腕が横切った。', 'A white work lamp switches on in the short clip. The red line stops, but a metal arm passes across the top of the frame.'),
    t('整備メモには、青い回路の小さな電池が描かれている。「主電源と分離」とある。隣の音声記録は長そうだ。', 'A maintenance note shows a small battery on the blue circuit: “Separate from mains.” A nearby audio record looks longer.'),
  ], choices: [
    a('record-details', t('音声記録も再生する', 'Play the audio record too'), 'refuge', t('「固定を離すと、均圧が戻る」。続いて、船の外部ケーブルから火花が飛ぶ映像。「点火時の逆流」と字幕が出た。\n\n「失敗の記録ばっかりだ」\n\nAI：成功例より、見どころがあります。', '“Release the latch and pressure falls back.” Then a clip shows sparks from the ship’s external cable. The caption reads “Backflow during ignition.”\n\n“All these recordings are failures.”\n\nAI: More revealing than the successes.'), { effect: { oxygen: 1, learn: ['pressure-link', 'launch-interlock'] } }),
    a('leave-records', t('端末を閉じる', 'Close the terminal'), 'refuge', t('白い光の中でも、腕は動いていた。そこだけは覚えておく。', 'The arm kept moving in the white light. I remember that much.')),
  ] },
  { id: 'robot', challenge: 'robot', title: t('赤い線の向こう', 'Beyond the red line'), narrative: [
    t('窓の先でロボットが向きを変える。胸から赤い線が伸びる。頭の高さに金属の腕、足元には低い配管と浮いた床板。', 'A robot turns beyond the window. A red line extends from its chest. A metal arm sits at head height. Low pipes and loose floor plates run below.'),
    t('小さな破片が落ちると、赤い線が音の方へ向く。「耳もいいのか。嫌な同僚だ」\n\nAI：同僚かどうかは未確認です。', 'A scrap falls, and the red line turns toward the sound. “Good hearing too. Awful colleague.”\n\nAI: Its employment status is unconfirmed.'),
  ], additions: [...stateProse,
    { when: { knowledge: ['light-response'] }, text: t('記録の白い作業灯を思い出す。あのとき腕は止まらなかった。', 'I recall the white work lamp in the recording. The arm did not stop then.') },
    { when: { challenges: [{ id: 'robot', attemptsMin: 2 }] }, text: t('何度も扉を行き来して、息が弾む。次の試行は前より長くかかりそうだ。', 'Repeated trips to the door leave me panting. The next attempt will take more effort.') },
  ], choices: [
    a('watch-robot', t('窓越しに動きを追う', 'Watch its movements through the window'), 'robot-watch', t('扉を閉じたまま、光の往復を追う。少し空気を使う。', 'Keeping the door shut, I follow the light back and forth. It uses a little air.'), { effect: { oxygen: 1, learn: ['arm-cycle'], challenges: [{ id: 'robot', observe: 'robot-motion' }] }, routes: [{ when: { challenges: [{ id: 'robot', observed: 'robot-motion' }] }, next: 'robot-watch', effect: { oxygen: 1, threat: 1 } }] }),
    a('prepare-robot', t('手元の準備をする', 'Prepare what is in my hands'), 'robot-prep', t('何を向けるか、それとも何も使わないか。', 'What should I aim, or should I use nothing?')),
    a('robot-withdraw', t('扉を閉めて戻る', 'Close the door and withdraw'), 'refuge', t('いったん距離を取る。音が少し遠のく。', 'I pull back. The sound recedes a little.'), { effect: { ...retreat('robot'), threat: -1 } }),
  ] },
  { id: 'robot-watch', challenge: 'robot', title: t('三度の音', 'Three clicks'), narrative: [
    t('一、二、三。赤い線が壁で折り返す。その間、腕は高いところを通る。配管の下のほこりは動かない。', 'One, two, three. The red line turns at the wall. During the turn, the arm sweeps high. Dust beneath the pipe stays still.'),
    t('白い表示板を横切る間だけ、赤い線が薄くなる。腕の音は続いた。「同じ機械でも、別々に動くんだな」\n\nAI：観察には、分けて見る価値があります。', 'The red line fades only while crossing a white display. The arm keeps clicking. “One machine, separate movements.”\n\nAI: It pays to observe the parts separately.'),
  ], choices: [
    a('watch-to-prep', t('手元を準備する', 'Prepare my hands'), 'robot-prep', t('見えた動きと、使えるものを合わせて考える。', 'I consider the movements and what I can use.')),
    a('watch-to-door', t('窓から離れる', 'Step away from the window'), 'robot', t('音の間隔を頭に残す。', 'I keep the spacing of those clicks in mind.')),
  ] },
  { id: 'robot-prep', challenge: 'robot', title: t('手元', 'In my hands'), narrative: [t('窓の縁からなら、手だけ出せる。奥に箱を投げる空きもある。扉を抜けるのは、まだだ。', 'I can reach one hand around the window edge. There is space to throw a box farther inside. I have not crossed the door yet.')], choices: [
    a('ready-light', t('ライトを走査光へ向ける', 'Aim the light at the scan'), 'robot-stance', t('白い光を向ける。手首をそこで保つ。', 'I aim the white beam and hold my wrist there.'), { when: { items: ['light'] }, effect: set('robot', { signal: 'light' }) }),
    a('ready-decoy', t('試験箱を奥へ置く', 'Place the test box farther away'), 'robot-stance', t('箱をすべらせる。鳴らすのは進むときだ。', 'I slide the box across. I will trigger it when I move.'), { when: { items: ['decoy'] }, effect: set('robot', { signal: 'decoy' }) }),
    a('ready-empty', t('何も向けない', 'Aim nothing'), 'robot-stance', t('両手を空ける。', 'I leave both hands free.'), { effect: set('robot', { signal: 'none' }) }),
    a('prep-to-window', t('窓へ戻る', 'Return to the window'), 'robot', t('準備をいったん置く。', 'I set the preparation aside.'), { effect: reset('robot') }),
  ] },
  { id: 'robot-stance', challenge: 'robot', title: t('足の置き場', 'Where to put my feet'), narrative: [t('配管の下は狭い。床板の間には、靴一足分の硬い縁が続く。立ったままなら広く歩ける。', 'It is cramped beneath the pipe. Solid edges between the loose plates are just wide enough for a boot. Standing gives me more room.')], choices: [
    a('stance-low', t('低い配管の陰へ入る', 'Get under the low pipe'), 'robot-act', t('背中を丸め、配管の下に身を寄せる。', 'I bend my back and tuck beneath the pipe.'), { effect: set('robot', { stance: 'low' }) }),
    a('stance-quiet', t('床板の縁に足を置く', 'Put my feet on the plate edges'), 'robot-act', t('硬い縁に足を置く。床板は鳴らない。', 'I place my boots on the solid edges. The plates stay silent.'), { effect: set('robot', { stance: 'quiet' }) }),
    a('stance-upright', t('立ったまま構える', 'Stay upright'), 'robot-act', t('肩を起こす。窓の跡と同じ高さだ。', 'I straighten my shoulders, level with the scrapes on the window.'), { effect: set('robot', { stance: 'upright' }) }),
    a('stance-back', t('手元の準備を変える', 'Change what is in my hands'), 'robot-prep', t('足を戻して、手元を見る。', 'I pull my feet back and check my hands.')),
  ] },
  { id: 'robot-act', challenge: 'robot', title: t('扉の縁', 'At the threshold'), narrative: [t('赤い線が行き来する。進む動きは一度に終わらせたい。試すたび、呼吸と機械の音が近くなる。', 'The red line moves back and forth. I want to cross in one movement. Each attempt brings my breath and the machine’s sound closer.')], additions: [
    ...stateProse,
    { when: ready('robot', { signal: 'light' }), text: t('手元には白いライト。', 'The white light is in my hand.') },
    { when: ready('robot', { signal: 'decoy' }), text: t('奥に試験箱。進むと一回分の音を使う。', 'The test box is farther inside. Moving will use its one burst of sound.') },
    { when: ready('robot', { stance: 'low' }), text: t('背中のすぐ上に配管がある。', 'The pipe sits just above my back.') },
    { when: ready('robot', { stance: 'quiet' }), text: t('靴は硬い縁に乗っている。', 'My boots rest on the solid edges.') },
    { when: ready('robot', { stance: 'upright' }), text: t('肩は窓の黒い跡と同じ高さ。', 'My shoulders are level with the black scrapes.') },
  ], choices: [
    a('robot-cross', t('今、進む', 'Move now'), 'robot-result', robotFailure, { effect: finish('robot', 'failure', 2, { hurt: true, threat: 1 }), routes: robotRules }),
    a('robot-gap', t('光が折り返すときに進む', 'Move as the beam turns'), 'robot-result', robotFailure, { effect: finish('robot', 'failure', 2, { hurt: true, threat: 1 }), routes: [
      ...robotRules,
      { when: ready('robot', { signal: 'none', stance: 'low' }), next: 'robot-result', result: t('三度の音。光が離れる間に、配管の下を抜けた。腕は上を通る。待ったぶん、ファンが少し速い。', 'Three clicks. As the light moves away, I cross beneath the pipe. The arm passes above. My fan runs a little faster after the wait.'), effect: finish('robot', 'costly', 1) },
    ] }),
    a('robot-alter', t('足の置き方を変える', 'Change my footing'), 'robot-stance', t('進む前なら、まだ変えられる。', 'I can still change it before moving.')),
    a('robot-cancel', t('準備を外して退く', 'Clear the setup and withdraw'), 'refuge', t('扉を閉じ、手元の準備をしまう。', 'I close the door and put the setup away.'), { effect: retreat('robot') }),
  ] },
  resultScene('robot-result', 'robot', 'seal', 'robot'),
  { id: 'seal', challenge: 'seal', title: t('戻ってしまう針', 'The falling needle'), narrative: [
    t('気密扉の針が左右に揺れる。固定レバーはばねで戻る。脇には細い管。内側の扉だけが開いている。', 'The airlock needle wavers. A spring pulls the latch back. A thin pipe runs beside it. Only the inner door is open.'),
    t('「扉まで落ち着きがない」\n\nAI：両側を同時に開けると空気を失います。ここでは落ち着いてください。', '“Even the door is restless.”\n\nAI: Opening both sides loses air. One of you should remain calm.'),
  ], additions: [...stateProse,
    { when: ready('seal', { patch: 'none' }), text: t('細い管から空気が漏れている。', 'Air hisses from the thin pipe.') },
    { when: ready('seal', { patch: 'tools' }), text: t('締め直した管の留め具は残っている。漏れる音はない。', 'The tightened pipe clip remains in place. There is no hiss.') },
    { when: ready('seal', { patch: 'oxygen' }), text: t('管の代わりにつないだ容器は、そのまま残っている。', 'The replacement flask remains connected in place of the pipe.') },
  ], choices: [
    a('watch-seal', t('レバーと針を見比べる', 'Compare the latch and needle'), 'seal-watch', t('窓越しに表示を見る。扉はまだ閉じている。', 'I watch the display through the window. The door stays shut.'), { effect: { challenges: [{ id: 'seal', observe: 'seal-gauge' }], learn: ['pressure-link'] } }),
    a('prepare-seal', t('レバーと管に手を伸ばす', 'Reach for the latch and pipe'), 'seal-prep', t('触る前に、手元の道具を確かめる。', 'I check my tools before touching anything.')),
    a('seal-withdraw', t('点検室へ戻る', 'Return to the service room'), 'refuge', t('内側の扉を閉めて戻る。', 'I close the inner door and withdraw.'), { effect: retreat('seal') }),
  ] },
  { id: 'seal-watch', challenge: 'seal', title: t('針の行き先', 'Following the needle'), narrative: [
    t('レバーを押さえると、針は中央に寄る。手を離すと端へ戻った。管の割れ目は、小さな留め具のすぐ下だ。', 'Holding the latch moves the needle toward the middle. Releasing it sends the needle back. The pipe is split just below a small clip.'),
    t('管には「補助ガス」とある。均圧ボタンは、針が中央へ来るまで働く表示。扉の重い音がしても、針はまだ端にある。', 'The pipe reads “Auxiliary gas.” The equalise display runs until the needle reaches the middle. Even after a heavy door click, the needle is still at the edge.'),
  ], choices: [
    a('seal-watch-prep', t('手元の準備をする', 'Prepare the equipment'), 'seal-prep', t('音だけでは、まだ判断しない。', 'I do not rely on the sound alone.')),
    a('seal-watch-back', t('窓から離れる', 'Step away from the window'), 'seal', t('針の動きを覚えておく。', 'I remember how the needle moved.')),
  ] },
  { id: 'seal-prep', challenge: 'seal', title: t('ばねと割れ目', 'Spring and split'), narrative: [t('固定レバー、管の留め具、均圧ボタン。準備をしても、扉は自分で開ける必要がある。', 'The latch, the pipe clip, the equalise button. Preparing them will not open the door for me.')], additions: [
    ...stateProse,
    { when: ready('seal', { lock: 'held' }), text: t('固定レバーを留めてある。', 'The latch is held in place.') },
    { when: ready('seal', { patch: 'tools' }), text: t('留め具を締め直した管は、静かだ。', 'The tightened pipe clip is quiet.') },
    { when: ready('seal', { patch: 'oxygen' }), text: t('空の予備容器が、管の代わりにつながっている。', 'The empty reserve flask is connected in place of the pipe.') },
  ], choices: [
    a('hold-pressure', t('固定レバーを留める', 'Secure the latch'), 'seal-prep', t('留め金をかける。ばねの音が止まった。', 'I fasten the catch. The spring falls quiet.'), { effect: set('seal', { lock: 'held' }) }),
    a('patch-pipe', t('工具で管の留め具を締める', 'Tighten the pipe clip with tools'), 'seal-prep', t('管の割れ目を留め具の中へ寄せる。漏れる音が止まる。', 'I pull the split into the clip. The hiss stops.'), { when: { items: ['tools'] }, effect: set('seal', { patch: 'tools' }) }),
    a('feed-pipe', t('予備酸素を細い管につなぐ', 'Connect reserve oxygen to the thin pipe'), 'seal-prep', t('管へ空気を送る。容器は空になるが、針の震えは収まった。', 'I feed air into the pipe. The flask empties, but the needle stops shaking.'), { when: { items: ['flask'] }, effect: { consume: ['flask'], ...set('seal', { patch: 'oxygen' }) } }),
    a('seal-to-act', t('操作盤へ向かう', 'Turn to the control panel'), 'seal-act', t('手をボタンの上へ持っていく。', 'I bring my hand over the buttons.')),
    a('seal-clear-prep', t('留め金を外して戻る', 'Release the catch and step back'), 'seal', t('留め金を外す。針が端へ戻る。管に取り付けたものは残る。使った容器は空のままだ。', 'I release the catch. The needle falls back. Installed pipe parts stay in place. The spent flask remains empty.'), { effect: reset('seal') }),
  ] },
  { id: 'seal-act', challenge: 'seal', title: t('二枚の扉', 'Two doors'), narrative: [t('内側が閉じると、均圧と開扉のボタンが点く。大きな音で決めず、針とレバーも見る。', 'Once the inner door closes, the equalise and open buttons light up. I check the needle and latch, not just the loud click.')], additions: [
    ...stateProse,
    { when: ready('seal', { pressure: 'unequal' }), text: t('針は中央から外れている。', 'The needle is off-centre.') },
    { when: ready('seal', { pressure: 'equal' }), text: t('針は中央にある。', 'The needle is centred.') },
    { when: ready('seal', { lock: 'open' }), text: t('固定レバーは戻っている。', 'The latch has sprung back.') },
    { when: ready('seal', { lock: 'held' }), text: t('固定レバーは留まっている。', 'The latch remains secured.') },
  ], choices: [
    a('equalise-pressure', t('均圧ボタンを押す', 'Press equalise'), 'seal-result', t('針が動いて、また戻る。レバーもばねで戻っていた。待ったぶんの空気だけを失った。\n\n「音はしたのに」\n\nAI：音と完了は別の報告です。', 'The needle moves, then falls back. The spring has pulled the latch back too. Only my spent air is gone.\n\n“But it clicked.”\n\nAI: A sound and a completion are separate reports.'), { effect: finish('seal', 'failure', 2), routes: [
      { when: ready('seal', { lock: 'held', patch: 'tools' }), next: 'seal-act', result: t('針が中央へ寄り、そこで止まる。漏れる音もない。', 'The needle settles in the middle. No hiss follows.'), effect: set('seal', { pressure: 'equal' }) },
      { when: ready('seal', { lock: 'held', patch: 'oxygen' }), next: 'seal-act', result: t('容器につないだ管が震え、針は中央で止まる。', 'The flask hose trembles. The needle settles in the middle.'), effect: set('seal', { pressure: 'equal' }) },
      { when: ready('seal', { lock: 'held' }), next: 'seal-act', result: t('漏れが続く。長く待って、ようやく針が中央へ来る。ファンが速く回る。', 'The hiss continues. After a long wait, the needle reaches the middle. My fan spins faster.'), effect: { oxygen: 2, ...set('seal', { pressure: 'equal' }) } },
    ] }),
    a('open-airlock', t('外側の扉を開ける', 'Open the outer door'), 'seal-result', t('針が端を指したまま、扉が少し浮く。空気が引かれ、慌てて閉め直した。レバーと針が同時に戻る。\n\n「まだだった。くそ」\n\nAI：引き返せる幅で止まって幸いでした。', 'The door lifts with the needle still at the edge. Air pulls away. I quickly close it. The latch and needle fall back together.\n\n“Too soon. Damn.”\n\nAI: Fortunately it stopped while retreat was possible.'), { effect: finish('seal', 'failure', 2), routes: [
      { when: ready('seal', { lock: 'held', pressure: 'equal', patch: 'tools' }), next: 'seal-result', result: t('針は中央のまま。扉が開き、風は吹かない。静かなまま通り抜けた。', 'The needle stays centred. The door opens without a gust. I cross in silence.'), effect: finish('seal', 'clean') },
      { when: ready('seal', { lock: 'held', pressure: 'equal' }), next: 'seal-result', result: t('針が中央にある間に通る。漏れを待つ空気か、予備容器を使ったが、扉は越えた。', 'I cross while the needle is centred. Waiting out the leak or using the reserve flask has cost supplies, but I am through.'), effect: finish('seal', 'costly') },
    ] }),
    a('seal-adjust', t('レバーと管へ戻る', 'Return to the latch and pipe'), 'seal-prep', t('まだやり直せる。', 'I can still adjust it.')),
    a('seal-cancel', t('内側へ戻って退く', 'Return inside and withdraw'), 'refuge', t('内側の扉だけを開けて戻る。', 'I open only the inner door and return.'), { effect: retreat('seal') }),
  ] },
  resultScene('seal-result', 'seal', 'power', 'seal'),
  { id: 'power', challenge: 'power', title: t('止まった昇降台', 'The stalled lift'), narrative: [
    t('昇降台は暗い。操作箱に青い端子と主電源の端子がある。下のブレーキがかかったまま、試験用の丸い穴が口を開けている。', 'The lift is dark. Its panel has blue and mains terminals. A brake remains engaged below, beside a round test socket.'),
    t('「電気だけじゃ、足りない顔してる」\n\nAI：顔はありません。ブレーキはあります。', '“It looks like electricity will not be enough.”\n\nAI: It has no face to look at. It does have a brake.'),
  ], additions: [...stateProse,
    { when: { knowledge: ['independent-power'] }, text: t('青い端子は、記録の小さな電池と同じ印だ。', 'The blue terminal bears the same mark as the small battery in the record.') },
    { when: { challenges: [{ id: 'power', attemptsMin: 2 }] }, text: t('操作箱が熱い。何度も試すと、移動より呼吸に時間を取られる。', 'The panel is hot. Repeated attempts take more breathing than moving.') },
  ], choices: [
    a('watch-power', t('端子とブレーキの札を読む', 'Read the terminal and brake labels'), 'power-watch', t('ほこりを払う。札は破れているが、印は読める。', 'I brush off dust. The labels are torn, but their marks are legible.'), { effect: { learn: ['independent-power'], challenges: [{ id: 'power', observe: 'power-label' }] } }),
    a('prepare-power', t('電源端子を選ぶ', 'Choose a power terminal'), 'power-prep', t('コードを持つ。まだつながない。', 'I take the cable. It is not connected yet.')),
    a('power-withdraw', t('点検室へ引き返す', 'Withdraw to the service room'), 'refuge', t('昇降台を降り、来た扉まで戻る。', 'I step off the lift and return to the door.'), { effect: retreat('power') }),
  ] },
  { id: 'power-watch', challenge: 'power', title: t('小さな電池', 'A small battery'), narrative: [
    t('青い端子の表示だけは光っている。「独立電源・短い入力」。主電源の札には「停電中」とある。', 'Only the blue terminal glows: “Independent supply. Short input.” The mains label reads “Offline.”'),
    t('ブレーキの札には、工具で外す絵と、試験箱を丸い穴へ当てる絵。箱の振動で爪が引っ込むらしい。手動レバーは固く、腕に重そうだ。', 'The brake label shows tools removing it, and a test box held against the round socket. Its vibration seems to pull the catch back. The stiff manual lever looks hard on my arm.'),
    t('「壊れた設備にも、取扱説明はあるんだ」\n\nAI：読者が残っているかは別問題ですが。', '“Broken equipment still has instructions.”\n\nAI: Whether it still has readers is another matter.'),
  ], choices: [
    a('power-watch-prep', t('コードを持つ', 'Take the cable'), 'power-prep', t('札と端子を見比べる。', 'I compare the labels with the terminals.')),
    a('power-watch-back', t('昇降台へ戻る', 'Step back to the lift'), 'power', t('ブレーキの爪をもう一度見る。', 'I look at the brake catch once more.')),
  ] },
  { id: 'power-prep', challenge: 'power', title: t('コードの先', 'The end of the cable'), narrative: [t('コードは一つ。つなぐ端子は二つ。青い表示は小さく光り、主電源の表示は暗い。', 'One cable, two terminals. The blue display glows faintly. The mains display is dark.')], choices: [
    a('source-blue', t('青い端子につなぐ', 'Connect to the blue terminal'), 'power-drive', t('青い端子へコードを差す。', 'I plug the cable into the blue terminal.'), { effect: set('power', { source: 'blue' }) }),
    a('source-main', t('主電源の端子につなぐ', 'Connect to the mains terminal'), 'power-drive', t('主電源の端子へコードを差す。表示は暗いまま。', 'I plug into the mains terminal. The display stays dark.'), { effect: set('power', { source: 'main' }) }),
    a('source-none', t('コードをつながない', 'Leave the cable unplugged'), 'power-drive', t('コードを脇に置く。', 'I set the cable aside.'), { effect: set('power', { source: 'none' }) }),
    a('power-prep-back', t('札を見直す', 'Read the labels again'), 'power-watch', t('動かす前に、札へ戻る。', 'Before moving it, I return to the labels.'), { effect: { learn: ['independent-power'], challenges: [{ id: 'power', observe: 'power-label' }] } }),
  ] },
  { id: 'power-drive', challenge: 'power', title: t('ブレーキ', 'The brake'), narrative: [t('爪が車輪を留めている。爪の脇にネジ、丸い試験穴、重いレバーがある。', 'A catch holds the wheel. Beside it are screws, a round test socket, and a heavy lever.')], choices: [
    a('drive-tools', t('工具でブレーキを外す', 'Release the brake with tools'), 'power-act', t('ネジをゆるめ、爪を固定する。まだ台は動かない。', 'I loosen the screws and brace the catch. The platform still does not move.'), { when: { items: ['tools'] }, effect: set('power', { drive: 'tools' }) }),
    a('drive-decoy', t('試験箱を丸い穴へ当てる', 'Hold the test box against the socket'), 'power-act', t('箱を穴へ当てる。動かすときに一回分の振動を使う。', 'I hold the box to the socket. Moving the lift will use its one vibration charge.'), { when: { items: ['decoy'] }, effect: set('power', { drive: 'decoy' }) }),
    a('drive-hand', t('手でレバーを握る', 'Grip the lever by hand'), 'power-act', t('固いレバーを握る。力を込め続けると腕に来そうだ。', 'I grip the stiff lever. Holding it will strain my arm.'), { effect: set('power', { drive: 'hand' }) }),
    a('drive-none', t('ブレーキには触れない', 'Leave the brake alone'), 'power-act', t('爪をそのままにする。', 'I leave the catch where it is.'), { effect: set('power', { drive: 'none' }) }),
    a('drive-back', t('電源端子を選び直す', 'Change the power terminal'), 'power-prep', t('手を離し、コードを確かめる。', 'I let go and check the cable.')),
  ] },
  { id: 'power-act', challenge: 'power', title: t('入力ボタン', 'The input button'), narrative: [t('台はまだ止まっている。ボタンには短い入力の印。長く押すための囲いもある。焦ると、つい力が入る。', 'The platform remains still. The button has a short-input mark and a guard for holding it down. Hurry makes my hand tense.')], additions: [
    ...stateProse,
    { when: ready('power', { source: 'blue' }), text: t('コードは青い端子につながっている。', 'The cable is in the blue terminal.') },
    { when: ready('power', { source: 'main' }), text: t('コードは暗い主電源につながっている。', 'The cable is in the dark mains terminal.') },
    { when: ready('power', { drive: 'tools' }), text: t('工具で爪を留めてある。', 'The tools hold the catch back.') },
    { when: ready('power', { drive: 'decoy' }), text: t('試験箱を穴へ当てている。', 'The test box rests against the socket.') },
    { when: ready('power', { drive: 'hand' }), text: t('レバーを手で握っている。', 'My hand grips the lever.') },
    { when: ready('power', { drive: 'none' }), text: t('ブレーキの爪は車輪を留めたままだ。', 'The brake catch still holds the wheel.') },
  ], choices: [
    a('power-pulse', t('短く押す', 'Press briefly'), 'power-result', t('台は動かない。主電源は暗いまま、爪は車輪の脇に見える。作動音を待つ間、空気を使った。\n\n「どこまで、動いたんだ？」\n\nAI：表示と爪は、別々に確認できます。', 'The platform does not move. The mains stays dark; the catch is visible beside the wheel. Waiting for a motor sound costs air.\n\n“What part actually moved?”\n\nAI: The display and catch can be checked separately.'), { effect: finish('power', 'failure', 2, { threat: 1 }), routes: [
      { when: ready('power', { source: 'blue', drive: 'tools' }), next: 'power-result', result: t('青い光が一度点く。爪が離れた車輪が回り、台が静かに上がった。「よし、頼りになる小ささだ」', 'The blue light flashes once. The freed wheel turns, and the platform rises quietly. “Small, but dependable.”'), effect: finish('power', 'clean') },
      { when: ready('power', { source: 'blue', drive: 'decoy' }), next: 'power-result', result: t('箱の振動で爪が引っ込み、青い光が台を動かす。箱は黙った。上には届いた。', 'The box vibrates the catch back, and the blue circuit moves the lift. The box goes silent. I reach the top.'), effect: finish('power', 'costly', 0, { consume: ['decoy'], threat: 1 }) },
      { when: ready('power', { source: 'blue', drive: 'hand' }), next: 'power-result', result: t('光は点いた。でも一瞬だけ緩んだレバーが戻り、台が止まる。手で持つには、押し続ける時間が必要らしい。', 'The light flashes. But the briefly loosened lever springs back, stopping the lift. Holding it by hand seems to need a longer input.'), effect: finish('power', 'failure', 1) },
      { when: ready('power', { source: 'blue' }), next: 'power-result', result: t('青い光は点く。車輪は、残った爪に当たって止まった。「電気は来てる。動けないだけだ」\n\nAI：有用な区別です。', 'The blue light comes on. The wheel stops against the catch. “There is power. It just cannot move.”\n\nAI: A useful distinction.'), effect: finish('power', 'failure', 2, { threat: 1 }) },
    ] }),
    a('power-hold', t('押し続ける', 'Hold it down'), 'power-result', t('長く押しても台は動かない。暗い端子と車輪の爪は変わらず、息だけが弾む。', 'Holding it does not move the platform. The dark terminal and wheel catch remain unchanged. Only my breathing grows faster.'), { effect: finish('power', 'failure', 3, { threat: 1 }), routes: [
      { when: ready('power', { source: 'blue', drive: 'hand' }), next: 'power-result', result: t('レバーを握り続ける。台は上がるが、左腕が熱く痛む。空気も余分に使った。「上には来た。腕は置いていきたかった」\n\nAI：持参を推奨します。', 'I keep my grip. The platform rises, but my left arm burns with pain. I spend extra air. “Made it. Wish I could leave the arm behind.”\n\nAI: I recommend bringing it.'), effect: finish('power', 'costly', 1, { hurt: true }) },
      { when: ready('power', { source: 'blue', drive: 'tools' }), next: 'power-result', result: t('台が上がった後も電池の表示が点滅する。長く押したぶん、焦げたにおいと荒い息が残った。', 'The battery display keeps blinking after the lift rises. The long input leaves a burnt smell and rough breathing.'), effect: finish('power', 'costly', 2, { threat: 1 }) },
      { when: ready('power', { source: 'blue', drive: 'decoy' }), next: 'power-result', result: t('箱は爪を引き込み、台は上がる。押しすぎて警報が鳴った。箱も使い切った。', 'The box pulls the catch back and the lift rises. The long press sounds an alarm. The box is spent.'), effect: finish('power', 'costly', 2, { consume: ['decoy'], threat: 2 }) },
    ] }),
    a('power-adjust', t('ブレーキの準備を変える', 'Change the brake preparation'), 'power-drive', t('ボタンから手を離す。', 'I take my hand off the button.')),
    a('power-cancel', t('コードを外して戻る', 'Unplug and withdraw'), 'refuge', t('コードを外して、台を離れる。', 'I unplug the cable and leave the platform.'), { effect: retreat('power') }),
  ] },
  resultScene('power-result', 'power', 'ship', 'power'),
  { id: 'ship', challenge: 'launch', title: t('帰還船', 'The return ship'), narrative: [
    t('帰還船の窓が緑に光る。細い外部ケーブルが船につながり、脇に「点火時・逆流注意」の札。船内には固定、均圧、外部切断、点火準備の表示がある。', 'The return ship’s window glows green. A thin external cable feeds the ship, beside a “Backflow during ignition” tag. Inside are latch, equalise, disconnect, and arm-ignition displays.'),
    t('「最後くらい、押すだけで飛んでよ」\n\nAI：押すだけならできます。飛べるかは別です。', '“For once, let me just press something and fly.”\n\nAI: You may press something. Flight is a separate outcome.'),
  ], additions: stateProse, choices: [
    a('board-ship', t('船内の操作盤へ入る', 'Enter and approach the panel'), 'ship-check', t('指の震えを止める。ここまで来た。', 'I steady my trembling fingers. I have come this far.')),
    a('inspect-plate', t('入口の手順票を読む', 'Read the plate by the entrance'), 'ship-read', t('薄い文字を読む。照明がなければ、顔を寄せて少し時間を使う。', 'I read the faint print. Without a light, I must lean close and spend some time.'), { effect: { oxygen: 1, learn: ['launch-interlock'], challenges: [{ id: 'launch', observe: 'launch-plate' }] }, routes: [{ when: { items: ['light'] }, next: 'ship-read', effect: { oxygen: 0, learn: ['launch-interlock'], challenges: [{ id: 'launch', observe: 'launch-plate' }] } }] }),
    a('ship-withdraw', t('点検室へ戻る', 'Return to the service room'), 'refuge', t('船を出る。使える空気と道具を考える。', 'I step out, considering the air and tools I have left.'), { effect: { oxygen: 1 } }),
  ] },
  { id: 'ship-read', challenge: 'launch', title: t('消えかけた手順票', 'The faded procedure plate'), narrative: [
    t('票には配管の絵。「固定が外れると均圧を保持できない」。均圧の針が中央に来ると、点火準備の窓が開く。', 'The plate shows the pipes: “Equal pressure cannot be held with the latch released.” The arming window opens when the pressure needle is centred.'),
    t('ケーブルの絵には「外部接続のまま点火すると逆流」。点火準備の文字の下には「青が点灯してから点火」とある。番号はかすれて読めない。', 'The cable diagram reads: “Ignition with external power connected causes backflow.” Beneath the arming label: “Ignite after blue is steady.” The numbered steps have faded.'),
    t('「読むだけじゃ、飛べないんだよな」\n\nAI：その点は正確に理解されています。', '“Reading will not launch it for me.”\n\nAI: You have understood that accurately.'),
  ], choices: [
    a('plate-to-panel', t('操作盤へ向かう', 'Go to the control panel'), 'ship-check', t('絵の線を頭に残す。順番は自分で組み立てる。', 'I keep the diagram in mind and work out the order.')),
    a('plate-to-entry', t('入口で考え直す', 'Think again by the entrance'), 'ship', t('票から目を離し、ケーブルを見る。', 'I look away from the plate and check the cable.')),
  ] },
  { id: 'ship-check', challenge: 'launch', title: t('指の前にあるもの', 'Before my fingers'), narrative: [
    t('圧力の針、外部電源の線、青い点火準備灯。操作する場所は二つに分かれている。', 'The pressure needle, external power line, and blue arming lamp. The controls are divided between two panels.'),
    t('AI：表示の確認はできます。操作はあなたが行ってください。', 'AI: I can confirm the readings. The operations are yours.'),
  ], additions: [...stateProse, ...launchReadings], choices: [
    a('to-pressure', t('圧力の操作盤を使う', 'Use the pressure panel'), 'ship-pressure', t('固定と均圧のボタンへ手を置く。', 'I reach for the latch and equalise controls.')),
    a('to-electric', t('電源と点火の操作盤を使う', 'Use the power and ignition panel'), 'ship-electric', t('ケーブルの表示を確かめる。', 'I check the cable display.')),
    a('panel-read-plate', t('手順票を見直す', 'Read the procedure plate'), 'ship-read', t('票を見直す。新しい空気や道具が増えるわけではない。', 'I review the plate. It supplies neither extra air nor tools.'), { effect: { oxygen: 1, learn: ['launch-interlock'], challenges: [{ id: 'launch', observe: 'launch-plate' }] }, routes: [{ when: { items: ['light'] }, next: 'ship-read', effect: { oxygen: 0, learn: ['launch-interlock'], challenges: [{ id: 'launch', observe: 'launch-plate' }] } }] }),
    a('ship-refill', t('予備酸素をスーツにつなぐ', 'Connect reserve oxygen to the suit'), 'ship-check', t('胸に空気が入る。容器は最後の音で黙った。', 'Air fills my chest. The flask goes quiet with a last hiss.'), { when: { items: ['flask'] }, effect: { refill: true, consume: ['flask'] } }),
  ] },
  { id: 'ship-pressure', challenge: 'launch', title: t('圧力の操作盤', 'Pressure panel'), narrative: [t('固定と均圧のボタン。解除レバーには「均圧を失う」の札がある。操作した後も、針を確認する。', 'Latch and equalise buttons. The release lever is tagged “Equal pressure lost.” I check the needle after each operation.')], additions: [
    ...stateProse,
    { when: ready('launch', { pressure: 'open' }), text: t('固定灯は消えている。針は端にある。', 'The latch lamp is dark. The needle is at the edge.') },
    { when: ready('launch', { pressure: 'locked' }), text: t('固定灯が点く。針はまだ端にある。', 'The latch lamp is lit. The needle is still at the edge.') },
    { when: ready('launch', { pressure: 'equal' }), text: t('固定灯が点き、針は中央にある。', 'The latch lamp is lit, and the needle is centred.') },
  ], choices: [
    a('launch-lock', t('圧力固定を押す', 'Press pressure latch'), 'ship-pressure', t('留め金がかかる。固定灯が点く。', 'The catch locks. The latch lamp lights.'), { effect: set('launch', { pressure: 'locked', ignition: 'cold' }), routes: [{ when: ready('launch', { pressure: 'equal' }), next: 'ship-pressure', result: t('固定灯は点いたまま。針も動かない。', 'The latch lamp stays lit. The needle does not move.'), effect: {} }] }),
    a('launch-equalise', t('均圧を押す', 'Press equalise'), 'ship-result', t('針が中央へ寄りかけて戻る。固定灯は消えたままだ。少し空気が流れた。\n\n「さっきの扉と、同じ動きだ」\n\nAI：見覚えのある結果ですね。', 'The needle approaches the centre, then falls back. The latch lamp stays dark. Some air escapes.\n\n“Same movement as that door.”\n\nAI: A familiar result.'), { effect: finish('launch', 'failure', 1), routes: [
      { when: ready('launch', { pressure: 'locked' }), next: 'ship-pressure', result: t('針が中央で止まる。点火準備の窓が開いた。', 'The needle settles in the middle. The arming window opens.'), effect: set('launch', { pressure: 'equal' }) },
      { when: ready('launch', { pressure: 'equal' }), next: 'ship-pressure', result: t('針は中央のままだ。', 'The needle stays centred.'), effect: {} },
    ] }),
    a('launch-release', t('固定を解除する', 'Release the latch'), 'ship-pressure', t('針が端へ戻る。点火準備灯も消えた。', 'The needle falls to the edge. The arming lamp goes dark.'), { effect: set('launch', { pressure: 'open', ignition: 'cold' }) }),
    a('pressure-to-electric', t('電源と点火の操作盤へ移る', 'Move to power and ignition'), 'ship-electric', t('指を次の操作盤へ移す。', 'I move my fingers to the other panel.')),
    a('pressure-to-check', t('操作盤から手を離す', 'Take my hands off the panel'), 'ship-check', t('息を整えて表示を眺める。', 'I steady my breathing and look at the displays.')),
  ] },
  { id: 'ship-electric', challenge: 'launch', title: t('ケーブルと青い灯り', 'Cable and blue lamp'), narrative: [
    t('外部切断、点火準備、点火。端子には「逆流注意」。点火ボタンの脇で、安全装置の封印が赤く光る。', 'Disconnect, arm, ignite. The terminal is tagged “Backflow.” A sealed safety override glows red beside the ignition button.'),
  ], additions: [
    ...stateProse,
    { when: ready('launch', { supply: 'external' }), text: t('外部ケーブルの表示はつながった線。', 'The external cable display shows a connected line.') },
    { when: ready('launch', { supply: 'internal' }), text: t('外部ケーブルの表示は切れた線。船内電池の小さな灯りがついている。', 'The cable display shows a broken line. The small internal-battery lamp is on.') },
    { when: ready('launch', { ignition: 'cold' }), text: t('青い点火準備灯は消えている。', 'The blue arming lamp is dark.') },
    { when: ready('launch', { ignition: 'armed' }), text: t('青い点火準備灯は点いたままだ。', 'The blue arming lamp is steady.') },
    { when: ready('launch', { pressure: 'open' }), text: t('固定灯は消え、圧力の針は端にある。', 'The latch lamp is dark. The pressure needle is at the edge.') },
    { when: ready('launch', { pressure: 'locked' }), text: t('固定灯は点くが、圧力の針は端にある。', 'The latch lamp is lit, but the pressure needle is at the edge.') },
    { when: ready('launch', { pressure: 'equal' }), text: t('圧力の針は中央にある。', 'The pressure needle is centred.') },
  ], choices: [
    a('launch-disconnect', t('外部電源を切断する', 'Disconnect external power'), 'ship-electric', t('固い留め具を外すのに少し時間がかかった。船内電池の灯りは消えない。', 'The stiff clip takes a little time to release. The internal battery lamp stays on.'), { effect: { oxygen: 1, ...set('launch', { supply: 'internal' }) }, routes: [
      { when: ready('launch', { supply: 'internal' }), next: 'ship-electric', result: t('線はもう切れている。', 'The line is already disconnected.'), effect: {} },
      { when: { items: ['tools'] }, next: 'ship-electric', result: t('工具で留め具を外す。船内電池の灯りが残る。', 'I release the clip with tools. The internal battery lamp stays on.'), effect: set('launch', { supply: 'internal' }) },
    ] }),
    a('launch-arm', t('点火準備を押す', 'Press arm ignition'), 'ship-result', t('青い灯りは点かず、圧力の針が端で震える。ボタンの窓が閉じた。「何か、まだ残ってる」\n\nAI：表示は確認できます。', 'The blue lamp stays dark. The pressure needle shakes at the edge. The button window closes. “Something is still missing.”\n\nAI: The readings are available to check.'), { effect: finish('launch', 'failure', 1), routes: [{ when: ready('launch', { pressure: 'equal' }), next: 'ship-electric', result: t('青い灯りが点き、そのまま残る。', 'The blue lamp comes on and stays lit.'), effect: set('launch', { ignition: 'armed' }) }] }),
    a('launch-ignite', t('点火を押す', 'Press ignite'), 'ship-result', t('警報が鳴る。青い灯りと、圧力の針と、外部の線を見る。安全装置が点火を止めた。だが冷却の間に空気を使う。\n\n「止めてくれて、ありがとう。悔しいけど」\n\nAI：感謝は受け付けます。封印を破ると、この停止は働きません。', 'An alarm sounds. I check the blue lamp, pressure needle, and external line. The safety system blocks ignition, but cooling costs air.\n\n“Thanks for stopping me. Annoying as that is.”\n\nAI: Gratitude accepted. Breaking the seal disables that protection.'), { effect: finish('launch', 'failure', 2, { threat: 1 }), routes: [
      { when: { challenges: [{ id: 'launch', preparation: { pressure: 'equal', supply: 'internal', ignition: 'armed' }, attemptsMin: 1 }] }, next: 'clear', result: t('今度は警報が鳴らない。青い灯り、中央の針、切れた外部の線。船が床を離れた。「やり直して、よかった！」', 'This time there is no alarm. A blue lamp, centred needle, disconnected external line. The ship leaves the floor. “Glad I tried again!”'), effect: finish('launch', 'costly') },
      { when: ready('launch', { pressure: 'equal', supply: 'internal', ignition: 'armed' }), next: 'clear', result: t('船が震える。外部の線は切れたまま、針は中央を保つ。窓の向こうで基地が遠ざかる。「飛んだ。私が、飛ばした！」\n\nAI：その評価には同意します。', 'The ship shivers. The external line stays disconnected; the needle remains centred. The base falls away beyond the window. “It flew. I made it fly!”\n\nAI: I agree with that assessment.'), effect: finish('launch', 'clean') },
      { when: ready('launch', { supply: 'external' }), next: 'ship-result', result: t('外部ケーブルの線が赤く点滅する。端子の逆流警告も光った。安全装置が点火を止め、冷却の間に空気を使う。\n\n「その線が、まだつながってた」\n\nAI：現物と表示は一致しています。', 'The external cable line flashes red. The backflow warning lights too. The safety system blocks ignition, and cooling costs air.\n\n“That line was still connected.”\n\nAI: The hardware agrees with the display.'), effect: finish('launch', 'failure', 2, { threat: 1 }) },
    ] }),
    a('electric-to-pressure', t('圧力の操作盤へ戻る', 'Return to the pressure panel'), 'ship-pressure', t('針と固定灯を確かめに戻る。', 'I return to check the needle and latch lamp.')),
    a('electric-to-check', t('手を離して表示を見直す', 'Step back and review the readings'), 'ship-check', t('押す前に、一度手を離す。', 'Before pressing again, I take my hands away.')),
  ] },
  { id: 'ship-result', challenge: 'launch', title: t('止まった点火', 'Ignition stopped'), narrative: [
    t('船はまだ床の上だ。表示と、今押した操作を思い返す。安全装置の封印には「解除後は圧力喪失・火災の危険」とある。', 'The ship remains on the floor. I recall the displays and the control I just pressed. The safety seal reads “Override risks pressure loss and fire.”'),
    t('AI：封印を破って点火すれば、取り返しがつきません。確認と再操作はできます。', 'AI: Breaking the seal and firing is irreversible. You can still check and operate the controls again.'),
  ], additions: [...stateProse, ...launchReadings,
    { when: { challenges: [{ id: 'launch', attemptsMin: 2 }] }, text: t('繰り返す冷却と操作で、息が弾む。次の試行はさらに空気を使う。', 'Repeated cooling and operations leave me panting. The next attempt will use more air.') },
  ], choices: [
    a('launch-retry', t('操作盤へ戻る', 'Return to the controls'), 'ship-check', t('残った表示から考える。全部を戻す必要があるかも、自分で決める。', 'I think from the remaining readings. I decide whether anything needs resetting.')),
    a('launch-reset', t('圧力を解除して最初から扱う', 'Release pressure and start the setup over'), 'ship-check', t('針が端へ戻り、青い灯りが消える。外部の線はそのままだ。', 'The needle returns to the edge and the blue lamp goes out. The external line stays as it was.'), { effect: set('launch', { pressure: 'open', ignition: 'cold' }) }),
    a('launch-review', t('手順票を見に行く', 'Review the procedure plate'), 'ship-read', t('今の表示と、票の絵を見比べる。', 'I compare the readings with the diagram.'), { effect: { oxygen: 1, learn: ['launch-interlock'], challenges: [{ id: 'launch', observe: 'launch-plate' }] }, routes: [{ when: { items: ['light'] }, next: 'ship-read', effect: { oxygen: 0, learn: ['launch-interlock'], challenges: [{ id: 'launch', observe: 'launch-plate' }] } }] }),
    a('force-ignition', t('危険の封印を破り、強制点火する', 'Break the danger seal and force ignition'), 'launch-over', t('赤い封印を破る。止めてくれる音は、もう鳴らなかった。', 'I break the red seal. The sound that could stop me never comes.')),
  ] },
  { id: 'clear', title: t('GAME CLEAR', 'GAME CLEAR'), ending: 'clear', narrative: [
    t('月面基地が小さくなる。船の空気を胸いっぱいに吸う。怖かった光も、戻った針も、今は帰り道を作った手掛かりだ。', 'The lunar base grows small. I fill my chest with the ship’s air. The frightening light and falling needle became clues that made my way home.'),
    t('「帰ったら、何もしない日をつくる」\n\nAI：本日の実験記録は私がまとめます。あなたは休んでください。', '“When we get home, I am having a day of doing nothing.”\n\nAI: I will write up today’s experiments. You may rest.'),
  ], choices: [] },
  { id: 'oxygen-over', title: t('GAME OVER', 'GAME OVER'), ending: 'over', narrative: [
    t('何度も待ち、試し、戻った。今度はファンの音だけが続く。息を吸っても、胸まで届かない。', 'I waited, tried, and turned back too many times. Now only the fan keeps going. I breathe in, but nothing reaches my chest.'),
    t('AI：酸素が尽きました。', 'AI: Oxygen depleted.'),
  ], choices: [] },
  { id: 'injury-over', title: t('GAME OVER', 'GAME OVER'), ending: 'over', narrative: [
    t('痛む腕を、また強くぶつけた。床へ手をついても体を支えられない。扉が、届かないほど遠い。', 'I struck the aching arm hard again. My hand cannot support me on the floor. The door is too far away.'),
    t('AI：移動を続けられません。', 'AI: You can no longer move.'),
  ], choices: [] },
  { id: 'launch-over', title: t('GAME OVER', 'GAME OVER'), ending: 'over', narrative: [
    t('解除した安全弁から空気が引き出される。船の窓が消えた。点火の震えは、上へ向かわない。', 'Air pulls out through the overridden safety valve. The ship’s window goes dark. Ignition shakes the ship without lifting it.'),
    t('AI：安全装置は解除されています。停止できません。', 'AI: Safety override active. Unable to stop.'),
  ], choices: [] },
]
export const scenes = Object.fromEntries(sceneList.map(scene => [scene.id, scene])) as Record<SceneId, Scene>
