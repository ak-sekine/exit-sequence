# 共通pushプロトタイプ仕様

## 状態と構成

3ステージ、各8×8。地形は floor / wall / hole / goal、物体は player / robot / box。各ステージにplayerとgoalが各1個、robotは最大1体。型付きの位置とIDを持ち、記号文字列をゲーム状態として使用しない。levels.tsの記号は初期配置を編集するための表記で、ロード時に地形と物体へ変換する。

model.tsは型、levels.tsは初期配置とその検証、game.tsはDOMに依存しないルールと履歴、main.tsは描画と入力、i18n.tsは文章のみ。GameStateは地形、物体、stageIndex、turns、status、直近message、clearByを持つ。statusはplaying / fail / clear / all-clear。clearByは出口到達がplayerフェーズかrobotフェーズかの検証情報で、攻略条件や画面のヒントには使用しない。anyなし。

## 共通移動

上下左右へ1マス。push(state, entityId, direction)はPLAYER / ROBOT / BOXすべてに同じ処理を適用する。進行方向の物体を順に集め、末尾の行き先まで検査する。末尾が壁か盤面外ならnullを返す。元の状態は変更せず、途中だけ動かさない。

移動できる場合、連鎖に含まれる全物体を同時に1マス進めた新しい状態を返す。種類別の衝突例外はない。HOLEに到達した物体はそのフェーズで消える。BOX・ROBOTは消失、PLAYERはFAIL。HOLEは残り、埋まらない。消失した物体は以後押せない。

GOALは通常の床。BOX・ROBOTもそこに移動でき、CLEARしない。PLAYERがGOALに到達した場合だけCLEAR。自力移動でも連鎖pushで押された場合でも同じ判定。最終ステージのCLEARはALL CLEAR。

## ロボット

PLAYERが成功移動した場合に1回だけ行動する。PLAYERの移動後の現在位置を対象にする。

1. 横位置が異なれば、PLAYERへ近づく横方向の共通pushを試す。
2. 横方向が不可能で縦位置も異なれば、近づく縦方向の共通pushを試す。
3. 横位置が同じなら、近づく縦方向だけを試す。
4. 試せる方向が全て不可能なら静止する。遠ざかる移動、待機入力、斜め移動、乱数、経路探索はない。

箱やプレイヤーを押せることも「成功移動」に含む。穴へ入る移動も成功で、ロボットはその場で消え、縦方向へ再試行しない。

## ターンと終了順序

1. playing中のPLAYER入力を共通pushで処理する。不成立ならGameState・履歴・ターンは完全に不変。UIにだけ「動かせない」と表示し、ROBOTは動かない。
2. 成功した場合、入力前の完全なGameStateをUNDO履歴に追加し、turnsを1増やす。
3. PLAYERが消失していれば即FAIL。GOAL上なら即CLEAR / ALL CLEAR。どちらの場合もROBOTは行動しない。
4. 継続中ならROBOTが共通pushで1回行動する。ROBOTが消失済みなら何もしない。
5. PLAYERの消失ならFAIL、GOAL到達ならCLEAR / ALL CLEARを判定する。

各フェーズ内の連鎖は一括適用してから終了判定する。地形は単一の種類なのでPLAYERのGOAL到達とHOLE落下は同時には起きない。終了後の方向入力は無効。

UNDOは成功入力前の地形・全物体・消失前の物体・ターン・status・message・clearBy・stageIndexを丸ごと復元する。回数制限なくステージ開始まで戻れる。FAILとCLEAR / ALL CLEAR後も使用可能。UNDO自体はターンを進めない。RESTARTは現在ステージを初期化し履歴を消去。NEXT STAGEは中間のCLEAR後のみ許可し、新ステージを履歴なしで開始する。ALL CLEARのPLAY AGAINはSTAGE 1へ戻す。

## ステージと探索

STAGE 1：PLAYER 1、BOX 2、HOLE 2、GOAL 1。ロボットなし。箱の列の正面から押すことも、別側の床を通ることもできる。

STAGE 2：PLAYER 1、ROBOT 1、BOX 1、HOLE 2、GOAL 1。中央の壁が移動の関係を変える。ロボットを左下の穴へ押しても、残したまま出口へ行ってもよい。

STAGE 3：PLAYER 1、ROBOT 1、BOX 2、HOLE 2、GOAL 1。広い床で押す方向・ロボットとの位置関係を試す。ロボット消失後の脱出、生存したままの自力脱出、ロボットpushによる脱出を機械的に確認済み。

テスト専用BFSは各状態の上下左右4入力を展開し、重複状態を除外して探索終了まで実行する。キーは物体の種類・位置・存在、status、CLEAR到達主体。交換可能な箱のID、ターン数、メッセージ、履歴は除外する。全配置が同じ無意味な往復を攻略数に数えない。600,000状態の安全上限に到達した場合はエラーとし、部分探索を完全探索として報告しない。探索数はimplementation-report.mdに記録する。本番にsolverは含めない。

ja/enはUI文章だけ切り替わる。地形・行動・判定・履歴は共通。言語設定を含め永続保存は行わない。画像、物語、追加ギミック、オンライン機能はない。
