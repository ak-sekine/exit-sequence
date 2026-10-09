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

全ステージでCLEAR可能、WALK-ONLY CLEAR = 0。WALK-ONLYはPLAYER→BOX、PLAYER→ROBOT、ROBOT→BOX、ROBOT→PLAYERのpush、BOX/ROBOTの穴消失、連鎖pushを一度も含まないCLEARを指す。単なる最短経路の検査ではなく、該当イベントを禁止した到達可能部分グラフを全探索する。

- STAGE 1：PLAYER 1、BOX 2、HOLE 2、GOAL 1、ROBOTなし。全CLEARがPLAYER_PUSH_BOXを含む。通路の同じ箱を右へ退かして残す方法と、上の穴へ落として消す方法が存在する。どちらも最短8手。単一の箱運搬手順に固定しない。
- STAGE 2：PLAYER 1、ROBOT 1、BOX 1、HOLE 2、GOAL 1。全CLEARにPLAYER_PUSH_ROBOT / ROBOT_PUSH_BOX / ROBOT_PUSH_PLAYER / ROBOT_DROPPED_IN_HOLEのいずれかが必要。ROBOTを穴へ押して消す方法と、ROBOTが箱を押す働きを利用して残す方法が存在する。ROBOTを完全に無視したCLEARはない。
- STAGE 3：PLAYER 1、ROBOT 1、BOX 2、HOLE 2、GOAL 1。全CLEARにpushと意味のあるROBOT相互作用が必要。ROBOTを落とす、自分で出口へ入りROBOTを残す、ROBOTに出口へ押してもらう3分類を確認する。最後の方式にはROBOT_PUSH_PLAYERとPLAYER_PUSHED_TO_GOALが必要で、全経路にPLAYER自身のBOX/ROBOTのpushが先行する。開始位置から↓↓だけでは進まない。画面で方法を推奨しない。

テスト専用solverは、まず盤面状態だけで重複を除外した有向グラフをBFSで完全に構築する。キーは物体の種類・位置・存在、status、CLEAR到達主体。交換可能な箱のID、ターン数、メッセージ、履歴は除外する。辺のイベントは既存のpush / robotTurnの一般的な結果（moved / fallen）から両フェーズを観測して分類し、最終UIメッセージだけには依存しない。本番コードの変更やステージ固有処理はない。

イベントはPLAYER_PUSH_BOX、PLAYER_PUSH_ROBOT、ROBOT_PUSH_BOX、ROBOT_PUSH_PLAYER、BOX_DROPPED_IN_HOLE、ROBOT_DROPPED_IN_HOLE、CHAIN_PUSH、PLAYER_PUSHED_TO_GOAL。CHAIN_PUSHは移動主体を含む3物体以上の連鎖。経路のsignatureは発生した種類の集合であり、順序・回数を攻略数に数えない。

必須条件はイベントを禁止した部分グラフの到達可能性で証明するため、往復を含む全入力経路も対象になる。分類の探索は別に（盤面ノード、累積イベントbitmask）の積グラフで重複を除外する。同じ盤面でも異なるsignatureは失わない。積グラフには循環に由来する集合も含まれるため、それ自体を異なる攻略の数とは報告しない。報告する再現例は盤面状態を再訪しない経路だけ。箱の存続/消失、ROBOTの存続/消失、到達主体の違いで具体的な異なる利用を検証する。BFSの最初のCLEARが最短解で、その経路とsignatureも出力する。

盤面600,000状態、積グラフ2,000,000ノードを安全上限とし、超過ならエラー。部分探索を完全探索として扱わない。本番にはsolver・signature・操作列を含めない。

ja/enはUI文章だけ切り替わる。地形・行動・判定・履歴は共通。言語設定を含め永続保存は行わない。画像、物語、追加ギミック、オンライン機能はない。
