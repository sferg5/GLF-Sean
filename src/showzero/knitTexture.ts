import { CanvasTexture, RepeatWrapping } from 'three'

/**
 * A jersey knit, drawn rather than downloaded.
 *
 * The surface reads as fabric or the whole comparison reads as plastic, and what
 * makes knit knit is the normal map: columns of interlocking loops (wales) crossed
 * by rows (courses). A height field of two locked sine waves is enough at this
 * viewing distance — integer frequencies make it tile, a Sobel pass turns it into
 * normals, and a hash adds fibre-level grain so the highlight never goes glassy.
 *
 * Pure trigonometry and a deterministic hash: the texture is identical every build,
 * which the pixel-diff verification relies on.
 */

const SIZE = 256
const WALES = 18
const COURSES = 26

/** Deterministic per-pixel grain — same recipe as the shader's hash. */
const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123
  return s - Math.floor(s)
}

const height = (u: number, v: number) => {
  /* Wales wobble side to side as they cross each course — that phase coupling is
     what makes loops rather than corduroy. */
  const wale = Math.sin(2 * Math.PI * (WALES * u + 0.14 * Math.sin(2 * Math.PI * COURSES * v)))
  const course = Math.sin(2 * Math.PI * COURSES * v)
  return 0.62 * wale + 0.28 * course
}

let cached: CanvasTexture | null = null

export function knitNormalMap(): CanvasTexture {
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(SIZE, SIZE)

  const h = new Float32Array(SIZE * SIZE)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      h[y * SIZE + x] = height(x / SIZE, y / SIZE) + 0.35 * (hash(x, y) - 0.5)
    }
  }

  /* Central differences with wrapped indices, so the tile's own seam is invisible. */
  const at = (x: number, y: number) => h[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)]
  const STRENGTH = 1.1
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const gx = (at(x + 1, y) - at(x - 1, y)) * STRENGTH
      const gy = (at(x, y + 1) - at(x, y - 1)) * STRENGTH
      const inv = 1 / Math.hypot(gx, gy, 1)
      const i = (y * SIZE + x) * 4
      image.data[i] = Math.round((-gx * inv * 0.5 + 0.5) * 255)
      image.data[i + 1] = Math.round((gy * inv * 0.5 + 0.5) * 255)
      image.data[i + 2] = Math.round((inv * 0.5 + 0.5) * 255)
      image.data[i + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)

  const texture = new CanvasTexture(canvas)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  /* ~14 repeats across the shirt puts a wale at about 2 loops/cm at the specimen's
     scale — fine enough to read as jersey, coarse enough to survive minification. */
  texture.repeat.set(14, 14)
  cached = texture
  return texture
}
