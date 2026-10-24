import { readFileSync, writeFileSync } from 'node:fs'

const catalog = JSON.parse(readFileSync(new URL('../docs/event-catalog.json', import.meta.url), 'utf8'))
const esc = value => String(value ?? 'なし').replaceAll('|', '\\|').replaceAll('\n', ' ')
const refs = event => event.linkedResources?.join('、') || 'なし'
const ids = values => values?.length ? values.join('、') : 'なし'
const statusCounts = Object.fromEntries(['未制作', '作業中', '本文完成', '要確認'].map(status => [status, catalog.events.filter(event => event.phase3Status === status).length]))
const browserReadyCount = catalog.runtimeReady ? catalog.events.length : 0
const zone1Batches = Array.from({ length: 4 }, (_, index) => catalog.events.filter(event => event.zone === 1).slice(index * 10, index * 10 + 10))

let ledger = `# イベント一覧・Phase 2制作台帳

## 制作状態

- 設計済み: **${catalog.events.length}/200件**（各イベントの構成と因果方針まで）。
- Phase 3本文完成: **${statusCounts['本文完成']}/${catalog.events.length}件**。
- Phase 3未制作: **${statusCounts['未制作']}/${catalog.events.length}件**、作業中: **${statusCounts['作業中']}件**、要確認: **${statusCounts['要確認']}件**。
- ブラウザで使用可能: **${browserReadyCount}/${catalog.events.length}件**（runtimeReady=${catalog.runtimeReady}。本文完成数とは別の統合状態）。
- 「要確認」は本文データが存在しても、人による最終レビュー待ちを含む。自動構造検証の通過を文章レビュー済みとは数えない。
- Phase 4イラスト: **0/200件**。既存10枚は旧15マス版用のまま。
- この台帳JSONは docs/event-catalog.json。本文未完成の概要をランタイムイベントとして扱わず、runtimeReady=false とする。
- 本文台帳、依存表、NPC表はJSONから生成する。元データを変更した後に npm run render:phase2 を実行する。
- 1回の進行では区画ごとに最大20イベント、同じIDは再使用しない。通常イベントは過去状態を要求せず抽選可能。連携イベントの成立失敗時は各区画に30件ある通常候補から進行する。
- 連携イベントの保証は指定条件が成立した時だけ発動する。保証イベントはその区画の通常抽選から除外し、状態が成立した後続区画で優先する。

## 既存10イベントの配置

| 区画 | ID | 名称 |
|---|---|---|
| 最深部 | bulkhead | ごきげんななめの隔壁 |
| 最深部 | battery | 拾いもののバッテリー |
| 廃棄物処理区画 | leak | ぴりぴり水たまり |
| 廃棄物処理区画 | conveyor | 止まらない搬送台 |
| 生産・整備区画 | generator | 二度寝中の発電機 |
| 生産・整備区画 | emergency | 非常電源の切替器 |
| 管理・保守区画 | terminal | おしゃべりな制御端末 |
| 管理・保守区画 | cargo-rail | 居座る貨物台車 |
| 地上接続区画 | charger | 気難しい充電装置 |
| 地上接続区画 | lift | 途中で休む昇降機 |

IDは維持した。旧15マス本文・確率・結果を100マス仕様に移植した扱いにはしない。Phase 3で各イベントの選択肢と状態効果を別途制作する。

## 区画別一覧

| 区画 | 距離 | 通常 | 連携 | 総数 | 最大予約数 |
|---|---:|---:|---:|---:|---:|
${[1,2,3,4,5].map(zone => { const items=catalog.events.filter(e=>e.zone===zone); return `| ${zone} ${['最深部','廃棄物処理区画','生産・整備区画','管理・保守区画','地上接続区画'][zone-1]} | ${(zone-1)*20+1}〜${zone*20} | ${items.filter(e=>e.category==='normal').length} | ${items.filter(e=>e.category==='linked').length} | ${items.length} | ${items.filter(e=>e.guarantee.needed).length} |` }).join('\n')}

### Phase 3 区画1の10件単位の進捗

${zone1Batches.map((batch, index) => `- P3-01-${String(index + 1).padStart(2,'0')} (${batch.length}/10): ${batch.map(event => `${event.id}［${event.phase3Status}］`).join('、')}`).join('\n')}

### 各イベントで定義する項目

各行には最終ID、名称、区画、通常/連携分類、発生内容、独自性、3行動の方向性、出現条件、保証要否、状態変化、関連資源、後続ID、後続効果、因果説明方針を記録する。個別項目の詳細な記述はJSON台帳を参照する。

${[1,2,3,4,5].map(zone => {
 const items=catalog.events.filter(e=>e.zone===zone)
 return `### 区画${zone}: ${['最深部','廃棄物処理区画','生産・整備区画','管理・保守区画','地上接続区画'][zone-1]}（${(zone-1)*20+1}〜${zone*20}）\n\n| ID / 名称 / 分類 | 起きること / 固有性 | 3行動の方向性 | 条件 / 保証 | 状態変化 / 関連資源 | 後続 / 影響 | 因果説明方針 |\n|---|---|---|---|---|---|---|---|\n${items.map(e=>`| ${esc(e.id)} / ${esc(e.name)} / ${e.category==='normal'?'通常':'連携'} | ${esc(e.what)}。${esc(e.distinctive)} | ${e.actionDirections.map(esc).join(' / ')} | ${esc(e.condition)} / ${e.guarantee.needed?'必要':'不要'} | ${esc(e.stateChange)} / ${esc(refs(e))} | ${ids(e.followUpEventIds)} / ${esc(e.followUpEffect)} | ${esc(e.causalExplanation)} |`).join('\n')}\n`}).join('\n')}

## Phase 3へ渡す制作境界

本文制作では各イベントに3選択肢を作り、成功率、条件成立時の成功率、成功/失敗の電力差分と文章、状態効果を定義する。条件成立時にも通常の進行方法を残す。成功・失敗のどちらでも電力が残れば次へ進み、0なら停止、100マス目で電力が残ればCLEAR。失敗文の意味レビューは人が行う。

Phase 1の prototype-* 6件、旧15マス用の画像10枚、シミュレーションfixtureは200件の完成数に含めない。
`
writeFileSync(new URL('../docs/event-catalog.md', import.meta.url), ledger)

const edges = new Map()
for (const event of catalog.events) {
  for (const nextId of event.followUpEventIds ?? []) edges.set(`${event.id}->${nextId}`, [event.id, nextId])
  for (const next of catalog.events.filter(candidate => (candidate.relatedEventIds ?? []).includes(event.id))) {
    edges.set(`${event.id}->${next.id}`, [event.id, next.id])
  }
}
const dependencyLines = [...edges.values()].map(([fromId,toId]) => {
 const from=catalog.events.find(e=>e.id===fromId), to=catalog.events.find(e=>e.id===toId)
 return `| ${fromId} | ${toId} | ${esc(from.stateChange)} | ${esc(to.condition)} | ${to.guarantee.needed?'予約保証: '+esc(to.guarantee.reason):'保証なし'} | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | ${esc(to.causalExplanation)} |`
}).join('\n')
const dependencyDoc = `# イベント連携依存関係

Phase 2カタログ全件の依存台帳。正本は docs/event-catalog.json。各リンクは起点イベントの効果が後続区画の状態条件に届く関係を表し、イベント本文/確率/電力差分の完成を意味しない。

## 到達性と保証予約の設計

- 全ての起点イベントは後続イベントより前の区画にある。区画終盤で既に通過した区画へ予約するリンクはない。
- 保証は条件成立後、対象区画の未使用イベントとして予約する。保証イベントの条件と出現条件は同じ状態を参照する。
- 同時成立数の安全側上限は区画別の保証対象総数で評価する。最大は ${Math.max(...[1,2,3,4,5].map(z=>catalog.events.filter(e=>e.zone===z&&e.guarantee.needed).length))}件/20マスであり、重なっても容量内。
- 条件不成立なら保証イベントを予約しない。各区画に過去状態を要求しない通常イベント30件があるため、連携不成立だけで候補不足にならない。
- 連携の因果は、取得した物の規格/形、復旧した設備の配線、記録した情報、救出したNPC本人の記憶で説明する。根拠のない数値ボーナスは置かない。
- 依存エッジは区画番号が常に増えるDAG。全状態のゲーム実行探索ではなく、構造・条件参照・区画順・予約上限の検査である。

## 全依存リンク

| 依存元 | 依存先 | 起点の状態変化 | 後続条件 | 保証条件 | 不成立時 | 因果関係の説明方針 |
|---|---|---|---|---|---|---|
${dependencyLines}

## アイテム利用順と所持上限

既定上限は3個。イベント単位で1つずつ拾う想定で、消費型は次区画の保証利用機会で消費し、再利用型は以後も所持できる。

| ID | 区分 | 取得 | 利用 | 計画 |
|---|---|---|---|---|
${catalog.items.map(i=>`| ${i.id} (${i.name}) | ${i.reusable?'再利用型':'消費型'} | ${i.acquireEventId} | ${i.useEventId} | ${i.capacityPlan} |`).join('\n')}

### 情報タグ

| タグ | 読み取るイベント | 利用イベント |
|---|---|---|
${(catalog.informationTags ?? []).map(info=>`| ${info.id} (${info.name}) | ${info.setEventId} | ${info.followUpEventId} |`).join('\n')}

任意選択で使用機会を見送った場合も、通常経路は残る。3枠を超えて必ず破棄させる連続取得は置かず、取得後の利用機会をPhase 3でも残す。
`
writeFileSync(new URL('../docs/event-dependencies.md', import.meta.url), dependencyDoc)

const npcDoc = `# NPC設定カタログ

100マス版の連続イベントに登場する${catalog.npcs.length}体。登場・再会IDはすべて別ID。再会は初回で救出された場合だけ条件が成立し、重要な再会は後続区画で保証する。

| NPC ID / 名前 | 外見 | 性格 | 話し方 | 得意分野 | 初登場 / 再登場 | 成立条件・再会効果 | 不成立時 |
|---|---|---|---|---|---|---|---|
${catalog.npcs.map(n=>`| ${esc(n.id)} / ${esc(n.name)} | ${esc(n.appearance)} | ${esc(n.personality)} | ${esc(n.voice)} | ${esc(n.expertise)} | ${esc(n.firstEventId)} / ${ids(n.revisitEventIds)}${n.thirdEventId?` / 3回目 ${esc(n.thirdEventId)}`:''} | ${esc(n.successCondition)} ${esc(n.reunionCondition)} ${esc(n.reunionEffect)} | ${esc(n.failureHandling)} |`).join('\n')}

## 会話・状態の共通規則

- 初回救出の成否をNPC状態として記録し、再会条件には同じIDの rescued 状態を使う。
- 助けていない/助けられなかったNPCに、救出への感謝や恩返しをさせない。
- 再会時は初回の道具、言葉、約束、失敗を具体的に思い出す。効果は成功率/電力に限らず、案内、視認性、安全な通路、物語上の再会を含む。
- 同じNPCの外見・性格・声を初回から再会まで維持する。第三イベントがある場合は前回の状態遷移も台詞に反映する。
`
writeFileSync(new URL('../docs/npc-catalog.md', import.meta.url), npcDoc)

console.log(`Rendered ${catalog.events.length} event entries, ${edges.size} dependency links, and ${catalog.npcs.length} NPC records.`)
