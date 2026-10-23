# 参考画像に基づく描画再調整

## 参考画像の確認

チャットに添付された参考画像を視覚的に確認し、その造形を基準に調整した。黒地と鮮明な緑の細線、連続する多角形の装甲フレーム、壁から天井への面取り、天井通気口、左手前のコンテナ、右壁の円筒照明と配管、床の透視格子が特徴だった。敵には縦に裂けた大きな口、上下の鋭い歯、張り出した肩、長い腕と湾曲爪、不規則な骨格・筋繊維、非対称な脚が見られた。

参考画像ファイルは実行環境内では取得できていない。ユーザーがその取得条件を解除したため、チャット上で視覚認識した画像を参照した。参考画像と実装画像のピクセル単位の比較や、両者を並べた画像は作成していない。添付する比較シートは実装の修正前／修正後である。

## 修正前との差分

| 観点 | 修正前の画面 | 調整後 |
| --- | --- | --- |
| 施設の立体感 | 壁面模様が中心で、補強部材の張り出しがない | 奥行きと開口を持つ多角形フレーム、縁取り、床上コンテナ、円筒照明を追加 |
| 線画の密度 | 壁の縦線が点状で、輪郭が接続していない | 投影された縦線を接続し、通気口とパネル枠を復元 |
| ディテールの種類 | 壁面と床天井の平面模様 | コンテナの蓋・面板・交差補強、照明の端環・発光管・配管、天井ルーバー |
| 遠近感 | ワールド投影はあるが、壁と床の中央が暗い | 同一カメラの投影で立体装飾を配置し、連続する床の中心格子を強調 |
| 敵のシルエット | 小さい口、直立姿勢、短い爪、左右ほぼ同じ形 | 縦長の大口、長い湾曲爪、非対称な腕・脚、追跡時の頭部張り出し |
| 敵の内部構造 | 粗い肋骨と単純な関節 | 不規則な頭蓋輪郭、歯列、重なる肋骨、筋繊維、突起、関節の細線 |
| 線の明るさ | 太くにじんだ淡緑の敵と暗い施設 | 鮮緑の細い輪郭、暗い内部線、距離に応じて暗くなる装飾 |
| 黒背景とのコントラスト | 黒緑の面とぼかしが中心 | 黒い遮蔽面と緑の線画。大口と胴体の黒い面で背景線を遮る |

## 実装

- Canvas 2Dと既存レイキャストを維持。ゲーム、敵AI、移動速度、当たり判定、マップ、扉の論理状態を変更していない。
- `facility.ts` に描画専用メッシュを分離。狭い通路の一部にだけ装飾を置き、ワールド座標への固定、近接面クリップ、透視投影、距離減衰を行う。
- 壁深度に加えて画素ごとの装飾深度を使用。補強枠やコンテナに敵が隠れ、開口やコンテナの上の空間は通して見える。装飾には衝突判定を追加しない。
- 装飾メッシュと深度配列を再利用。黒い面は投影三角形の縦スパン内だけを走査する。
- 敵Canvasを112×176から224×352へ拡大。ゲーム内の表示寸法は維持し、主線と内部線を分け、ぼかしを除去。
- 胴体・肩・腰を共通変換で接続して呼吸と前傾を表現。爪は付け根を固定して湾曲を変形し、追跡時は口・頭部・腕・爪の動きを強める。ゲーム時刻を唯一のアニメーション時刻とする。

## スクリーンショット

Chromiumで実際のゲームCanvasを描画した。比較用に更新ループだけを検証側で停止し、実マップ、全扉開、プレイヤー位置(2.5, 14.5)、ゲーム時刻1.25秒を固定した。AIの動作・追跡・捕獲は別の既存ブラウザテストで確認している。

- [修正前／修正後・5場面の比較シート](after/before-after.png)
- [SF通路](after/corridor.png)
- [壁面装飾](after/wall.png)
- [敵・近距離正面](after/mutant-front.png)
- [敵・中距離](after/mutant-middle.png)
- [敵・追跡ポーズ](after/mutant-chase.png)
- [320px・敵2体](after/chase-320.png)、[375px](after/chase-375.png)、[390px](after/chase-390.png)、[PC](after/chase-1280.png)

初回修正後の画像を確認し、太い帯状になった壁パネル端、背景が透過する胴体、暗い床中心線、単純すぎるコンテナ・照明、正面から厚みのない補強枠を順に修正した。最終画像もChromiumの撮影結果を視覚確認した。

## 検証

- `npm test`：27件成功。床・天井のワールド座標投影、移動・AI・扉・時刻固定のアニメーションを含む。
- `npm run build`：成功。
- `npm run test:browser`：成功。320・375・390px、PC、横画面、Safe Area、操作、扉開閉・通過、壁と扉の敵遮蔽、メニュー／マップ停止、ゲームオーバー後のCanvas停止を確認。
- `git diff --check`：成功。
- 追加の `node tests/visual-review.mjs docs/visual-review/after docs/visual-review/before`：装飾本体の深度、装飾上部の空間、手前の壁による装飾の遮蔽を検証し、固定時刻の5場面と4幅の画像を生成。

再撮影には、別ターミナルで `npm run dev -- --host 127.0.0.1` を起動してから上記スクリプトを実行する。既定は `/usr/bin/chromium`、変更する場合は `CHROMIUM_PATH` を指定する。比較元の `before/` は780a233の実装で撮影した保存済み画像。

## 残る差分と限界

参考画像と同一の描き込み量・形状には達していない。敵の生体組織はまだ幾何学的で、肉の細かな裂け目、機械部品との融合、局所的な表面傷、首の奥行きは簡略化している。スプライトは正面を向く2D線画で、立体モデルではない。施設のフレームと小物は既存マップに合わせた限定配置で、参考画像の広い画角・長い通路・すべての配線をそのまま再現したものではない。

参考画像ファイルとの直接比較、実機スマートフォン、iPhone Safariの性能・外観確認は行っていない。PCでも常時60fpsを保証する結果ではなく、描画量を増やした分の負荷はある。

## 性能測定

Chromium、deviceScaleFactor=1、開いた通路・敵2体で、5回のウォームアップ後に60回の `renderDungeon` の実行時間を測定した。これは描画CPU時間であり、実機のFPSではない。数値の元データは [measurements.json](after/measurements.json)。

| 画面幅 | Canvas幅 | 平均描画時間 | 95パーセンタイル |
| --- | --- | --- | --- |
| 320px | 302px | 14.1ms | 28.4ms |
| 375px | 357px | 15.4ms | 25.8ms |
| 390px | 372px | 15.2ms | 25.0ms |
| 1280px | 622px | 26.9ms | 39.5ms |

既存の320px・敵2体テストでは45フレームの平均間隔16.7ms。上表の通路用固定描画とは異なるシーン・測定方式であり、単純比較はできない。PCを含む高負荷時の60fpsは保証しない。iPhone Safariと実機スマートフォンは未検証。

## 変更ファイル一覧

- `README.md`
- `docs/dungeon-sample.md`
- `docs/enemy-ai.md`
- `docs/visual-review/README.md`
- `docs/visual-review/after/before-after.png`
- `docs/visual-review/after/chase-1280.png`
- `docs/visual-review/after/chase-320.png`
- `docs/visual-review/after/chase-375.png`
- `docs/visual-review/after/chase-390.png`
- `docs/visual-review/after/corridor.png`
- `docs/visual-review/after/measurements.json`
- `docs/visual-review/after/mutant-chase.png`
- `docs/visual-review/after/mutant-front.png`
- `docs/visual-review/after/mutant-middle.png`
- `docs/visual-review/after/wall.png`
- `docs/visual-review/before/corridor.png`
- `docs/visual-review/before/mutant-chase.png`
- `docs/visual-review/before/mutant-front.png`
- `docs/visual-review/before/mutant-middle.png`
- `docs/visual-review/before/wall.png`
- `src/animation.ts`
- `src/facility.ts`
- `src/renderer.ts`
- `tests/visual-review.mjs`
