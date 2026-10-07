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
  repairInvestigationMissing: {"ja":"帰還船の修理には修理部品が必要だ。","en":"Repair parts are needed to repair the return ship."},
  launchInvestigationMissing: {"ja":"発進条件がまだ揃っていない。","en":"Launch requirements are not yet met."},
  gameLog: {"ja":"ゲームログ","en":"Game log"},
  introDamage: {"ja":"AI：基地は致命的損傷を受けた。恒久復旧は不可能。帰還船で地球へ帰還する。","en":"AI: The base has suffered critical damage. Permanent repairs are impossible. Use the return ship to reach Earth."},
  introRequirements: {"ja":"電力管理区で給電、管制区でロック解除、研究区の部品を整備区で使用、倉庫区で食糧確保。4条件を満たして発着区へ。","en":"Supply power in POWER, unlock launch control in CONTROL, use parts from RESEARCH in MAINTENANCE, and collect food in STORAGE. Meet all four requirements, then head to LAUNCH."},
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
  suitPowerDepleted: {"ja":"AI：スーツ電力が尽きた。最初から再試行できる。","en":"AI: Suit power depleted. Select RESTART to try again."},
  robotEncounter: {"ja":"防災ロボットを発見。人間認証に失敗している。","en":"A safety robot is here. Its human authentication has failed."},
  encounterInstructions: {"ja":"AI：対処を選択。隠れる80%／ENERGY 1、強行突破60%／ENERGY 2。失敗時は追加ENERGY 1。逃走は通路コスト。","en":"AI: Choose a response. HIDE: 80%, 1 ENERGY. FORCE THROUGH: 60%, 2 ENERGY. Failure costs 1 extra ENERGY. FLEE uses the passage cost."},
  actionUnavailable: {"ja":"AI：現在の状況で選べない行動。","en":"AI: This action is unavailable in the current situation."},
  districtDisconnected: {"ja":"AI：直接接続していない区画。","en":"AI: That district is not directly connected."},
  passageClosed: {"ja":"隔壁が閉鎖されている。CLOSED：移動不可。ENERGY消費なし。","en":"The bulkhead is closed. CLOSED: Impassable. No ENERGY spent."},
  walkedUnderEmergencyLightsUsingSuitLife: {"ja":"非常灯の下を歩く。スーツの生命維持を使用した。","en":"Walked under emergency lights, using suit life support."},
  passageLightsAreOffUsedSuitLighting: {"ja":"通路照明が停止している。スーツ照明を使用した。","en":"Passage lights are off. Used suit lighting."},
  debrisBlocksTheWayUsedPowerAssistance: {"ja":"瓦礫で通行困難。パワーアシストで突破した。","en":"Debris blocks the way. Used power assistance to get through."},
  taskUnavailable: {"ja":"AI：この設備操作は実行できない。","en":"AI: This system operation is unavailable."},
  repairPartsMissing: {"ja":"AI：修理部品がない。研究区で回収してほしい。ENERGY消費なし。","en":"AI: No repair parts. Collect them in RESEARCH. No ENERGY spent."},
  requirementsMissing: {"ja":"AI：帰還条件が不足している。","en":"AI: Return requirements are incomplete."},
  punctuation: {"ja":"。","en":"."},
  repairPartsCollectedUseThemInMaintenance: {"ja":"修理部品を取得。整備区で使用できる。","en":"Repair parts collected. Use them in MAINTENANCE."},
  theReturnShipHasLeftTheMoon: {"ja":"帰還船が月面を離れた。地球への航路を確保。","en":"The return ship has left the Moon. Course to Earth secured."},
  aiDeparturePreparationsCompleteWeCanDeal: {"ja":"AI：帰還準備完了。基地の修理請求書は後回しにする。","en":"AI: Departure preparations complete. We can deal with the base repair bill later."},
  foodCollectedKeepItUntilDeparture: {"ja":"食糧を取得。帰還まで保持する。","en":"Food collected. Keep it until departure."},
  repairPartsUsedHullRepairsComplete: {"ja":"修理部品を使用。船体修理完了。","en":"Repair parts used. Hull repairs complete."},
  returnRequirementMet: {"ja":"帰還条件達成：","en":"Return requirement met: "},
  hidingBehindCover: {"ja":"遮蔽物に隠れる。","en":"Hiding behind cover."},
  forcingPastTheSafetyRobot: {"ja":"防災ロボットの妨害を突破する。","en":"Forcing past the safety robot."},
  successAvoidedTheSafetyRobot: {"ja":"対処成功。防災ロボットをやり過ごした。","en":"Success. Avoided the safety robot."},
  failureUsedSuitProtectionToEscape: {"ja":"対処失敗。スーツ防護を使用し、離脱した。","en":"Failure. Used suit protection to escape."},
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
  descriptionHabitation: {"ja":"生命維持設備と非常灯が居室を支えている。ここに留まる選択肢はない。","en":"Life support and emergency lights keep the quarters running. Staying here is not an option."},
  descriptionMedical: {"ja":"医療端末は停止中。予備バッテリーが残っている。","en":"The medical terminal is offline. A spare battery remains."},
  descriptionObservation: {"ja":"観測装置が無人の月面を記録し続けている。不要設備を停止できる。","en":"The observation system keeps recording the empty lunar surface. Unneeded systems can be shut down."},
  descriptionResearch: {"ja":"研究室の保管箱に帰還船用の修理部品がある。","en":"The laboratory storage box contains repair parts for the return ship."},
  descriptionMaintenance: {"ja":"船体への遠隔整備設備が残っている。修理には研究区の部品が必要だ。","en":"Remote hull repair equipment still works. Repairs need parts from RESEARCH."},
  descriptionStorage: {"ja":"帰還用の食糧が保管されている。賞味期限は地球で確認しよう。","en":"Food for the return journey is stored here. Check the expiry dates back on Earth."},
  descriptionControl: {"ja":"通信設備は沈黙している。発進管制の安全ロックを解除できる。","en":"Communications are silent. The launch control safety lock can be released."},
  descriptionPower: {"ja":"残存電力を帰還船へ配電できる。基地全体の復旧は不可能だ。","en":"Remaining power can be routed to the return ship. Restoring the whole base is impossible."},
  descriptionLaunch: {"ja":"帰還船が待機している。帰還4条件を確認して発進しよう。","en":"The return ship is waiting. Check all four return requirements before launch."},
  settingsMenu: {"ja":"設定 >","en":"SETTINGS >"},
  languageMenu: {"ja":"言語 >","en":"LANGUAGE >"},
  settings: {"ja":"設定","en":"SETTINGS"},
  language: {"ja":"言語","en":"LANGUAGE"},
  energy1: {"ja":"ENERGY：1","en":"ENERGY: 1"},
  energy2: {"ja":"ENERGY：2","en":"ENERGY: 2"},
  checkedTarget: {"ja":"{0}を確認した。","en":"Checked {0}."},
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
  movementResult: {"ja":"{0}区へ{1}。","en":"{1} to {0}."},
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

export type TaskConfirmation = { explanation: string; question: string; done: string; declined: string }
const confirmationText: Record<Task, Record<Language, TaskConfirmation>> = {
  power: {
    ja: {"explanation": "残存電力を帰還船へ供給できる。", "question": "帰還船へ電力を供給しますか？", "done": "帰還船への電力供給はすでに完了している。", "declined": "電力を供給しなかった。"},
    en: {"explanation": "Remaining power can be supplied to the return ship.", "question": "Supply power to the return ship?", "done": "Power has already been supplied to the return ship.", "declined": "Did not supply power."},
  },
  control: {
    ja: {"explanation": "発進管制の安全ロックを解除できる。", "question": "発進管制を解除しますか？", "done": "発進管制のロックはすでに解除されている。", "declined": "解除しなかった。"},
    en: {"explanation": "The launch safety lock can be released.", "question": "Release launch control?", "done": "The launch safety lock has already been released.", "declined": "Did not release the lock."},
  },
  repair: {
    ja: {"explanation": "修理部品を使って帰還船を修理できる。", "question": "帰還船を修理しますか？", "done": "帰還船はすでに修理済みだ。", "declined": "修理しなかった。"},
    en: {"explanation": "Repair parts can be used to repair the return ship.", "question": "Repair the return ship?", "done": "The return ship has already been repaired.", "declined": "Did not repair the ship."},
  },
  parts: {
    ja: {"explanation": "帰還船の修理に使う部品を回収できる。", "question": "修理部品を回収しますか？", "done": "修理部品はすでに回収済みだ。", "declined": "修理部品を回収しなかった。"},
    en: {"explanation": "Parts for repairing the return ship can be collected.", "question": "Collect repair parts?", "done": "The repair parts have already been collected.", "declined": "Did not collect repair parts."},
  },
  food: {
    ja: {"explanation": "帰還に必要な食糧を回収できる。", "question": "食糧を回収しますか？", "done": "食糧はすでに回収済みだ。", "declined": "食糧を回収しなかった。"},
    en: {"explanation": "Food for the return journey can be collected.", "question": "Collect food?", "done": "The food has already been collected.", "declined": "Did not collect food."},
  },
  medical: {
    ja: {"explanation": "回収すると ENERGY が6回復する（上限20）。1回のみ。", "question": "回収しますか？", "done": "予備バッテリーはすでに回収済みだ。", "declined": "回収しなかった。"},
    en: {"explanation": "Collect it to restore 6 ENERGY (maximum 20). Once only.", "question": "Collect it?", "done": "The spare battery has already been collected.", "declined": "Left it behind."},
  },
  observe: {
    ja: {"explanation": "不要設備を停止すると ENERGY が6回復する（上限20）。1回のみ。", "question": "不要設備を停止しますか？", "done": "不要設備はすでに停止済みだ。", "declined": "停止しなかった。"},
    en: {"explanation": "Shut down unused systems to restore 6 ENERGY (maximum 20). Once only.", "question": "Shut down unused systems?", "done": "The unused systems have already been shut down.", "declined": "Did not shut down the systems."},
  },
  launch: {
    ja: {"explanation": "帰還船を発進して地球へ帰還できる。", "question": "帰還船を発進しますか？", "done": "帰還船はすでに発進済みだ。", "declined": "発進しなかった。"},
    en: {"explanation": "The return ship can launch for Earth.", "question": "Launch the return ship?", "done": "The return ship has already launched.", "declined": "Did not launch the ship."},
  },
}
export function taskConfirmations(language: Language): Record<Task, TaskConfirmation> {
  return Object.fromEntries(Object.entries(confirmationText).map(([task, text]) => [task, text[language]])) as Record<Task, TaskConfirmation>
}
