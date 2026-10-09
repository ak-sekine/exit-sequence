# ターミナルRPG UI

上部EXIT SEQUENCE＋≡。下に2行のLV/HP、BODY/TECH/SENSE。戦闘中だけ敵名、敵HP、NEXT予告を2～3行で表示する。中央はスクロール可能な物語・行動・結果ログ、下部は現在の全幅1列Choice。通常探索に敵情報を残さない。

320×640最優先、最大幅720px、100dvhと100vhフォールバック。四辺env(safe-area-inset-*)、横スクロールなし。ログ以外でページをスクロールしない。5行動の戦闘中もログ100px以上を確保。ステータスは12px、本文14px・1.8。緑#4ade80、背景#07100f。全ボタン44px以上。長文は折り返す。

導入後に2回能力ボタンを選びキャラクター作成。成長時も能力ボタン。アイテムは5番目のChoiceで持ち物を開き、数量と効果を表示。戻ると開閉はターン消費なし。装備は倉庫で一つ選び自動装備、取得文で効果を説明する。ゲーム中に数値入力やキーボードは不要。

≡は言語のみの二階層dropdown。本文やChoiceの配置を変えず、再タップ・外側タップ・Escapeで閉じる。言語選択後とEscapeは≡へフォーカス。aria-label/expanded/controls、role=log、aria-busyを維持する。

新しい本文は5ms/文字のtypewriter。過去ログと選択結果は即時。演出中は操作無効、ログのtap skipで完了。reduced-motionでは即時、実行中の変更にも応じる。言語はlocalStorageに保存し、保存禁止でも遊べる。変更は状態・履歴・ターンを変えず、読んでいたスクロール位置を保つ。RESTARTで全ゲームを初期化。

Chromiumではja/en×3ビルドを320pxのtouch操作でCLEAR。HP、敵表示、成長・装備文章、行動予告、言語非進行、GAME OVER/restart、typewriter/tap skip/reduced-motion、44px、非ゼロSafe Areaを確認する。観測用関数は開発レスポンスにのみ注入し本番APIは作らない。
