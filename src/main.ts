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

const mainActions = [
  { label: '周囲を見る', hasNext: false },
  { label: '扉を調べる', hasNext: false },
  { label: '端末を調べる', hasNext: false },
  { label: '持ち物', hasNext: true },
  { label: '状態確認', hasNext: false },
  { label: '待機する', hasNext: false },
]
const inventory = [
  { label: '非常用ライト', hasNext: false },
  { label: '古い鍵', hasNext: false },
  { label: 'メモ', hasNext: false },
  { label: 'ドライバー', hasNext: false },
  { label: 'IDカード', hasNext: false },
  { label: '電池', hasNext: false },
  { label: '小型端末', hasNext: false },
  { label: 'ヒューズ', hasNext: false },
  { label: '薬品ボトル', hasNext: false },
  { label: 'ケーブル', hasNext: false },
]
const itemsPerPage = 6
const pageCount = Math.ceil(inventory.length / itemsPerPage)
let inventoryPage = 0
let inventoryOpen = false

function createButton(label: string, onClick: () => void) {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = label
  button.addEventListener('click', onClick)
  return button
}

function actionLabel(action: { label: string; hasNext: boolean }) {
  return action.label + (action.hasNext ? ' >' : '')
}

const navigation = document.createElement('nav')
navigation.className = 'action-navigation'
navigation.setAttribute('aria-label', '選択肢のページ操作')
const previous = createButton('＜', () => {
  if (!inventoryOpen || inventoryPage === 0) return
  inventoryPage -= 1
  renderInventoryPage()
})
previous.setAttribute('aria-label', '前のページ')
const next = createButton('＞', () => {
  if (!inventoryOpen || inventoryPage === pageCount - 1) return
  inventoryPage += 1
  renderInventoryPage()
})
next.setAttribute('aria-label', '次のページ')
const indicator = document.createElement('span')
indicator.className = 'action-page-indicator'
indicator.setAttribute('aria-live', 'polite')
const back = createButton('戻る', () => {
  if (!inventoryOpen) return
  renderMainActions()
  actions.querySelectorAll('button')[3]?.focus({ preventScroll: true })
})
back.setAttribute('aria-label', '親メニューへ戻る')
back.className = 'back-button'
const pageNavigation = document.createElement('div')
pageNavigation.className = 'page-navigation'
pageNavigation.append(previous, indicator, next)
navigation.append(back, pageNavigation)

function updateNavigation(currentPage: number, totalPages: number, hasParent: boolean) {
  indicator.textContent = `${currentPage + 1} / ${totalPages}`
  back.disabled = !hasParent
  previous.disabled = currentPage === 0
  next.disabled = currentPage === totalPages - 1
}

function renderMainActions() {
  inventoryOpen = false
  updateNavigation(0, 1, false)
  actions.replaceChildren()
  actions.setAttribute('aria-label', '行動を選択')
  for (const action of mainActions) {
    actions.append(createButton(actionLabel(action), () => {
      if (action.label === '持ち物') {
        inventoryOpen = true
        inventoryPage = 0
        renderInventoryPage()
        actions.querySelector('button')?.focus({ preventScroll: true })
      } else {
        appendLog(action.label)
      }
    }))
  }
}

function renderInventoryPage() {
  actions.replaceChildren()
  actions.setAttribute('aria-label', `持ち物 ${inventoryPage + 1} / ${pageCount}ページ`)
  const start = inventoryPage * itemsPerPage
  for (let slot = 0; slot < itemsPerPage; slot += 1) {
    const item = inventory[start + slot]
    if (item) {
      actions.append(createButton(actionLabel(item), () => appendLog(item.label)))
    } else {
      const empty = document.createElement('span')
      empty.className = 'inventory-empty'
      empty.setAttribute('aria-hidden', 'true')
      // 最長ラベルと同じ幅・高さを確保し、空き枠で行が縮まるのを防ぐ。
      empty.textContent = actionLabel(inventory[0]!)
      actions.append(empty)
    }
  }
  updateNavigation(inventoryPage, pageCount, true)
}

renderMainActions()

terminal.append(log, actions, navigation)
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
