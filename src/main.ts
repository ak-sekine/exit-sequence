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

for (const action of ['周囲を見る', '扉を調べる', '端末を調べる', '持ち物', '状態確認', '待機する']) {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = action
  button.addEventListener('click', () => appendLog(action))
  actions.append(button)
}

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
