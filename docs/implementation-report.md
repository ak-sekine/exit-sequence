# SFゲームブック再設計 実装報告

本書は再設計時の実装記録。現行UIは [ui-layout.md](ui-layout.md) を正本とし、参照画面・下部ナビゲーションは廃止、右上メニューの言語設定のみを提供する。Game.read()も削除済み。ゲームState・シナリオとその条件・効果は維持している。

UI簡素化の回帰確認：最新main `fe1e2ae` を基準に全1,893到達StateとChoice遷移を照合し一致。18 Scene・46 Choice、model/scenario/itemsは変更なし。npm test（個別11件）、build、git diff --check、日英320×640 Chromium 46項目が成功。言語変更のState・履歴・Choice不変、開始前と両OVER／CLEAR後、メニュー開閉・Escape・外側タップ、実Choiceによる全内部状態とEnding、typewriter・tap skip・reduced motion、保存言語の再読込を確認。非ゼロSafe Areaは開発CSSレスポンスのenv値を模擬し、5 Choiceとdropdownが画面内に収まることを確認した。本番コードへテスト用APIは追加していない。

2026-10-08。最新main `d666c43` からmainに直接実装。AGENTS.md、指定4文書、main/game/map/items/i18n/balanceと旧テストを確認。PROJECT.mdは存在しない。

読む → 現象から推測 → 主人公の行動を選ぶ → 知識・道具・状態・脅威が変化 → 次Sceneを読む、という固定シナリオに置き換えた。18 Scene（進行15、CLEAR1、OVER2）、Knowledge4、Item4、状態カテゴリ3。記録と整備の分岐、遭遇割込みと気密室への収束を持つ。

## 構造と変更ファイル

- src/model.ts（追加）：SceneId、GameState、Condition、Effect、Choice、Sceneの型。
- src/scenario.ts（追加）：全Scene、日英文章、条件付き認識、Knowledge、条件別遷移。
- src/game.ts：条件判定、Choice検証・適用、酸素枯渇の優先判定、非進行参照。シナリオの巨大switchなし。
- src/items.ts：4種の携帯品と観測可能な説明。
- src/i18n.ts：共通UI翻訳、言語初期化・保存。状態から独立。
- src/main.ts、src/style.css：文章ログと行動、独立した参照UI。320pxの一列ボタン、タイプ表示・タップスキップ。
- docs/game-design.md、prototype-spec.md、writing-style.md、ui-layout.md：新設計へ全面更新。
- README.md、本書：現仕様と検証手順へ更新。
- tests/game.test.ts、i18n.test.ts、browser-check.mjs：Scene・知識・道具・状態・文章・Ending・言語・UIへ置換。
- tests/routes.ts（追加）：初期状態から通常操作だけの複数CLEARとOVER手順。

削除：src/map.ts、src/balance.ts、旧balance／マップ攻略／巡回／座標／カメラ／次行動予測／隔壁／誘導経路／ENERGYコード、旧escape-route・DOMハーネス・旧UI/文章回帰テスト。旧仕様はGit履歴に残り、現行コードへ保管しない。

## 具体例

序盤の二本の黒い痕を、全記録で得たアーム旋回の知識で認識し直し、低い配管の陰を使う行動が出る。青い表示は停電時も消えず、銘板を読んだ後に独立電源として使える。光の知識とライト／工具は走査回避方法を増やす。工具は空気を使わず手順票を読めるため、単なる鍵ではない。

全記録は知識3つと引き換えに酸素・警戒を各1段階悪化。要約は光の事実だけ。待機は警戒を下げても空気を失い、読み残した終盤の手順を読めなくなることがある。手修正・レバーは空気を節約するが負傷し、以後の行動が制限される。

Stateは正常／負傷、酸素十分／少ない／危険、警戒低／中／高。音と長い再生で警戒が上がり、光・撤退・待機・デコイで下がる。高警戒時の危険な騒音操作で遭遇。酸素が危険なままさらに空気を使えばOVER。予備容器は一度だけ十分へ戻す。乱数・リアルタイム消耗なし。

CLEARは正しい圧力固定→点火。OVERはロボット前で消灯静止、酸素枯渇、逆順点火による排気。通常操作の例と全状態変化はprototype-spec.mdとtests/routes.tsに記載する。

## 検証

npm test、npm run build、git diff --checkはすべて成功。個別テスト10件、Chromiumの日英320×640テスト32項目も成功。ユニットテストは全到達可能Stateを探索し、全18 Sceneと全46 Choiceの到達を確認する。ブラウザは状態を書き換えず、STARTから実ボタンだけで記録・整備・デコイ・非常灯のCLEAR、ロボットと酸素のOVER、補給、再開始を検証する。

各行動後に横スクロールなし、全ボタン44px以上、文字切れなし、ログ領域確保を検査。STATUS・INVENTORY・KNOWLEDGE・HELP・SETTINGS・LANGUAGE・BACKで進行しない。タイプ表示中のロック、タップ全文表示、reduced-motion切替を確認。スクリーンショットとレポートは `/tmp/exit-sequence-browser/`。

10～15分は読解・判断体験の目標。自動操作の実行時間を人のプレイ時間とみなさず、体験時間と面白さは今後のユーザープレイで評価する。最終検証結果とcommit/push・SHA一致・cleanは完了メッセージで報告する。
