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
      [0.4, 104, 180, 226],
      [0.66, 88, 192, 206],
      /* The freestream lands about here — still teal, so green stays the mark of accelerated air. */
      [0.82, 78, 204, 162],
      [0.92, 96, 220, 112],
      /* The jet cores. Brighter and yellower than the last pass: this is the top of the scale and
         it should look like it. */
      [1.0, 186, 246, 96],
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
 * **The freestream must land mid-scale and the jets must reach the top.** At 1.2 the freestream sat
 * at 0.83, which painted the whole approach flow green and left the wake blue — true (upstream *is*
 * the fastest broad region, and a resistive membrane decelerates what passes it) but backwards to
 * read. At 1.35 green went too scarce: with a 60%-open knit the jets are faster than they were, and
 * they were still stopping short of the top of the ramp. 1.25 puts the freestream near 0.8 — still
 * teal, because the ramp's green is weighted above that — and lets a jet core actually reach the
 * bright end, which is where the eye is meant to go.
 */
const WIND_TOP = 1.25

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

/**
 * The yarn, in the knit's own colour.
 *
 * Sampled off a macro shot of the real mesh and then pulled up and desaturated. Two constraints
 * fight here: the fabric should read as the fabric, which is a pale sage, and it must not read as
 * *data*, which on this screen is a light-blue-to-green ramp that a saturated sage sits right on
 * top of. So the hue survives and the saturation mostly doesn't — sage-tinted paper rather than
 * sage. The three tones are one material under one light: mid, the lit face, and the shadow the
 * loops cast on each other.
 */
const YARN = '203,216,210'
const YARN_HI = '243,247,244'
const YARN_LO = '124,150,143'

/**
 * The eyelets, read straight off the field the air meets.
 *
 * One entry per unbroken run of permeable cells down the membrane column — which is to say, the
 * holes, in cell rows. Everything the knit is drawn from comes from here, so the eye you can see
 * through is the eye the solver lets air through. Nothing about the picture is decorative geometry.
 */
function eyeletsOf(field: Field): [number, number][] {
  const out: [number, number][] = []
  let from = -1
  for (let j = 0; j < field.h; j++) {
    const open = field.perm[field.band + j * field.w] >= 0.5
    if (open && from < 0) from = j
    else if (!open && from >= 0) {
      out.push([from, j])
      from = -1
    }
  }
  if (from >= 0) out.push([from, field.h])
  return out
}

/**
 * The knit, woven once into its own bitmap.
 *
 * **This is the fifth attempt and the first that is not a cross-section.** Four before it drew the
 * membrane as an edge — a brick wall, a column of pills, a punched sheet, a thread — and the last of
 * those was right about the width and still wrong about the subject. A slice through a knit is a
 * smear. What the fabric actually looks like is its *face*: staggered lens-shaped eyelets between
 * columns of looped yarn, which is what a macro shot of the mesh shows and what nobody recognises
 * from an edge-on section. So the membrane is now a ribbon of the face standing in the channel — a
 * window into the cloth rather than a slice of it.
 *
 * **The one thing the first pass at this got wrong is worth naming, because it is a trap.** It drew
 * the eyelets at the height of the solver's open runs, which for a 30%-open knit is a third of the
 * course pitch — and a hole a third as tall as its pitch, at a wale's width, comes out round. The
 * result was a chain, not a mesh. The mistake was reading `porosityOf` as a picture: it measures the
 * open fraction along *one column line*, and in real cloth a hole column is open for most of its
 * length while the wale beside it is closed for all of its length. The 30% is two-dimensional.
 *
 * So the porosity is spent the way the cloth spends it. The eyelets keep the solver's *rhythm* —
 * one per course, on the pitch measured off `field.perm`, so the eye you can see through is the
 * course the solver lets air through — and each is 80% of its pitch tall, which is what a warp-knit
 * eyelet is. What the porosity then buys is **width**: `open × gauge × pitch = eye area`, so the
 * 30% knit gets narrow slots between thick wales and the 60% one gets eyes twice as wide between
 * wales half as thick. Two knits at the same gauge, one visibly more open — which is the comparison
 * this whole screen exists to make, and it is now carried by the geometry rather than by a caption.
 *
 * **Where the lens comes from.** Each side of a wale is one continuous path that bows out to the
 * eyelet's mid-height and pinches back in between them. Two quadratics per eye, and the point at the
 * top and bottom of the eye falls out of the pinch rather than being drawn: the yarn converging is
 * what makes the point, in cloth and here.
 *
 * **An expanse, not a column.** Five wales, every other one half a course out of phase — the stagger
 * of the real mesh — with the outer ones dimmer and the ribbon's vertical edges eased off. A
 * hard-edged strip reads as an object standing in the flow; a ribbon that fades at the margins reads
 * as cloth passing through the frame, which is what it is. The count is fixed and the *gauge* flexes
 * with the window, not the other way round: three wales is a chain at any width, so it is the count
 * that has to survive a narrow channel.
 *
 * Built once per size. The geometry cannot change between resizes, and a texture that reshuffles
 * every frame reads as noise rather than as thread.
 */
function weaveKnit(field: Field, sy: number, chPx: number, cwPx: number, dpr: number) {
  const eyes = eyeletsOf(field)

  /* Course pitch and open fraction, both measured off the field rather than recomputed from the
     spec — the solved membrane is already the authority on both, and `MM_PER_CELL` is private to
     the solver. */
  const pitch =
    eyes.length > 1
      ? ((eyes[eyes.length - 1][0] - eyes[0][0]) / (eyes.length - 1)) * sy
      : chPx / 6
  const open = Math.max(
    0.05,
    Math.min(0.95, eyes.reduce((sum, [a, b]) => sum + (b - a), 0) / field.h),
  )

  /* How many wales of cloth to show. Fixed rather than derived, because it is the count and not the
     width that decides whether this reads as mesh: at three it is a chain no matter how wide the
     strip is, and five is the first count where the stagger is legible as a stagger. */
  const wales = cwPx > 1700 ? 7 : 5

  /* The wale gauge. Held to a fraction of the course pitch so a cell of the mesh comes out about as
     elongated as it is in the cloth — roughly three to one — and *also* to a fraction of the channel,
     which is what keeps the ribbon a ribbon: on an iPad in portrait the pitch is tall and the window
     is narrow, and a gauge set by the pitch alone put a tenth of the picture under cloth. */
  const gauge = Math.max(8, Math.min(18, pitch * 0.42, cwPx * 0.016))
  const eyeH = pitch * 0.8
  /* Open area = eye width × eye height over gauge × pitch. Solve it for the width. */
  const wide = Math.max(1.4, Math.min(gauge * 0.44, (open * gauge * pitch) / eyeH / 2))
  const pinch = Math.max(0.6, wide * 0.13)
  const weight = Math.max(1.3, Math.min(3.4, (gauge - wide * 2) * 0.5))

  const reach = (wales * gauge) / 2 + weight * 2

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(2, Math.round(reach * 2 * dpr))
  canvas.height = Math.max(2, Math.round(chPx * dpr))
  const kx = canvas.getContext('2d')
  if (!kx) return { canvas, reach }
  kx.setTransform(dpr, 0, 0, dpr, 0, 0)
  kx.lineCap = 'round'
  kx.lineJoin = 'round'

  /** One side of one wale, as a single path: pinch, bow to the eye's waist, pinch, all the way down. */
  const side = (spans: [number, number][], xc: number, sign: number) => {
    const path = new Path2D()
    path.moveTo(xc + sign * pinch, -weight)
    for (const [y0, y1] of spans) {
      const ym = (y0 + y1) / 2
      path.lineTo(xc + sign * pinch, y0)
      path.quadraticCurveTo(xc + sign * wide, y0 + (ym - y0) * 0.06, xc + sign * wide, ym)
      path.quadraticCurveTo(xc + sign * wide, y1 - (y1 - ym) * 0.06, xc + sign * pinch, y1)
    }
    path.lineTo(xc + sign * pinch, chPx + weight)
    return path
  }

  /** The loop crossings in the pinch between two eyes — the ladder that makes it yarn, not wire. */
  const rungs = (spans: [number, number][], xc: number) => {
    const path = new Path2D()
    const step = Math.max(2.4, weight * 1.5)
    const arm = pinch + weight * 0.4
    for (let i = 0; i <= spans.length; i++) {
      const from = i === 0 ? 0 : spans[i - 1][1]
      const to = i === spans.length ? chPx : spans[i][0]
      for (let y = from + step * 0.4; y < to - step * 0.2; y += step) {
        path.moveTo(xc - arm, y)
        path.lineTo(xc + arm, y)
      }
    }
    return path
  }

  /* Centre out, so the sharpest wale is the last one drawn. */
  const order: number[] = []
  for (let k = (wales - 1) / 2; k >= 0; k--) {
    if (k > 0) order.push(-k, k)
    else order.push(0)
  }

  for (const k of order) {
    const xc = reach + k * gauge
    /* Every other wale half a course out of phase — the stagger of the real mesh. */
    const shift = (Math.abs(k) % 2) * 0.5 * pitch
    const fade = 1 - Math.min(0.74, (Math.abs(k) / ((wales - 1) / 2 || 1)) * 0.74)
    const spans = eyes.map(([a, b]) => {
      const mid = ((a + b) / 2) * sy + shift
      return [mid - eyeH / 2, mid + eyeH / 2] as [number, number]
    })
    const left = side(spans, xc, -1)
    const right = side(spans, xc, 1)
    const ladder = rungs(spans, xc)

    const pass = (
      colour: string,
      alpha: number,
      lw: number,
      offset: number,
      dash?: [number, number],
    ) => {
      kx.save()
      kx.translate(offset, 0)
      kx.strokeStyle = `rgba(${colour},${(alpha * fade).toFixed(3)})`
      kx.lineWidth = lw
      if (dash) kx.setLineDash(dash)
      kx.stroke(left)
      kx.stroke(right)
      kx.restore()
    }

    /* Fibre has no hard edge: a wide, faint breath under everything, or the yarn reads as wire. */
    pass(YARN, 0.028, weight * 2.8, 0)
    /* The shadow the loops throw, downstream of the light. */
    pass(YARN_LO, 0.3, weight * 1.4, weight * 0.34)
    /* The yarn itself — held well under opaque, because cloth this fine is translucent at the edges
       and because a solid white ribbon in front of the flow reads as a bar rather than a knit. */
    pass(YARN, 0.44, weight, 0)
    /* The twist, as a dash along the same path — the cheapest honest plait there is. */
    pass(YARN_HI, 0.15, weight * 0.7, 0, [1.4, 2.4])
    /* The lit face, upstream: the light in this chamber comes from the side the air arrives on. */
    pass(YARN_HI, 0.3, Math.max(0.65, weight * 0.32), -weight * 0.3)

    kx.strokeStyle = `rgba(${YARN},${(0.2 * fade).toFixed(3)})`
    kx.lineWidth = Math.max(0.7, weight * 0.46)
    kx.stroke(ladder)
    kx.strokeStyle = `rgba(${YARN_HI},${(0.11 * fade).toFixed(3)})`
    kx.lineWidth = Math.max(0.5, weight * 0.22)
    kx.stroke(ladder)
  }

  /* Ease the ribbon's vertical margins. A hard edge makes it an object standing in the flow; a
     falloff makes it cloth continuing past the frame, and it is the frame that is the fiction. */
  const edge = kx.createLinearGradient(0, 0, reach * 2, 0)
  edge.addColorStop(0, 'rgba(0,0,0,0.2)')
  edge.addColorStop(0.28, 'rgba(0,0,0,1)')
  edge.addColorStop(0.72, 'rgba(0,0,0,1)')
  edge.addColorStop(1, 'rgba(0,0,0,0.2)')
  kx.globalCompositeOperation = 'destination-in'
  kx.fillStyle = edge
  kx.fillRect(0, 0, reach * 2, chPx)

  return { canvas, reach }
}

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
  channels: readonly ChannelRefs[]
  /** Live, so a parent re-render never restarts a running field. */
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
  /** Built whether or not the heat layer is on — see the note in `composite`. */
  heat: HTMLCanvasElement
  hx: CanvasRenderingContext2D
  raster: ImageData
  /** The knit, woven once at this size by `weaveKnit`, and blitted every frame. */
  knit: HTMLCanvasElement
  /** Half the woven strip's width, in CSS px: where to put its left edge relative to the membrane. */
  knitReach: number
  cw: number
  ch: number
  density: number
  stir: { on: boolean; x: number; y: number; px: number; py: number }
  detach: () => void
}

/**
 * The loop, driving both channels.
 *
 * One `requestAnimationFrame` for the pair rather than one each — two independent loops drift apart
 * under load, and two channels of a controlled experiment stepping at different rates is not a
 * controlled experiment. Both fields take the same wind and the same deterministic inflow
 * perturbation, so the only difference between them is the knit.
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

        host.style.setProperty('--tunnel-ground', PALETTE.ground)

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
        fx.fillStyle = PALETTE.ground
        fx.fillRect(0, 0, fc.width, fc.height)

        /* Woven here rather than in the loop: the geometry only changes when the box does, and this
           is the one place that knows both the field and the size. */
        const woven = weaveKnit(field, cheight / field.h, cheight, cw, dpr)

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
          knit: woven.canvas,
          knitReach: woven.reach,
          cw,
          ch: cheight,
          /**
           * Particles per unit area, not per channel. A fixed population in a narrow channel is the
           * same number of marks in a fraction of the pixels, which over-accumulates in the trail
           * and washes the field out. Scaled against the box the constants were tuned in.
           */
          density: Math.max(0.32, Math.min(1.15, (cw * cheight) / (1400 * 300))),
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
      const d = r.raster.data
      const { field } = r
      for (let i = 0; i < field.temp.length; i++) {
        const t = tempOf(field.temp[i])
        const [cr, cg, cb] = heatRamp(t)
        const o = i * 4
        d[o] = cr | 0
        d[o + 1] = cg | 0
        d[o + 2] = cb | 0
        d[o + 3] = field.solid[i] ? 0 : (Math.min(1, 0.13 + Math.pow(t, 1.15) * 1.1) * 228) | 0
      }
      r.hx.putImageData(r.raster, 0, 0)
    }

    /**
     * The knit, blitted.
     *
     * All the drawing is in `weaveKnit`, which runs once per size. What's left here is where the
     * strip goes: centred on the solved band, which is the middle of the channel — the same centre
     * the flow's pressure jump sits on, so the eyes you can see through are exactly where the air
     * is going through.
     *
     * `source-over`, deliberately, in a file that composites the flow additively. The cloth is the
     * one opaque object on screen; adding it to the field behind it would make it glow.
     */
    const drawMembrane = (r: Runtime, sx: number) => {
      const { field, gx } = r
      const cx = (field.band + field.thickness / 2) * sx
      gx.globalCompositeOperation = 'source-over'
      gx.globalAlpha = 1
      gx.drawImage(
        r.knit,
        cx - r.knitReach,
        0,
        r.knitReach * 2,
        r.ch,
      )
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
          const raw = Math.hypot(uu, vv)
          let sp = (raw - lo) / Math.max(1e-4, hi - lo)
          sp = sp < 0 ? 0 : sp > 1 ? 1 : sp
          if (sp < 0.03) continue
          let g = 4
          if (sp >= 0.07) {
            const q = Math.round(Math.atan2(vv, uu) / (Math.PI / 4))
            g = ((q % 4) + 4) % 4
          }
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

    const updateTrail = (r: Runtime) => {
      const { field } = r
      const sx = r.cw / field.w
      const sy = r.ch / field.h
      const lo = 0.06 * field.wind
      const hi = 2.3 * field.wind
      const span = Math.max(1e-4, hi - lo)

      r.tx.setTransform(1, 0, 0, 1, 0, 0)
      r.tx.globalCompositeOperation = 'destination-out'
      r.tx.fillStyle = 'rgba(0,0,0,0.045)'
      r.tx.fillRect(0, 0, r.trail.width, r.trail.height)
      r.tx.setTransform(dprFlow, 0, 0, dprFlow, 0, 0)
      r.tx.globalCompositeOperation = 'lighter'

      /* Bucketed by speed, which is both the colour axis and the brightness axis: a slow thread is
         a dim pale blue, a jet is a bright green. One bucket is one `fillStyle`; alpha varies
         inside it, so a bucket is a shade rather than a flat band. */
      const buckets: number[][] = Array.from({ length: BINS }, () => [])
      const n = Math.round(live * r.density)
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

    const composite = (r: Runtime) => {
      const { field, fx, gx, fc } = r
      const sx = r.cw / field.w
      const L = layers.current

      if (L.particles) updateTrail(r)

      fx.setTransform(1, 0, 0, 1, 0, 0)
      fx.globalCompositeOperation = 'source-over'
      fx.globalAlpha = 1
      fx.fillStyle = PALETTE.ground
      fx.fillRect(0, 0, fc.width, fc.height)
      fx.setTransform(dprFlow, 0, 0, dprFlow, 0, 0)

      /**
       * The heat raster, off for now.
       *
       * `layers.heat` is `false` in the section, so this branch never runs — but the raster, its
       * buffer and its ramp are all still here and still built. Turning it back on is one boolean
       * in `components/Perforation.tsx`, which is the point: the temperature field is still solved
       * every frame, so the layer has real data waiting for it rather than a cold start.
       */
      if (L.heat) {
        drawHeat(r)
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
        drawMembrane(r, sx)
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
       * The governor. Two fields solve and two composite every frame, at half a screen each — the
       * heaviest this section has been — so it sheds glyph cadence first, then particle population.
       */
      if (now - qualityAt > 900) {
        qualityAt = now
        if (frameMs > 32 && quality > 0.5) quality -= 0.1
        else if (frameMs < 20 && quality < 1) quality += 0.06
        quality = Math.min(1, quality)
        live = Math.round(COUNT * (0.45 + 0.55 * quality))
        glyphEvery = frameMs > 40 ? 4 : frameMs > 26 ? 3 : 2
      }

      advance()
      for (const r of runtimes) composite(r)
    }

    if (reduced || !showing) {
      for (let i = 0; i < 260; i++) advance()
      for (const r of runtimes) composite(r)
    } else {
      /* A formed flow before the first live frame, so nobody watches an empty chamber fill. */
      for (let i = 0; i < 120; i++) advance()
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
