/**
 * Derives every geometric constant in src/lib/shoe.ts from the two photographs,
 * plus the default background colour.
 *
 * Run it if the images are ever replaced — the numbers in shoe.ts are measured, not
 * eyeballed, and none of them survive a re-shoot.
 *
 *   node scripts/measure.mjs
 */
import { decode } from './png.mjs'

const A = decode('public/shoe/start.png') // intact
const B = decode('public/shoe/end.png') // cross-section
if (A.w !== B.w || A.h !== B.h) throw new Error('images differ in size — they must share a canvas')
if (A.bpp !== 4 || B.bpp !== 4) throw new Error('expected RGBA cutouts')
const { w: W, h: H } = A

const at = (im, x, y) => {
  const i = y * im.stride + x * im.bpp
  return [im.data[i], im.data[i + 1], im.data[i + 2], im.data[i + 3]]
}
const alpha = (im, x, y) => (x >= 0 && x < W && y >= 0 && y < H ? im.data[y * im.stride + x * im.bpp + 3] : 0)
const pct = (v, total) => Number(((v / total) * 100).toFixed(1))

console.log(`canvas         ${W}x${H}  (${W}/${H} = ${(W / H).toFixed(4)})`)

/* Alpha histogram: confirms these are real cutouts and not a soft knockout. */
{
  let clear = 0, partial = 0, solid = 0
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const a = alpha(A, x, y)
      if (a < 16) clear++
      else if (a > 239) solid++
      else partial++
    }
  const n = W * H
  console.log(
    `matte          ${((100 * clear) / n).toFixed(1)}% clear · ` +
      `${((100 * partial) / n).toFixed(1)}% feathered edge · ${((100 * solid) / n).toFixed(1)}% solid`,
  )
}

/* Silhouette from alpha — no backdrop to threshold against any more. */
const mask = (im) => {
  const m = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) m[y * W + x] = alpha(im, x, y) > 128 ? 1 : 0
  return m
}
const mA = mask(A), mB = mask(B)

const bbox = (m) => {
  let x0 = W, y0 = H, x1 = -1, y1 = -1
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (m[y * W + x]) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  return { x0, y0, x1, y1 }
}
const bA = bbox(mA), bB = bbox(mB)
console.log(`silhouette A   (${bA.x0},${bA.y0})-(${bA.x1},${bA.y1})   ${bA.x1 - bA.x0}x${bA.y1 - bA.y0}`)
console.log(`silhouette B   (${bB.x0},${bB.y0})-(${bB.x1},${bB.y1})   ${bB.x1 - bB.x0}x${bB.y1 - bB.y0}`)

/**
 * Registration.
 *
 * Unlike the previous pair (which agreed to a pixel) these two were cut out
 * separately, and B's sole sits ~12px lower while the tops agree — so no
 * translation fixes both ends. A vertical scale does.
 *
 * Correcting it is only possible because the images are cutouts: with a backdrop
 * baked in, transforming one layer would tear the background against the other.
 */
const ANCHOR = { x: Math.round((bA.x0 + bA.x1) / 2), y: bA.y0 - 4 }
const silhouetteArea = (() => { let n = 0; for (let i = 0; i < W * H; i++) n += mA[i] | mB[i]; return n })()

const disagreement = (sy, dx, dy) => {
  let e = 0
  for (let y = 0; y < H; y += 2)
    for (let x = 0; x < W; x += 2) {
      const sx = Math.round(x - dx)
      const syp = Math.round(ANCHOR.y + (y - ANCHOR.y - dy) / sy)
      const b = sx >= 0 && sx < W && syp >= 0 && syp < H ? mB[syp * W + sx] : 0
      e += mA[y * W + x] ^ b
    }
  return (100 * e * 4) / silhouetteArea
}

let fit = { sy: 1, dx: 0, dy: 0, e: disagreement(1, 0, 0) }
const uncorrected = fit.e
for (let sy = 0.955; sy <= 1.005; sy += 0.005)
  for (let dy = -10; dy <= 10; dy += 1)
    for (let dx = -10; dx <= 10; dx += 1) {
      const e = disagreement(sy, dx, dy)
      if (e < fit.e) fit = { sy: Number(sy.toFixed(3)), dx, dy, e }
    }
console.log(
  `registration   silhouettes disagree over ${uncorrected.toFixed(2)}% of their area uncorrected,\n` +
    `               ${fit.e.toFixed(2)}% after scaleY ${fit.sy} + translate (${fit.dx}, ${fit.dy})px ` +
    `about (${ANCHOR.x}, ${ANCHOR.y}).\n` +
    `               END_FIT: translate(${pct(fit.dx, W)}%, ${pct(fit.dy, H)}%) scaleY(${fit.sy}) ` +
    `origin ${pct(ANCHOR.x, W)}% ${pct(ANCHOR.y, H)}%`,
)

/** Sample B through the correction, so everything below measures the aligned pair. */
const fitB = (x, y) => {
  const sx = Math.round(x - fit.dx)
  const sy = Math.round(ANCHOR.y + (y - ANCHOR.y - fit.dy) / fit.sy)
  return sx >= 0 && sx < W && sy >= 0 && sy < H ? at(B, sx, sy) : [0, 0, 0, 0]
}

/**
 * Difference between the two, but only where both are solid — a pixel that's shoe
 * in one image and empty in the other says nothing about the interior, and outside
 * the shoe there is nothing in either image, so blending there is a no-op.
 */
const diffAt = (x, y) => {
  const a = at(A, x, y), b = fitB(x, y)
  if (a[3] < 200 || b[3] < 200) return 0
  return (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3
}

let sx = 0, sy = 0, sw = 0, minx = W, maxx = -1
for (let x = 0; x < W; x++)
  for (let y = 0; y < H; y++) {
    const d = diffAt(x, y)
    if (d > 28) {
      const g = d - 28
      sx += x * g; sy += y * g; sw += g
      if (x < minx) minx = x
      if (x > maxx) maxx = x
    }
  }
console.log(
  `difference     x ${minx}..${maxx} (${pct(minx, W)}%..${pct(maxx, W)}%)  ` +
    `focus (${Math.round(sx / sw)}, ${Math.round(sy / sw)}) = ${pct(sx / sw, W)}%, ${pct(sy / sw, H)}%`,
)

/**
 * Spine: the difference-weighted centre of each column, heavily smoothed — a line
 * through the heart of what changes. Not the top of the difference band, which just
 * tracks the upper silhouette and makes a poor axis.
 */
const centroid = []
for (let x = 0; x < W; x++) {
  let s = 0, ys = 0
  for (let y = 0; y < H; y++) {
    const d = diffAt(x, y)
    if (d > 25) { s += d - 25; ys += y * (d - 25) }
  }
  centroid.push(s > 500 ? ys / s : NaN)
}
const SMOOTH = Math.round(W / 12)
const smooth = centroid.map((_, x) => {
  let s = 0, n = 0
  for (let k = -SMOOTH; k <= SMOOTH; k++) {
    const v = centroid[x + k]
    if (Number.isFinite(v)) { s += v; n++ }
  }
  return n > 60 ? s / n : NaN
})

const spine = []
const step = Math.round(W / 14)
for (let x = step; x <= W - step; x += step) if (Number.isFinite(smooth[x])) spine.push([pct(x, W), pct(smooth[x], H)])
console.log('spine          ' + JSON.stringify(spine))

let need = 0
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++)
    if (mA[y * W + x] || mB[y * W + x]) {
      let d2 = Infinity
      for (const [px, py] of spine) {
        const dx = x - (px / 100) * W, dy = y - (py / 100) * H
        d2 = Math.min(d2, dx * dx + dy * dy)
      }
      need = Math.max(need, d2)
    }
console.log(`bloom          needs half-width ${Math.ceil(Math.sqrt(need))}px to cover the silhouette`)

/**
 * The shoe's red, and a muted background derived from it.
 *
 * Sampled from the most chromatic red-dominant pixels — the coral midsole — then
 * pulled most of the way to neutral so it reads as a studio wall lit by the product
 * rather than as a red page.
 */
{
  let r = 0, g = 0, b = 0, n = 0
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const [pr, pg, pb, pa] = at(A, x, y)
      if (pa < 240) continue
      const max = Math.max(pr, pg, pb), min = Math.min(pr, pg, pb)
      // strongly chromatic and red-dominant
      if (max - min > 90 && pr === max && pr > 150) { r += pr; g += pg; b += pb; n++ }
    }
  r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n)
  const hex = (v) => v.toString(16).padStart(2, '0')
  console.log(`shoe red       #${hex(r)}${hex(g)}${hex(b)}  (mean of ${n} chromatic red pixels)`)

  // HSL, so hue can be kept while saturation and lightness are pulled way down.
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn), l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  let hue = 0
  if (d !== 0) {
    if (max === rn) hue = ((gn - bn) / d) % 6
    else if (max === gn) hue = (bn - rn) / d + 2
    else hue = (rn - gn) / d + 4
    hue = (hue * 60 + 360) % 360
  }
  console.log(`               hsl(${hue.toFixed(1)} ${(s * 100).toFixed(0)}% ${(l * 100).toFixed(0)}%)`)
  const muted = (sat, light) => `hsl(${hue.toFixed(1)} ${sat}% ${light}%)`
  console.log(`suggested bg   deep   ${muted(14, 12)}`)
  console.log(`               default ${muted(13, 19)}   <- muted, based on the shoe's red`)
  console.log(`               mid    ${muted(11, 34)}`)
  console.log(`               bone   ${muted(16, 88)}`)
}
