import { DOORS, DUNGEON_MAP } from './dungeon.ts'
import type { Door, DungeonMap } from './dungeon.ts'
import type { Enemy } from './enemy.ts'
import type { GameState } from './game.ts'
import { castRay } from './raycast.ts'

const FIELD_OF_VIEW = Math.PI * 0.4
const WALL_HEIGHT = 1
const BACKGROUND = '#020705'
let enemySprite: HTMLCanvasElement | undefined

function sprite(): HTMLCanvasElement {
  if (enemySprite) return enemySprite
  const image = document.createElement('canvas')
  image.width = 32; image.height = 48
  const context = image.getContext('2d')!
  context.fillStyle = '#4ade80'
  // A compact green guard silhouette with a readable head, shoulders and legs.
  context.fillRect(11, 3, 10, 10)
  context.fillRect(8, 14, 16, 16)
  context.fillRect(4, 16, 5, 15); context.fillRect(23, 16, 5, 15)
  context.fillRect(9, 29, 6, 16); context.fillRect(18, 29, 6, 16)
  context.fillStyle = '#d1fae5'
  context.fillRect(13, 7, 2, 2); context.fillRect(18, 7, 2, 2)
  enemySprite = image
  return image
}

function drawGround(context: CanvasRenderingContext2D, width: number, height: number, horizon: number): void {
  context.fillStyle = BACKGROUND
  context.fillRect(0, 0, width, height)
  context.save()
  context.strokeStyle = 'rgba(74, 222, 128, 0.16)'
  context.lineWidth = 1
  for (const fraction of [0.07, 0.11, 0.17, 0.25, 0.37, 0.53, 0.75, 1]) {
    const y = horizon + (height - horizon) * fraction
    context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke()
  }
  for (let i = -12; i <= 12; i++) {
    const x = width / 2 + i * width / 24
    context.beginPath(); context.moveTo(width / 2, horizon); context.lineTo(x, height); context.stroke()
  }
  context.restore()
}

function drawSprite(
  context: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  centerX: number,
  top: number,
  spriteWidth: number,
  spriteHeight: number,
  forward: number,
  zBuffer: Float32Array,
  width: number,
  height: number,
): boolean {
  const left = Math.max(0, Math.floor(centerX - spriteWidth / 2))
  const right = Math.min(width - 1, Math.ceil(centerX + spriteWidth / 2))
  let visible = false
  context.save()
  for (let x = left; x <= right; x++) {
    if (zBuffer[x]! <= forward) continue
    visible = true
    context.beginPath(); context.rect(x, 0, 1, height); context.clip()
    context.imageSmoothingEnabled = false
    context.drawImage(image, centerX - spriteWidth / 2, top, spriteWidth, spriteHeight)
    context.restore(); context.save()
  }
  context.restore()
  return visible
}

function projectEnemy(player: GameState['player'], enemy: Enemy) {
  const dx = enemy.x - player.x, dy = enemy.y - player.y
  const forward = dx * Math.sin(player.heading) - dy * Math.cos(player.heading)
  const right = dx * Math.cos(player.heading) + dy * Math.sin(player.heading)
  return { forward, right }
}

export function renderDungeon(
  canvas: HTMLCanvasElement,
  state: GameState,
  map: DungeonMap = DUNGEON_MAP,
  doors: readonly Door[] = map === DUNGEON_MAP ? DOORS : [],
): readonly string[] {
  const bounds = canvas.getBoundingClientRect()
  const cssWidth = Math.max(1, bounds.width), cssHeight = Math.max(1, bounds.height)
  const ratio = Math.min(2, window.devicePixelRatio || 1)
  const width = Math.max(1, Math.round(cssWidth * ratio)), height = Math.max(1, Math.round(cssHeight * ratio))
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height }
  const context = canvas.getContext('2d')!
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  const w = cssWidth, h = cssHeight, horizon = h * 0.49
  const focal = w / (2 * Math.tan(FIELD_OF_VIEW / 2))
  drawGround(context, w, h, horizon)

  const zBuffer = new Float32Array(Math.ceil(w))
  zBuffer.fill(Infinity)
  const tops = new Float32Array(Math.ceil(w)), bottoms = new Float32Array(Math.ceil(w))
  const hitKeys: Array<string | undefined> = Array.from({ length: Math.ceil(w) })
  const player = state.player
  for (let x = 0; x < w; x++) {
    const relativeAngle = (x + 0.5 - w / 2) / focal
    const angle = player.heading + relativeAngle
    const direction = { x: Math.sin(angle), y: -Math.cos(angle) }
    const hit = castRay(map, player, direction, doors, state.openDoors, 18)
    if (!hit) continue
    hitKeys[x] = `${hit.kind}:${hit.side}:${hit.cell.x},${hit.cell.y}`
    const distance = Math.max(0.04, hit.distance * Math.cos(relativeAngle))
    zBuffer[x] = distance
    const wallHeight = focal * WALL_HEIGHT / distance
    const top = horizon - wallHeight * 0.5
    const bottom = horizon + wallHeight * 0.5
    tops[x] = top; bottoms[x] = bottom
    const sideShade = hit.side === 'vertical' ? 0.82 : 1
    const distanceShade = Math.max(0.28, 1 - distance * 0.055) * sideShade
    if (hit.kind === 'door') {
      const frame = hit.offset < 0.13 || hit.offset > 0.87
      context.fillStyle = frame ? `rgba(74, 222, 128, ${0.42 * distanceShade})` : `rgba(5, 22, 12, ${1})`
      context.fillRect(x, top, 1.15, wallHeight)
      if (frame) {
        context.strokeStyle = `rgba(74, 222, 128, ${0.5 * distanceShade})`
        context.beginPath(); context.moveTo(x, top); context.lineTo(x, bottom); context.stroke()
      }
    } else {
      context.fillStyle = `rgba(2, 12, 7, ${0.96})`
      context.fillRect(x, top, 1.15, wallHeight)
    }
  }

  context.save()
  context.strokeStyle = 'rgba(74, 222, 128, 0.78)'
  context.lineWidth = 1
  context.beginPath()
  let open = false
  for (let x = 0; x < w; x++) {
    if (!Number.isFinite(zBuffer[x])) { open = false; continue }
    if (!open) { context.moveTo(x, tops[x]!); open = true }
    else context.lineTo(x, tops[x]!)
  }
  context.stroke()
  context.beginPath(); open = false
  for (let x = 0; x < w; x++) {
    if (!Number.isFinite(zBuffer[x])) { open = false; continue }
    if (!open) { context.moveTo(x, bottoms[x]!); open = true }
    else context.lineTo(x, bottoms[x]!)
  }
  context.stroke()
  context.strokeStyle = 'rgba(74, 222, 128, 0.72)'
  context.beginPath()
  for (let x = 1; x < w; x++) {
    if (!hitKeys[x] || !hitKeys[x - 1] || hitKeys[x] === hitKeys[x - 1]) continue
    context.moveTo(x, Math.min(tops[x]!, tops[x - 1]!))
    context.lineTo(x, Math.max(bottoms[x]!, bottoms[x - 1]!))
  }
  context.stroke()
  context.restore()

  const sprites = state.enemies.map(enemy => ({ enemy, ...projectEnemy(player, enemy) }))
    .filter(item => item.forward > 0.12)
    .sort((a, b) => b.forward - a.forward)
  const image = sprite(), visible: string[] = []
  const spriteDepth = zBuffer.slice()
  for (const item of sprites) {
    const centerX = w / 2 + focal * item.right / item.forward
    const spriteHeight = focal * 0.82 / item.forward
    const spriteWidth = spriteHeight * (32 / 48)
    const bottom = horizon + focal * 0.48 / item.forward
    const top = bottom - spriteHeight
    if (centerX + spriteWidth / 2 < 0 || centerX - spriteWidth / 2 > w) continue
    if (drawSprite(context, image, centerX, top, spriteWidth, spriteHeight, item.forward, spriteDepth, Math.ceil(w), h)) {
      visible.push(item.enemy.id)
      const first = Math.max(0, Math.floor(centerX - spriteWidth / 2))
      const last = Math.min(Math.ceil(w) - 1, Math.ceil(centerX + spriteWidth / 2))
      for (let x = first; x <= last; x++) if (spriteDepth[x]! > item.forward) spriteDepth[x] = item.forward
    }
  }
  return visible
}
