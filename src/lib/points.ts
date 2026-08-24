/**
 * The intact shoe, resampled as a stipple.
 *
 * The technical state renders the shell as a point cloud rather than as a
 * photograph, so the material has something to dissolve *into*. The cloud is
 * derived from the photograph itself — not scattered at random — which is why it
 * still reads as the product while it comes apart.
 *
 * Three properties of the source drive the sampling:
 *
 * - **Alpha** decides membership. The masters are cutouts, so this is exact:
 *   every point lands on shoe and none land on the background.
 * - **The alpha gradient** concentrates points along the silhouette. A stipple
 *   with uniform density reads as noise laid over a shape; one that thickens at
 *   the rim reads as the shape itself, which is the whole difference between
 *   "grain" and "scan".
 * - **Luminance** thins the cloud over the near-black outsole and fills it over
 *   the white foam, so the cloud carries the shoe's own tonal structure.
 *
 * Sampling is seeded. The field has to be identical run to run or `verify.mjs`
 * (which compares a scrolled frame against a scrubbed one, pixel by pixel) and
 * every screenshot would drift.
 */

import { SRC } from './shoe'

export type PointCloud = {
  /** Position in 0..1 of the stage box, so the cloud is resolution-independent. */
  x: Float32Array
  y: Float32Array
  /** Base alpha from the source pixel's luminance — the cloud's tonal structure. */
  weight: Float32Array
  /** Stable per-point randomness: drift speed and curl phase. Never Math.random at draw time. */
  seed: Float32Array
  /** Sampled from one of the shoe's chromatic reds, so the cloud keeps the product's accent. */
  warm: Uint8Array
  count: number
}

/**
 * Sampling raster. Coarse enough that the decode-and-scan stays around 10ms, fine
 * enough that the rim is a line rather than a staircase — the cloud is jittered
 * within each cell, so the raster never shows through as a grid.
 */
const GRID = { w: 384, h: 256 } as const

/** Points to aim for. Past ~14k the field stops reading as points and starts reading as fog. */
const TARGET = 12000

/** Guards against a pathological source turning into a million draw calls. */
const CEILING = 16000

/** mulberry32 — small, fast, and good enough for scatter. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function decodeToGrid(img: HTMLImageElement): ImageData | null {
  const canvas = document.createElement('canvas')
  canvas.width = GRID.w
  canvas.height = GRID.h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, GRID.w, GRID.h)
  try {
    return ctx.getImageData(0, 0, GRID.w, GRID.h)
  } catch {
    // Tainted canvas — only possible if the image is ever served cross-origin.
    return null
  }
}

const EMPTY: PointCloud = {
  x: new Float32Array(0),
  y: new Float32Array(0),
  weight: new Float32Array(0),
  seed: new Float32Array(0),
  warm: new Uint8Array(0),
  count: 0,
}

function build(data: Uint8ClampedArray): PointCloud {
  const { w, h } = GRID
  const alpha = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) alpha[i] = data[i * 4 + 3] / 255

  /**
   * Score every cell first, then solve for the acceptance constant that lands on
   * TARGET. Picking a probability by hand would make the count drift with any
   * change to the weighting, and the count is quoted on screen.
   */
  const score = new Float32Array(w * h)
  let total = 0

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const a = alpha[i]
      if (a < 0.06) continue

      // Alpha gradient — how close this cell is to the silhouette's edge.
      const l = x > 0 ? alpha[i - 1] : a
      const r = x < w - 1 ? alpha[i + 1] : a
      const u = y > 0 ? alpha[i - w] : a
      const d = y < h - 1 ? alpha[i + w] : a
      const edge = Math.max(Math.abs(r - l), Math.abs(d - u))

      const lum =
        (data[i * 4] * 0.2126 + data[i * 4 + 1] * 0.7152 + data[i * 4 + 2] * 0.0722) / 255

      const s = a * (0.2 + 0.55 * lum + 2.4 * edge)
      score[i] = s
      total += s
    }
  }

  if (total <= 0) return EMPTY

  const k = TARGET / total
  const rand = mulberry32(0x5eed)

  const xs: number[] = []
  const ys: number[] = []
  const ws: number[] = []
  const seeds: number[] = []
  const warms: number[] = []

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const s = score[i]
      if (s <= 0) continue
      if (rand() > s * k) continue
      if (xs.length >= CEILING) break

      // Jitter inside the cell, or the sampling raster shows through as a grid.
      xs.push((x + rand()) / w)
      ys.push((y + rand()) / h)

      const red = data[i * 4]
      const green = data[i * 4 + 1]
      const blue = data[i * 4 + 2]
      const lum = (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255

      ws.push(0.35 + 0.65 * lum)
      seeds.push(rand())
      warms.push(red > 90 && red > green * 1.22 && red > blue * 1.22 ? 1 : 0)
    }
  }

  return {
    x: Float32Array.from(xs),
    y: Float32Array.from(ys),
    weight: Float32Array.from(ws),
    seed: Float32Array.from(seeds),
    warm: Uint8Array.from(warms),
    count: xs.length,
  }
}

let pending: Promise<PointCloud> | null = null

/** Memoised: the scan is the same every time, and it costs a full decode. */
export function sampleShoe(): Promise<PointCloud> {
  return (pending ??= new Promise<PointCloud>((resolve) => {
    const img = new Image()
    // A missing or undecodable source degrades to no cloud, never to a hang: the
    // rest of the transition still works without it.
    img.onerror = () => resolve(EMPTY)
    img.onload = () => {
      const data = decodeToGrid(img)
      resolve(data ? build(data.data) : EMPTY)
    }
    img.src = SRC.start
  }))
}
