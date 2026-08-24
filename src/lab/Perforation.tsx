import { useEffect } from 'react'
import {
  type FabricSpec,
  type Field,
  HOT,
  type Stir,
  buildMembrane,
  createField,
  sample,
  step,
  windFor,
} from '../lib/perforation'

/**
 * Two channels of air, drawn — and coloured by how warm it is, not by how fast.
 *
 * The physics is `lib/perforation.ts`. This file is three pictures of the same solved field,
 * composited in one order, and the loop that drives both channels:
 *
 * - **Heat**, the temperature field as a low-resolution raster, transparent at ambient and
 *   glowing where warmth has banked up. Under everything, because it is the answer and the rest
 *   is the mechanism.
 * - **Streaklines**, particles advected through the flow into a buffer that fades rather than
 *   clears. A still frame of points is a speckle; the same points with a fourteen-frame tail are
 *   the airflow.
 * - **Glyphs**, a monospace grid sampling direction into `- \ | /`. The plotter reading of the
 *   same field, and the reason this reads as an instrument rather than a smoke machine.
 *
 * **Colour is temperature. Brightness is speed.** That split is the whole visual grammar and it is
 * worth stating plainly, because the obvious version — colour by velocity — is what this section
 * used to do and it said the wrong thing entirely. Fast air rendered hot, so the *better* fabric
 * looked like the hotter one. Now the hue of every mark is the temperature of the air it is made
 * of and its brightness is how fast that air is moving, so the open knit reads as what it is: more
 * movement, less heat.
 *
 * **Ambient is a quiet cool slate and only heat is coloured.** Not a blue-to-red thermal ramp —
 * `lab/WindTunnel.tsx` records why that was dropped once already ("a section that arrives in cyan
 * and crimson is a different brand for one screen"), and it was right. Cool here is barely a hue
 * at all, just a cold grey that sits down against the ground; everything with any saturation in it
 * is warmth. The palette stays lululemon and red still means one thing.
 */

/* Ink
   ------------------------------------------------------------------ */

/**
 * The ramp, as stops: ambient at 0, a cell with no airflow at all at 1.
 *
 * **The cool end is lifted well off the ground, and that was a correction.** It sat at a near-black
 * slate on the first pass, on the theory that ambient air should be quiet — and the result was a
 * channel that was four-fifths black, with the airflow invisible and a wall of fire at one end. The
 * approach flow is not background: it is the mechanism the whole claim rests on. So ambient is a
 * clearly visible cool slate, desaturated enough to read as the absence of heat rather than as a
 * colour of its own, and warmth is what adds saturation.
 *
 * Brand red lands at 0.76, which is where the current knit's microclimate sits. That is the
 * placement that matters: the section's whole claim is the distance between the two channels on
 * this scale, so the fabric that has a problem needs to be unmistakably in the red and the one
 * that fixes it needs to be visibly short of it.
 */
const STOPS: [number, number, number, number][] = [
  [0.0, 104, 122, 148],
  [0.16, 126, 118, 148],
  [0.32, 158, 92, 108],
  [0.48, 186, 62, 68],
  [0.62, 216, 48, 44],
  [0.76, 238, 59, 51],
  [0.88, 243, 126, 62],
  [1.0, 248, 186, 116],
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

/** Quantisation: the number of `fillStyle` changes a frame costs, not a number of colours. */
const BINS = 14
const INK = Array.from({ length: BINS }, (_, i) => {
  const [r, g, b] = ramp((i + 0.5) / BINS)
  return `rgb(${r | 0},${g | 0},${b | 0})`
})

/** The knit, in the page's warm neutral. It is not on the temperature scale and must not look it. */
const SPECIMEN = '226,221,210'

/**
 * Exposure, and the one place a display decision is allowed to shape the picture.
 *
 * **Never against a channel's own maximum.** Auto-exposing per channel would normalise away the
 * entire comparison: the open knit's warmest air would render as hot as the closed knit's, because
 * it would be the warmest thing in its own frame. Both channels are measured against the same
 * fixed scale, so cooler genuinely looks cooler.
 *
 * `HOT` is the stagnant ceiling — what a cell with no airflow at all settles at — and nothing ever
 * reaches it. Settled headlessly at the reference pace, today's microclimate *means* sit at 0.35 of
 * it and the new one's at 0.21, but the cells hard against the skin run well above their own mean,
 * so exposing on the means alone clipped every one of them to white. At 0.62 of the ceiling the two
 * means land at 0.46 and 0.24 of the ramp and the hot cells reach ember without going to paper.
 *
 * The curve is a transfer function, not a thumb on the scale: monotonic, identical for both
 * channels, and it changes neither the ordering nor the ratio between them. It spends more of the
 * ramp on the range the two fabrics actually occupy, which is what a thermal image does. The °C
 * printed under the picture are the solver's own and are not curved at all.
 */
const EXPOSE = HOT * 0.92
const CONTRAST = 1.5

const tempOf = (t: number) => {
  const n = t / EXPOSE
  const c = n < 0 ? 0 : n > 1 ? 1 : n
  return Math.pow(c, CONTRAST)
}

const GLYPHS = ['-', '\\', '|', '/'] as const
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

/* Particles
   ------------------------------------------------------------------ */

const COUNT = 4200

type Swarm = { x: Float32Array; y: Float32Array; life: Float32Array }

const makeSwarm = (f: Field): Swarm => {
  const s: Swarm = {
    x: new Float32Array(COUNT),
    y: new Float32Array(COUNT),
    life: new Float32Array(COUNT),
  }
  for (let i = 0; i < COUNT; i++) {
    s.x[i] = Math.random() * f.w
    s.y[i] = Math.random() * f.h
    s.life[i] = Math.random() * 160
  }
  return s
}

/**
 * Advance the swarm.
 *
 * Most respawns go to the inlet, a fifth go anywhere. The fifth keeps the recirculation behind a
 * closed knit from reading as a rendering hole: nothing reaches it from upstream, which is true
 * and is the point, and an entirely empty region reads as a bug rather than as stagnant air.
 */
function move(f: Field, s: Swarm, live: number): void {
  for (let i = 0; i < live; i++) {
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

export type ChannelRefs = {
  flow: React.RefObject<HTMLCanvasElement | null>
  glyph: React.RefObject<HTMLCanvasElement | null>
  spec: FabricSpec
}

type Options = {
  channels: readonly [ChannelRefs, ChannelRefs]
  /** Live, so dragging the slider never restarts a running field. */
  pace: React.RefObject<number>
  layers: React.RefObject<Layers>
  showing: boolean
  reduced: boolean
}

/** Everything one channel needs, built once per layout. */
type Runtime = {
  spec: FabricSpec
  field: Field
  swarm: Swarm
  host: HTMLElement
  fc: HTMLCanvasElement
  fx: CanvasRenderingContext2D
  gc: HTMLCanvasElement
  gx: CanvasRenderingContext2D
  trail: HTMLCanvasElement
  tx: CanvasRenderingContext2D
  heat: HTMLCanvasElement
  hx: CanvasRenderingContext2D
  raster: ImageData | null
  cw: number
  ch: number
  /** Particle population scale for this box — see the note where it is set. */
  density: number
  stir: { on: boolean; x: number; y: number; px: number; py: number }
  detach: () => void
}

/**
 * The loop, driving both channels.
 *
 * One `requestAnimationFrame` for the pair rather than one each — two independent loops would
 * drift apart under load, and two channels of a controlled experiment stepping at different rates
 * is not a controlled experiment. Both fields take the same wind and the same deterministic
 * inflow perturbation, so the only difference between them is the knit.
 */
export function usePerforation({ channels, pace, layers, showing, reduced }: Options): void {
  useEffect(() => {
    const runtimes: Runtime[] = []

    /* Two raster scales. The flow buffers are fill-rate bound and look no worse at 1.5×; the glyph
       layer is text and wants the full ratio, or the marks blur into dashes. */
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const dprFlow = Math.min(1.5, dpr)

    let cellPx = 12
    let frameMs = 16
    let quality = 1
    let glyphEvery = 2
    let live = COUNT

    const build = (): boolean => {
      for (const ch of channels) {
        const fc = ch.flow.current
        const gc = ch.glyph.current
        if (!fc || !gc) return false
        const fx = fc.getContext('2d')
        const gx = gc.getContext('2d')
        const host = fc.parentElement
        if (!fx || !gx || !host) return false

        const trail = document.createElement('canvas')
        const tx = trail.getContext('2d')
        const heat = document.createElement('canvas')
        const hx = heat.getContext('2d')
        if (!tx || !hx) return false

        const cw = Math.max(240, host.clientWidth)
        const cheight = Math.max(90, host.clientHeight)
        cellPx = cw < 700 ? 10 : 12

        gc.width = Math.round(cw * dpr)
        gc.height = Math.round(cheight * dpr)
        for (const c of [fc, trail]) {
          c.width = Math.round(cw * dprFlow)
          c.height = Math.round(cheight * dprFlow)
        }

        const field = createField(cw / cheight)
        buildMembrane(field, ch.spec)
        field.wind = windFor(pace.current)
        heat.width = field.w
        heat.height = field.h

        const stir = { on: false, x: 0, y: 0, px: 0, py: 0 }

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

        fx.setTransform(1, 0, 0, 1, 0, 0)
        fx.fillStyle = '#0a0908'
        fx.fillRect(0, 0, fc.width, fc.height)

        runtimes.push({
          spec: ch.spec,
          field,
          swarm: makeSwarm(field),
          host,
          fc,
          fx,
          gc,
          gx,
          trail,
          tx,
          heat,
          hx,
          raster: hx.createImageData(field.w, field.h),
          cw,
          ch: cheight,
          /**
           * Particles per unit area, not per channel.
           *
           * A fixed population in a phone-width channel is the same number of marks in a fifth of
           * the pixels, which over-accumulates in the trail buffer and washes the whole field to
           * white — and a washed-out channel cannot show a temperature. Scaled against the desktop
           * box the constants were tuned in, with a floor so a narrow channel still reads as flow.
           */
          density: Math.max(0.32, Math.min(1, (cw * cheight) / (1400 * 230))),
          stir,
          detach: () => {
            host.removeEventListener('pointerdown', down)
            window.removeEventListener('pointermove', moved)
            window.removeEventListener('pointerup', up)
            window.removeEventListener('pointercancel', up)
          },
        })
      }
      return true
    }

    const teardown = () => {
      for (const r of runtimes) r.detach()
      runtimes.length = 0
    }

    if (!build()) {
      teardown()
      return
    }

    /* Drawing
       ---------------------------------------------------------------- */

    const drawHeat = (r: Runtime) => {
      if (!r.raster) return
      const d = r.raster.data
      const { field } = r
      for (let i = 0; i < field.temp.length; i++) {
        const t = tempOf(field.temp[i])
        const [cr, cg, cb] = ramp(t)
        const o = i * 4
        d[o] = cr | 0
        d[o + 1] = cg | 0
        d[o + 2] = cb | 0
        /* A dim floor at ambient rather than full transparency. The layer is still overwhelmingly
           about heat, but a channel whose cool air is pure background reads as an empty box with a
           fire at one end — the air has to be visibly there for its temperature to mean anything. */
        d[o + 3] = field.solid[i] ? 0 : (Math.min(1, 0.13 + Math.pow(t, 1.15) * 1.1) * 228) | 0
      }
      r.hx.putImageData(r.raster, 0, 0)
    }

    const drawMembrane = (r: Runtime, sx: number, sy: number) => {
      const { field, gx } = r
      const x0 = field.band * sx
      const width = field.thickness * sx
      gx.globalCompositeOperation = 'source-over'
      gx.fillStyle = `rgba(${SPECIMEN},0.12)`
      gx.fillRect(x0, 0, width, r.ch)
      for (let j = 0; j < field.h; j++) {
        const closed = 1 - field.perm[field.band + j * field.w]
        if (closed <= 0.02) continue
        gx.fillStyle = `rgba(${SPECIMEN},${(0.09 + closed * 0.46).toFixed(3)})`
        gx.fillRect(x0, j * sy - 0.3, width, sy + 0.6)
      }
    }

    const drawGlyphs = (r: Runtime) => {
      const { field, gx } = r
      const cols = Math.ceil(r.cw / cellPx)
      const rows = Math.ceil(r.ch / cellPx)
      const base = layers.current.particles ? 0.36 : 1

      gx.font = `${cellPx - 1}px ${MONO}`
      gx.textBaseline = 'middle'
      gx.textAlign = 'center'
      gx.globalCompositeOperation = 'lighter'

      /* Bucketed by temperature and by glyph, so the layer costs 8 × 5 style changes rather than
         one per mark. The fifth glyph is the low-speed dot, which has no direction to show. */
      const B = 8
      const bins: number[][][] = Array.from({ length: B }, () => [[], [], [], [], []])
      const lo = 0.06 * field.wind
      const hi = 2.3 * field.wind

      for (let rr = 0; rr < rows; rr++) {
        const cy = rr * cellPx + cellPx / 2
        const gy = (cy / r.ch) * field.h
        for (let c = 0; c < cols; c++) {
          const cx = c * cellPx + cellPx / 2
          const gxv = (cx / r.cw) * field.w
          const gi = gxv | 0
          const gj = gy | 0
          if (gi < 0 || gi >= field.w || gj < 0 || gj >= field.h) continue
          if (field.solid[gi + gj * field.w]) continue
          const uu = sample(field, field.u, gxv, gy)
          const vv = sample(field, field.v, gxv, gy)
          /* Speed decides whether a mark is drawn and how bright; temperature decides its colour. */
          let s = (Math.hypot(uu, vv) - lo) / Math.max(1e-4, hi - lo)
          s = s < 0 ? 0 : s > 1 ? 1 : s
          if (s < 0.03) continue
          let g = 4
          if (s >= 0.07) {
            const q = Math.round(Math.atan2(vv, uu) / (Math.PI / 4))
            g = ((q % 4) + 4) % 4
          }
          const t = tempOf(sample(field, field.temp, gxv, gy))
          const bi = Math.min(B - 1, (t * (B - 1)) | 0)
          bins[bi][g].push(cx, cy, s)
        }
      }

      for (let b = 0; b < B; b++) {
        const [cr, cg, cb] = ramp((b + 0.5) / B)
        gx.fillStyle = `rgb(${cr | 0},${cg | 0},${cb | 0})`
        for (let gi = 0; gi < 5; gi++) {
          const list = bins[b][gi]
          if (!list.length) continue
          const chr = gi === 4 ? '.' : GLYPHS[gi]
          for (let i = 0; i < list.length; i += 3) {
            gx.globalAlpha = base * (0.2 + 0.8 * list[i + 2])
            gx.fillText(chr, list[i], list[i + 1])
          }
        }
      }
      gx.globalAlpha = 1
    }

    const render = (r: Runtime) => {
      const { field, fx, gx, fc } = r
      const sx = r.cw / field.w
      const sy = r.ch / field.h
      const L = layers.current

      if (L.particles) {
        const lo = 0.06 * field.wind
        const hi = 2.3 * field.wind
        const span = Math.max(1e-4, hi - lo)

        r.tx.setTransform(1, 0, 0, 1, 0, 0)
        r.tx.globalCompositeOperation = 'destination-out'
        r.tx.fillStyle = 'rgba(0,0,0,0.045)'
        r.tx.fillRect(0, 0, r.trail.width, r.trail.height)
        r.tx.setTransform(dprFlow, 0, 0, dprFlow, 0, 0)
        r.tx.globalCompositeOperation = 'lighter'

        /* Bucketed by temperature — the colour axis — and given an alpha from speed, which is the
           brightness axis. One bucket is one `fillStyle`; alpha varies inside it. */
        const buckets: number[][] = Array.from({ length: BINS }, () => [])
        const n = Math.round(live * r.density)
        for (let i = 0; i < n; i++) {
          const x = r.swarm.x[i]
          const y = r.swarm.y[i]
          let s = (sample(field, field.spd, x, y) - lo) / span
          s = s < 0 ? 0 : s > 1 ? 1 : s
          const t = tempOf(sample(field, field.temp, x, y))
          const bi = Math.min(BINS - 1, (t * (BINS - 1)) | 0)
          buckets[bi].push(x * sx, y * sy, s)
        }
        for (let b = 0; b < BINS; b++) {
          const list = buckets[b]
          if (!list.length) continue
          r.tx.fillStyle = INK[b]
          const size = b > BINS * 0.62 ? 1.6 : 1.25
          for (let i = 0; i < list.length; i += 3) {
            r.tx.globalAlpha = 0.3 + 0.7 * Math.pow(list[i + 2], 0.8)
            r.tx.fillRect(list[i], list[i + 1], size, size)
          }
        }
        r.tx.globalAlpha = 1
      }

      fx.setTransform(1, 0, 0, 1, 0, 0)
      fx.globalCompositeOperation = 'source-over'
      fx.globalAlpha = 1
      fx.fillStyle = '#0a0908'
      fx.fillRect(0, 0, fc.width, fc.height)
      fx.setTransform(dprFlow, 0, 0, dprFlow, 0, 0)

      if (L.heat) {
        drawHeat(r)
        /* Smooth while it is an underglow, crisp when it is the subject. A 300-cell raster blown
           up five times is a blur, and a blur with nothing drawn on top is just soft — so with the
           streaklines off it becomes the solver's own cell grid, which is at least honest about
           its resolution. */
        fx.imageSmoothingEnabled = L.particles
        fx.globalAlpha = L.particles ? 0.55 : 0.94
        fx.drawImage(r.heat, 0, 0, r.cw, r.ch)
        fx.globalAlpha = 1
      }
      if (L.particles) {
        fx.globalCompositeOperation = 'lighter'
        fx.setTransform(1, 0, 0, 1, 0, 0)
        fx.drawImage(r.trail, 0, 0)
        fx.setTransform(dprFlow, 0, 0, dprFlow, 0, 0)
        fx.globalCompositeOperation = 'source-over'
      }

      /* The glyph layer keeps its own canvas and is not cleared on the frames it skips, which is
         what makes running it at half rate free rather than flickery. */
      if (!L.glyphs || field.tick % glyphEvery === 0) {
        gx.setTransform(dpr, 0, 0, dpr, 0, 0)
        gx.clearRect(0, 0, r.cw, r.ch)
        drawMembrane(r, sx, sy)
        if (L.glyphs) drawGlyphs(r)
      }
    }

    const advance = () => {
      const wind = windFor(pace.current)
      for (const r of runtimes) {
        r.field.wind = wind
        const s = r.stir
        const push: Stir = s.on
          ? { x: s.x, y: s.y, dx: (s.x - s.px) * 0.9, dy: (s.y - s.py) * 0.9 }
          : null
        if (push) {
          s.px = s.x
          s.py = s.y
        }
        step(r.field, push)
        move(r.field, r.swarm, Math.round(live * r.density))
      }
    }

    /* Resize rebuilds both channels from scratch — the grid is derived from the box. */
    let resizeTimer = 0
    let relayout = false
    const onResize = () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        relayout = true
      }, 140)
    }
    window.addEventListener('resize', onResize)

    /* The loop
       ---------------------------------------------------------------- */

    let frame = 0
    let last = performance.now()
    let qualityAt = last

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)

      if (relayout) {
        relayout = false
        teardown()
        if (!build()) return
      }

      const delta = now - last
      last = now
      if (delta > 0 && delta < 400) frameMs += (delta - frameMs) * 0.12

      /**
       * The governor. Two fields per frame is twice the pressure solve, so this matters more than
       * it did with one: it sheds glyph cadence first, then particle population, and never the
       * heat raster — which is the cheapest layer and the one carrying the argument.
       */
      if (now - qualityAt > 900) {
        qualityAt = now
        if (frameMs > 32 && quality > 0.55) quality -= 0.1
        else if (frameMs < 20 && quality < 1) quality += 0.06
        quality = Math.min(1, quality)
        live = Math.round(COUNT * (0.5 + 0.5 * quality))
        glyphEvery = frameMs > 40 ? 4 : frameMs > 26 ? 3 : 2
      }

      advance()
      for (const r of runtimes) render(r)
    }

    /**
     * Reduced motion, and the section that isn't showing, resolve the same way: solve far enough
     * for the microclimate to have settled, then stop. A still frame of a settled field is a
     * legitimate rendering of this section — it is a cross-section diagram either way — and the
     * temperature needs the longer run, because heat reaches steady state well after the flow
     * does. The figures do not wait on this: they come from `predict()`, not from the field.
     */
    if (reduced || !showing) {
      for (let i = 0; i < 260; i++) advance()
      for (const r of runtimes) render(r)
    } else {
      frame = requestAnimationFrame(tick)
    }

    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
      teardown()
    }
    /* `pace` and `layers` are refs by design — they must not restart the fields. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showing, reduced, channels, pace, layers])
}
