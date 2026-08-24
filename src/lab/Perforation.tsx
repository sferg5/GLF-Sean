import { useEffect, useRef } from 'react'
import {
  type Field,
  type Reading,
  type Stir,
  buildMembrane,
  columnsFor,
  createField,
  measure,
  sample,
  step,
  window0,
  window1,
} from '../lib/perforation'

/**
 * The perforation field, drawn.
 *
 * The physics is `lib/perforation.ts` and stays there. This file is three pictures of the same
 * solved field, composited in one order, plus the loop that drives them:
 *
 * - **Heat**, the speed magnitude as a low-resolution raster, drawn under everything as the glow
 *   that says where the energy is.
 * - **Streaklines**, particles advected through the field into a persistent buffer that fades
 *   rather than clears. This is the layer that carries the image — a still frame of points is a
 *   speckle, and the same points with a fourteen-frame tail are the flow.
 * - **Glyphs**, a monospace grid sampling direction into `- \ | /` and speed into brightness. The
 *   plotter reading of the same field, and the reason the section reads as an instrument rather
 *   than as a smoke machine.
 *
 * **Colour, against the grain of `lab/WindTunnel.tsx`.** That file took the colour out on the
 * argument that "a section that arrives in cyan and crimson is a different brand for one screen",
 * and it was right about cyan and crimson. This ramp is the brand red — #EE3B33 at its midpoint,
 * deep maroon below, ember and gold above — so what arrives is not a foreign palette but the
 * page's own accent used as a scale. It earns the colour by carrying information the neutral could
 * not: at 25% open the jets run four times the freestream, and a monochrome ramp puts the
 * freestream and the jet core within one step of each other.
 *
 * **Nothing in here reads scroll**, same as the tunnel it sits beside. The field runs whenever the
 * section is in front of you.
 */

/* Ink
   ------------------------------------------------------------------ */

/**
 * The ramp, as stops.
 *
 * Brand red sits at 0.52 rather than at the top, which is the placement that matters: the
 * freestream lands near 0.38 and has to read as *present but cool*, so everything below the red is
 * spent getting from near-black to it, and everything above is the headroom a jet needs.
 */
const STOPS: [number, number, number, number][] = [
  [0.0, 16, 6, 14],
  [0.1, 46, 12, 20],
  [0.24, 128, 28, 32],
  [0.38, 200, 40, 38],
  [0.52, 238, 59, 51],
  [0.7, 245, 120, 58],
  [0.86, 249, 190, 69],
  [1.0, 255, 243, 220],
]

const ramp = (t: number): [number, number, number] => {
  if (t <= 0) return [STOPS[0][1], STOPS[0][2], STOPS[0][3]]
  const last = STOPS[STOPS.length - 1]
  if (t >= 1) return [last[1], last[2], last[3]]
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i]
    const b = STOPS[i + 1]
    if (t >= a[0] && t <= b[0]) {
      const k = (t - a[0]) / (b[0] - a[0])
      return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k]
    }
  }
  return [last[1], last[2], last[3]]
}

/**
 * Quantisation. Every particle in a bin is filled under one `fillStyle`, so this is the number of
 * style changes a frame costs rather than a number of colours anybody can count.
 */
const BINS = 14
const INK = Array.from({ length: BINS }, (_, i) => {
  const [r, g, b] = ramp((i + 0.5) / BINS)
  return `rgb(${r | 0},${g | 0},${b | 0})`
})

/** The membrane, in the page's warm neutral rather than in the ramp. It is not part of the scale. */
const SPECIMEN = '226,221,210'
const WITNESS = 'rgba(238,59,51,0.62)'

/**
 * Per-layer tone curves over the same exposure window.
 *
 * Three curves rather than one because the layers have different jobs. Heat is an underglow and
 * wants its midtones pushed down or it fogs the streaklines it sits beneath. Streaklines must stay
 * legible everywhere, so they get a floor — a particle rendered at true zero is a particle that
 * isn't there, and the approach flow would go missing. Glyphs sit between the two.
 */
const heatOf = (t: number) => Math.pow(t, 1.02)
const partOf = (t: number) => 0.22 + 0.78 * Math.pow(t, 0.8)
const glyphOf = (t: number) => Math.pow(t, 0.8)

const GLYPHS = ['-', '\\', '|', '/'] as const
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

/* Particles
   ------------------------------------------------------------------ */

const COUNT = 8600

type Swarm = { x: Float32Array; y: Float32Array; life: Float32Array; active: number }

const makeSwarm = (f: Field): Swarm => {
  const s: Swarm = {
    x: new Float32Array(COUNT),
    y: new Float32Array(COUNT),
    life: new Float32Array(COUNT),
    active: COUNT,
  }
  for (let i = 0; i < COUNT; i++) {
    /* Seeded across the whole field rather than at the inlet: the first frame should be a flow,
       not an empty channel filling from the left. Deterministic is not worth it here — a start
       position is washed out within a second of stepping. */
    s.x[i] = Math.random() * f.w
    s.y[i] = Math.random() * f.h
    s.life[i] = Math.random() * 160
  }
  return s
}

/**
 * Advance the swarm.
 *
 * Most respawns go to the inlet, a fifth go anywhere. The fifth is what keeps a recirculation zone
 * behind a dense specimen from reading as a rendering hole: nothing reaches it from upstream, which
 * is true and correct, and an entirely empty region reads as a bug rather than as a wake.
 */
function move(f: Field, s: Swarm): void {
  for (let i = 0; i < s.active; i++) {
    const px = s.x[i]
    const py = s.y[i]
    const uu = sample(f, f.u, px, py)
    const vv = sample(f, f.v, px, py)
    let x = px + uu
    let y = py + vv
    s.life[i] += 1

    if (x < 0 || x >= f.w - 1 || y < 0.5 || y >= f.h - 1.5 || s.life[i] > 240) {
      const anywhere = Math.random() < 0.18
      s.x[i] = anywhere ? Math.random() * f.w : Math.random() * 3
      s.y[i] = Math.random() * f.h
      s.life[i] = 0
      continue
    }
    /* Inside the fabric: back out along the way in and jitter, rather than teleport. A particle
       nudged out of a solid cell that keeps its velocity finds the nearest hole, which is what air
       does. */
    if (f.solid[(x | 0) + (y | 0) * f.w]) {
      x -= uu * 1.4
      y -= vv * 1.4 + (Math.random() - 0.5) * 0.7
    }
    s.x[i] = x
    s.y[i] = y
  }
}

/* Options
   ------------------------------------------------------------------ */

export type Layers = { particles: boolean; glyphs: boolean; heat: boolean }

type Options = {
  flow: React.RefObject<HTMLCanvasElement | null>
  glyph: React.RefObject<HTMLCanvasElement | null>
  /** Live, so dragging a slider never restarts a running loop. */
  wind: React.RefObject<number>
  geometry: React.RefObject<{ dia: number; pitch: number; drag: number }>
  layers: React.RefObject<Layers>
  showing: boolean
  reduced: boolean
  /** Called at about 4Hz with the field's reading. Not every frame — nothing can read that fast. */
  onReading: (r: Reading) => void
}

/**
 * The loop.
 *
 * One effect, one `requestAnimationFrame`, and a governor. The governor exists because this is
 * going on a display and a display is whatever hardware is in the room: it sheds glyph cadence
 * first, then solver iterations, and only last the streaklines, because that is the order that
 * protects the picture. Dropping particles first would keep the frame rate and lose the image.
 */
export function usePerforation({
  flow,
  glyph,
  wind,
  geometry,
  layers,
  showing,
  reduced,
  onReading,
}: Options): void {
  /* The callback is read from a ref so a parent re-render never tears down a running field. */
  const report = useRef(onReading)
  report.current = onReading

  useEffect(() => {
    const fc = flow.current
    const gc = glyph.current
    if (!fc || !gc) return

    const fx = fc.getContext('2d')
    const gx = gc.getContext('2d')
    if (!fx || !gx) return

    const host = fc.parentElement
    if (!host) return

    let field = createField(host.clientWidth / Math.max(1, host.clientHeight))
    let swarm = makeSwarm(field)

    /* Streaklines live in their own buffer so they can persist while the composite clears every
       frame. Heat is redrawn from the field each frame and must not accumulate; particles must.
       One canvas cannot do both. */
    const trail = document.createElement('canvas')
    const tx = trail.getContext('2d')
    const heat = document.createElement('canvas')
    const hx = heat.getContext('2d')
    if (!tx || !hx) return

    let raster: ImageData | null = null

    let cw = 0
    let ch = 0
    let dpr = 1
    /* Two raster scales. The flow buffers are fill-rate bound and look no worse at 1.5×; the glyph
       layer is text and wants the full ratio, or the marks blur into dashes. */
    let dprFlow = 1

    let cellPx = 13
    let frameMs = 16
    let quality = 1
    let glyphEvery = 2
    let live = COUNT

    const stir: { on: boolean; x: number; y: number; px: number; py: number } = {
      on: false,
      x: 0,
      y: 0,
      px: 0,
      py: 0,
    }

    const layout = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      dprFlow = Math.min(1.5, dpr)
      cw = Math.max(240, host.clientWidth)
      ch = Math.max(120, host.clientHeight)
      cellPx = cw < 700 ? 11 : 13

      gc.width = Math.round(cw * dpr)
      gc.height = Math.round(ch * dpr)
      for (const c of [fc, trail]) {
        c.width = Math.round(cw * dprFlow)
        c.height = Math.round(ch * dprFlow)
      }

      const columns = columnsFor(cw / ch)
      if (columns !== field.w) {
        field = createField(cw / ch)
        swarm = makeSwarm(field)
      }
      heat.width = field.w
      heat.height = field.h
      raster = hx.createImageData(field.w, field.h)

      field.wind = wind.current
      const g = geometry.current
      buildMembrane(field, g.dia, g.pitch, g.drag)

      fx.setTransform(1, 0, 0, 1, 0, 0)
      fx.fillStyle = '#0a0908'
      fx.fillRect(0, 0, fc.width, fc.height)
    }

    layout()

    /* Geometry is rebuilt only when it actually changes. `buildMembrane` supersamples eight times
       per row, which is nothing on its own and is not worth doing sixty times a second. */
    let lastGeom = ''

    const drawHeat = () => {
      if (!raster) return
      const d = raster.data
      const lo = window0(field.wind)
      const hi = window1(field.wind)
      const span = Math.max(1e-4, hi - lo)
      for (let i = 0; i < field.spd.length; i++) {
        let t = (field.spd[i] - lo) / span
        t = t < 0 ? 0 : t > 1 ? 1 : t
        t = heatOf(t)
        const [r, g, b] = ramp(t)
        const o = i * 4
        d[o] = r | 0
        d[o + 1] = g | 0
        d[o + 2] = b | 0
        d[o + 3] = field.solid[i] ? 0 : (Math.min(1, 0.1 + t * 1.25) * 236) | 0
      }
      hx.putImageData(raster, 0, 0)
    }

    const drawMembrane = (sx: number, sy: number) => {
      const x0 = field.band * sx
      const width = field.thickness * sx
      gx.globalCompositeOperation = 'source-over'
      gx.fillStyle = `rgba(${SPECIMEN},0.12)`
      gx.fillRect(x0, 0, width, ch)
      for (let j = 0; j < field.h; j++) {
        const closed = 1 - field.perm[field.band + j * field.w]
        if (closed <= 0.02) continue
        gx.fillStyle = `rgba(${SPECIMEN},${(0.09 + closed * 0.46).toFixed(3)})`
        gx.fillRect(x0, j * sy - 0.3, width, sy + 0.6)
      }
      /* The witness line marks the upstream face — the plane the pressure drop is measured across,
         so it is the one edge of the specimen worth naming in the accent. */
      gx.fillStyle = WITNESS
      gx.fillRect(x0 - 0.6, 0, 1, ch)
    }

    const drawGlyphs = () => {
      const cols = Math.ceil(cw / cellPx)
      const rows = Math.ceil(ch / cellPx)
      const lo = window0(field.wind)
      const hi = window1(field.wind)
      const span = Math.max(1e-4, hi - lo)
      const base = layers.current.particles ? 0.34 : 1

      gx.font = `${cellPx - 1}px ${MONO}`
      gx.textBaseline = 'middle'
      gx.textAlign = 'center'
      gx.globalCompositeOperation = 'lighter'

      /* Bucketed by brightness and by glyph, so the whole layer costs 8 × 5 style changes rather
         than one per mark. The fifth glyph is the low-speed dot, which has no direction to show. */
      const B = 8
      const bins: number[][][] = Array.from({ length: B }, () => [[], [], [], [], []])

      for (let r = 0; r < rows; r++) {
        const cy = r * cellPx + cellPx / 2
        const gy = (cy / ch) * field.h
        for (let c = 0; c < cols; c++) {
          const cx = c * cellPx + cellPx / 2
          const gxv = (cx / cw) * field.w
          const gi = gxv | 0
          const gj = gy | 0
          if (gi < 0 || gi >= field.w || gj < 0 || gj >= field.h) continue
          if (field.solid[gi + gj * field.w]) continue
          const uu = sample(field, field.u, gxv, gy)
          const vv = sample(field, field.v, gxv, gy)
          let w = (Math.hypot(uu, vv) - lo) / span
          w = w < 0 ? 0 : w > 1 ? 1 : w
          if (w < 0.035) continue
          const t = glyphOf(w)
          let g = 4
          if (t >= 0.075) {
            const q = Math.round(Math.atan2(vv, uu) / (Math.PI / 4))
            g = ((q % 4) + 4) % 4
          }
          const bi = Math.min(B - 1, (Math.pow(t, 0.72) * (B - 1)) | 0)
          bins[bi][g].push(cx, cy)
        }
      }

      for (let b = 0; b < B; b++) {
        const t = (b + 0.5) / B
        const [r, g, bl] = ramp(Math.min(1, 0.18 + t * 0.86))
        gx.fillStyle = `rgb(${r | 0},${g | 0},${bl | 0})`
        gx.globalAlpha = base * (0.22 + 0.78 * t)
        for (let gi = 0; gi < 5; gi++) {
          const list = bins[b][gi]
          if (!list.length) continue
          const ch2 = gi === 4 ? '.' : GLYPHS[gi]
          for (let i = 0; i < list.length; i += 2) gx.fillText(ch2, list[i], list[i + 1])
        }
      }
      gx.globalAlpha = 1
    }

    const render = () => {
      const sx = cw / field.w
      const sy = ch / field.h
      const L = layers.current

      if (L.particles) {
        const lo = window0(field.wind)
        const hi = window1(field.wind)
        const span = Math.max(1e-4, hi - lo)

        tx.setTransform(1, 0, 0, 1, 0, 0)
        tx.globalCompositeOperation = 'destination-out'
        tx.fillStyle = 'rgba(0,0,0,0.048)'
        tx.fillRect(0, 0, trail.width, trail.height)
        tx.setTransform(dprFlow, 0, 0, dprFlow, 0, 0)
        tx.globalCompositeOperation = 'lighter'

        const buckets: number[][] = Array.from({ length: BINS }, () => [])
        for (let i = 0; i < live; i++) {
          let w = (sample(field, field.spd, swarm.x[i], swarm.y[i]) - lo) / span
          w = w < 0 ? 0 : w > 1 ? 1 : w
          const bi = Math.min(BINS - 1, (partOf(w) * (BINS - 1)) | 0)
          buckets[bi].push(swarm.x[i] * sx, swarm.y[i] * sy)
        }
        for (let b = 0; b < BINS; b++) {
          const list = buckets[b]
          if (!list.length) continue
          tx.fillStyle = INK[b]
          tx.globalAlpha = 0.3 + 0.7 * Math.pow(b / (BINS - 1), 0.9)
          const size = b > BINS * 0.7 ? 1.5 : 1.1
          for (let i = 0; i < list.length; i += 2) tx.fillRect(list[i], list[i + 1], size, size)
        }
        tx.globalAlpha = 1
      }

      fx.setTransform(1, 0, 0, 1, 0, 0)
      fx.globalCompositeOperation = 'source-over'
      fx.globalAlpha = 1
      fx.fillStyle = '#0a0908'
      fx.fillRect(0, 0, fc.width, fc.height)
      fx.setTransform(dprFlow, 0, 0, dprFlow, 0, 0)

      if (L.heat) {
        drawHeat()
        /* Smooth while it is an underglow, crisp when it is the subject. A 300-cell raster blown
           up five times is a blur, and a blur that nothing is drawn on top of is just soft — so
           with the streaklines off it becomes the solver's own cell grid instead, which is at
           least honest about its resolution. */
        fx.imageSmoothingEnabled = L.particles
        fx.globalAlpha = L.particles ? 0.48 : 0.94
        fx.drawImage(heat, 0, 0, cw, ch)
        fx.globalAlpha = 1
      }
      if (L.particles) {
        fx.globalCompositeOperation = 'lighter'
        fx.setTransform(1, 0, 0, 1, 0, 0)
        fx.drawImage(trail, 0, 0)
        fx.setTransform(dprFlow, 0, 0, dprFlow, 0, 0)
        fx.globalCompositeOperation = 'source-over'
      }

      /* The glyph layer keeps its own canvas and is not cleared on the frames it skips, which is
         what makes running it at half rate free rather than flickery. */
      if (!L.glyphs || field.tick % glyphEvery === 0) {
        gx.setTransform(dpr, 0, 0, dpr, 0, 0)
        gx.clearRect(0, 0, cw, ch)
        drawMembrane(sx, sy)
        if (L.glyphs) drawGlyphs()
      }
    }

    /* Input
       ---------------------------------------------------------------- */

    const at = (e: PointerEvent): [number, number] => {
      const box = host.getBoundingClientRect()
      return [
        ((e.clientX - box.left) / box.width) * field.w,
        ((e.clientY - box.top) / box.height) * field.h,
      ]
    }
    const down = (e: PointerEvent) => {
      const [x, y] = at(e)
      stir.on = true
      stir.x = x
      stir.y = y
      stir.px = x
      stir.py = y
      host.dataset.stirred = 'true'
    }
    const moved = (e: PointerEvent) => {
      if (!stir.on) return
      const [x, y] = at(e)
      stir.x = x
      stir.y = y
    }
    const up = () => {
      stir.on = false
    }

    host.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', moved)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)

    let resizeTimer = 0
    const onResize = () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(layout, 120)
    }
    window.addEventListener('resize', onResize)

    /* The loop
       ---------------------------------------------------------------- */

    let frame = 0
    let last = performance.now()
    let qualityAt = last
    let reportAt = last

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)

      const delta = now - last
      last = now
      if (delta > 0 && delta < 400) frameMs += (delta - frameMs) * 0.12

      if (now - qualityAt > 900) {
        qualityAt = now
        if (frameMs > 32 && quality > 0.6) quality -= 0.1
        else if (frameMs < 20 && quality < 1) quality += 0.06
        quality = Math.min(1, quality)
        live = Math.round(COUNT * (0.55 + 0.45 * quality))
        glyphEvery = frameMs > 40 ? 4 : frameMs > 26 ? 3 : 2
      }

      const g = geometry.current
      const key = `${g.dia}|${g.pitch}|${g.drag}`
      if (key !== lastGeom) {
        lastGeom = key
        buildMembrane(field, g.dia, g.pitch, g.drag)
      }
      field.wind = wind.current

      const push: Stir = stir.on
        ? { x: stir.x, y: stir.y, dx: (stir.x - stir.px) * 0.9, dy: (stir.y - stir.py) * 0.9 }
        : null
      if (push) {
        stir.px = stir.x
        stir.py = stir.y
      }

      step(field, push)
      move(field, swarm)
      render()

      /* Four times a second. The figures under the picture are a reading, and a reading that
         changes its last digit sixty times a second reads as instability rather than as liveness —
         the same mistake the old section's live figures made before they became a table. */
      if (now - reportAt > 250) {
        reportAt = now
        report.current(measure(field))
      }
    }

    /**
     * Reduced motion, and the section that isn't showing, both resolve the same way: solve enough
     * to have a picture and a set of figures, then stop. A still frame of a settled field is a
     * legitimate rendering of this section — it is a cross-section diagram either way.
     */
    if (reduced || !showing) {
      for (let i = 0; i < 90; i++) {
        field.wind = wind.current
        step(field, null)
        move(field, swarm)
      }
      render()
      report.current(measure(field))
    } else {
      frame = requestAnimationFrame(tick)
    }

    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(resizeTimer)
      host.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', moved)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('resize', onResize)
    }
    /* `wind`, `geometry` and `layers` are refs by design — they must not restart the field. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showing, reduced, flow, glyph, wind, geometry, layers])
}
