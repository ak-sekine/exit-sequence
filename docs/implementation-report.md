# 共通pushプロトタイプ：実装と検証

2026-10-09、最新origin/mainを取得し、`1a16089bd6f6e788f20fae466089adb93a27b1f0`を基準にmain上で実装した。AGENTS.md、README、指定の5文書、src、tests、package.jsonを確認した。

## 置換と共通ルール

以前のRPGのBODY / TECH / SENSE、HP、レベル・経験値、キャラクター作成、戦闘、敵HP・行動予告、装備・アイテム、イベント、寄り道報酬、戦闘によるGAME OVERを削除した。src/scenario.ts、src/items.ts、tests/story.test.ts、tests/routes.tsを削除し、旧エンジン・UI・文章・テストを置換。現行仕様としてRPG文書を残していない。

model.ts / levels.ts / game.ts / main.tsに責務を分離。地形と物体は別データ。共通pushは連鎖を全部検査してから全物体を1マス移動する。壁・盤面外なら全体不成立。PLAYER / ROBOT / BOXごとのpushコピーや専用衝突処理はない。穴は物体だけを消し、出口は床。PLAYERだけが到達主体に関係なくCLEARする。

ROBOTは成功したPLAYER移動後だけ1回行動する。横を優先して近づき、横が塞がれていれば縦へ近づく。横が同じなら縦のみ、両方不可能なら静止。全て共通pushを使い、経路探索・乱数はない。PLAYERフェーズでFAIL/CLEARなら終了し、ROBOTは動かない。ROBOTフェーズ後にも同じ終了判定をする。

UNDOは成功入力前の完全なGameStateを保存し、開始まで何度でも復元する。消えた物体、終了状態、ターンも戻る。RESTARTは現在ステージを初期化。NEXT STAGEとPLAY AGAINも履歴を初期化する。言語はUI状態だけで、永続保存しない。

## 3ステージと機械的な攻略

| ステージ | 構成と狙い | 探索した重複なし状態 | CLEAR終端数 |
| --- | --- | ---: | ---: |
| 1 | BOX 2、HOLE 2、ROBOTなし。箱の列、穴、迂回可能な床で移動・連鎖を試す | 16,908 | 498 |
| 2 | BOX 1、ROBOT 1、HOLE 2。押せる／押されるロボットを消しても残しても脱出 | 1,407 | 54 |
| 3 | BOX 2、ROBOT 1、HOLE 2。開けた床で押す方向とロボットの位置関係を試すサンドボックス | 20,998 | 600 |

全ステージ8×8、PLAYER・GOAL各1。BFSは到達可能な状態を展開し終えている。600,000状態の上限には達していない。キーは物体の種類・位置・存在、status、CLEAR到達主体。箱IDは交換可能として正規化し、ターン・結果文・履歴を除く。数値は**重複なしのCLEAR終端状態数**で、全操作列の総数や人間が感じる攻略の数ではない。各終端への探索木上の最短経路を1つ持つ。無意味な同一状態への往復は数えない。

以下は探索が生成した再現例。画面や本番エンジンには含めていない。各例に状態の再訪がないことをテストで確認する。

| ステージ・方法 | タップ順序 |
| --- | --- |
| 1・自力で出口へ | ↓ ↓ → ↓ → → |
| 2・ロボットを残して出口へ | ↓ ↓ → ↓ → → → |
| 2・ロボットを穴へ押してから出口へ | ↓ ↓ → ↓ → ← → → → |
| 3・ロボットを穴へ誘導してから出口へ | ↑ ↓ → → ↓ ↓ ← |
| 3・ロボットを残し、自力で出口へ | → → ↓ ↓ ← |
| 3・ロボットに押されて出口へ | ↓ ↓ |

STAGE 2の←はロボットを左下の穴へ押し込む実際の状態変化で、単なる往復差ではない。STAGE 3の消失経路は、箱を押しながら追いかけるロボットを右上の穴へ誘導する。残す経路では箱を下へ押し、ロボットを押し戻しながら出口へ入る。

STAGE 3の押される経路では、1手目にROBOTがBOXを押し、2手目にPLAYERがそのBOXを下へ押して列に入る。続くROBOTの横pushがPLAYERをGOALへ送り、同じ到達判定でALL CLEARになる。専用イベント、手順判定、攻略ヒントはない。

## 単体・探索テスト

`npm test`：27件PASS。PLAYER移動、壁／盤面外、BOX／ROBOT押し、PLAYER→BOX→ROBOT、ROBOT→BOX→PLAYER、BOXを移動主体とする共通処理、壁による全連鎖停止、各物体の穴消失、PLAYERのFAIL、自力CLEAR、押されてCLEAR、押されてFAIL、BOX／ROBOTのGOAL非CLEAR、成功入力後だけROBOT行動、決定論・横優先・縦fallback・静止、ROBOT自身の穴落下、完全状態UNDO・複数UNDO・物体復元・失敗から復帰、RESTART・NEXT STAGE・最終ALL CLEAR・PLAY AGAIN、配置検証、日英非進行、全探索と異なる攻略を確認した。

`npm run test:levels`：上記全探索・再現経路を出力。`npm run build`：TypeScriptとVite成功。`git diff --check`：成功。solverはtests内だけで、buildの入力に含まれない。

## Chromium

`EXIT_SEQUENCE_URL=http://127.0.0.1:5174/exit-sequence/ npm run test:browser`：PASS。OSの`/usr/bin/chromium`、320×640、touch/mobile、ja/en各1周以上。全3ステージ、STAGE 2の2方法、STAGE 3の3方法、最終ALL CLEARを実際の方向ボタンのtapで再現。各入力後に参照Gameの完全状態とUNDO数を比較した。テスト時に読み取り専用観測関数を開発レスポンスへ注入するだけで、本番APIは追加していない。

各ステージでPLAYERが穴に落ちてFAIL、UNDO復帰、RESTARTを確認。連鎖押し・BOX消失・複数UNDOで開始へ戻る操作、CLEAR後のUNDO、NEXT STAGE、PLAY AGAIN、日英切替で状態と履歴が変わらないこと、補助矢印キーも確認した。ゲーム進行はタップだけで完結する。

方向ボタンは52×44px、全表示ボタンは44×44px以上。盤面セルは正方形。320pxでdocument/bodyの横幅320px、横スクロールなし、タイトルとメニューの非重複、通常の全操作が640pxの画面内に収まることを確認した。Safe Areaは実機の切り欠きではなくCSS変数を24/16/20/16pxへ置き換える模擬確認。四辺paddingと横スクロールなし、tapによる操作継続を検証した。画面の高さが不足すれば縦スクロールを許す。

成果物は`/tmp/exit-sequence-search.json`、`/tmp/exit-sequence-browser/report.json`、日英の初期・FAIL・CLEAR・異なる攻略のスクリーンショット。ブラウザのpageerrorは0。実行環境ではnpmの既定キャッシュが書き込めなかったため`npm ci --cache /tmp/exit-sequence-npm-cache`で依存を準備した。5173が使用中だったため検証サーバーは5174を使用した。

## 人間ではまだ評価できていない点

- 想定外の方法を思いついた感覚があるか。
- 自分で発見した感じがあるか。
- 他の方法も試したくなるか。
- 3ステージ遊んでも単なるSokobanに感じないか。
- ROBOTを「敵」ではなく道具として利用したくなるか。

これらは人間の初見プレイによる評価待ち。STAGE 1の迂回やSTAGE 3の短い攻略が、発見を促すか・すぐ終わるだけになるかも未評価。自動テストの成功や多数の終端状態から面白さを断定しない。次の判断は追加ステージや追加ギミックより先に、この最小ルールでのプレイ観察に基づく。
