import type { Room } from './map.ts'
import type { Task } from './game.ts'

export type Language = 'ja' | 'en'
export const LANGUAGE_STORAGE_KEY = 'exit-sequence-language'
export const languageNames: Record<Language, string> = { ja: '日本語', en: 'English' }

// Every message has both languages. Numeric placeholders are interpolated as text.
export const messages = {
  powerPanel: {"ja":"配電盤","en":"POWER PANEL"},
  controlTerminal: {"ja":"管制端末","en":"CONTROL TERMINAL"},
  repairSystem: {"ja":"整備設備","en":"REPAIR SYSTEM"},
  partsStorage: {"ja":"部品保管箱","en":"PARTS STORAGE"},
  foodStorage: {"ja":"食糧保管庫","en":"FOOD STORAGE"},
  spareBattery: {"ja":"予備バッテリー","en":"SPARE BATTERY"},
  observationSystem: {"ja":"観測装置","en":"OBSERVATION SYSTEM"},
  returnShip: {"ja":"帰還船","en":"RETURN SHIP"},
  repairInvestigationMissing: {"ja":"整備設備は動いている。\nだが、船体を直すには修理部品が足りない。","en":"The repair system is running.\nBut I need repair parts to fix the hull."},
  launchInvestigationMissing: {"ja":"発進前の表示に、未完了の項目が残っている。\nまだ帰還条件が揃っていない。","en":"I read the pre-launch display.\nSome return requirements are still incomplete."},
  gameLog: {"ja":"ゲームログ","en":"Game log"},
  introDamage: {"ja":"AI：基地は致命的損傷を受けています。恒久復旧は不可能です。帰還船で地球へ帰還してください。","en":"AI: The base has suffered critical damage. Permanent repairs are impossible. Return to Earth aboard the return ship."},
  introRequirements: {"ja":"AI：帰還条件は4つです。電力管理区で給電、管制区でロック解除、研究区の部品を整備区で使用、倉庫区で食糧確保。達成後、発着区へ向かってください。","en":"AI: Four return requirements: supply power in POWER, unlock launch control in CONTROL, use parts from RESEARCH in MAINTENANCE, and secure food in STORAGE. Then proceed to LAUNCH."},
  introSupplies: {"ja":"医療区と観測区で各1回、ENERGY +6。監視は1ルート／ENERGY 1。情報は次の行動で古くなる。","en":"MEDICAL and OBSERVATION each restore 6 ENERGY once. CAMERA checks one route for 1 ENERGY. Its information becomes stale after your next action."},
  introStatus: {"ja":"ENERGY 20 / 20。現在地：居住区。","en":"ENERGY 20 / 20. LOCATION: HABITATION."},
  food: {"ja":"食糧","en":"FOOD"},
  repairParts: {"ja":"修理部品","en":"REPAIR PARTS"},
  foodHelp: {"ja":"食糧：帰還用物資。帰還まで保持する。","en":"FOOD: Supplies for the return journey. Keep them until departure."},
  partsHelp: {"ja":"修理部品：整備区の設備で使用する。","en":"REPAIR PARTS: Use at the system in MAINTENANCE."},
  securePowerForTheReturnShip: {"ja":"帰還船用電力を確保する。","en":"Secure power for the return ship."},
  releaseTheLaunchControlLock: {"ja":"発進管制ロックを解除する。","en":"Release the launch control lock."},
  useRepairPartsToRepairTheReturn: {"ja":"修理部品を消費して帰還船を修理する。","en":"Use repair parts to repair the return ship."},
  collectRepairParts: {"ja":"修理部品を取得する。","en":"Collect repair parts."},
  collectFoodToKeepUntilDeparture: {"ja":"帰還まで保持する食糧を取得する。","en":"Collect food to keep until departure."},
  supplyHelp: {"ja":"ENERGY +6（上限20）。1回のみ。","en":"ENERGY +6 (maximum 20). Once only."},
  launchTheReturnShipToAchieveGame: {"ja":"帰還船を発進し、GAME CLEARとなる。","en":"Launch the return ship to achieve GAME CLEAR."},
  yes: {"ja":"はい","en":"YES"},
  no: {"ja":"いいえ","en":"NO"},
  held: {"ja":"所持","en":"HELD"},
  missing: {"ja":"不足","en":"MISSING"},
  requiresAllFourReturnRequirements: {"ja":"前提条件：帰還4条件の達成","en":"REQUIRES: All four return requirements."},
  start: {"ja":"ゲーム開始","en":"START"},
  restart: {"ja":"最初から","en":"RESTART"},
  finalStatus: {"ja":"最終状態確認","en":"FINAL STATUS"},
  exploreMenu: {"ja":"調べる >","en":"EXPLORE >"},
  moveMenu: {"ja":"移動 >","en":"MOVE >"},
  inventoryMenu: {"ja":"持ち物 >","en":"INVENTORY >"},
  status: {"ja":"状態確認","en":"STATUS"},
  aiStatus: {"ja":"AI 状態確認","en":"AI STATUS"},
  statusHelp: {"ja":"現在地・ENERGY・帰還条件を確認する。消費・進行なし。","en":"Check location, ENERGY and return requirements. No cost or world progression."},
  camera: {"ja":"監視カメラ >","en":"CAMERA >"},
  hide: {"ja":"隠れる","en":"HIDE"},
  success80: {"ja":"成功率：80%","en":"SUCCESS: 80%"},
  encounterFailureHelp: {"ja":"失敗時：追加ENERGY 1を消費して離脱する。","en":"On failure, spend 1 extra ENERGY to escape."},
  forceThrough: {"ja":"強行突破","en":"FORCE THROUGH"},
  success60: {"ja":"成功率：60%","en":"SUCCESS: 60%"},
  fleeMenu: {"ja":"逃げる >","en":"FLEE >"},
  baseMap: {"ja":"基地マップ","en":"BASE MAP"},
  inventoryBaseMap: {"ja":"持ち物 基地マップ","en":"INVENTORY BASE MAP"},
  mapHelp: {"ja":"基地の配置・接続を参照する携行データ。消費・進行なし。敵・通路状態・コストは取得しない。","en":"Portable data showing the base layout and connections. No cost or world progression. Does not reveal enemies, passage conditions or costs."},
  facilityGuide: {"ja":"施設案内","en":"FACILITY GUIDE"},
  inventoryFacilityGuide: {"ja":"持ち物 施設案内","en":"INVENTORY FACILITY GUIDE"},
  guideHelpFacilities: {"ja":"各区画にある主な施設を確認する。","en":"Shows the main facilities in each district."},
  guideHelpLocation: {"ja":"施設の所在地を調べるための参照情報。","en":"Use it to find which district contains a facility."},
  noEnergyCostOrWorldProgression: {"ja":"ENERGY消費・進行なし。","en":"No ENERGY cost or world progression."},
  surroundings: {"ja":"周囲","en":"SURROUNDINGS"},
  exploreSurroundings: {"ja":"調べる 周囲","en":"EXPLORE SURROUNDINGS"},
  surroundingsHelp: {"ja":"現在地の説明を読む。消費・進行なし。","en":"Read about your current location. No cost or world progression."},
  explore: {"ja":"調べる","en":"EXPLORE"},
  checkOnlyTheSelectedRoute: {"ja":"選択した1ルートだけを確認する。","en":"Check only the selected route."},
  capturePassageConditionsEnemyPresenceAndEstimated: {"ja":"通路状態・敵情報・推定ENERGYを世界更新後に取得する。","en":"Capture passage conditions, enemy presence and estimated ENERGY after the world update."},
  informationBecomesStaleAfterTheNextValid: {"ja":"情報は次の有効な世界行動で古くなる。","en":"Information becomes stale after the next valid world action."},
  thisHelpDoesNotActivateTheCamera: {"ja":"このHELPでは監視を実行しない。","en":"This HELP does not activate the camera."},
  flee: {"ja":"逃げる","en":"FLEE"},
  fleeAction: {"ja":"逃走","en":"FLEE"},
  move: {"ja":"移動","en":"MOVE"},
  closedCurrentlyImpassable: {"ja":"CLOSED（現在移動不可）","en":"CLOSED (currently impassable)"},
  unknownUnchecked: {"ja":"UNKNOWN / 未確認","en":"UNKNOWN / UNCHECKED"},
  impassable: {"ja":"移動不可","en":"IMPASSABLE"},
  impassableAtCapture: {"ja":"取得時点では移動不可","en":"IMPASSABLE AT CAPTURE"},
  unknownUnchecked13: {"ja":"UNKNOWN / 未確認（1〜3）","en":"UNKNOWN / UNCHECKED (1–3)"},
  presentAtCapture: {"ja":"あり（取得時点）","en":"PRESENT AT CAPTURE"},
  noneAtCapture: {"ja":"なし（取得時点）","en":"NONE AT CAPTURE"},
  unchecked: {"ja":"未確認","en":"UNCHECKED"},
  fresh: {"ja":"最新","en":"FRESH"},
  stale: {"ja":"古い","en":"STALE"},
  staleInformationDoesNotGuaranteeCurrentSafety: {"ja":"古い情報は現在の安全性を保証しない。","en":"Stale information does not guarantee current safety."},
  fleeHelp: {"ja":"逃走成功率：100%。選択した通路の移動コストを使用する。","en":"Flee success: 100%. Uses the selected passage's movement cost."},
  choicePageNavigation: {"ja":"選択肢のページ操作","en":"Choice page navigation"},
  back: {"ja":"戻る","en":"BACK"},
  backToParentMenu: {"ja":"親メニューへ戻る","en":"Back to parent menu"},
  previousPage: {"ja":"前のページ","en":"Previous page"},
  nextPage: {"ja":"次のページ","en":"Next page"},
  helpMode: {"ja":"HELPモード","en":"HELP mode"},
  chooseAnAction: {"ja":"行動を選択","en":"Choose an action"},
  destination: {"ja":"移動先","en":"Destination"},
  cameraRoute: {"ja":"監視ルート","en":"Camera route"},
  confirmation: {"ja":"確認","en":"Confirmation"},
  inventory: {"ja":"持ち物","en":"INVENTORY"},
  encounterResponse: {"ja":"遭遇対処","en":"Encounter response"},
  escapeRoute: {"ja":"逃走先","en":"Escape route"},
  end: {"ja":"終了","en":"End"},
  coreLoopPrototype: {"ja":"コアループ検証用プロトタイプ","en":"Core loop prototype"},
  selectStartToBegin: {"ja":"ゲーム開始を選択してください。","en":"Select START to begin."},
  shipPowerPower: {"ja":"帰還船用電力（電力管理区）","en":"Ship power (POWER)"},
  launchControlUnlockedControl: {"ja":"発進管制解除（管制区）","en":"Launch control unlocked (CONTROL)"},
  shipRepairedPartsFromResearchMaintenance: {"ja":"帰還船修理（研究区の部品 → 整備区）","en":"Ship repaired (parts from RESEARCH → MAINTENANCE)"},
  foodSecuredStorage: {"ja":"食糧確保（倉庫区）","en":"Food secured (STORAGE)"},
  supplyPower: {"ja":"帰還船へ配電する","en":"SUPPLY POWER"},
  unlockControl: {"ja":"発進管制を解除する","en":"UNLOCK CONTROL"},
  repairShip: {"ja":"帰還船を修理する","en":"REPAIR SHIP"},
  collectParts: {"ja":"修理部品を回収する","en":"COLLECT PARTS"},
  collectFood: {"ja":"食糧を回収する","en":"COLLECT FOOD"},
  collectBattery: {"ja":"予備バッテリーを回収","en":"COLLECT BATTERY"},
  shutDownSystem: {"ja":"不要設備を停止する","en":"SHUT DOWN SYSTEM"},
  launchShip: {"ja":"帰還船を発進する","en":"LAUNCH SHIP"},
  suitPowerDepleted: {"ja":"スーツの警告音が途切れる。\n表示から最後の光が消える。\nAI：スーツ電力が枯渇しました。","en":"The suit alarm falls silent.\nThe last light fades from my display.\nAI: Suit power depleted."},
  robotEncounter: {"ja":"通路の先で何かが動く。\n防災ロボットだ。\nセンサーがこちらを向いている。","en":"Something moves ahead in the passage.\nA safety robot.\nIts sensor turns toward me."},
  encounterInstructions: {"ja":"AI：人間認証に失敗しています。対処を選択してください。\n隠れる80%／ENERGY 1、強行突破60%／ENERGY 2。失敗時は追加ENERGY 1。逃走は通路コスト。","en":"AI: Human authentication has failed. Select a response.\nHIDE: 80%, 1 ENERGY. FORCE THROUGH: 60%, 2 ENERGY. Failure costs 1 extra ENERGY. FLEE uses the passage cost."},
  actionUnavailable: {"ja":"AI：現在の状況で選べない行動。","en":"AI: This action is unavailable in the current situation."},
  districtDisconnected: {"ja":"AI：直接接続していない区画。","en":"AI: That district is not directly connected."},
  passageClosed: {"ja":"隔壁は完全に閉じている。\nここから先へは進めない。\nCLOSED / ENERGY消費なし","en":"The bulkhead is fully closed.\nI cannot get through here.\nCLOSED / No ENERGY spent"},
  walkedUnderEmergencyLightsUsingSuitLife: {"ja":"非常灯の続く通路を歩く。\nスーツの生命維持装置の音だけが耳に残る。","en":"I follow the emergency lights along the passage.\nOnly the hum of my suit’s life support reaches me."},
  passageLightsAreOffUsedSuitLighting: {"ja":"通路の照明は消えている。\nスーツライトを点け、その光を頼りに進む。","en":"The passage lights are out.\nI switch on my suit light and follow its beam."},
  debrisBlocksTheWayUsedPowerAssistance: {"ja":"崩れた資材が通路を塞いでいる。\nパワーアシストを使い、瓦礫を押し分けて進む。","en":"Fallen materials block the passage.\nI use power assistance to push through the debris."},
  taskUnavailable: {"ja":"AI：この設備操作は実行できない。","en":"AI: This system operation is unavailable."},
  repairPartsMissing: {"ja":"整備設備は動いているが、手元に修理部品がない。\n研究区で回収する必要がある。\nENERGY消費なし","en":"The repair system runs, but I have no repair parts.\nI need to collect them in RESEARCH.\nNo ENERGY spent"},
  requirementsMissing: {"ja":"発進前の表示に未完了の項目が残る。\nまだ帰還条件が揃っていない。","en":"The pre-launch display still shows unfinished checks.\nI have not met all the return requirements."},
  punctuation: {"ja":"。","en":"."},
  repairPartsCollectedUseThemInMaintenance: {"ja":"箱に残っていた修理部品を回収する。\n整備区で帰還船の修理に使えそうだ。","en":"I collect the repair parts left in the box.\nI can use them to repair the return ship in MAINTENANCE."},
  theReturnShipHasLeftTheMoon: {"ja":"帰還船が月面を離れる。\n窓の外で壊れた基地が遠ざかり、私はシートに身体を預ける。\n地球への航路は確保された。","en":"The return ship lifts away from the Moon.\nThe damaged base recedes outside the window as I lean back in my seat.\nThe course to Earth is secured."},
  aiDeparturePreparationsCompleteWeCanDeal: {"ja":"AI：帰還航路、正常です。","en":"AI: Return course nominal."},
  foodCollectedKeepItUntilDeparture: {"ja":"食糧の状態を確かめ、帰還に必要な分を確保する。\n出発まで手元に置いておく。","en":"I check the food and secure enough for the return journey.\nI will keep it with me until departure."},
  repairPartsUsedHullRepairsComplete: {"ja":"部品を使った整備が終わり、表示から船体の故障が消える。\n修理部品使用 / 船体修理完了","en":"The repair work finishes, and the hull fault clears from the display.\nREPAIR PARTS USED / HULL REPAIRS COMPLETE"},
  returnRequirementMet: {"ja":"帰還条件達成：","en":"Return requirement met: "},
  hidingBehindCover: {"ja":"近くの機材の陰へ身を滑り込ませる。","en":"I slip behind nearby equipment."},
  forcingPastTheSafetyRobot: {"ja":"ロボットの脇へ、一気に駆け出す。","en":"I dash toward the gap beside the robot."},
  successAvoidedTheSafetyRobot: {"ja":"息を潜めて待つ。\nやがてロボットの駆動音が遠ざかっていく。","en":"I hold my breath and wait.\nThe robot’s motors gradually fade into the distance."},
  failureUsedSuitProtectionToEscape: {"ja":"隠れきれず、ロボットがこちらへ向き直る。\nスーツの防護機能を使い、距離を取る。","en":"The robot turns toward me before I am fully hidden.\nI use my suit’s protection to pull away."},
  powerSwitchResult: {"ja":"配電盤の表示が切り替わる。\n帰還船への給電を示している。","en":"The panel display changes.\nIt shows power flowing to the return ship."},
  controlUnlockResult: {"ja":"端末の警告表示が一つ消える。\n発進管制のロックは解除された。","en":"One warning disappears from the terminal.\nThe launch control lock is released."},
  batteryConnectedResult: {"ja":"回収した予備バッテリーをスーツにつなぐ。\n電力表示が更新される。","en":"I connect the collected spare battery to my suit.\nThe power reading updates."},
  observationShutdownResult: {"ja":"不要設備を止めると、観測装置の作動音が途切れる。\n確保した電力をスーツへ回す。","en":"The observation system falls silent as I shut down the unused equipment.\nI route the freed power to my suit."},
  forceSuccess: {"ja":"警告音を背に、ロボットの脇を駆け抜ける。\n追いつかれる前に距離を取る。","en":"I run past the robot with its warning sounding behind me.\nI put distance between us before it can catch up."},
  forceFailure: {"ja":"ロボットが進路へ割り込む。\nスーツの防護機能を使い、強引に距離を取る。","en":"The robot cuts across my path.\nI use my suit’s protection to break away from it."},
  fleeResult: {"ja":"ロボットから離れ、{0}区への通路へ駆け込む。","en":"I break away from the robot and enter the passage to {0}."},
  cameraFeedFreshAfterWorldUpdate: {"ja":"CAMERA FEED（最新・世界更新後）","en":"CAMERA FEED (FRESH / AFTER WORLD UPDATE)"},
  safetyRobotPresent: {"ja":"防災ロボットあり","en":"SAFETY ROBOT PRESENT"},
  none: {"ja":"なし","en":"NONE"},
  launchReady: {"ja":"AI：帰還4条件達成。調べる → 帰還船から発進できる。","en":"AI: All four return requirements met. Launch via EXPLORE → RETURN SHIP."},
  launchNotReady: {"ja":"AI：帰還条件不足。AI → 状態確認で条件を確認できる。","en":"AI: Return requirements incomplete. Check AI → STATUS."},
  quarters: {"ja":"居室","en":"Quarters"},
  cafeteria: {"ja":"食堂","en":"Cafeteria"},
  lounge: {"ja":"共用室","en":"Lounge"},
  clinic: {"ja":"診療室","en":"Clinic"},
  pharmacy: {"ja":"薬品庫","en":"Pharmacy"},
  observationRoom: {"ja":"観測室","en":"Observation Room"},
  equipmentRoom: {"ja":"機器室","en":"Equipment Room"},
  supplyStorage: {"ja":"資材庫","en":"Supply Storage"},
  foodStorage2: {"ja":"食糧庫","en":"Food Storage"},
  controlRoom: {"ja":"管制室","en":"Control Room"},
  communications: {"ja":"通信室","en":"Communications"},
  distributionRoom: {"ja":"配電室","en":"Distribution Room"},
  powerSystems: {"ja":"電源設備室","en":"Power Systems"},
  laboratory: {"ja":"研究室","en":"Laboratory"},
  storageRoom: {"ja":"保管室","en":"Storage Room"},
  workshop: {"ja":"整備室","en":"Workshop"},
  toolStorage: {"ja":"工具庫","en":"Tool Storage"},
  hangar: {"ja":"格納庫","en":"Hangar"},
  launchControl: {"ja":"発着管制室","en":"Launch Control"},
  baseMapYou: {"ja":"基地マップ * = 現在地","en":"BASE MAP * = YOU"},
  descriptionHabitation: {"ja":"居住区には非常灯だけが残っている。\n生命維持設備の低い音が聞こえる。\nかろうじて動いているが、ここに留まり続けるわけにはいかない。","en":"Only the emergency lights remain in HABITATION.\nI hear the low hum of life support.\nThe systems are barely holding; I cannot stay here."},
  descriptionMedical: {"ja":"診療室の端末には光がない。\nその傍らに予備バッテリーが残っている。\nスーツの電力を補えそうだ。","en":"The clinic terminal is dark.\nI find a spare battery beside it.\nIt could replenish my suit’s power."},
  descriptionObservation: {"ja":"観測装置の表示に、無人の月面が映っている。\n誰もいない観測室で、記録だけが続いている。\n不要な設備を止めれば、電力を確保できそうだ。","en":"The observation display shows the empty lunar surface.\nAround me, the room is deserted, but recording continues.\nShutting down unused equipment could free up power."},
  descriptionResearch: {"ja":"研究室の保管箱をのぞく。\n中には帰還船に使えそうな修理部品が残っている。\n整備区へ持っていけば、船を直せそうだ。","en":"I look into the laboratory storage box.\nRepair parts for the return ship remain inside.\nTaking them to MAINTENANCE should let me repair the ship."},
  descriptionMaintenance: {"ja":"遠隔整備設備の作動音が聞こえる。\n表示を読むと、帰還船の船体を修理できるようだ。\n作業には研究区の修理部品が必要になる。","en":"I hear the remote repair equipment running.\nIts display shows that I can repair the return ship’s hull.\nI need repair parts from RESEARCH for the work."},
  descriptionStorage: {"ja":"食糧保管庫の扉を開く。\n中には帰還に使えそうな食糧が残っている。\n状態を確かめて持ち出せそうだ。","en":"I open the food storage door.\nFood for the return journey remains inside.\nI can check its condition and take it with me."},
  descriptionControl: {"ja":"通信設備からは何も聞こえない。\n管制端末の表示には、発進管制の安全ロックが残っている。\nここから解除できそうだ。","en":"I hear nothing from the communications equipment.\nThe control terminal still shows the launch safety lock.\nI should be able to release it here."},
  descriptionPower: {"ja":"配電盤の表示に残存電力が示されている。\n基地全体を復旧するには足りない。\n帰還船へ回す電力は確保できそうだ。","en":"I read the remaining power on the distribution panel.\nIt cannot restore the whole base.\nI should still be able to secure power for the return ship."},
  descriptionLaunch: {"ja":"格納庫には帰還船が待機している。\n発進前の表示を読み、帰還4条件を確かめる。\nすべて揃えば、ここから地球へ向かえる。","en":"The return ship waits in the hangar.\nI read the pre-launch display and check the four return requirements.\nOnce they are met, I can leave for Earth from here."},
  settingsMenu: {"ja":"設定 >","en":"SETTINGS >"},
  languageMenu: {"ja":"言語 >","en":"LANGUAGE >"},
  settings: {"ja":"設定","en":"SETTINGS"},
  language: {"ja":"言語","en":"LANGUAGE"},
  energy1: {"ja":"ENERGY：1","en":"ENERGY: 1"},
  energy2: {"ja":"ENERGY：2","en":"ENERGY: 2"},
  energyCost: {"ja":"ENERGY：{0}","en":"ENERGY: {0}"},
  taskDone: {"ja":"実行済み：{0}","en":"DONE: {0}"},
  requiresParts: {"ja":"前提条件：修理部品（{0}）","en":"REQUIRES: Repair parts ({0})"},
  requiresRoom: {"ja":"前提条件：{0}区の設備","en":"REQUIRES: System in {0}"},
  missingCondition: {"ja":"不足：{0}","en":"MISSING: {0}"},
  inventoryInput: {"ja":"持ち物 {0}","en":"INVENTORY {0}"},
  districtLabel: {"ja":"{0}区","en":"{0}"},
  exploreInput: {"ja":"調べる {0}","en":"EXPLORE {0}"},
  cameraInput: {"ja":"AI 監視カメラ {0}区","en":"AI CAMERA {0}"},
  routeInput: {"ja":"{0} {1}区","en":"{0} {1}"},
  routeHeading: {"ja":"{0}区へのルート","en":"Route to {0}"},
  feedFreshness: {"ja":"情報の鮮度：{0}","en":"INFORMATION: {0}"},
  passageStatus: {"ja":"状態：{0}","en":"PASSAGE: {0}"},
  estimatedCost: {"ja":"推定ENERGY：{0}","en":"ESTIMATED ENERGY: {0}"},
  enemyStatus: {"ja":"敵情報：{0}","en":"ENEMY: {0}"},
  menuPage: {"ja":"{0}：{1} / {2}ページ","en":"{0}: Page {1} / {2}"},
  locationStatus: {"ja":"LOCATION : {0}区","en":"LOCATION : {0}"},
  passageUpdate: {"ja":"AI：通路更新 {0}区 ↔ {1}区：{2} → {3}","en":"AI: Passage update {0} ↔ {1}: {2} → {3}"},
  movementResult: {"ja":"{0}区へ向かう。","en":"I head toward {0}."},
  supplyResult: {"ja":"ENERGY +{0}（補給 +6／上限20）→ {1} / 20。使用済み。","en":"ENERGY +{0} (supply +6 / maximum 20) → {1} / 20. Used up."},
  cameraDirection: {"ja":"{0}区方面","en":"Toward {0}"},
  cameraEnemy: {"ja":"敵：{0}","en":"ENEMY: {0}"},
  cameraPassage: {"ja":"通路：{0}","en":"PASSAGE: {0}"},
  cameraCost: {"ja":"推定 ENERGY：{0}","en":"ESTIMATED ENERGY: {0}"},
  startLanguageMenu: { ja: 'LANGUAGE >', en: 'LANGUAGE >' },
  aiMenu: { ja: 'AI >', en: 'AI >' },
  ai: { ja: 'AI', en: 'AI' },
  title: { ja: 'EXIT SEQUENCE', en: 'EXIT SEQUENCE' },
  systemOnline: { ja: 'SYSTEM ONLINE', en: 'SYSTEM ONLINE' },
  help: { ja: 'HELP', en: 'HELP' },
  helpInput: { ja: 'HELP {0}', en: 'HELP {0}' },
  energyStatus: { ja: 'ENERGY : {0} / {1}', en: 'ENERGY : {0} / {1}' },
  energySpent: { ja: 'ENERGY -{0} → {1} / 20', en: 'ENERGY -{0} → {1} / 20' },
  returnStatus: { ja: 'RETURN STATUS', en: 'RETURN STATUS' },
  ready: { ja: 'READY', en: 'READY' },
  notReady: { ja: 'NOT READY', en: 'NOT READY' },
  conditionStatus: { ja: '{0} : {1}', en: '{0} : {1}' },
  gameOver: { ja: 'GAME OVER', en: 'GAME OVER' },
  gameClear: { ja: 'GAME CLEAR', en: 'GAME CLEAR' },
} as const satisfies Record<string, Record<Language, string>>

type MessageKey = keyof typeof messages
type MessageValues<S extends string> = S extends `${string}{${number}}${infer Rest}`
  ? [string | number, ...MessageValues<Rest>] : []
export function t<K extends MessageKey>(key: K, language: Language, ...values: MessageValues<typeof messages[K]['ja']>): string {
  return messages[key][language].replace(/\{(\d+)\}/g, (_, index: string) => String(values[Number(index)]))
}

export type LanguageEnvironment = {
  readonly localStorage?: Pick<Storage, 'getItem' | 'setItem'>
  readonly navigator?: Pick<Navigator, 'language'>
}
export function initialLanguage(environment: LanguageEnvironment = globalThis): Language {
  try {
    const saved = environment.localStorage?.getItem(LANGUAGE_STORAGE_KEY)
    if (saved === 'ja' || saved === 'en') return saved
  } catch { /* Storage may be blocked; continue with browser detection. */ }
  try {
    const locale = environment.navigator?.language
    if (locale) return /^ja(?:-|$)/i.test(locale) ? 'ja' : 'en'
  } catch { /* A non-browser environment uses Japanese. */ }
  return 'ja'
}
export function saveLanguage(language: Language, environment: LanguageEnvironment = globalThis): void {
  try { environment.localStorage?.setItem(LANGUAGE_STORAGE_KEY, language) } catch { /* Keep playing without persistence. */ }
}

export const roomNames: Record<Room, Record<Language, string>> = {
  居住: { ja: '居住', en: 'HABITATION' },
  医療: { ja: '医療', en: 'MEDICAL' },
  観測: { ja: '観測', en: 'OBSERVATION' },
  倉庫: { ja: '倉庫', en: 'STORAGE' },
  管制: { ja: '管制', en: 'CONTROL' },
  電力管理: { ja: '電力管理', en: 'POWER' },
  研究: { ja: '研究', en: 'RESEARCH' },
  整備: { ja: '整備', en: 'MAINTENANCE' },
  発着: { ja: '発着', en: 'LAUNCH' },
}
export const mapNames: Record<Room, Record<Language, string>> = {
  居住: { ja: '居住', en: 'HAB' },
  医療: { ja: '医療', en: 'MED' },
  観測: { ja: '観測', en: 'OBS' },
  倉庫: { ja: '倉庫', en: 'STO' },
  管制: { ja: '管制', en: 'CTL' },
  電力管理: { ja: '電力', en: 'PWR' },
  研究: { ja: '研究', en: 'LAB' },
  整備: { ja: '整備', en: 'MNT' },
  発着: { ja: '発着', en: 'PAD' },
}
export const roomName = (room: Room, language: Language) => roomNames[room][language]

export function taskLabels(language: Language): Record<Task, string> {
  return {
    power: t('supplyPower', language),
    control: t('unlockControl', language),
    repair: t('repairShip', language),
    parts: t('collectParts', language),
    food: t('collectFood', language),
    medical: t('collectBattery', language),
    observe: t('shutDownSystem', language),
    launch: t('launchShip', language),
  }
}

export function conditionLabels(language: Language): Record<'power' | 'control' | 'repair' | 'food', string> {
  return {
    power: t('shipPowerPower', language),
    control: t('launchControlUnlockedControl', language),
    repair: t('shipRepairedPartsFromResearchMaintenance', language),
    food: t('foodSecuredStorage', language),
  }
}

export function roomDescriptions(language: Language): Record<Room, string> {
  return {
    居住: t('descriptionHabitation', language),
    医療: t('descriptionMedical', language),
    観測: t('descriptionObservation', language),
    研究: t('descriptionResearch', language),
    整備: t('descriptionMaintenance', language),
    倉庫: t('descriptionStorage', language),
    管制: t('descriptionControl', language),
    電力管理: t('descriptionPower', language),
    発着: t('descriptionLaunch', language),
  }
}

export function itemName(item: string, language: Language): string {
  return item === '食糧' ? t('food', language) : item === '修理部品' ? t('repairParts', language) : item
}
export function freshnessName(value: '未確認' | '最新' | '古い', language: Language): string {
  return t(({ 未確認: 'unchecked', 最新: 'fresh', 古い: 'stale' } as const)[value], language)
}

export type FacilityId = 'quarters' | 'cafeteria' | 'lounge' | 'clinic' | 'pharmacy' | 'observationRoom' | 'equipmentRoom' | 'supplyStorage' | 'foodStorage' | 'controlRoom' | 'communications' | 'distributionRoom' | 'powerSystems' | 'laboratory' | 'storageRoom' | 'workshop' | 'toolStorage' | 'hangar' | 'launchControl'
export function facilityNames(language: Language): Record<FacilityId, string> {
  return {
    quarters: t('quarters', language),
    cafeteria: t('cafeteria', language),
    lounge: t('lounge', language),
    clinic: t('clinic', language),
    pharmacy: t('pharmacy', language),
    observationRoom: t('observationRoom', language),
    equipmentRoom: t('equipmentRoom', language),
    supplyStorage: t('supplyStorage', language),
    foodStorage: t('foodStorage2', language),
    controlRoom: t('controlRoom', language),
    communications: t('communications', language),
    distributionRoom: t('distributionRoom', language),
    powerSystems: t('powerSystems', language),
    laboratory: t('laboratory', language),
    storageRoom: t('storageRoom', language),
    workshop: t('workshop', language),
    toolStorage: t('toolStorage', language),
    hangar: t('hangar', language),
    launchControl: t('launchControl', language),
  }
}

export type TaskConfirmation = { inspected: string; explanation: string; question: string; done: string; declined: string; action: string }
const confirmationText: Record<Task, Record<Language, TaskConfirmation>> = {
  power: {
    ja: {"inspected": "配電盤の前で、表示を読む。", "explanation": "基地に残った電力の一部は、まだ帰還船へ回せそうだ。", "question": "配電を切り替えるか？", "done": "表示はすでに帰還船への給電を示している。", "declined": "配電を変えず、パネルから手を離す。", "action": "配電の切り替え操作に取りかかる。"},
    en: {"inspected": "I read the distribution panel.", "explanation": "Some of the remaining base power can still be routed to the return ship.", "question": "Switch the distribution?", "done": "The display already shows power supplied to the return ship.", "declined": "I leave the distribution unchanged and take my hand off the panel.", "action": "I begin switching the power distribution."},
  },
  control: {
    ja: {"inspected": "沈黙した管制室で、端末に向き合う。", "explanation": "表示を読むと、発進管制の安全ロックはまだ生きている。\nここから解除できそうだ。", "question": "解除するか？", "done": "端末にロック解除の表示が残っている。", "declined": "ロックをそのままにして、端末から離れる。", "action": "ロックの解除操作を実行する。"},
    en: {"inspected": "I stand at the terminal in the silent control room.", "explanation": "The display shows that the launch safety lock is still active.\nI can release it here.", "question": "Release the lock?", "done": "The terminal still shows the lock as released.", "declined": "I step away from the terminal, leaving the lock in place.", "action": "I begin releasing the lock."},
  },
  repair: {
    ja: {"inspected": "整備設備に向き合い、船体の状態表示を読む。", "explanation": "表示には故障が残っている。手元の修理部品を使えば、ここから帰還船を直せそうだ。", "question": "修理するか？", "done": "整備設備の表示に船体の故障は残っていない。\n帰還船の修理は済んでいる。", "declined": "部品を手元に残し、整備を見送る。", "action": "修理部品を整備設備へ渡し、作業に取りかかる。"},
    en: {"inspected": "I read the hull status on the repair display.", "explanation": "A hull fault remains. With the repair parts I have, I can fix the return ship from here.", "question": "Repair the ship?", "done": "No hull fault remains on the repair display.\nThe return ship is already repaired.", "declined": "I keep the parts with me and leave the repair work for now.", "action": "I place the repair parts in the system and begin the work."},
  },
  parts: {
    ja: {"inspected": "部品保管箱を開ける。", "explanation": "中には帰還船の修理に使えそうな部品が残っている。", "question": "回収するか？", "done": "箱の中に修理部品はもうない。\n必要な部品はすでに回収している。", "declined": "部品を残したまま、箱を閉じる。", "action": "箱の中の修理部品へ手を伸ばす。"},
    en: {"inspected": "I open the parts storage box.", "explanation": "Parts that could repair the return ship remain inside.", "question": "Collect the parts?", "done": "The repair parts are no longer in the box.\nI have already collected them.", "declined": "I close the box, leaving the parts inside.", "action": "I reach for the repair parts in the box."},
  },
  food: {
    ja: {"inspected": "食糧保管庫の中をのぞく。", "explanation": "帰還用に使えそうな食糧が残っている。\n状態を確かめて持っていけそうだ。", "question": "回収するか？", "done": "帰還用の食糧は、すでに手元にある。", "declined": "食糧を残し、保管庫を閉じる。", "action": "持ち出す食糧を保管庫から選ぶ。"},
    en: {"inspected": "I look inside the food storage.", "explanation": "Food for the return journey remains.\nI can check its condition and take it with me.", "question": "Collect the food?", "done": "I already have the food for the return journey.", "declined": "I close the storage, leaving the food inside.", "action": "I select food to take from the storage."},
  },
  medical: {
    ja: {"inspected": "予備バッテリーの置かれた場所に目を向ける。", "explanation": "残されたバッテリーをスーツにつなげば、電力を補えそうだ。\nENERGY +6（上限20）／1回のみ", "question": "回収するか？", "done": "予備バッテリーを置いていた場所は空だ。\n補給にはすでに使っている。", "declined": "バッテリーを残し、その場を離れる。", "action": "予備バッテリーを取り外し、回収に取りかかる。"},
    en: {"inspected": "I check the spot where the spare battery is kept.", "explanation": "I could connect the remaining battery to replenish my suit’s power.\nENERGY +6 (maximum 20) / Once only", "question": "Collect it?", "done": "The battery’s place is empty.\nI have already used it to replenish my suit.", "declined": "I leave the battery where it is and step away.", "action": "I begin removing the spare battery for collection."},
  },
  observe: {
    ja: {"inspected": "観測装置の前で足を止める。", "explanation": "月面の記録が続いている。不要な設備への給電を止めれば、その電力を使えそうだ。\nENERGY +6（上限20）／1回のみ", "question": "停止するか？", "done": "観測装置は静まり、表示も消えている。\n不要設備はすでに止めている。", "declined": "給電を止めず、装置から離れる。", "action": "不要設備の停止操作に取りかかる。"},
    en: {"inspected": "I stop in front of the observation system.", "explanation": "Lunar recording continues. Cutting power to unused equipment could free it up for my suit.\nENERGY +6 (maximum 20) / Once only", "question": "Shut it down?", "done": "The observation system is quiet and its display dark.\nI have already shut down the unused equipment.", "declined": "I leave the system running and step away.", "action": "I begin shutting down the unused equipment."},
  },
  launch: {
    ja: {"inspected": "帰還船の発進前の表示を読む。", "explanation": "帰還4条件はすべて揃っている。\nこの船で地球へ向かえる。", "question": "発進するか？", "done": "窓の外に月面が遠ざかっていく。\n帰還船はすでに発進している。", "declined": "発進操作を見送り、船を待機させる。", "action": "シートに身を収め、発進操作を始める。"},
    en: {"inspected": "I read the return ship’s pre-launch display.", "explanation": "All four return requirements are met.\nThis ship can take me to Earth.", "question": "Launch the ship?", "done": "The lunar surface recedes outside the window.\nThe return ship has already launched.", "declined": "I leave the ship waiting and hold off on launch.", "action": "I settle into the seat and begin the launch sequence."},
  },
}
export function taskConfirmations(language: Language): Record<Task, TaskConfirmation> {
  return Object.fromEntries(Object.entries(confirmationText).map(([task, text]) => [task, text[language]])) as Record<Task, TaskConfirmation>
}
