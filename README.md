# EXIT SEQUENCE

ターミナル風UIで遊ぶ短編SFダンジョンRPG。損傷した月面基地を探索し、自分で作ったキャラクターの能力と装備でロボットを突破し、帰還船で地球へ向かう。

- 3区画、通常敵2種＋ボス、3～4戦、LV1～3。
- BODY / TECH / SENSE、開始時に2ポイント配分。
- 行動予告のある完全ターン制。HP0でGAME OVER、帰還船離脱でCLEAR。
- 6種類の装備／アイテム、寄り道、能力によるイベント突破、レベルアップ。
- ja/en、320pxスマホ、タップ操作、typewriterとtap skip、reduced-motion対応。

初見10～15分を目標とするプロトタイプ。面白さと実プレイ時間は人間による評価待ち。

## 開発と検証

Node 24以降。`npm ci`、`npm run dev`。`npm test`、`npm run build`、`git diff --check`。

Chromiumを用意し、開発サーバー起動中に `npm run test:browser`。既定は `/usr/bin/chromium` と `http://127.0.0.1:5173/exit-sequence/`。`CHROMIUM_PATH`、`EXIT_SEQUENCE_URL`、`EXIT_SEQUENCE_ARTIFACTS`で変更可能。結果と画像は `/tmp/exit-sequence-browser`。

仕様は [game-design](docs/game-design.md)、[prototype-spec](docs/prototype-spec.md)、[writing-style](docs/writing-style.md)、[ui-layout](docs/ui-layout.md)、[implementation-report](docs/implementation-report.md)。mainへ検証済みの実装をpushし、GitHub Pagesで確認する。
