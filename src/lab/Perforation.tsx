import { useEffect } from 'react'
import {
  type FabricId,
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

/* Palettes
   ------------------------------------------------------------------ */

type Stops = [number, number, number, number][]

type Scheme = {
  /** Human name, for the note below and for anyone reading a diff. */
  label: string
  /** The chamber behind the marks. The canvas paints it and hands it to CSS as a custom property. */
  ground: string
  /** The heat raster: ambient at 0, a cell with no airflow at all at 1. */
  heat: Stops
  /** The tracers and glyphs: still air at 0, the fastest jet at 1. */
  wind: Stops
}

/**
 * Two palettes, both kept.
 *
 * Colour maps **temperature** in either one — that mapping is the section's argument and does not
 * change with the skin. What changes is which colours the scale is made of.
 *
 * `ember` is the shipped scheme: a cool slate at ambient rising through brand red to gold, built so
 * red means heat and nothing else on the page has to compete with it.
 *
 * `tide` is the one under test, drawn off the wind-map reference — deep indigo at ambient through
 * teal and green to a pale chartreuse at the top. Worth naming the tension honestly: in its source
 * that palette encodes *wind speed*, where bright means fast, and the reason `ember` exists is that
 * an earlier version of this section coloured by speed and so made the better fabric look hotter.
 * Mapped onto temperature, `tide`'s bright end reads as energetic before it reads as hot — striking
 * to look at, and a weaker carrier of the one thing the picture is trying to say.
 */
/** Ember's ramp, kept verbatim — the shipped scheme's exact values. */
const EMBER_RAMP: Stops = [
      [0.0, 104, 122, 148],
      [0.16, 126, 118, 148],
      [0.32, 158, 92, 108],
      [0.48, 186, 62, 68],
      [0.62, 216, 48, 44],
      [0.76, 238, 59, 51],
      [0.88, 243, 126, 62],
  [1.0, 248, 186, 116],
]

const SCHEMES: Record<'ember' | 'tide', Scheme> = {
  /* Ember drives both layers off one ramp, which is what it always did — temperature everywhere,
     brightness from speed. Listed twice rather than special-cased, so the two-ramp machinery has
     nothing to branch on. */
  ember: {
    label: 'ember',
    ground: '#2d2c30',
    heat: EMBER_RAMP,
    wind: EMBER_RAMP,
  },
  tide: {
    label: 'tide',
    /* Darker than the reference's own background: the marks composite additively, so the chamber
       has to sit under the scale rather than beside it. An earlier pass used the reference navy
       here and the ambient flow vanished into it — same hue, almost no luminance between them. */
    ground: '#0e1028',
    /**
     * Heat, in blues alone — deep navy where the air is at ambient, pale ice where it has banked
     * up against the skin. Two things made this the fix. Green in the microclimate read as gas
     * rather than warmth, which is a hard thing to un-see once someone says it; and with the
     * tracers now carrying speed, the raster is the only layer left telling the heat story, so it
     * wants a scale of its own rather than a slice of a shared one. Brighter means hotter because
     * the ground is dark: on a dark chamber, darker cannot mean more.
     */
    heat: [
      [0.0, 26, 38, 88],
      [0.22, 36, 58, 128],
      [0.42, 50, 90, 176],
      [0.6, 74, 130, 212],
      [0.78, 116, 172, 232],
      [1.0, 176, 214, 246],
    ],
    /**
     * Wind, light blue through teal to green — slow air is a pale blue thread, a jet through a
     * perforation is bright green. This is the reference's own mapping put back the right way
     * round: it is a wind map, bright means fast, and that is now exactly what it means here.
     */
    wind: [
      [0.0, 128, 172, 230],
      [0.35, 104, 180, 226],
      [0.6, 88, 192, 206],
      /* The freestream lands about here — still teal, so green stays the mark of accelerated air. */
      [0.76, 80, 202, 168],
      [0.88, 94, 216, 120],
      [1.0, 160, 238, 104],
    ],
  },
}

/**
 * Which palette is live.
 *
 * `DEFAULT_SCHEME` is the one that ships; `?scheme=ember` on the URL overrides it, so both can be
 * looked at on the same build without a rebuild between them — which is the only way to actually
 * compare two colour schemes, since nobody can hold the first one in their head while waiting for
 * the second to compile. Read once at module scope: a palette change is a rebuild of every buffer,
 * not something to hot-swap mid-frame.
 */
const DEFAULT_SCHEME: keyof typeof SCHEMES = 'tide'

const chosen = (): keyof typeof SCHEMES => {
  if (typeof window === 'undefined') return DEFAULT_SCHEME
  const raw = new URLSearchParams(window.location.search).get('scheme')
  return raw && raw in SCHEMES ? (raw as keyof typeof SCHEMES) : DEFAULT_SCHEME
}

const PALETTE = SCHEMES[chosen()]

/** One mixer, two scales. Linear between stops; clamped at both ends. */
const mixStops = (stops: Stops, t: number): [number, number, number] => {
  if (t <= 0) return [stops[0][1], stops[0][2], stops[0][3]]
  const last = stops[stops.length - 1]
  if (t >= 1) return [last[1], last[2], last[3]]
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]
    const b = stops[i + 1]
    if (t >= a[0] && t <= b[0]) {
      const k = (t - a[0]) / (b[0] - a[0])
      return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k]
    }
  }
  return [last[1], last[2], last[3]]
}

/** Temperature → colour, for the heat raster. */
const heatRamp = (t: number) => mixStops(PALETTE.heat, t)
/** Speed → colour, for the tracers and the glyphs. */
const windRamp = (t: number) => mixStops(PALETTE.wind, t)

/**
 * Where the top of the wind *colour* scale sits, as a multiple of the freestream.
 *
 * Separate from the brightness normalisation, and that separation was the fix: brightness runs to
 * 2.3× the freestream, generous headroom that keeps a gust from blowing out — but nothing in this
 * flow goes that fast. The peak through a perforation is about 1.2× the freestream, so on a 2.3×
 * scale every jet sat mid-ramp and the green end was never reached.
 *
 * **1.35 rather than 1.2, and the ramp is weighted to match.** At 1.2 the freestream itself landed
 * at 0.83 of the scale, which painted the entire approach flow green and left the wake behind the
 * knit blue — true (upstream *is* the fastest broad region, and a resistive membrane decelerates
 * what passes it) but backwards to read: it says the outside air is the story. At 1.35 the
 * freestream lands near 0.74, where the ramp is still teal, so green is reserved for air that has
 * been *accelerated* — the jets squeezing through the perforations, which is the thing worth
 * looking at.
 */
const WIND_TOP = 1.35

const windOf = (speed: number, wind: number) => {
  const n = speed / Math.max(1e-4, WIND_TOP * wind)
  return n < 0 ? 0 : n > 1 ? 1 : n
}

/**
 * Quantisation: the number of `fillStyle` changes a frame costs, not a number of colours.
 *
 * Off the **wind** ramp — a tracer's colour is how fast the air it is made of is moving. It used to
 * be its temperature, which left the streaklines and the raster saying the same thing twice and the
 * flow itself unlabelled.
 */
const BINS = 14
const INK = Array.from({ length: BINS }, (_, i) => {
  const [r, g, b] = windRamp((i + 0.5) / BINS)
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

type Options = {
  /** The one visible canvas pair. */
  flow: React.RefObject<HTMLCanvasElement | null>
  glyph: React.RefObject<HTMLCanvasElement | null>
  /** Both knits, in `FABRICS` order. Both solve every frame; one renders. */
  fabrics: readonly [FabricSpec, FabricSpec]
  /** Which knit is on screen. A ref, so switching never rebuilds the fields. */
  active: React.RefObject<FabricId>
  /** Live, so dragging the slider never restarts a running field. */
  pace: React.RefObject<number>
  layers: React.RefObject<Layers>
  showing: boolean
  reduced: boolean
}

/** Everything one knit needs — its physics and its accumulating buffers. The canvases on screen
 * are shared and live in `View` below. */
type Runtime = {
  spec: FabricSpec
  field: Field
  swarm: Swarm
  trail: HTMLCanvasElement
  tx: CanvasRenderingContext2D
  heat: HTMLCanvasElement
  hx: CanvasRenderingContext2D
  raster: ImageData
}

type View = {
  host: HTMLElement
  fc: HTMLCanvasElement
  fx: CanvasRenderingContext2D
  gc: HTMLCanvasElement
  gx: CanvasRenderingContext2D
  cw: number
  ch: number
  density: number
  detach: () => void
}

/**
 * The loop, driving both knits into one window.
 *
 * **Both fields solve every frame; only the active one is drawn.** That asymmetry is the whole
 * design: a temperature field takes tens of seconds to settle, so a toggle that rebuilt the field
 * on switch would answer every press with a cold black box. Solving both keeps the knit you are
 * *not* looking at settled and its streak trail current, so the switch is instant in both
 * directions and always lands on a developed picture. It costs no more than the two stacked
 * channels this replaced — the same two solves, and one composite instead of two.
 *
 * Both fields take the same wind and the same deterministic inflow perturbation, so the only
 * difference between what the two buttons show is the knit.
 */
export function usePerforation({
  flow,
  glyph,
  fabrics,
  active,
  pace,
  layers,
  showing,
  reduced,
}: Options): void {
  useEffect(() => {
    let view: View | null = null
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
    /* Which knit the glyph canvas currently shows — a switch forces a redraw off-cadence. */
    let drawnId: FabricId | null = null

    const stir = { on: false, x: 0, y: 0, px: 0, py: 0 }

    const activeRuntime = () =>
      runtimes.find((r) => r.spec.id === active.current) ?? runtimes[0]

    const build = (): boolean => {
      const fc = flow.current
      const gc = glyph.current
      if (!fc || !gc) return false
      const fx = fc.getContext('2d')
      const gx = gc.getContext('2d')
      const host = fc.parentElement
      if (!fx || !gx || !host) return false

      const cw = Math.max(240, host.clientWidth)
      const cheight = Math.max(90, host.clientHeight)
      cellPx = cw < 700 ? 10 : 12

      gc.width = Math.round(cw * dpr)
      gc.height = Math.round(cheight * dpr)
      fc.width = Math.round(cw * dprFlow)
      fc.height = Math.round(cheight * dprFlow)

      for (const spec of fabrics) {
        const trail = document.createElement('canvas')
        const tx = trail.getContext('2d')
        const heat = document.createElement('canvas')
        const hx = heat.getContext('2d')
        if (!tx || !hx) return false
        trail.width = fc.width
        trail.height = fc.height

        const field = createField(cw / cheight)
        buildMembrane(field, spec)
        field.wind = windFor(pace.current)
        heat.width = field.w
        heat.height = field.h

        runtimes.push({
          spec,
          field,
          swarm: makeSwarm(field),
          trail,
          tx,
          heat,
          hx,
          raster: hx.createImageData(field.w, field.h),
        })
      }

      const at = (e: PointerEvent): [number, number] => {
        const box = host.getBoundingClientRect()
        const f = activeRuntime().field
        return [
          ((e.clientX - box.left) / box.width) * f.w,
          ((e.clientY - box.top) / box.height) * f.h,
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

      /* CSS owns the box, the canvas owns the pixels, and both need the same ground — so it is
         published once here rather than written down in two places that can drift. */
      host.style.setProperty('--tunnel-ground', PALETTE.ground)

      fx.setTransform(1, 0, 0, 1, 0, 0)
      fx.fillStyle = PALETTE.ground
      fx.fillRect(0, 0, fc.width, fc.height)

      view = {
        host,
        fc,
        fx,
        gc,
        gx,
        cw,
        ch: cheight,
        /**
         * Particles per unit area, not per window. A fixed population in a phone-width window is
         * the same number of marks in a fifth of the pixels, which over-accumulates in the trail
         * buffer and washes the whole field to white. Scaled against the desktop box the constants
         * were tuned in — this window is roughly the two old channels stacked, hence the larger
         * reference area.
         */
        density: Math.max(0.32, Math.min(1, (cw * cheight) / (1400 * 420))),
        detach: () => {
          host.removeEventListener('pointerdown', down)
          window.removeEventListener('pointermove', moved)
          window.removeEventListener('pointerup', up)
          window.removeEventListener('pointercancel', up)
        },
      }
      drawnId = null
      return true
    }

    const teardown = () => {
      view?.detach()
      view = null
      runtimes.length = 0
    }

    if (!build()) {
      teardown()
      return
    }

    /* Drawing
       ---------------------------------------------------------------- */

    const drawHeat = (r: Runtime) => {
      const d = r.raster.data
      const { field } = r
      for (let i = 0; i < field.temp.length; i++) {
        const t = tempOf(field.temp[i])
        const [cr, cg, cb] = heatRamp(t)
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

    const drawMembrane = (v: View, r: Runtime, sx: number, sy: number) => {
      const { field } = r
      const { gx } = v
      const x0 = field.band * sx
      const width = field.thickness * sx
      gx.globalCompositeOperation = 'source-over'
      gx.fillStyle = `rgba(${SPECIMEN},0.12)`
      gx.fillRect(x0, 0, width, v.ch)
      for (let j = 0; j < field.h; j++) {
        const closed = 1 - field.perm[field.band + j * field.w]
        if (closed <= 0.02) continue
        gx.fillStyle = `rgba(${SPECIMEN},${(0.09 + closed * 0.46).toFixed(3)})`
        gx.fillRect(x0, j * sy - 0.3, width, sy + 0.6)
      }
    }

    const drawGlyphs = (v: View, r: Runtime) => {
      const { field } = r
      const { gx } = v
      const cols = Math.ceil(v.cw / cellPx)
      const rows = Math.ceil(v.ch / cellPx)
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
        const gy = (cy / v.ch) * field.h
        for (let c = 0; c < cols; c++) {
          const cx = c * cellPx + cellPx / 2
          const gxv = (cx / v.cw) * field.w
          const gi = gxv | 0
          const gj = gy | 0
          if (gi < 0 || gi >= field.w || gj < 0 || gj >= field.h) continue
          if (field.solid[gi + gj * field.w]) continue
          const uu = sample(field, field.u, gxv, gy)
          const vv = sample(field, field.v, gxv, gy)
          /* Speed decides whether a mark is drawn and how bright; temperature decides its colour. */
          const raw = Math.hypot(uu, vv)
          let sp = (raw - lo) / Math.max(1e-4, hi - lo)
          sp = sp < 0 ? 0 : sp > 1 ? 1 : sp
          if (sp < 0.03) continue
          let g = 4
          if (sp >= 0.07) {
            const q = Math.round(Math.atan2(vv, uu) / (Math.PI / 4))
            g = ((q % 4) + 4) % 4
          }
          /* Binned by speed, like the tracers: a glyph is a flow mark, and the heat raster under
             it is what carries temperature. */
          const bi = Math.min(B - 1, (windOf(raw, field.wind) * (B - 1)) | 0)
          bins[bi][g].push(cx, cy, sp)
        }
      }

      for (let b = 0; b < B; b++) {
        const [cr, cg, cb] = windRamp((b + 0.5) / B)
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

    /**
     * The trail advances for BOTH knits every frame, seen or not. It is an accumulation buffer —
     * fourteen frames of history is what makes points read as flow — and history is exactly what
     * a buffer that only ran while visible would not have at the moment of a switch.
     */
    const updateTrail = (v: View, r: Runtime) => {
      const { field } = r
      const sx = v.cw / field.w
      const sy = v.ch / field.h
      const lo = 0.06 * field.wind
      const hi = 2.3 * field.wind
      const span = Math.max(1e-4, hi - lo)

      r.tx.setTransform(1, 0, 0, 1, 0, 0)
      r.tx.globalCompositeOperation = 'destination-out'
      r.tx.fillStyle = 'rgba(0,0,0,0.045)'
      r.tx.fillRect(0, 0, r.trail.width, r.trail.height)
      r.tx.setTransform(dprFlow, 0, 0, dprFlow, 0, 0)
      r.tx.globalCompositeOperation = 'lighter'

      /* Bucketed by speed, which is now both the colour axis and the brightness axis: a slow
         thread is a dim pale blue, a jet is a bright green. One bucket is one `fillStyle`; alpha
         varies inside it, so a bucket is a shade rather than a flat band. */
      const buckets: number[][] = Array.from({ length: BINS }, () => [])
      const n = Math.round(live * v.density)
      for (let i = 0; i < n; i++) {
        const x = r.swarm.x[i]
        const y = r.swarm.y[i]
        const raw = sample(field, field.spd, x, y)
        let sp = (raw - lo) / span
        sp = sp < 0 ? 0 : sp > 1 ? 1 : sp
        const bi = Math.min(BINS - 1, (windOf(raw, field.wind) * (BINS - 1)) | 0)
        buckets[bi].push(x * sx, y * sy, sp)
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

    /** Composite the active knit to the screen. */
    const composite = (v: View, r: Runtime) => {
      const { field } = r
      const { fx, gx, fc } = v
      const sx = v.cw / field.w
      const sy = v.ch / field.h
      const L = layers.current

      fx.setTransform(1, 0, 0, 1, 0, 0)
      fx.globalCompositeOperation = 'source-over'
      fx.globalAlpha = 1
      fx.fillStyle = PALETTE.ground
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
        fx.drawImage(r.heat, 0, 0, v.cw, v.ch)
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
         what makes running it at half rate free rather than flickery. A knit switch redraws it
         immediately — a membrane pattern from the other fabric is not a stale frame, it is the
         wrong picture. */
      const switched = drawnId !== r.spec.id
      if (!L.glyphs || switched || field.tick % glyphEvery === 0) {
        gx.setTransform(dpr, 0, 0, dpr, 0, 0)
        gx.clearRect(0, 0, v.cw, v.ch)
        drawMembrane(v, r, sx, sy)
        if (L.glyphs) drawGlyphs(v, r)
        drawnId = r.spec.id
      }
    }

    const advance = () => {
      const wind = windFor(pace.current)
      const act = activeRuntime()
      for (const r of runtimes) {
        r.field.wind = wind
        /* The drag disturbs the knit on screen. Pushing the hidden field too would be a change
           the reader made without seeing, surfacing minutes later as inexplicable turbulence. */
        const push: Stir =
          stir.on && r === act
            ? { x: stir.x, y: stir.y, dx: (stir.x - stir.px) * 0.9, dy: (stir.y - stir.py) * 0.9 }
            : null
        step(r.field, push)
        if (view) {
          move(r.field, r.swarm, Math.round(live * view.density))
          if (layers.current.particles) updateTrail(view, r)
        }
      }
      if (stir.on) {
        stir.px = stir.x
        stir.py = stir.y
      }
    }

    /* Resize rebuilds everything from scratch — the grid is derived from the box. */
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
       * The governor. Two fields still solve per frame — the toggle's instant switch is paid for
       * here — so it sheds glyph cadence first, then particle population, and never the heat
       * raster, which is the cheapest layer and the one carrying the argument.
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
      if (view) composite(view, activeRuntime())
    }

    /**
     * Reduced motion, and the section that isn't showing, resolve the same way: solve far enough
     * for the microclimate to have settled, then stop. A still frame of a settled field is a
     * legitimate rendering of this section — it is a cross-section diagram either way. The figures
     * do not wait on this: they come from `predict()`, not from the field.
     */
    if (reduced || !showing) {
      for (let i = 0; i < 260; i++) advance()
      if (view) composite(view, activeRuntime())
    } else {
      /* A shorter warm-up before going live. This branch also runs on the rebuild that entering
         fullscreen forces, and a field that starts from rest opens on an empty black box for the
         first seconds of exactly the moment somebody chose to look closer. 120 steps is a formed
         flow and the beginnings of the microclimate, at a cost of roughly a fifth of a second
         behind a click or a scroll. */
      for (let i = 0; i < 120; i++) advance()
      frame = requestAnimationFrame(tick)
    }

    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
      teardown()
    }
    /* `active`, `pace` and `layers` are refs by design — they must not restart the fields. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showing, reduced, flow, glyph, fabrics, active, pace, layers])
}
