> 旧グリッドパズルの履歴資料。現在の実装仕様は[dungeon-sample.md](dungeon-sample.md)と[ui-layout.md](ui-layout.md)を参照。今回のサンプルには適用しない。

# 配置修正：実装と検証

2026-10-09、最新 origin/main を取得し、`63bae54476e0700747702e26761d563deeef0142` を基準に main で作業。AGENTS.md、指定文書、README、model / levels / game / main、tests、package.json を確認した。

## 問題と変更範囲

人間の実プレイで、箱やROBOTをほとんど使わず歩くだけでCLEARできる問題が判明した。設計原則を **相互作用は必須、利用方法は複数** とし、src/levels.tsと探索・UI再現テストを修正した。共通push、ターン順序、ROBOT行動、穴・出口の判定、UNDO等の本番ルールは変更していない。UI・ja/en説明も維持し、新ギミック・攻略ヒントは追加していない。

旧配置のCLEAR終端数498 / 54 / 600は異なる攻略法の数ではなく、ゲーム性の根拠として扱わない。今回も状態数やsignature集合の数から面白さを断定しない。

## 探索方法

solverはtests内だけ。盤面グラフをBFSで構築し、必須イベントを禁止した部分グラフの全到達状態からCLEARの不存在を確認する。分類は別の（盤面、累積イベント集合）積グラフで探索する。同じ盤面の異なる履歴を捨てない。既存push / robotTurnのmoved / fallenで各フェーズを観測し、stepの状態遷移を使用する。本番にsolver、signature、操作列、ステージ固有処理を追加していない。

集合に往復が付加したイベントを攻略数として扱わない。以下の再現例は全て盤面の再訪なしで検証し、物体の存続と消失、出口への到達主体など実際の利用の違いを確認する。盤面600,000 / 積グラフ2,000,000の上限超過は失敗扱い。最初のCLEARがBFS最短解。

## STAGE 1

通路の同じ箱を退かすか穴へ落とすかで、通り道を自分で作れることを発見してほしい。

```text
########
#...#..#
#.@.O..#
#...B..#
#B...#G#
#...#..#
#...#O.#
########
```

盤面708状態、分類727ノードを完全探索。WALK-ONLY CLEAR = 0、pushなしCLEAR = 0。PLAYER_PUSH_BOXなしCLEAR = 0。

最短 **8手**：↓ ↓ → → ↑ → → ↓

signature：PLAYER_PUSH_BOX, BOX_DROPPED_IN_HOLE

| 利用方法 | 手数 | 再現入力 | signature |
| --- | ---: | --- | --- |
| 箱を退かして残す | 8 | ↓ → → → ↑ → ↓ ↓ | PLAYER_PUSH_BOX |
| 箱を穴へ落とす | 8 | ↓ ↓ → → ↑ → → ↓ | PLAYER_PUSH_BOX, BOX_DROPPED_IN_HOLE |

## STAGE 2

ROBOTが押した箱とROBOT自身の位置を使い、消すか残すかの通り方を発見してほしい。

```text
########
#...#..#
#.@.#O.#
#..BR.G#
#...#..#
#O..#..#
#...#..#
########
```

盤面225状態、分類1116ノードを完全探索。WALK-ONLY CLEAR = 0、pushなしCLEAR = 0。意味のあるROBOT相互作用なしCLEAR = 0。

最短 **9手**：↑ ↓ ← ↓ → → → → →

signature：PLAYER_PUSH_BOX, ROBOT_PUSH_BOX

| 利用方法 | 手数 | 再現入力 | signature |
| --- | ---: | --- | --- |
| ROBOTを残して利用し、自分でGOALへ | 9 | ↑ ↓ ← ↓ → → → → → | PLAYER_PUSH_BOX, ROBOT_PUSH_BOX |
| ROBOTを消してからGOALへ | 11 | ↑ ↓ ← ↓ → → → → ↓ ↑ → | PLAYER_PUSH_BOX, PLAYER_PUSH_ROBOT, ROBOT_PUSH_BOX, ROBOT_DROPPED_IN_HOLE |

## STAGE 3

箱を押してから入る列を変えることで、ROBOTのpushを出口への移動に使えることを発見してほしい。

```text
########
#..#...#
#.#@B..#
#..#...#
#RB...G#
#O...O.#
#......#
########
```

盤面6824状態、分類12444ノードを完全探索。WALK-ONLY CLEAR = 0、pushなしCLEAR = 0。意味のあるROBOT相互作用なしCLEAR = 0。

最短 **4手**：→ ↓ ↓ →

signature：PLAYER_PUSH_BOX, ROBOT_PUSH_BOX, ROBOT_PUSH_PLAYER

| 利用方法 | 手数 | 再現入力 | signature |
| --- | ---: | --- | --- |
| ROBOTを消してからGOALへ | 6 | → ↓ ↓ ↑ ↓ → | PLAYER_PUSH_BOX, PLAYER_PUSH_ROBOT, ROBOT_PUSH_BOX, ROBOT_PUSH_PLAYER, ROBOT_DROPPED_IN_HOLE |
| ROBOTを残して利用し、自分でGOALへ | 4 | → ↓ ↓ → | PLAYER_PUSH_BOX, ROBOT_PUSH_BOX, ROBOT_PUSH_PLAYER |
| ROBOTにGOALへ押させる | 4 | → ↓ → ↓ | PLAYER_PUSH_BOX, ROBOT_PUSH_BOX, ROBOT_PUSH_PLAYER, BOX_DROPPED_IN_HOLE, PLAYER_PUSHED_TO_GOAL |

STAGE 1は両方法で同じ通路の箱の扱いが異なることをテストする。箱を右に押した後、上側から回り込んでGOALへ入る方式と、下側から上の穴へ押し込む方式。

STAGE 2の最初の↑↓はPLAYER位置だけが戻るが、ROBOTは箱を左へ動かしており盤面の往復ではない。その箱を下へ押して通路を空ける。ROBOTを残して進むか、出口手前で下から上へROBOTを押し、穴で消すかが異なる。

STAGE 3の押される方式は、最初にPLAYERが上の箱を右へ押し、ROBOTは下の箱を右へ押す。次にPLAYERが右下の列へ入り、下の箱を穴へ押して場所を空けると、左に並んだROBOTがPLAYERをGOALへ押す。最短の自力到達方式とは箱の消失と出口への到達主体が異なる。ROBOTを消す方式は、押されてから上のROBOTを下の穴へ押す。3方式は方向列の違いだけではない。

全てのROBOTによるGOAL到達について、PLAYER自身によるBOX/ROBOTのpushなしの経路は0件。今回の配置では開始時の↓↓は不成立で、初手の箱pushが必要。ただし最短4手の配置が発見を促すかは人間評価待ちで、長さ自体を成功の根拠としない。

## 検証

- npm test：28件PASS。既存の共通pushエンジン検証を維持し、UNDO/FAIL/終了テストはステージ配置に依存しないfixtureへ変更。追加の一般的な観測テストでROBOT→BOX→PLAYER連鎖とGOAL到達イベントを確認。
- npm run test:levels：PASS。上記の必須条件、最短経路、signatureを算出し、/tmp/exit-sequence-search.jsonへ出力。
- npm run build：TypeScript / Vite PASS。solverは本番ビルドに含まれない。
- git diff --check：PASS。
- Chromium：/usr/bin/chromium、320×640、touch/mobile、ja/en双方でPASS。STAGE 1の箱を残す/落とす、STAGE 2のROBOTを残す/落とす、STAGE 3のROBOTを残す/落とす/出口へ押すを、solver生成経路の実ボタンtapで再現。各入力後に参照Gameの完全状態とUNDO数を比較。本番には観測APIを追加せず開発レスポンスだけに読み取り関数を注入。
- FAILからUNDO、複数UNDOで開始へ復帰、CLEARからUNDO、RESTART、NEXT STAGE、PLAY AGAIN、ブロック入力の非進行、ja/en変更の状態/履歴非進行を確認。
- 320pxで横スクロールなし、セル正方形、全表示操作44px以上、タイトル非重複、通常操作の画面内配置を確認。四辺のSafe Areaは24/16/20/16pxのCSS模擬で確認し、必要な縦スクロール中もtap可能。実機の切り欠きは未検証。

ブラウザpageerrorは0。成果物は/tmp/exit-sequence-browser/report.jsonと日英の各方式・初期・FAIL・CLEARの画像。依存はnpm ci --cache /tmp/exit-sequence-npm-cacheで準備し、開発サーバーは5174を使用。

## 人間評価待ち

機械的に確認したのは、歩くだけではCLEARできないこと、コアルール利用が必須であること、異なる利用方法が複数成立すること。面白くなったとは結論しない。

- コアルールを使う必要性が自然に理解できるか。
- 攻略を自分で思いついた感覚があるか。
- ROBOTを利用する発想が生まれるか。
- 別解を試したくなるか。
- 唯一解パズルを解く感覚にならないか。
- 難しすぎたり面倒になっていないか。
