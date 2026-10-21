# EXIT SEQUENCE

Vite + TypeScriptで作った、ターミナル風のリアルタイム2.5Dダンジョン探索ゲームです。初代DOOMやWolfenstein 3Dのように、プレイヤーは連続して歩き、左右を自由に見回せます。マップ、6枚の扉、探索範囲、敵の巡回・追跡を使い、武器や戦闘を加えずに探索と逃走を行います。

## 起動

```sh
npm ci
npm run dev
```

## 操作

| 操作 | スマートフォン | PC |
| --- | --- | --- |
| 移動 | 左下のスティック | WASD |
| 視点 | ボタン以外を横方向にドラッグ | 画面をマウスドラッグ |
| 扉 | 右下のAボタン | EまたはSpace |
| 一時停止 | 上部メニュー | Escape |
| マップ・言語 | 上部メニュー | 上部メニュー |

探索マップとメニューを表示している間、敵を含むゲーム処理は一時停止します。移動中に別の指で視点を回したり、Aボタンを押したりできます。

## 実装仕様

- [画面と入力](docs/ui-layout.md)
- [マップ、衝突、2.5D描画](docs/dungeon-sample.md)
- [敵AI、視覚、聴覚](docs/enemy-ai.md)

マップやゲームルールの追加は行わず、既存の16×16マップを使用します。カメラの高さは固定で、ジャンプ、高低差、戦闘、武器、アイテム、BGMはありません。聴覚検知は効果音の再生に依存しません。

## 検証

```sh
npm test
npm run build
npm run dev
npm run test:browser
git diff --check
```

ブラウザテストはChromiumを使用します。既定の実行ファイルは `/usr/bin/chromium` で、別のChromiumを使う場合は `CHROMIUM_PATH` を指定してください。iPhone Safariの実機検証はこのリポジトリの自動テストに含まれません。
