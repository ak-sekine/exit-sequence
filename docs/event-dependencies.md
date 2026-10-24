# イベント連携依存関係

Phase 2カタログ全件の依存台帳。正本は docs/event-catalog.json。各リンクは起点イベントの効果が後続区画の状態条件に届く関係を表し、イベント本文/確率/電力差分の完成を意味しない。

## P3-01で記録した設計整合性修正

Phase 2の `deep-signal-foil` は状態変化を `history:signal-mark` と記述する一方、関連資源と後続イベント `surface-signal-mirror` の条件は `facility:signal-mark=true` を参照していた。P3-01では後続条件に合わせ、成功時に設備フラグ `signal-mark=true` と履歴タグ `signal-mark` の両方を記録するよう正本を揃えた。失敗時はどちらも成立しない。

## 到達性と保証予約の設計

- 全ての起点イベントは後続イベントより前の区画にある。区画終盤で既に通過した区画へ予約するリンクはない。
- 保証は条件成立後、対象区画の未使用イベントとして予約する。保証イベントの条件と出現条件は同じ状態を参照する。
- 同時成立数の安全側上限は区画別の保証対象総数で評価する。最大は 10件/20マスであり、重なっても容量内。
- 条件不成立なら保証イベントを予約しない。各区画に過去状態を要求しない通常イベント30件があるため、連携不成立だけで候補不足にならない。
- 連携の因果は、取得した物の規格/形、復旧した設備の配線、記録した情報、救出したNPC本人の記憶で説明する。根拠のない数値ボーナスは置かない。
- 依存エッジは区画番号が常に増えるDAG。全状態のゲーム実行探索ではなく、構造・条件参照・区画順・予約上限の検査である。

## 全依存リンク

| 依存元 | 依存先 | 起点の状態変化 | 後続条件 | 保証条件 | 不成立時 | 因果関係の説明方針 |
|---|---|---|---|---|---|---|
| deep-alarm-map | waste-alarm-relay | 成功: history:alarm-route | facility:alarm-routeがある場合に連携候補 | 予約保証: 必要: alarm-route確認時は予約 | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | 地図の赤線と現場の札が同じ番号と説明 |
| deep-coolant-label | waste-coolant-diverter | 成功: history:coolant-label | history:coolant-labelを区画1で読み取った場合のみ連携候補。 | 予約保証: 区画1で読み取った番号に合う冷却水分岐弁が廃棄区画にあります。 | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | 水の流れと管理棟の乾いたラジエーターを対比 |
| deep-key-cache | waste-key-hatch | 成功: item:service-key取得 | item:service-key所持時のみ。未所持なら候補にしない | 予約保証: 必要: 鍵取得時に区画2で予約 | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | 成功率100%の根拠として鍵の刻みと塗料を説明。不所持時は通常進路 |
| deep-shaft-wheel | ops-shaft-release | 成功: facility:shaft-braced=true | facility:shaft-bracedがtrueなら予約 | 予約保証: 必要: 区画1で歯止め成功時に区画4で予約 | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | シャフト形状と歯止め番号を示して因果を説明 |
| deep-signal-foil | surface-signal-mirror | 成功: facility:signal-mark=true; history:signal-mark | facility:signal-mark=trueなら予約 | 予約保証: 必要: 区画1で信号記録時に区画5で予約 | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | 点滅パターンの一致を見せて根拠を説明 |
| deep-vent-sketch | waste-vent-shutter | 成功: history:vent-map | history:vent-mapを区画1で記録している場合のみ連携候補。 | 予約保証: 区画1の紙模型で換気角度を記録したため、対応するシャッターが現れます。 | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | 紙模型の折り角とシャッターの埃の流れが一致し、後の管理盤まで同じ送風路が続く。 |
| npc-chiri-first | npc-chiri-return | 成功: chiri=rescued;失敗: chiri=rescue-failed;見送り: encountered | npc-chiri=rescuedでのみ出現 | 予約保証: 最深部で清掃ブラシを助けたチリが、生産区画で粉じんを掃きながら再会します。 | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | 最深部で交わした「掃除を続ける」約束を覚え、粉じんの筋から換気の向きを見つけている。 |
| npc-goro-first | npc-goro-return | 成功: goro=rescued;失敗: goro=rescue-failed;見送り: encountered | npc-goro=rescuedでのみ出現 | 予約保証: 必要: npc-goro-first成功後、区画3で予約 | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | 初回のコンテナ音を覚えた会話で音の因果を説明 |
| npc-momo-first | npc-momo-return | 成功: momo=rescued;失敗: momo=rescue-failed;見送り: encountered | npc-momo=rescuedでのみ出現 | 予約保証: 必要: npc-momo-firstの成功後、区画2で予約 | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | 救出済み条件の時だけ「助けてくれた」と発話。失敗状態ではイベント不成立 |
| npc-nori-first | npc-nori-return | 成功: nori=rescued;失敗: nori=rescue-failed;見送り: encountered | npc-nori=rescuedでのみ出現 | 予約保証: 必要: npc-nori-firstの成功後、区画2で予約 | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | 「あの測定を覚えている」と線のずれを具体的に説明 |
| npc-kabo-first | npc-kabo-return | 救出成功: kabo=rescued;救出失敗: rescue-failed;声での見送り失敗: encountered。 | npc-kabo=rescuedでのみ出現 | 予約保証: 必要: npc-kabo-first成功後、区画4で予約 | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | 箱に埋まった初回を覚えた会話で材料の再利用理由を説明 |
| npc-pico-first | npc-pico-return | 救出成功: pico=rescued;救出失敗: rescue-failed;列を指す選択の失敗: encountered。 | npc-pico=rescuedでのみ出現 | 予約保証: 必要: npc-pico-first成功後、区画3で予約 | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | 初回の誤札を台詞で思い出し、札の違いを根拠にする |
| waste-alarm-relay | mutant-quiet-way | 成功: facility:alarm-disabled=true;共通リレーを切れた成功経路で設定。失敗は状態維持。 | facility:alarm-disabledがtrueの時だけ連携出現 | 予約保証: 必要: 区画2で警報停止時に区画3で予約 | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | 敵AIや戦闘にせず、警報音と遠い気配を因果説明 |
| waste-alarm-relay | surface-alarm-quiet | 成功: facility:alarm-disabled=true;共通リレーを切れた成功経路で設定。失敗は状態維持。 | facility:alarm-disabled=trueなら予約 | 予約保証: 必要: 区画2で警報停止時に区画5で予約 | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | 以前の警報停止と現在の静けさを因果説明。戦闘・敵AIは作らない |
| waste-aux-switch | ops-powered-lift | 成功: facility:aux-power=true;回路図照合または安全端子接続の成功時。迂回では変化なし。 | facility:aux-power=trueなら保証出現。廃棄区画の切替器または生産区画の補助ヒューズで復旧する。 | 予約保証: 区画2の予備系統切替または区画3の規格ヒューズ修理で、同じ補助母線が復旧します。 | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | 二つの修理手段はいずれも昇降機専用の補助母線を通電する。母線表示と回路番号が一致するため起動は確実。 |
| waste-coolant-diverter | ops-coolant-valve | 成功: 分岐先切替でfacility:coolant-diverted=true;漏水受け/迂回では設備状態を変えない。 | facility:coolant-diverted=trueなら予約 | 予約保証: 必要: 区画2で冷却水を分岐した時に予約 | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | 管の流れを実際に見せて因果を説明 |
| waste-fuse-salvage | production-fuse-jig | 成功: item:copper-fuse取得と履歴記録。失敗は取得なし。 | item:copper-fuse所持時のみ。未所持なら不成立 | 予約保証: 必要: ヒューズ取得時に区画3で予約 | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | 廃棄区画で拾った規格品がこの治具用。銅線ヒューズが昇降機専用母線を復旧する。 |
| waste-vent-shutter | ops-vent-route | 成功: 模型照合または手動開放でfacility:ventilation-shutter=true。歩廊迂回と失敗では状態維持。 | facility:ventilation-shutter=trueなら後続の換気盤が出現 | 予約保証: 廃棄区画で換気シャッターを開けたため、同じ送風路の管理盤が現れます。 | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | 折り目と埃の筋を同じ図柄として見せる |
| npc-jin-first | npc-jin-return | 成功: jin=rescued;失敗: jin=rescue-failed;見送り: encountered | npc-jin=rescuedでのみ出現 | 予約保証: 必要: npc-jin-first成功後、区画5で予約 | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | 初回の片手手袋を覚えていて予備を持ってきたと話す |
| npc-lens-first | npc-lens-return | 成功: lens=rescued;失敗: lens=rescue-failed;見送り: encountered | npc-lens=rescuedでのみ出現 | 予約保証: 必要: npc-lens-first成功後、区画4で予約 | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | 初回のレンズ磨きが曇りガラスの読み取りに役立つ理由を会話 |
| npc-peta-first | npc-peta-return | 成功: peta=rescued;失敗: peta=rescue-failed;見送り: encountered | npc-peta=rescuedでのみ出現 | 予約保証: 必要: npc-peta-first成功後、区画4で予約 | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | 前回の抜け欄を覚えていることと記録の因果を示す |
| production-access-code | ops-auth-terminal | 成功: item:access-code取得 | item:access-code所持なら予約 | 予約保証: 必要: 区画3でコード取得時に区画4で予約 | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | 型番照合を成功率理由と会話の両方に示す |
| production-fuse-jig | ops-powered-lift | 成功率100%で補助治具へヒューズを装着し消費。昇降機専用のaux-power母線を復旧する。 | facility:aux-power=trueなら保証出現。廃棄区画の切替器または生産区画の補助ヒューズで復旧する。 | 予約保証: 区画2の予備系統切替または区画3の規格ヒューズ修理で、同じ補助母線が復旧します。 | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | 二つの修理手段はいずれも昇降機専用の補助母線を通電する。母線表示と回路番号が一致するため起動は確実。 |
| production-route-card | ops-route-board | 成功: item:route-card取得 | item:route-card所持なら予約 | 予約保証: 必要: 区画3でカード取得時に区画4で予約 | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | カード上の記号と盤面番号で説明し、通常路も残す |
| npc-waku-first | npc-waku-return | 成功: waku=rescued;失敗: waku=rescue-failed;見送り: encountered | npc-waku=rescuedでのみ出現 | 予約保証: 必要: npc-waku-first成功後、区画5で予約 | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | 同じ板の傷と固定方法を指し、救出後の再会だと分かるようにする |
| ops-auth-terminal | surface-coded-airlock | 成功率100%で認証しcode-accepted=true、コード消費 | facility:code-accepted=trueなら予約 | 予約保証: 必要: 区画3でコードを見つけ区画4で認証時に予約 | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | 認証ログを引き継いだ理由を表示し、通常の迂回も確保 |
| ops-coolant-valve | surface-pressure-door | 成功: pressure-balanced=true | facility:pressure-balanced=trueなら予約 | 予約保証: 必要: 区画2で冷却水を切替え、区画4で循環確認後に予約 | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | 実際の差圧計の針と冷却水循環を理由にする |
| ops-powered-lift | surface-lift-exit | 成功率100%でlift-powered=true | facility:lift-powered=trueなら予約 | 予約保証: 必要: 区画2の電源復旧後、区画4の昇降機起動を経て予約 | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | 二台の銘板番号一致を因果説明し、未復旧でも階段を残す |
| ops-route-board | surface-route-exit | 成功: route-card使用/消費;safe-routeタグ | safe-routeタグがあれば予約 | 予約保証: 必要: 区画3のカードと区画4の盤面設定後に予約 | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | カード記号と床矢印の一致を見せる |
| ops-shaft-release | surface-safety-rail | 成功: safety-rail=true | facility:safety-rail=trueなら予約 | 予約保証: 必要: 区画1のシャフト補強成功後に区画5で予約 | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | シャフトの連続構造と同じ番号で因果を示す |
| ops-vent-route | surface-warm-air | 成功: vent-bypass=true | facility:vent-bypass=trueなら予約 | 予約保証: 必要: 区画1の模型発見後、区画4の通路確認を経て予約 | 条件不成立時は後続を候補化せず、区画内の無条件通常候補で進む。 | 二度の観察をつなげ、方向判断の根拠を示す |

## アイテム利用順と所持上限

既定上限は3個。イベント単位で1つずつ拾う想定で、消費型は次区画の保証利用機会で消費し、再利用型は以後も所持できる。

| ID | 区分 | 取得 | 利用 | 計画 |
|---|---|---|---|---|
| service-key (廃棄区画の保守鍵) | 消費型 | deep-key-cache | waste-key-hatch | 区画1で最大1個取得。区画2最初の保証使用で消費。 |
| copper-fuse (銅線ヒューズ) | 消費型 | waste-fuse-salvage | production-fuse-jig | 区画2で最大1個取得。区画3の規格治具で消費。 |
| route-card (折りたたみ工程カード) | 再利用型 | production-route-card | ops-route-board | 区画3で取得、区画4で再利用型の照合に使う。 |
| access-code (検査端末の型番コード) | 消費型 | production-access-code | ops-auth-terminal | 区画3で最大1個取得。区画4の認証で消費。 |

### 情報タグ

| タグ | 読み取るイベント | 利用イベント |
|---|---|---|
| vent-map (紙模型から読んだ換気角度) | deep-vent-sketch | waste-vent-shutter |
| coolant-label (冷却戻り管の番号) | deep-coolant-label | waste-coolant-diverter |
| safe-route (管理盤で照合した安全レーン) | ops-route-board | surface-route-exit |

任意選択で使用機会を見送った場合も、通常経路は残る。3枠を超えて必ず破棄させる連続取得は置かず、取得後の利用機会をPhase 3でも残す。
