# EXIT SEQUENCE

廃墟から部品を回収して暮らすロボットのぼくは、探索中に床が抜け、廃棄施設の最深部へ落下してしまった。電力が切れる前に、危険なミュータントのいる廃墟を抜けて街へ帰る選択式ゲームです。

15マスを進み、各行動の成功率と電力の増減を見比べて選びます。スロットの00〜99が表示成功率より小さければ成功。結果を読んで「次へ進む ▶」を押すと次のマスへ進みます。

```sh
npm install
npm test
npm run build
npm run simulate
npm run test:browser
npm run dev
```

URLの `?seed=42` でイベント抽選を再現できます。詳しくは [ゲームルール](docs/game-rules.md)、[物語](docs/story.md)、[イベント一覧](docs/event-catalog.md)、[バランス](docs/balance.md)を参照してください。
