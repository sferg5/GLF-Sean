import { clamp, mix } from '../lib/remap'

/**
 * The swatch's baked pose — the hand-arranged hang the sim starts from and is
 * gently starched back toward.
 *
 * Holocloth's insight, borrowed whole: a cloth that starts flat looks like a
 * plane being bent, and a cloth that starts *arranged* — big soft billows, tension
 * where it's held, corners doing their own thing — looks like fabric from the
 * first frame. Theirs was captured by hand in the live tool; ours is written as a
 * sum of terms, each one a thing hanging cloth does:
 *
 *  - every column drops by the sag of its own x (level only at the clips)
 *  - the sheet gathers slightly inward on the way down
 *  - the hem bows toward the camera
 *  - vertical folds deepen toward the hem
 *  - one long soft billow crosses the whole sheet — the volume the reference has
 *  - a small radial "tension star" wrinkles out of each clip
 *  - the free bottom corners curl forward
 *
 * All numbers, no clock — the pose is byte-identical every build, which is what a
 * frozen frame is checked against.
 */

/** Swatch dimensions in scene units — a ~50 cm cut, portrait. */
export const SWATCH_W = 1.0
export const SWATCH_H = 1.35

const HW = SWATCH_W / 2
const HH = SWATCH_H / 2

/** Where the clips grip, from centre. The cloth is dead level only at these points. */
export const PIN_X = HW - 0.09

/** Simulation grid. Low on purpose — smooth normals carry the softness. */
export const SEG_X = 48
export const SEG_Y = 64
export const SEG_X_COARSE = 34
export const SEG_Y_COARSE = 46

const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/**
 * How far the column of cloth at x hangs below the rail: a shallow parabola
 * between the pins, and a freer droop outside them where nothing holds the corners.
 */
export const sag = (x: number) => {
  const a = Math.abs(x)
  if (a <= PIN_X) {
    const t = x / PIN_X
    return 0.032 * (1 - t * t)
  }
  return 0.05 * Math.pow((a - PIN_X) / (HW - PIN_X), 1.3)
}

/** Baked fold relief: vertical hanging folds that deepen toward the hem. */
const folds = (x: number, t: number) => {
  const a = 0.01 + 0.058 * t
  return (
    a * Math.sin(x * 9.5 + 0.8) * 0.55 +
    a * Math.sin(x * 5.2 - 1.6) * 0.45 +
    0.006 * t * Math.sin(x * 19.0 + t * 3.0)
  )
}

/** The clip's tension star: radial creases fanning out of a held point. */
const pinch = (gx: number, gy: number, px: number) => {
  const dx = gx - px
  const dy = gy - HH
  const d = Math.hypot(dx, dy)
  const ang = Math.atan2(dy, dx)
  return 0.02 * Math.exp(-d * 4.5) * Math.cos(ang * 5 + (px > 0 ? 1.1 : 0)) * smoothstep(0, 0.05, d)
}

/**
 * The hang: a clothesline. Two clips, the sheet presented like a specimen.
 *
 * **There was a second one** — gathered to 45% of its width at the header and opening toward the
 * hem, the surplus thrown into three and a half deep S-folds, lit by a raking key so the folds did
 * the talking. It looked better than this does and it's gone, because a sample gathered into folds
 * is a sample whose marks are partly hidden by its own shadows, and this is a comparison about
 * *showing*.
 */
export type SwatchGrid = {
  cols: number
  rows: number
  /** Baked pose positions, xyz interleaved. */
  pose: Float32Array
  /** Flat grid coords + hem factor, for the wind field. */
  gx: Float32Array
  gy: Float32Array
  below: Float32Array
  uvs: Float32Array
  indices: number[]
  /** Vertex indices the clips hold. */
  pins: number[]
  /** Where to draw clips, in world x. */
  clipXs: number[]
  /** Flat rest spacing of the true rectangle. */
  stepX: number
  stepY: number
  /** Flat garment coords → the baked pose's surface point (bilinear). */
  surface: (x: number, y: number) => [number, number, number]
}

export function buildSwatchGrid(coarse = false): SwatchGrid {
  const segX = coarse ? SEG_X_COARSE : SEG_X
  const segY = coarse ? SEG_Y_COARSE : SEG_Y
  const cols = segX + 1
  const rows = segY + 1
  const count = cols * rows

  const pose = new Float32Array(count * 3)
  const gxA = new Float32Array(count)
  const gyA = new Float32Array(count)
  const belowA = new Float32Array(count)
  const uvs = new Float32Array(count * 2)

  for (let iy = 0; iy < rows; iy++) {
    for (let ix = 0; ix < cols; ix++) {
      const u = ix / segX
      const v = iy / segY
      const gx = mix(-HW, HW, u)
      const gy = mix(-HH, HH, v)
      const below = (HH - gy) / SWATCH_H

      const x = gx * (1 - 0.05 * below)
      const y = gy - sag(gx)
      const z =
        0.05 * below * below * (1 - (gx / HW) ** 2) +
        folds(gx, below) * smoothstep(0, 0.12, below) +
        /* The long billow — the reference's volume. One soft S across the sheet, quiet at the
           clips, full by mid-drop. */
        0.07 * Math.sin(gx * 3.4 + below * 2.2 + 0.6) * smoothstep(0.08, 0.5, below) +
        pinch(gx, gy, -PIN_X) +
        pinch(gx, gy, PIN_X) +
        /* Free corners curl toward the camera. */
        0.04 * smoothstep(0.72, 1, below) * smoothstep(0.55, 1, Math.abs(gx) / HW)

      const i = iy * cols + ix
      pose[i * 3] = x
      pose[i * 3 + 1] = y
      pose[i * 3 + 2] = z
      gxA[i] = gx
      gyA[i] = gy
      belowA[i] = below
      uvs[i * 2] = u
      uvs[i * 2 + 1] = v
    }
  }

  const indices: number[] = []
  for (let iy = 0; iy < segY; iy++) {
    for (let ix = 0; ix < segX; ix++) {
      const a = iy * cols + ix
      const b = a + 1
      const c = a + cols
      const d = c + 1
      indices.push(a, b, d, a, d, c)
    }
  }

  /* Who holds the cloth: each clip holds a few adjacent vertices, because a single pinned vertex
     tears into a spike the moment the wind leans on it. */
  const pins: number[] = []
  const topRow = (rows - 1) * cols
  let clipXs: number[]
  {
    for (const px of [-PIN_X, PIN_X]) {
      const ix = Math.round(((px + HW) / SWATCH_W) * segX)
      for (const o of [-1, 0, 1]) {
        const j = Math.min(segX, Math.max(0, ix + o))
        pins.push(topRow + j)
      }
    }
    clipXs = [-PIN_X, PIN_X]
  }

  /** Bilinear sample of the pose — where a flat garment point actually hangs. */
  const surface = (x: number, y: number): [number, number, number] => {
    const u = clamp((x + HW) / SWATCH_W) * segX
    const v = clamp((y + HH) / SWATCH_H) * segY
    const ix = Math.min(segX - 1, Math.floor(u))
    const iy = Math.min(segY - 1, Math.floor(v))
    const fx = u - ix
    const fy = v - iy
    const out: [number, number, number] = [0, 0, 0]
    for (let c = 0; c < 3; c++) {
      const i00 = (iy * cols + ix) * 3 + c
      const i10 = i00 + 3
      const i01 = ((iy + 1) * cols + ix) * 3 + c
      const i11 = i01 + 3
      const v0 = pose[i00] * (1 - fx) + pose[i10] * fx
      const v1 = pose[i01] * (1 - fx) + pose[i11] * fx
      out[c] = v0 * (1 - fy) + v1 * fy
    }
    return out
  }

  return {
    cols,
    rows,
    pose,
    gx: gxA,
    gy: gyA,
    below: belowA,
    uvs,
    indices,
    pins,
    clipXs,
    stepX: SWATCH_W / segX,
    stepY: SWATCH_H / segY,
    surface,
  }
}
