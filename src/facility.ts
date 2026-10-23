import { isFloor } from './dungeon.ts'
import type { DungeonMap, Player } from './dungeon.ts'

type V = readonly [number, number, number]
type Mesh = { vertices: V[]; faces: number[][]; edges: number[][] }
const cache = new WeakMap<DungeonMap, Mesh[]>()
const depthBuffers = new WeakMap<CanvasRenderingContext2D, Float32Array>()

// Render-only geometry. No collision or AI data is added to the dungeon.
function geometry(map: DungeonMap): Mesh[] {
  const old = cache.get(map)
  if (old) return old
  const meshes: Mesh[] = []
  const box = (x: number, y: number, z: number, w: number, d: number, h: number): void => {
    meshes.push({
      vertices: [
        [x, y, z],
        [x + w, y, z],
        [x + w, y + d, z],
        [x, y + d, z],
        [x, y, z + h],
        [x + w, y, z + h],
        [x + w, y + d, z + h],
        [x, y + d, z + h],
      ],
      faces: [
        [0, 1, 2, 3],
        [4, 7, 6, 5],
        [0, 4, 5, 1],
        [1, 5, 6, 2],
        [2, 6, 7, 3],
        [3, 7, 4, 0],
      ],
      edges: [
        [0, 1, 2, 3, 0],
        [4, 5, 6, 7, 4],
        [0, 4],
        [1, 5],
        [2, 6],
        [3, 7],
      ],
    })
  }
  for (let y = 0; y < map.length; y++)
    for (let x = 0; x < (map[y]?.length ?? 0); x++) {
      if (!isFloor(map, x, y)) continue
      const northSouth = !isFloor(map, x - 1, y) && !isFloor(map, x + 1, y)
      const eastWest = !isFloor(map, x, y - 1) && !isFloor(map, x, y + 1)
      if (northSouth || eastWest) {
        // An octagonal ring has real thickness along the corridor axis.
        const ring: readonly (readonly [number, number])[] = [
          [0.04, 0.14],
          [0.14, 0.02],
          [0.86, 0.02],
          [0.96, 0.14],
          [0.96, 0.82],
          [0.81, 0.98],
          [0.19, 0.98],
          [0.04, 0.82],
        ]
        const vertices: V[] = []
        for (const inset of [false, true])
          for (const along of [0.18, 0.24]) {
            for (const [u, z] of ring) {
              const across = inset ? 0.5 + (u - 0.5) * 0.93 : u
              const height = inset ? 0.5 + (z - 0.5) * 0.93 : z
              vertices.push(northSouth ? [x + across, y + along, height] : [x + along, y + across, height])
            }
          }
        const faces: number[][] = [],
          edges: number[][] = []
        for (let i = 0; i < 8; i++) {
          const j = (i + 1) % 8
          faces.push(
            [i, j, j + 8, i + 8],
            [i + 16, j + 16, j + 24, i + 24],
            [i, j, j + 16, i + 16],
            [i + 8, j + 8, j + 24, i + 24],
          )
          edges.push([i, j], [i + 8, j + 8], [i + 16, j + 16], [i + 24, j + 24], [i, i + 8], [i + 16, i + 24])
        }
        meshes.push({ vertices, faces, edges })
        if ((x + y) % 2 === 1) {
          const vertices: V[] = [
            [x + 0.24, y + 0.35, 0.992],
            [x + 0.76, y + 0.35, 0.992],
            [x + 0.76, y + 0.88, 0.992],
            [x + 0.24, y + 0.88, 0.992],
          ]
          const edges: number[][] = [[0, 1, 2, 3, 0]]
          for (let i = 1; i <= 6; i++) {
            const yy = y + 0.35 + (i * 0.53) / 7
            vertices.push([x + 0.26, yy, 0.987], [x + 0.74, yy, 0.987])
            edges.push([vertices.length - 2, vertices.length - 1])
          }
          meshes.push({ vertices, faces: [[0, 1, 2, 3]], edges })
        }
        if ((x + y) % 3 === 0) {
          box(x + 0.06, y + 0.48, 0, 0.23, 0.32, 0.29)
          box(x + 0.075, y + 0.5, 0.29, 0.2, 0.28, 0.025)
          const container = meshes[meshes.length - 2]!
          const panel: V[] = [
            [x + 0.085, y + 0.801, 0.055],
            [x + 0.265, y + 0.801, 0.055],
            [x + 0.265, y + 0.801, 0.255],
            [x + 0.085, y + 0.801, 0.255],
            [x + 0.175, y + 0.802, 0.155],
          ]
          const base = container.vertices.length
          container.vertices.push(...panel)
          container.edges.push(
            [base, base + 1, base + 2, base + 3, base],
            [base, base + 4, base + 2],
            [base + 1, base + 4, base + 3],
          )
          for (const z of [0.035, 0.275]) {
            const i = container.vertices.length
            container.vertices.push([x + 0.07, y + 0.802, z], [x + 0.28, y + 0.802, z])
            container.edges.push([i, i + 1])
          }
          // Cylinder at the opposite wall: polygonal end caps and luminous tubes.
          const vertices: V[] = [],
            faces: number[][] = [],
            edges: number[][] = []
          for (const z of [0.34, 0.39, 0.68, 0.73])
            for (let i = 0; i < 8; i++) {
              const a = (i * Math.PI) / 4
              vertices.push([
                x + 0.89 + Math.cos(a) * (z === 0.39 || z === 0.68 ? 0.07 : 0.055),
                y + 0.67 + Math.sin(a) * (z === 0.39 || z === 0.68 ? 0.07 : 0.055),
                z,
              ])
            }
          for (let r = 0; r < 4; r++) edges.push([...Array.from({ length: 8 }, (_, i) => r * 8 + i), r * 8])
          for (let i = 0; i < 8; i++) {
            const j = (i + 1) % 8
            faces.push([i, j, j + 24, i + 24])
            edges.push([i, i + 24])
          }
          for (const offset of [-0.022, 0, 0.022]) {
            const i = vertices.length
            vertices.push([x + 0.89 + offset, y + 0.742, 0.4], [x + 0.89 + offset, y + 0.742, 0.67])
            edges.push([i, i + 1])
          }
          for (const z of [0, 0.73]) {
            const i = vertices.length
            vertices.push([x + 0.89, y + 0.67, z], [x + 0.89, y + 0.67, z === 0 ? 0.34 : 1])
            edges.push([i, i + 1])
          }
          meshes.push({ vertices, faces, edges })
        }
      }
    }
  cache.set(map, meshes)
  return meshes
}

type CameraVertex = { r: number; d: number; z: number }
// Per-pixel geometry depth leaves the openings in ribs and the space above props clear.
export function drawFacility(
  ctx: CanvasRenderingContext2D,
  map: DungeonMap,
  player: Player,
  w: number,
  h: number,
  horizon: number,
  focal: number,
  walls: Float32Array,
): Float32Array {
  const width = Math.ceil(w),
    height = Math.ceil(h)
  let depth = depthBuffers.get(ctx)
  if (!depth || depth.length !== width * height) {
    depth = new Float32Array(width * height)
    depthBuffers.set(ctx, depth)
  }
  depth.fill(Infinity)
  const camera = (v: V): CameraVertex => ({
    r: (v[0] - player.x) * Math.cos(player.heading) + (v[1] - player.y) * Math.sin(player.heading),
    d: (v[0] - player.x) * Math.sin(player.heading) - (v[1] - player.y) * Math.cos(player.heading),
    z: v[2],
  })
  const project = (v: CameraVertex) => ({
    x: w / 2 + (focal * v.r) / v.d,
    y: horizon + (focal * (0.5 - v.z)) / v.d,
    q: 1 / v.d,
  })
  const shapes = geometry(map)
    .map((mesh) => ({ mesh, vs: mesh.vertices.map(camera) }))
    .filter(({ vs }) => vs.some((v) => v.d > 0.12 && v.d < 8))
    .sort((a, b) => b.vs[0]!.d - a.vs[0]!.d)
  ctx.save()
  ctx.lineWidth = 0.75
  // Fill only black surfaces; green is reserved for engineering contours.
  for (const { mesh, vs } of shapes)
    for (const face of mesh.faces) {
      let poly = face.map((i) => vs[i]!)
      const clipped: CameraVertex[] = []
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i]!,
          b = poly[(i + 1) % poly.length]!
        if (a.d >= 0.12) clipped.push(a)
        if (a.d >= 0.12 !== b.d >= 0.12) {
          const t = (0.12 - a.d) / (b.d - a.d)
          clipped.push({ r: a.r + (b.r - a.r) * t, d: 0.12, z: a.z + (b.z - a.z) * t })
        }
      }
      poly = clipped
      if (poly.length < 3) continue
      const ps = poly.map(project)
      for (let i = 1; i < ps.length - 1; i++) {
        const a = ps[0]!,
          b = ps[i]!,
          c = ps[i + 1]!,
          den = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y)
        if (Math.abs(den) < 0.01) continue
        const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x))),
          maxX = Math.min(width - 1, Math.ceil(Math.max(a.x, b.x, c.x)))
        ctx.fillStyle = '#000'
        for (let x = minX; x <= maxX; x++) {
          // Scan only the triangle's vertical span, rather than its bounding rectangle.
          const crossings: number[] = []
          for (const [p, q] of [
            [a, b],
            [b, c],
            [c, a],
          ]) {
            if ((p.x <= x + 0.5 && q.x > x + 0.5) || (q.x <= x + 0.5 && p.x > x + 0.5)) {
              crossings.push(p.y + ((q.y - p.y) * (x + 0.5 - p.x)) / (q.x - p.x))
            }
          }
          if (crossings.length < 2) continue
          const minY = Math.max(0, Math.ceil(Math.min(...crossings) - 0.5))
          const maxY = Math.min(height - 1, Math.floor(Math.max(...crossings) - 0.5))
          let start = -1
          for (let y = minY; y <= maxY + 1; y++) {
            const u = ((b.y - c.y) * (x + 0.5 - c.x) + (c.x - b.x) * (y + 0.5 - c.y)) / den
            const v = ((c.y - a.y) * (x + 0.5 - c.x) + (a.x - c.x) * (y + 0.5 - c.y)) / den
            const d = 1 / (u * a.q + v * b.q + (1 - u - v) * c.q),
              idx = y * width + x
            if (y <= maxY && d < walls[x]! && d < depth[idx]!) {
              depth[idx] = d
              if (start < 0) start = y
            } else if (start >= 0) {
              ctx.fillRect(x, start, 1, y - start)
              start = -1
            }
          }
        }
      }
    }
  for (const { mesh, vs } of shapes) {
    ctx.strokeStyle = `rgba(38,255,57,${Math.max(0.15, 0.95 - Math.max(0, vs[0]!.d) * 0.105)})`
    ctx.beginPath()
    for (const edge of mesh.edges)
      for (let i = 1; i < edge.length; i++) {
        let a = vs[edge[i - 1]!]!,
          b = vs[edge[i]!]!
        if (a.d < 0.12 && b.d < 0.12) continue
        if (a.d < 0.12 || b.d < 0.12) {
          const t = (0.12 - a.d) / (b.d - a.d),
            v = { r: a.r + (b.r - a.r) * t, z: a.z + (b.z - a.z) * t, d: 0.12 }
          if (a.d < 0.12) a = v
          else b = v
        }
        const p = project(a),
          q = project(b),
          steps = Math.ceil(Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y)))
        // Bound the raster loop for geometry intersecting the near plane.
        for (let s = 0; s <= Math.min(steps, 16000); s++) {
          const t = s / steps,
            x = p.x + (q.x - p.x) * t,
            y = p.y + (q.y - p.y) * t,
            ix = Math.floor(x),
            iy = Math.floor(y)
          if (ix < 0 || ix >= width || iy < 0 || iy >= height) continue
          const d = 1 / (p.q + (q.q - p.q) * t),
            idx = iy * width + ix
          if (d > walls[ix]! + 0.002 || d > depth[idx]! + 0.008) continue
          depth[idx] = Math.min(depth[idx]!, d)
          ctx.moveTo(x, y)
          ctx.lineTo(x + (q.x - p.x) / Math.max(1, steps), y + (q.y - p.y) / Math.max(1, steps))
        }
      }
    ctx.stroke()
  }
  ctx.restore()
  return depth
}
