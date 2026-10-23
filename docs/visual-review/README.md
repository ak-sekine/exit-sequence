# 描画簡素化とミュータントスプライト

## 変更

- 背景を黒に統一し、床・天井は2セル間隔の暗い格子、壁は距離に応じて暗くなる外周・境界線と少数のパネル線に整理した。
- 既存のレイキャスト、不透明な壁、閉じた扉の遮蔽、開閉論理と0.26秒の線の移動は維持した。立体装飾用の別深度バッファを取り除いた。
- `src/facility.ts` と `drawFacility()` を削除した。撤去した描画物は、多角形の補強フレーム、天井通気口、コンテナ、円筒照明、配管、および立体メッシュに属する補助線と黒い遮蔽面。
- 敵のCanvas Path形状生成を廃止し、透明PNGをキャッシュして `drawImage()` で表示する。敵は奥から手前へ描き、列ごとの壁深度で壁と閉じた扉の後ろを隠す。画像の透明部分は後方の描画を通す。
- `getImageData()`、不透明列マスク、敵用Canvas生成を削除した。レイの深度・交差配列をCanvasごとに再利用し、devicePixelRatioは最大2に制限する。

## 敵画像

すべて `src/assets/mutant/` 内の独立した透過PNGで、黒背景に映える明るい緑の線画。大きく縦に開いた歯のある口、張り出した肩、前傾姿勢、長い腕と湾曲した爪、非対称な脚、骨格・筋繊維の内部線を持つ同じキャラクターを使用する。

| 状態 | フレーム | 内容 |
| --- | --- | --- |
| idle | `idle-1.png`–`idle-4.png` | 呼吸と肩・頭の微動 |
| walk | `walk-1.png`–`walk-4.png` | 左右の腕と脚が交互に移る歩行周期 |
| chase | `chase-1.png`–`chase-4.png` | 強い前傾と爪を伸ばす追跡周期 |

各フレームの一覧：[mutant-frames.png](after/mutant-frames.png)

## 比較画像

- [背景と敵の修正前後比較](after/before-after.png)
- 背景：[修正前](before/corridor.png) / [修正後](after/corridor.png)、[曲がり角・修正前](before/corner.png) / [修正後](after/corner.png)
- 敵：[近距離・修正前](before/enemy-near.png) / [修正後](after/enemy-near.png)、[中距離・修正前](before/enemy-middle.png) / [修正後](after/enemy-middle.png)、[追跡・修正前](before/enemy-chase.png) / [修正後](after/enemy-chase.png)
- 実ゲーム画面：[スマートフォン390px](after/game-enemy-390.png) / [PC幅](after/game-enemy-1280.png)
- 敵の距離と複数表示：[近距離](after/enemy-near.png)、[中距離](after/enemy-middle.png)、[遠距離](after/enemy-far.png)、[2体](after/enemy-multiple.png)
- 扉：[閉状態](after/door-closed.png)、[開く途中](after/door-opening.png)、[閉じる途中](after/door-closing.png)
- 画面幅：[320px](after/responsive-320.png)、[375px](after/responsive-375.png)、[390px](after/responsive-390.png)、[PC](after/responsive-1280.png)

修正前画像はこの変更の直前、`main` の `038dc2b` を同じワールド位置・カメラで撮影したもの。比較撮影では更新ループを止め、実ゲームのレイキャストへ固定した `GameState` を渡している。画面幅の確認ではChromium上のゲームCanvasを撮影した。

## 性能

Chromium、deviceScaleFactor=1、開いた通路、追跡中の敵2体で65回描画し、最初の5回を除いてCanvas描画のCPU時間を測定した。変更前と変更後で幅・Canvas寸法・敵位置・測定回数をそろえた。数値は[変更前](before/measurements.json)と[変更後](after/measurements.json)。

| 画面幅 | Canvas幅 | 変更前 平均 / p95 | 変更後 平均 / p95 |
| ---: | ---: | ---: | ---: |
| 320px | 302px | 14.1 / 28.4ms | 2.9 / 2.3ms |
| 375px | 357px | 15.4 / 25.8ms | 6.3 / 5.9ms |
| 390px | 372px | 15.2 / 25.0ms | 8.2 / 3.7ms |
| PC幅 | 622px | 26.9 / 39.5ms | 13.5 / 168.6ms |

平均描画時間は全幅で短くなった。PC幅の変更後p95には長いフレームが残ったため、安定した60fpsを保証しない。ブラウザーや端末ごとの実FPSとは異なるCPU時間の計測で、iPhone Safariと実機スマートフォンは未確認。

## 検証

- `npm test`：28件成功。ワールド投影、敵状態の選択、ゲーム時刻からのフレーム選択、扉アニメーションを含む。
- `npm run build`：成功。PNGはViteがローカルの配信アセットとして出力する。
- `npm run test:browser`：Chromiumで320/375/390px、PC、横画面、高DPI上限、扉開閉、壁・扉遮蔽、複数敵、メニュー／マップ停止、ゲームオーバー停止を確認。
- `node tests/visual-review.mjs docs/visual-review/after docs/visual-review/before`：比較画像、距離別表示、アニメーション状態、画面幅、性能測定を生成し、施設メッシュと`getImageData()`がないことを確認。
- `git diff --check`：成功。

再撮影時はViteを起動してからvisual reviewスクリプトを実行する。操作・AI・移動・衝突・マップ・扉の論理状態に変更はない。
