/**
 * Prepares the five colourway photographs for the strip under the x-ray.
 *
 * The shots arrive as indexed PNGs with a matte already on them: a shoe seen from above,
 * lying toe-right and canted a few degrees off horizontal, in a wide frame with two
 * thirds of it empty. That's a contact sheet. The strip needs a lockup — upright, and
 * cropped to itself so the file's edges mean the shoe's edges.
 *
 * Three passes:
 *
 *   1. **Stand up.** The tilt is measured, not eyeballed — the major axis of the
 *      silhouette, from its covariance. A shoe is far longer than it is wide, so that
 *      axis *is* the shoe, and turning it onto the vertical squares all five to each
 *      other without anyone deciding what "level" looks like.
 *   2. **Trim** to the matte's bounding box. Framing then belongs to CSS, and every file
 *      means the same thing by "full width" — which is what lets the five sit in one row
 *      at one size and read as one product.
 *   3. **Resample** to a common height, at roughly twice the largest the page draws them.
 *
 * Colour is carried premultiplied. Interpolating straight alpha across a hard matte
 * averages the transparent side's colour into every edge pixel and hangs a halo on the
 * shoe — the one artefact that would be obvious on a dark tile.
 *
 * Sources live in .context (untracked — they're the raw attachments); the outputs are
 * committed. Re-running needs the originals put back at .context/colorways/src.
 *
 *   node scripts/colorways.mjs
 */
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { decode, encode } from './png.mjs'

const SRC = '.context/colorways/src'
const OUT = 'public/colorways'

/** Output height in pixels. ~2× the largest the hovered shoe is drawn at. */
const HEIGHT = 760

const hex = (r, g, b) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

/** Premultiplied RGBA as Float32, so both resamples stay linear in it. */
const premultiplied = ({ w, h, bpp, stride, data }) => {
  const out = new Float32Array(w * h * 4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = y * stride + x * bpp
      const a = data[s + 3] / 255
      const d = (y * w + x) * 4
      out[d] = data[s] * a
      out[d + 1] = data[s + 1] * a
      out[d + 2] = data[s + 2] * a
      out[d + 3] = data[s + 3]
    }
  return out
}

/** Angle of the silhouette's major axis, radians, from the +x axis. */
const tilt = (m, w, h) => {
  let n = 0, sx = 0, sy = 0
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (m[y * w + x]) {
        n++
        sx += x
        sy += y
      }
  const cx = sx / n, cy = sy / n
  let xx = 0, yy = 0, xy = 0
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (m[y * w + x]) {
        const dx = x - cx, dy = y - cy
        xx += dx * dx
        yy += dy * dy
        xy += dx * dy
      }
  // Half the arctangent of the covariance is the eigenvector angle of a 2×2 symmetric
  // matrix — the direction the silhouette is longest in.
  return { angle: 0.5 * Math.atan2(2 * xy, xx - yy), cx, cy }
}

/**
 * Rotate premultiplied RGBA by `phi` about the frame's centre, bilinear.
 *
 * Sampling is destination-to-source, so no output pixel is left unwritten. The canvas
 * grows to the rotated bound of the original, which the trim then takes back.
 */
const rotate = (src, w, h, phi, cx, cy) => {
  const cos = Math.cos(phi), sin = Math.sin(phi)
  const W = Math.ceil(Math.abs(w * cos) + Math.abs(h * sin))
  const H = Math.ceil(Math.abs(w * sin) + Math.abs(h * cos))
  const out = new Float32Array(W * H * 4)

  for (let y = 0; y < H; y++) {
    const v = y - H / 2
    for (let x = 0; x < W; x++) {
      const u = x - W / 2
      // Inverse rotation, about the silhouette's centroid rather than the frame's:
      // the shoe stays put and the paper moves around it.
      const sxf = cx + u * cos + v * sin
      const syf = cy - u * sin + v * cos
      const x0 = Math.floor(sxf), y0 = Math.floor(syf)
      if (x0 < 0 || y0 < 0 || x0 + 1 >= w || y0 + 1 >= h) continue
      const fx = sxf - x0, fy = syf - y0
      const d = (y * W + x) * 4
      for (let c = 0; c < 4; c++) {
        const a = src[(y0 * w + x0) * 4 + c], b = src[(y0 * w + x0 + 1) * 4 + c]
        const e = src[((y0 + 1) * w + x0) * 4 + c], f = src[((y0 + 1) * w + x0 + 1) * 4 + c]
        out[d + c] = (a * (1 - fx) + b * fx) * (1 - fy) + (e * (1 - fx) + f * fx) * fy
      }
    }
  }
  return { data: out, w: W, h: H }
}

/** Bounding box of everything with any alpha at all. */
const bounds = (src, w, h) => {
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (src[(y * w + x) * 4 + 3] > 1) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

/**
 * Area-averaged box resample. Every source pixel contributes in proportion to how much
 * of it the destination pixel covers, which is what keeps the knit from moiring at the
 * ~2.5× reduction these run at.
 */
const resample = (src, sw, sh, box, dw, dh) => {
  const out = new Float32Array(dw * dh * 4)
  const fx = box.w / dw, fy = box.h / dh

  for (let y = 0; y < dh; y++) {
    const ty0 = box.y0 + y * fy, ty1 = ty0 + fy
    for (let x = 0; x < dw; x++) {
      const tx0 = box.x0 + x * fx, tx1 = tx0 + fx
      let r = 0, g = 0, b = 0, a = 0, wsum = 0
      for (let sy = Math.floor(ty0); sy < ty1; sy++) {
        if (sy < 0 || sy >= sh) continue
        const cy = Math.min(sy + 1, ty1) - Math.max(sy, ty0)
        for (let sx = Math.floor(tx0); sx < tx1; sx++) {
          if (sx < 0 || sx >= sw) continue
          const wgt = cy * (Math.min(sx + 1, tx1) - Math.max(sx, tx0))
          const i = (sy * sw + sx) * 4
          r += src[i] * wgt
          g += src[i + 1] * wgt
          b += src[i + 2] * wgt
          a += src[i + 3] * wgt
          wsum += wgt
        }
      }
      const d = (y * dw + x) * 4
      out[d] = r / wsum
      out[d + 1] = g / wsum
      out[d + 2] = b / wsum
      out[d + 3] = a / wsum
    }
  }
  return out
}

/** Premultiplied float back to the straight 8-bit RGBA a PNG stores. */
const flatten = (src, w, h) => {
  const out = Buffer.alloc(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    const a = src[i * 4 + 3]
    out[i * 4 + 3] = Math.round(Math.max(0, Math.min(255, a)))
    if (a < 0.5) continue
    for (let c = 0; c < 3; c++)
      out[i * 4 + c] = Math.round(Math.max(0, Math.min(255, (src[i * 4 + c] / a) * 255)))
  }
  return out
}

/**
 * The most saturated eighth of the shoe, averaged.
 *
 * Reported rather than written into a file: it's a starting point for each colourway's
 * accent, not the accent itself. What it finds is the loudest thing in frame — usually
 * the insole print — and Lunar White has nothing saturated in it at all, so the numbers
 * in the component are hand-set from these.
 */
const accent = (rgba, w, h) => {
  const px = []
  for (let i = 0; i < w * h; i++) {
    if (rgba[i * 4 + 3] < 250) continue
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2]
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    px.push([max === 0 ? 0 : (max - min) / max, r, g, b])
  }
  px.sort((a, b) => b[0] - a[0])
  const top = px.slice(0, Math.max(1, Math.floor(px.length / 8)))
  const mean = top.reduce((s, p) => [s[0] + p[1], s[1] + p[2], s[2] + p[3]], [0, 0, 0])
  return hex(mean[0] / top.length, mean[1] / top.length, mean[2] / top.length)
}

mkdirSync(OUT, { recursive: true })

for (const file of readdirSync(SRC).filter((f) => f.endsWith('.png')).sort()) {
  const img = decode(`${SRC}/${file}`)
  if (img.bpp !== 4) throw new Error(`${file}: expected a matted RGBA source`)

  const m = new Uint8Array(img.w * img.h)
  for (let i = 0; i < m.length; i++) m[i] = img.data[i * img.bpp + 3] > 128 ? 1 : 0

  const pre = premultiplied(img)
  const { angle, cx, cy } = tilt(m, img.w, img.h)

  // The shot is toe-right, and the lockup is toe-up: a quarter turn anticlockwise on
  // top of however far off level this particular shoe was lying.
  const phi = angle - Math.PI / 2
  const turned = rotate(pre, img.w, img.h, phi, cx, cy)
  const box = bounds(turned.data, turned.w, turned.h)
  const width = Math.round((box.w / box.h) * HEIGHT)
  const small = resample(turned.data, turned.w, turned.h, box, width, HEIGHT)
  const rgba = flatten(small, width, HEIGHT)

  writeFileSync(`${OUT}/${file}`, encode({ w: width, h: HEIGHT, data: rgba }))

  const solid = m.reduce((n, v) => n + v, 0)
  console.log(
    `${file.replace('.png', '').padEnd(14)} ` +
      `${String(width).padStart(4)}×${HEIGHT}  ` +
      `tilt ${((angle * 180) / Math.PI).toFixed(1)}°  ` +
      `matte ${((100 * solid) / (img.w * img.h)).toFixed(1)}%  ` +
      `accent ${accent(rgba, width, HEIGHT)}`,
  )
}
