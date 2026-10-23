export type FacilityCondition = 'stable' | 'degraded'
export type Observation = 'steady' | 'flicker' | 'drop'

export interface ActionDefinition {
  id: string
  label: string
  detail: string
  successDelta: number
  failureDelta: number
  baseChance: number
  stableModifier: number
}

export interface EventDefinition {
  id: string
  title: string
  description: string
  clues: Record<Observation, string>
  actions: readonly ActionDefinition[]
}

const clues = (steady: string, flicker: string, drop: string): Record<Observation, string> => ({
  steady,
  flicker,
  drop,
})

export const EVENTS: readonly EventDefinition[] = [
  {
    id: 'bulkhead', title: '故障した隔壁',
    description: '厚い隔壁が通路を塞いでいる。駆動端子へ手が届く。',
    clues: clues('駆動端子の電圧は安定している。', '警告灯が一定しない間隔で点滅する。', '保守ログに駆動電圧の低下が残っている。'),
    actions: [
      { id: 'electronic', label: '電子制御を再起動', detail: '端子からロックを解除する', successDelta: -1, failureDelta: -5, baseChance: 0.57, stableModifier: 0.21 },
      { id: 'manual', label: '手動で解除', detail: '機構を直接動かして開通させる', successDelta: -3, failureDelta: -4, baseChance: 0.63, stableModifier: -0.065 },
      { id: 'force', label: '強行突破', detail: '隙間を広げて通り抜ける', successDelta: 1, failureDelta: -8, baseChance: 0.43, stableModifier: 0.11 },
    ],
  },
  {
    id: 'generator', title: '不安定な発電設備',
    description: '停止した発電機が残留電力を抱えている。再起動には短い放電が必要だ。',
    clues: clues('発電機の回転音と出力計が揃っている。', '回転音が揺れ、出力計の針も小刻みに動く。', '制御ログに複数回の電圧降下が記録されている。'),
    actions: [
      { id: 'restart', label: '制御系から再起動', detail: '安定した出力を取り戻す', successDelta: 5, failureDelta: -4, baseChance: 0.48, stableModifier: 0.22 },
      { id: 'bypass', label: '補助回路を迂回', detail: '少量の電力を取り出す', successDelta: 2, failureDelta: -2, baseChance: 0.68, stableModifier: 0.075 },
      { id: 'overload', label: '過負荷で引き出す', detail: '成功時の回収量は大きい', successDelta: 9, failureDelta: -8, baseChance: 0.34, stableModifier: 0.14 },
    ],
  },
  {
    id: 'battery', title: '廃棄されたバッテリー',
    description: '床に古い蓄電池が転がっている。残量と端子の状態は外から読み切れない。',
    clues: clues('端子の表示は静かに点灯している。', '残量表示が点いたり消えたりしている。', '診断ラベルに容量低下の手書き記録がある。'),
    actions: [
      { id: 'synchronize', label: '出力を同期して充電', detail: '電圧を合わせてから接続する', successDelta: 4, failureDelta: -1, baseChance: 0.66, stableModifier: 0.17 },
      { id: 'direct', label: '端子へ直接接続', detail: '回収量を狙う', successDelta: 8, failureDelta: -6, baseChance: 0.45, stableModifier: 0.22 },
      { id: 'trickle', label: '少量だけ抜き取る', detail: '出力を抑えて試す', successDelta: 2, failureDelta: -2, baseChance: 0.8, stableModifier: 0.055 },
    ],
  },
  {
    id: 'leak', title: '漏電している通路',
    description: '水の跡が通路を横切り、床下の配線が露出している。',
    clues: clues('床面の電位差は小さく保たれている。', '絶縁警告が断続的に点灯する。', '巡回ログに漏電値の上昇が記録されている。'),
    actions: [
      { id: 'insulate', label: '絶縁経路を探す', detail: '遠回りして安全な床を渡る', successDelta: -1, failureDelta: -4, baseChance: 0.61, stableModifier: 0.16 },
      { id: 'jump', label: '一気に飛び越える', detail: '通電部に触れず渡る', successDelta: 1, failureDelta: -7, baseChance: 0.45, stableModifier: 0.15 },
      { id: 'crawl', label: '低速で配線を避ける', detail: '慎重に進むが時間がかかる', successDelta: -3, failureDelta: -2, baseChance: 0.74, stableModifier: 0.055 },
    ],
  },
  {
    id: 'charger', title: '故障した充電装置',
    description: '壁面の充電装置はまだ起動する。出力調整器に傷がある。',
    clues: clues('冷却ファンが一定の速さで回っている。', '充電ランプが不規則に明滅している。', '整備記録に過熱と出力低下の記載がある。'),
    actions: [
      { id: 'calibrate', label: '出力を調整して充電', detail: '規定値へ戻してから受電する', successDelta: 5, failureDelta: -3, baseChance: 0.55, stableModifier: 0.2 },
      { id: 'full', label: '最大出力で接続', detail: '短時間で多く回収する', successDelta: 8, failureDelta: -7, baseChance: 0.39, stableModifier: 0.2 },
      { id: 'trickle', label: '低出力で充電', detail: '時間をかけて少し回収する', successDelta: 2, failureDelta: -1, baseChance: 0.79, stableModifier: 0.065 },
    ],
  },
  {
    id: 'conveyor', title: '自動搬送設備',
    description: '荷物用の搬送台が通路を横切っている。非常停止は反応しない。',
    clues: clues('駆動音は均一で、レールの振動も小さい。', 'モーター音に周期的な引っ掛かりが混じる。', '制御盤に速度異常の記録が残っている。'),
    actions: [
      { id: 'ride', label: '搬送台に乗る', detail: '動力に逆らわず通り抜ける', successDelta: 3, failureDelta: -5, baseChance: 0.53, stableModifier: 0.19 },
      { id: 'override', label: '制御盤を迂回', detail: '設備を止めて通路を開ける', successDelta: -1, failureDelta: -3, baseChance: 0.68, stableModifier: 0.13 },
      { id: 'counterflow', label: '逆方向へ押し進む', detail: '通過できれば電力を温存する', successDelta: 1, failureDelta: -7, baseChance: 0.4, stableModifier: -0.08 },
    ],
  },
  {
    id: 'emergency', title: '非常電源',
    description: '天井裏に非常電源の切替器がある。予備系統はまだ生きている。',
    clues: clues('予備回路の電圧は基準値に近い。', '切替器のランプが揺れながら点灯する。', '負荷記録に電圧の落ち込みが複数残っている。'),
    actions: [
      { id: 'switch', label: '系統を切り替える', detail: '予備電源を通常出力へ接続', successDelta: 6, failureDelta: -4, baseChance: 0.48, stableModifier: 0.2 },
      { id: 'reserve', label: '少量を取り出す', detail: '負荷を抑えて蓄電する', successDelta: 3, failureDelta: -2, baseChance: 0.75, stableModifier: 0.08 },
      { id: 'draw', label: '制限を外して引き出す', detail: '成功時は多く回収できる', successDelta: 10, failureDelta: -8, baseChance: 0.32, stableModifier: 0.17 },
    ],
  },
  {
    id: 'terminal', title: '老朽化した制御端末',
    description: '端末は応答するが、入力部と制御バスの劣化具合は分からない。',
    clues: clues('自己診断は大きな異常を報告していない。', 'キー入力の反応にむらがある。', '制御ログに再試行と低電圧の記録が並ぶ。'),
    actions: [
      { id: 'reboot', label: '端末を再起動', detail: '制御バスを初期化して通路を開く', successDelta: 4, failureDelta: -3, baseChance: 0.56, stableModifier: 0.19 },
      { id: 'manual', label: '短い命令を入力', detail: '複雑な制御を避ける', successDelta: 2, failureDelta: -1, baseChance: 0.82, stableModifier: 0.05 },
      { id: 'exploit', label: '保守ポートから割り込む', detail: '成功すれば大きく回収できる', successDelta: 8, failureDelta: -7, baseChance: 0.42, stableModifier: 0.19 },
    ],
  },
  {
    id: 'cargo-rail', title: '封鎖された貨物レール',
    description: '貨物台車がレール上で停止し、避難通路を塞いでいる。',
    clues: clues('レールの通電状態は一定している。', '車輪から時折、短い異音がする。', '点検記録に駆動電圧の低下が記されている。'),
    actions: [
      { id: 'ride', label: '台車を手動で動かす', detail: '低速で脇へ寄せて通過する', successDelta: -1, failureDelta: -5, baseChance: 0.6, stableModifier: 0.14 },
      { id: 'unlock', label: 'ロックを切り離す', detail: '駆動を止めて押し開ける', successDelta: 3, failureDelta: -5, baseChance: 0.47, stableModifier: 0.15 },
      { id: 'bypass', label: '保守通路を探す', detail: '遠回りして配線を避ける', successDelta: -2, failureDelta: -2, baseChance: 0.78, stableModifier: 0.055 },
    ],
  },
  {
    id: 'lift', title: '停止した昇降機',
    description: '昇降機が階の途中で止まっている。隣に保守用の昇降路が続く。',
    clues: clues('制動音は静まり、昇降機は動いていない。', '位置ランプがわずかに揺れている。', '制御ログに位置ずれ警告が残っている。'),
    actions: [
      { id: 'ladder', label: '保守はしごを登る', detail: '昇降機を使わず上階へ進む', successDelta: -2, failureDelta: -4, baseChance: 0.67, stableModifier: 0.12 },
      { id: 'lift-power', label: '昇降機を再通電', detail: '制御系を直して上昇する', successDelta: -4, failureDelta: -2, baseChance: 0.71, stableModifier: 0.17 },
      { id: 'climb-fast', label: '外枠を素早く登る', detail: '通れれば電力を消費しない', successDelta: 1, failureDelta: -8, baseChance: 0.43, stableModifier: 0.14 },
    ],
  },
]

export const OBSERVATION_LIKELIHOOD: Record<FacilityCondition, Record<Observation, number>> = {
  stable: { steady: 0.62, flicker: 0.28, drop: 0.10 },
  degraded: { steady: 0.15, flicker: 0.45, drop: 0.40 },
}

export function eventById(id: string): EventDefinition {
  const event = EVENTS.find(candidate => candidate.id === id)
  if (!event) throw new Error(`Unknown event: ${id}`)
  return event
}

export function successChance(action: ActionDefinition, condition: FacilityCondition): number {
  const signedModifier = condition === 'stable' ? action.stableModifier : -action.stableModifier
  return Math.max(0.08, Math.min(0.92, action.baseChance + signedModifier))
}
