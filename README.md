# exit-sequence

Vite + TypeScriptによる、ターミナル風3Dダンジョン表示・移動操作サンプル。

仕様は[UI layout](docs/ui-layout.md)と[移動・描画](docs/dungeon-sample.md)を参照。

Node.jsは.nvmrcの24.19.0を使用する。`npm ci`で準備し、`npm run dev`で起動する。`npm test`、`npm run build`、Vite起動中の`npm run test:browser`で検証する。ブラウザテストは既定で/usr/bin/chromiumを使用し、CHROMIUM_PATHで変更できる。
