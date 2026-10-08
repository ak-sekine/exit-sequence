# ゲームブックUI仕様

ゲーム画面には、物語と今できる行動を置く。ヘッダーは `EXIT SEQUENCE` と右上のhamburger menu（≡）、中央はこれまでの物語ログ、下部は現在SceneのChoice。下部ナビゲーション（STATUS / INVENTORY / KNOWLEDGE / HELP / SETTINGS）は廃止する。状態・持ち物・Knowledgeは内部Stateとして保持し、本文・条件付き文章・Choiceに反映する。一覧画面や常設HELPは置かない。

右上メニューは言語設定のみ。最初は「言語 >」／「LANGUAGE >」、次の階層に「日本語」「English」を表示する。dropdownは物語を置き換えず、絶対配置でログやChoiceの位置・高さを変えない。メニューボタンの再押下、メニュー外のタップ、Escapeで閉じる。閉じると階層をリセットする。ネイティブbuttonに日本語 `aria-label="メニュー"`／英語 `aria-label="Menu"`、`aria-expanded`、`aria-controls`を設定する。言語階層へ進むと最初の言語ボタンへ、Escapeと選択後はメニューボタンへフォーカスを戻す。

言語変更は非進行。UI・本文・Choiceを即時翻訳し、document.documentElement.langを更新、言語だけlocalStorageへ保存する。GameState、Scene、Choice、historyを変更せず、物語進行・undoは発生しない。保存が禁止された環境でもプレイ可能。メニュー開閉・階層移動はログを再描画しない。言語変更時も読んでいたスクロール位置を保つ（文章量に応じてブラウザが末尾へ制限する場合を除く）。

物語選択確定時に `> 行動文章`、結果、次Sceneを記録する。物語Choiceはundo不可。過去ログのタップで再実行しない。履歴のStateはコピーとして保存し、言語変更で再翻訳しても後で得た知識を過去へ適用しない。読む時間も進行しない。

START前はヘッダー・導入文・START、終了後はヘッダー・Endingを含む物語ログ・RESTART。いずれも言語変更可能。RESTARTで履歴とGameStateを初期化する。ゲームのセーブはない。

画面高100dvh（100vhフォールバック）、四辺Safe Area、最大幅720px。320pxでもタイトルと≡を重ねず、横スクロールを出さない。ページ全体は固定し、ログのみ縦スクロール。本文14px、line-height 1.8、段落間隔14px、overflow-wrapで長文を折り返す。最新Scene表示時はログ末尾へ追従する。

Choiceは全幅で一列。通常2～5行動（条件で減る）。固定6枠・方向・ページ送りを使わない。日英の長い行動文を切らずに折り返し、Choiceの高さとメニューボタンの幅・高さを最低44px確保する。START / RESTARTとdropdownの項目も44px以上。

緑色テーマ：本文・Choice・タイトルは `#4ade80`、主要枠線は `#2f7548`、背景は `#07100f`、ボタン背景は `#0d211d`。フォーカスは明るい同系色 `#a7eac9` の輪郭で示す。

新Scene本文は5ms/文字で表示（仮演出値）。入力・過去ログは即時。表示中はChoice・RESTART・メニューボタンを無効化し、ログのタップで全文表示して操作可能にする。prefers-reduced-motionでは即時表示、表示中のreduce変更でも完了させる。AI段落はAI：/AI:。role=log、aria-busy、言語と領域ラベルを維持する。

Chromiumテストは320×640の日英で、START前・ゲーム中・両OVERとCLEAR後のメニュー、非進行・言語保存・過去ログ、両分岐・Knowledge・Item・body・oxygen・threat、タイプ表示・tap skip・reduced motionを確認する。通常操作だけで進め、read-onlyなテスト観測を開発レスポンスへ注入する。本番に状態変更APIを追加しない。各操作後に横幅・44px・ログ領域、dropdownの画面内配置とログ／Choice位置不変を検査する。
