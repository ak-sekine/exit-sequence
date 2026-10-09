# EXIT SEQUENCE

**単純な共通ルールから複数の攻略法を作れるか**を試す、小さなターン制Web脱出ゲーム。

8×8の3ステージで @ を G へ。PLAYER / ROBOT / BOXは同じ処理で連鎖して押され、HOLEに入った物体は消える。ROBOTはPLAYERの成功移動後に1回だけ近づく。出口への到達方法は共通ルールと初期配置から生まれ、専用の攻略スクリプトはない。

- 画像を使わない緑のモノスペース盤面。ja/en、320pxスマートフォン、タップだけで遊べる。
- 回数制限のないUNDO、現在ステージのRESTART、NEXT STAGE、PLAY AGAIN。
- ロボットを消しても残しても脱出でき、STAGE 3ではロボットに押されて出口へ入る方法も成立。
- 戦闘、能力値、成長、アイテム、物語、スコア、時間制限、乱数、セーブ、バックエンドなし。

人間プレイで歩くだけのCLEARが判明したため、配置を「相互作用は必須、利用方法は複数」へ修正した。全ステージで相互作用なしのCLEARは0件。自動テストはルール・必須相互作用・異なる利用方法・操作を確認するもの。発見の面白さは人間による評価待ち。

## 開発と検証

Node 24.19以降（.nvmrc）。`npm ci`、`npm run dev`。

```sh
npm test
npm run test:levels
npm run build
git diff --check
```

`npm test`は同一プロセスのNode test runnerで28件の単体・探索テストを実行する。`npm run test:levels`は盤面グラフと攻略signatureのBFS探索、WALK-ONLYの不存在、必須相互作用、最短手数・経路・signature、具体的な異なる利用方法を表示し、詳細を`/tmp/exit-sequence-search.json`へ出力する。探索処理はテスト側のみ。

Chromiumを用意し、開発サーバー起動中に`npm run test:browser`。既定は`/usr/bin/chromium`と`http://127.0.0.1:5173/exit-sequence/`。`CHROMIUM_PATH`、`EXIT_SEQUENCE_URL`、`EXIT_SEQUENCE_ARTIFACTS`で変更できる。320×640のja/enタップ操作で全ステージ、異なる攻略、FAIL、UNDO、RESTART、NEXT STAGE、PLAY AGAIN、44px、横スクロールなし、模擬Safe Areaを検証。結果と画像は`/tmp/exit-sequence-browser`。本番にテスト観測APIは含めない。

仕様は[game-design](docs/game-design.md)、[prototype-spec](docs/prototype-spec.md)、[ui-layout](docs/ui-layout.md)、[writing-style](docs/writing-style.md)、[implementation-report](docs/implementation-report.md)。検証済みの実装はmainへcommit・pushし、GitHub Pagesで確認する。
