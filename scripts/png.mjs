/**
 * Minimal 8-bit PNG codec (colour types 0/2/3/4/6, non-interlaced).
 *
 * Shared by the measurement and verification scripts so neither pulls in an image
 * library for what zlib plus filter reconstruction does in thirty lines.
 *
 * Palette images (type 3) are here because the colourway photographs arrived indexed;
 * they're expanded to RGB(A) on the way out, so every consumer sees the same shape of
 * buffer whatever the file was. `encode` is the other direction, for the one script
 * that writes an image rather than measuring one.
 */
import { readFileSync } from 'node:fs'
import { inflateSync, deflateSync } from 'node:zlib'

export const decode = (path) => {
  const buf = readFileSync(path)
  let o = 8
  let w, h, bitDepth, colorType
  let plte = null
  let trns = null
  const idat = []

  while (o < buf.length) {
    const len = buf.readUInt32BE(o)
    const type = buf.toString('ascii', o + 4, o + 8)
    const data = buf.subarray(o + 8, o + 8 + len)
    if (type === 'IHDR') {
      w = data.readUInt32BE(0)
      h = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
    } else if (type === 'PLTE') plte = Buffer.from(data)
    else if (type === 'tRNS') trns = Buffer.from(data)
    else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    o += 12 + len
  }

  // Palette entries are one byte per pixel through the filter stage; the expansion
  // to RGB(A) happens once the scanlines have been reconstructed.
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType]
  if (!channels || bitDepth !== 8) throw new Error(`unsupported PNG: type ${colorType}, depth ${bitDepth}`)

  const raw = inflateSync(Buffer.concat(idat))
  const bpp = channels
  const stride = w * bpp
  const out = Buffer.alloc(h * stride)
  let pos = 0

  for (let y = 0; y < h; y++) {
    const filter = raw[pos++]
    const line = raw.subarray(pos, pos + stride)
    pos += stride
    const cur = out.subarray(y * stride, (y + 1) * stride)
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null

    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0
      const b = prev ? prev[x] : 0
      const c = prev && x >= bpp ? prev[x - bpp] : 0
      let v = line[x]
      switch (filter) {
        case 1: v += a; break
        case 2: v += b; break
        case 3: v += (a + b) >> 1; break
        case 4: {
          const p = a + b - c
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
          v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
          break
        }
      }
      cur[x] = v & 255
    }
  }

  if (colorType === 3) {
    if (!plte) throw new Error('palette image with no PLTE')
    // tRNS on a palette is a per-entry alpha table, and it may be shorter than the
    // palette — anything it doesn't mention is opaque.
    const outBpp = trns ? 4 : 3
    const expanded = Buffer.alloc(w * h * outBpp)
    for (let i = 0; i < w * h; i++) {
      const e = out[i] * 3
      const j = i * outBpp
      expanded[j] = plte[e]
      expanded[j + 1] = plte[e + 1]
      expanded[j + 2] = plte[e + 2]
      if (trns) expanded[j + 3] = out[i] < trns.length ? trns[out[i]] : 255
    }
    return { w, h, bpp: outBpp, stride: w * outBpp, data: expanded }
  }

  return { w, h, bpp, stride, data: out }
}

/* CRC-32, the polynomial PNG specifies. Built once; every chunk carries one. */
const CRC = new Int32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC[n] = c
}
const crc32 = (buf) => {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

const chunk = (type, body) => {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(body.length, 0)
  head.write(type, 4, 'ascii')
  const tail = Buffer.alloc(4)
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0)
  return Buffer.concat([head, body, tail])
}

/**
 * Encode 8-bit RGBA to a non-interlaced PNG.
 *
 * Each row is filtered twice — None and Paeth — and the one with the smaller sum of
 * absolute byte values is kept. That's the heuristic libpng uses, and on a photograph
 * it's worth roughly a third of the file over writing every row unfiltered.
 */
export const encode = ({ w, h, data }) => {
  const bpp = 4
  const stride = w * bpp
  const rows = Buffer.alloc(h * (stride + 1))

  for (let y = 0; y < h; y++) {
    const cur = data.subarray(y * stride, (y + 1) * stride)
    const prev = y ? data.subarray((y - 1) * stride, y * stride) : null

    const paeth = Buffer.alloc(stride)
    let sumNone = 0
    let sumPaeth = 0
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0
      const b = prev ? prev[x] : 0
      const c = prev && x >= bpp ? prev[x - bpp] : 0
      const p = a + b - c
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
      const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      const v = (cur[x] - pred) & 255
      paeth[x] = v
      // Signed magnitude: a byte of 255 is a delta of -1, which is as cheap as 1.
      sumPaeth += v < 128 ? v : 256 - v
      sumNone += cur[x] < 128 ? cur[x] : 256 - cur[x]
    }

    const at = y * (stride + 1)
    if (sumPaeth < sumNone) {
      rows[at] = 4
      paeth.copy(rows, at + 1)
    } else {
      rows[at] = 0
      cur.copy(rows, at + 1)
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Mean absolute RGB difference between two decoded images, 0..255. */
export const meanDiff = (a, b) => {
  if (a.w !== b.w || a.h !== b.h) throw new Error('size mismatch')
  let sum = 0
  for (let y = 0; y < a.h; y++)
    for (let x = 0; x < a.w; x++) {
      const i = y * a.stride + x * a.bpp
      const j = y * b.stride + x * b.bpp
      sum +=
        (Math.abs(a.data[i] - b.data[j]) +
          Math.abs(a.data[i + 1] - b.data[j + 1]) +
          Math.abs(a.data[i + 2] - b.data[j + 2])) /
        3
    }
  return sum / (a.w * a.h)
}
