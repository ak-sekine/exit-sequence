import './style.css'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('App element was not found')
}

const terminal = document.createElement('main')
terminal.className = 'terminal'

const log = document.createElement('div')
log.className = 'terminal-log'
log.setAttribute('role', 'log')
log.setAttribute('aria-label', 'ゲームログ')
log.tabIndex = 0

function appendLog(text: string) {
  const line = document.createElement('div')
  line.className = 'terminal-line'
  line.textContent = text
  log.append(line)
  log.scrollTop = log.scrollHeight
}

const actions = document.createElement('div')
actions.className = 'terminal-actions'
actions.setAttribute('role', 'group')
actions.setAttribute('aria-label', '行動を選択')

const inventory = [
  '非常用ライト', '古い鍵', 'メモ', 'ドライバー',
  'IDカード', '電池', '小型端末', 'ヒューズ',
  '薬品ボトル', 'ケーブル',
]
const itemsPerPage = 4
const pageCount = Math.ceil(inventory.length / itemsPerPage)
let inventoryPage = 0

function createButton(label: string, onClick: () => void) {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = label
  button.addEventListener('click', onClick)
  return button
}

function renderMainActions() {
  actions.replaceChildren()
  actions.setAttribute('aria-label', '行動を選択')
  for (const action of ['周囲を見る', '扉を調べる', '端末を調べる', '持ち物', '状態確認', '待機する']) {
    actions.append(createButton(action, () => {
      if (action === '持ち物') {
        inventoryPage = 0
        renderInventoryPage()
      } else {
        appendLog(action)
      }
    }))
  }
}

function renderInventoryPage() {
  actions.replaceChildren()
  actions.setAttribute('aria-label', `持ち物 ${inventoryPage + 1} / ${pageCount}ページ`)
  const start = inventoryPage * itemsPerPage
  for (const item of inventory.slice(start, start + itemsPerPage)) {
    actions.append(createButton(item, () => appendLog(item)))
  }

  const previous = createButton(inventoryPage === 0 ? '戻る' : '前へ', () => {
    if (inventoryPage === 0) {
      renderMainActions()
      actions.querySelectorAll('button')[3]?.focus({ preventScroll: true })
    } else {
      inventoryPage -= 1
      renderInventoryPage()
    }
  })
  previous.style.gridArea = '3 / 1'

  const next = createButton(inventoryPage === pageCount - 1 ? '戻る' : '次へ', () => {
    if (inventoryPage === pageCount - 1) {
      renderMainActions()
      actions.querySelectorAll('button')[3]?.focus({ preventScroll: true })
    } else {
      inventoryPage += 1
      renderInventoryPage()
    }
  })
  next.style.gridArea = '3 / 2'
  actions.append(previous, next)
  actions.querySelector('button')?.focus({ preventScroll: true })
}

renderMainActions()

terminal.append(log, actions)
app.append(terminal)

for (const line of [
  'EXIT SEQUENCE',
  'SYSTEM ONLINE',
  '',
  '非常灯だけが点灯している。',
  '正面には閉ざされた扉がある。',
  '壁際に古い端末が設置されている。',
  'どうする？',
]) {
  appendLog(line)
}
