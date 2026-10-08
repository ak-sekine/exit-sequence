# 原因発見プロトタイプ仕様

15 Scene / 30 Choice。3問題、CLEARのみ。各Sceneは判断の段階であり、位置ではない。

| 問題 | Scene | 行動 |
| --- | --- | --- |
| 導入 | wake | 最初の扉へ |
| 圧力差 | door / door-inspect / door-cause / door-result | 観察、点検、均圧、開扉 |
| 氷 | valve / valve-inspect / valve-cause / valve-warm / valve-result | カバー、軸と設備、加熱、レバー |
| 電力 | power / power-inspect / power-cause / power-result | 表示、単独比較、停止または順番運転 |
| 終了 | clear | UIのRESTART |

GameStateはscene / problems / status。各ProblemStateにobservation（0～2）、hintLevel（0～3）、resolution（unresolved / changed / resolved）。boolean群、準備スロット、attemptsは持たない。changedは原因を取り除いたが動作未確認。powerは運転結果まで一操作で確認する。

src/scenario.tsのcluesにinitial / inspect / deeper / hints[3]をja/enで保持する。ヒントの順序・具体性をデータで調整できる。Sceneも同じcluesを参照し、文章の重複を避ける。game.tsは合法Choice、Effect、ヒント段階、次Scene、Endingのみを処理する。問題別の巨大switchは不要。

ヒントを早く求めたとき、第2段階で不足しているinspect/deeperを結果に表示し、観察段階2・原因Sceneへ進める。最終説明だけで見えない原因を断定させない。ヒントの閲覧は解決状態を変えず、罰を与えず、他問題も変えない。第3段階以降はヒントChoiceを隠す。段階は次問題へ進んでも保持され、restartで初期化する。

追加観察の途中から「操作盤を見る」「周りの設備を見る」で詳しい観察画面へ進める。外部知識がある人も必要な現物を見るが、AIは全て省略可能。原因確認前に解答候補を並べない。各問題の原因と知識ゼロで到達できる段階はimplementation-report.mdに記載。

ja/enはTextだけ違い、Choice・Effect・Stateは共有。履歴は当時のStateを保存。言語変更、メニュー、読書は非進行。UI一覧は追加しない。通常の誤操作も何度でも修正可能。

tests/routes.tsのA=expert、B=hinted、C=mistakenを単体とChromiumで操作する。電源の停止と順番運転の両方を検証。有限State探索で全Scene/Choiceの到達と行動数を確認する。
