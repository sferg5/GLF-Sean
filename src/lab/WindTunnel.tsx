import { useEffect, useMemo, useRef } from 'react'
import {
  FABRICS,
  HOT,
  STEP,
  WALL,
  type Air,
  alphaOf,
  createAir,
  inject,
  poreCentre,
  poreHeight,
  puffs,
  riseOf,
  rng,
  settle,
  solids,
  step,
  type FabricId,
} from '../lib/air'

/**
 * Two channels of air, drawn.
 *
 * The physics is `lib/air.ts` and stays there — this file is the picture and the loop:
 *
 * - **The knit**, built from the same two numbers the particles are tested against
 *   (`solids()`), so the membrane on screen is the membrane in the model rather than a
 *   picture of one — and one small glow per pore, lit by how much has recently gone through
 *   it. Per pore rather than per channel, so what differs between the two is *how many* are
 *   lit.
 * - **Brightness is temperature**, in one neutral ink — dim where the air is still the
 *   outside's, bright where it has been sitting a while. It was a six-stop colour ramp from cyan
 *   to red, and it isn't the palette.
 * Additively composited on a near-black channel, like `ParticleField`: overlapping air gets
 * brighter, which is what accumulating density has to do to read as density.
 *
 * **Nothing in here reads scroll any more.** There was a 380svh pin and a storyboard: the
 * channels arrived empty, the fabric knitted itself across them middle-out, the air came on like
 * a tap, then the readouts and the verdict landed. It's all gone. The fields run whenever the
 * section is in front of you, which on a display that nobody scrolls is the only version of this
 * that is ever running when it's looked at.
 */

/* Ink
   ------------------------------------------------------------------ */

/**
 * One ink, at two brightnesses.
 *
 * **The colours went.** Air used to run cool blue through cream and coral to red as it sat
 * against the skin without being replaced, and a six-stop ramp existed to keep the crossing from
 * passing through grey. It read well and it isn't the palette: the whole page is a warm neutral,
 * and a section that arrives in cyan and crimson is a different brand for one screen.
 *
 * So temperature is carried by *brightness within one neutral* — dim where the air is still the
 * outside's, bright where it has been sitting a while. That is much less information than hue
 * was, and it can be, because the temperature is now quoted underneath: what the picture has to
 * carry is **how much air gets through**, which is density, which needs no colour at all.
 */
const INK_LO: [number, number, number] = [190, 186, 180]
const INK_HI: [number, number, number] = [255, 253, 250]

/**
 * Quantisation. Every mark in a bin is stroked in one path, so `SHADES × LEVELS` is the number of
 * draw calls a channel costs.
 *
 * Six shades where the ramp needed twelve — a monochrome scale has no crossing to resolve, so the
 * bins only have to be finer than the eye is on a 1px mark against near-black. Three brightness
 * levels for the same reason as before: this composites `lighter`, where alpha and brightness are
 * the same thing.
 */
const SHADES = 6
const LEVELS = 3

/**
 * Densest a single mark ever gets. Additive, so this is also the saturation budget.
 *
 * Half again what it was under the colour ramp, and it had to be. Hue was carrying most of the
 * contrast: a coral mark on near-black reads at an alpha a grey one disappears at, so taking the
 * colour out took the *picture* out with it and both channels came back as faint grey noise. This
 * is the density difference bought back in weight.
 */
const PEAK = 0.62

/**
 * The exposure a streak represents, in seconds.
 *
 * Long streaks read as scratches rather than as air — the same finding as the point cloud's
 * `TRAIL`. It multiplies velocity, so it lengthens the fast air without touching the queued air,
 * which is exactly the asymmetry the section needs.
 */
const EXPOSE = 0.04

/**
 * Thickness of the membrane, as a fraction of the channel's height.
 *
 * The constraint is the *pores*, not the runs: a filament wider than the gap next to it closes
 * that gap up, and then both knits read as one continuous run and the section has no picture left.
 * So this has to stay under the narrower of the two pore heights — 5.5% at 44% open across 8
 * pores, 6% at 18% across 3 — which is what sets the pore counts in `lib/air.ts` as much as this
 * number.
 */
const GAUGE = 0.045

/**
 * Ceiling on the canvas backing ratio.
 *
 * Lower than the point cloud's 2, and full-bleed is why: a channel is the width of the window, so
 * at 2× each one is 2 880 × 486 device pixels and the pair costs two and a half times the fill
 * rate a boxed version did. Every mark here is a soft additive stroke, and none has an edge that
 * 1.5 can't carry.
 */
const MAX_DPR = 1.5

/** Mix the two ends into `SHADES` CSS strings, once. */
const INK = Array.from({ length: SHADES }, (_, i) => {
  const f = SHADES > 1 ? i / (SHADES - 1) : 0
  const c = INK_LO.map((v, j) => Math.round(v + (INK_HI[j] - v) * f))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
})

/* Scratch. Everything a channel needs to draw a frame, allocated once — nothing below
   allocates per frame.
   ------------------------------------------------------------------ */

type Bucket = { data: Float32Array; n: number }

export type Scratch = {
  buckets: Bucket[]
}

/**
 * Sized for the pool, which is the worst case: every mark in one bin.
 *
 * Twelve colours by three levels by 2400 particles by four floats is 1.4MB a channel. It's
 * the price of never testing a bucket's capacity in the inner loop.
 */
export const makeScratch = (count: number): Scratch => ({
  buckets: Array.from({ length: SHADES * LEVELS }, () => ({
    data: new Float32Array(count * 4),
    n: 0,
  })),
})

/* Shared layers
   ------------------------------------------------------------------ */

type View = {
  ctx: CanvasRenderingContext2D
  air: Air
  scratch: Scratch
  w: number
  h: number
  dpr: number
}

/** Where the fabric's near face sits and how thick it is, in device pixels. */
const gaugeOf = (w: number, h: number, dpr: number) => {
  const wx = WALL * w
  const gauge = Math.max(3 * dpr, h * GAUGE)
  return { wx, gauge, face: wx + gauge / 2 }
}

/** Stroke every bucket. */
function strokeBuckets(ctx: CanvasRenderingContext2D, buckets: Bucket[], width: number) {
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = width

  for (let s = 0; s < SHADES; s++) {
    ctx.strokeStyle = INK[s]
    for (let l = 0; l < LEVELS; l++) {
      const bucket = buckets[s * LEVELS + l]
      if (!bucket.n) continue
      ctx.beginPath()
      for (let i = 0; i < bucket.n; i += 4) {
        ctx.moveTo(bucket.data[i], bucket.data[i + 1])
        ctx.lineTo(bucket.data[i + 2], bucket.data[i + 3])
      }
      ctx.globalAlpha = ((l + 0.5) / LEVELS) * PEAK
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
}

/** One segment into the bin its temperature and weight belong to. */
const put = (
  buckets: Bucket[],
  heat: number,
  weight: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) => {
  const level = Math.min(LEVELS - 1, (weight * LEVELS) | 0)
  const shade = Math.min(SHADES - 1, ((heat / HOT) * SHADES) | 0)
  const bucket = buckets[shade * LEVELS + level]
  const n = bucket.n
  bucket.data[n] = x0
  bucket.data[n + 1] = y0
  bucket.data[n + 2] = x1
  bucket.data[n + 3] = y1
  bucket.n = n + 4
}

/**
 * The vents, then the knit — drawn last and over everything, so the fabric reads as an object
 * in the channel rather than as another glow in it.
 *
 * The membrane is drawn *from* `wx` inward rather than centred on it, which is what keeps the
 * queued air out of it: refused parcels are held a hair short of `WALL`, so a membrane centred
 * there had the whole boundary layer painted inside its own yarn and the openings stopped
 * reading as openings.
 */
function knit({ ctx, air, w, h, dpr }: View) {
  const { wx, gauge, face } = gaugeOf(w, h, dpr)
  const poreH = poreHeight(air.spec) * h

  /* Clipped to the skin side of the fabric, which is where a jet is. Unclipped, a glow near a
     pore reached back through the gap and lit it — so the openings, the one thing the two
     knits differ in that a reader can count, came out brighter than the yarn instead of
     darker than it. */
  ctx.globalCompositeOperation = 'lighter'
  ctx.save()
  ctx.beginPath()
  ctx.rect(wx + gauge, 0, w, h)
  ctx.clip()
  for (let k = 0; k < air.spec.pores; k++) {
    const lit = air.glow[k]
    if (lit < 0.02) continue
    const cy = poreCentre(k, air.spec.pores) * h
    const r = Math.max(poreH * 1.3, gauge)
    const cx = wx + gauge * 1.2
    const jet = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    jet.addColorStop(0, `rgba(248, 246, 243, ${(0.3 * lit).toFixed(4)})`)
    jet.addColorStop(0.5, `rgba(232, 229, 225, ${(0.09 * lit).toFixed(4)})`)
    jet.addColorStop(1, 'rgba(232, 229, 225, 0)')
    ctx.fillStyle = jet
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  }
  ctx.restore()

  ctx.globalCompositeOperation = 'source-over'

  const runs = solids(air.spec)
  const yarn = ctx.createLinearGradient(wx, 0, wx + gauge, 0)
  /* Lit from the outside, which is where the light in this channel comes from — the membrane is
     the only opaque thing in the frame and it has to have a near side. */
  yarn.addColorStop(0, 'rgba(238, 235, 231, 0.94)')
  yarn.addColorStop(0.55, 'rgba(168, 164, 158, 0.72)')
  yarn.addColorStop(1, 'rgba(112, 108, 103, 0.6)')

  ctx.strokeStyle = yarn
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(1, gauge * 0.16)

  /**
   * The mesh: filaments crossing on the diagonal, a zig-zag down each face of the membrane with
   * the two out of phase so they cross in the middle.
   *
   * **It was one of four**, and the other three — interlocking loops, a plain rounded rib, a
   * plied twist — are gone with the switcher that chose between them. Before all four it was a
   * chain of circles, on the reasoning that a cross-section cuts across yarn and yarn in section
   * is round. The geometry was right and the picture was of beads on a wire; every version since
   * has treated the frame as a magnified elevation, where what you see is yarn passing through
   * itself.
   *
   * The physics never cared: a pore is a gap of a given height and total capacity is
   * `CAP × porosity` however the solid parts between them are shaped.
   */
  for (let j = 0; j < runs.length; j++) {
    const [y0, y1] = runs[j]
    const mid = ((y0 + y1) / 2) * h
    const half = ((y1 - y0) / 2) * h
    const step = Math.max(3, gauge * 0.9)

    for (const dir of [1, -1]) {
      ctx.beginPath()
      /* Alternated per run, so consecutive runs don't line their diagonals up into one long
         chevron down the whole membrane. */
      let side = j % 2 === 0 ? dir : -dir
      ctx.moveTo(face + side * gauge * 0.42, mid - half)
      for (let y = -half + step; y <= half; y += step) {
        side = -side
        ctx.lineTo(face + side * gauge * 0.42, mid + y)
      }
      ctx.stroke()
    }
  }

}

/* The air
   ------------------------------------------------------------------ */

/**
 * Every parcel of air as a short streak, its length its own velocity.
 *
 * So a jet through a pore draws long and a parcel queued against the fabric draws as a dot,
 * with no separate parameter deciding which — the model's state, plotted.
 *
 * **There were briefly three of these**, drawn from the same fields: this, streamlines traced
 * through the flow rule, and a smoothed thermal field. They cost 17ms, 33ms and 17ms a frame
 * under a 4× CPU throttle, and this is the one that was kept. The streamlines read best as
 * *flow* and were the only place a look interpreted the model rather than plotting it; the
 * field argued hardest for the temperature and showed no movement at all. Both are gone rather
 * than left switchable, because a renderer nobody has chosen is a renderer nobody maintains.
 */
function drawAir(view: View) {
  const { ctx, air, scratch, w, h, dpr } = view
  const { buckets } = scratch
  for (const b of buckets) b.n = 0

  for (let i = 0; i < air.n; i++) {
    if (air.life[i] <= 0) continue
    /* The parcel's own fade in and out, asked of the model rather than restated here — the two
       would otherwise be two sets of constants that have to agree about when air exists. */
    const a = alphaOf(air, i)
    if (a * PEAK < 0.012) continue
    const x = air.x[i] * w
    const y = air.y[i] * h
    put(buckets, air.heat[i], a, x, y, x - air.vx[i] * EXPOSE * w, y - air.vy[i] * EXPOSE * h)
  }

  strokeBuckets(ctx, buckets, 1.5 * dpr)
  knit(view)
}

/* The loop
   ------------------------------------------------------------------ */

/** Seed for the shared emitter. Fixed, so a screenshot of this section is repeatable. */
const SEED = 0x5eed

/**
 * Substeps a single frame is allowed.
 *
 * A tab that was in the background for a minute comes back with a minute of unspent time, and
 * catching up on it is both pointless and a spike.
 */
const MAX_STEPS = 4

/**
 * How often the figures are written, in frames.
 *
 * The fields are redrawn every frame; the readouts are not. Six of them at 60Hz is twenty
 * digit wheels re-transformed a second — cheap individually and pointless collectively,
 * because nobody reads a number that changes sixty times a second.
 */
const READ_EVERY = 6

type Options = {
  canvas: Record<FabricId, React.RefObject<HTMLCanvasElement | null>>
  /**
   * The pace, as the dimensionless wind the model runs on — both a ref and a value.
   *
   * The loop reads the ref so that a slider drag doesn't tear down and restart a running rAF
   * sixty times a second; the reduced-motion path takes the value, because a settled still has
   * to be recomputed when the pace changes and a ref can't be a dependency.
   */
  wind: React.RefObject<number>
  windValue: number
  /**
   * Whether the section is on screen.
   *
   * The loop doesn't run when it isn't, and that is the *only* thing scroll does here now. It
   * used to gate the emitter and draw the knit in over a 380svh pin: the channels arrived empty,
   * the fabric knitted itself across them, and then the air came on. All of that is gone — the
   * fields are simply running whenever the section is in front of you.
   */
  showing: boolean
  reduced: boolean
}

/**
 * One rAF for both channels, and one emitter in front of them.
 *
 * The loop is here rather than one per canvas for the reason the section exists: the two
 * channels have to be handed the *same* air on the *same* step, and two independent loops
 * drifting a frame apart would quietly make it two experiments instead of one.
 */
export function useWindTunnel({ canvas, wind, windValue, showing, reduced }: Options): void {
  /* The pool, allocated once. */
  const sim = useMemo(() => {
    const air = FABRICS.map((spec) => createAir(spec)) as [Air, Air]
    return {
      air,
      scratch: air.map((a) => makeScratch(a.n)) as [Scratch, Scratch],
      next: rng(SEED),
      carry: 0,
    }
  }, [])

  /** Canvas backing sizes, kept by a `ResizeObserver` rather than measured in the loop. */
  const size = useRef<Record<FabricId, { w: number; h: number; dpr: number }>>({
    now: { w: 0, h: 0, dpr: 1 },
    next: { w: 0, h: 0, dpr: 1 },
  })

  /* A frame, drawn from whatever state the sim is in. Shared by the running loop and the
     reduced-motion path, so the two can't diverge in what they paint. */
  const paint = useRef(() => {})
  paint.current = () => {
    FABRICS.forEach((spec, i) => {
      const el = canvas[spec.id].current
      const box = size.current[spec.id]
      if (!el || !box.w) return
      const ctx = el.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, box.w, box.h)
      drawAir({
        ctx,
        air: sim.air[i],
        scratch: sim.scratch[i],
        w: box.w,
        h: box.h,
        dpr: box.dpr,
      })
      ctx.globalCompositeOperation = 'source-over'
    })
  }

  /* Sizing. Every canvas gets its own observer and an immediate measure, because the section is
     three viewports tall and the first paint happens long before it's scrolled to. */
  useEffect(() => {
    const observers = FABRICS.map((spec) => {
      const el = canvas[spec.id].current
      if (!el) return null
      const measure = () => {
        const rect = el.getBoundingClientRect()
        if (!rect.width) return
        const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1)
        size.current[spec.id] = {
          w: Math.round(rect.width * dpr),
          h: Math.round(rect.height * dpr),
          dpr,
        }
        el.width = size.current[spec.id].w
        el.height = size.current[spec.id].h
        paint.current()
      }
      const observer = new ResizeObserver(measure)
      observer.observe(el)
      measure()
      return observer
    })
    return () => observers.forEach((o) => o?.disconnect())
  }, [canvas])

  /**
   * What the fields measure, onto each channel's canvas as data attributes.
   *
   * **Nothing draws these.** The figures under the section are `predict()` — the model's steady
   * state at the slider's pace, solved — because an EMA of two particle fields is never quite
   * still and a headline whose last digit crawls reads as instability rather than as liveness.
   * So what this is for is the check: `scripts/fabric.sh` reads them back and asserts the quoted
   * figures are the ones the *running* field agrees with, which is the only thing that keeps a
   * solved readout honest. `Clip` writes `dataset.frame` on its video for the same reason.
   */
  const publish = useRef(() => {})
  publish.current = () => {
    FABRICS.forEach((spec, i) => {
      const el = canvas[spec.id].current
      if (!el) return
      el.dataset.through = sim.air[i].through.toFixed(4)
      el.dataset.rise = riseOf(sim.air[i].load).toFixed(2)
    })
  }

  useEffect(() => {
    if (reduced || !showing) return

    let raf = 0
    let last = 0
    let frame = 0
    let spare = 0

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      if (!last) {
        last = t
        return
      }
      spare += Math.min(0.25, (t - last) / 1000)
      last = t

      const w = wind.current
      let steps = 0
      while (spare >= STEP && steps < MAX_STEPS) {
        spare -= STEP
        steps++
        /* One emitter, one list, both channels. This is the experiment — see `lib/air.ts`. */
        const emit = puffs(sim.next, STEP, w, sim.carry)
        sim.carry = emit.carry
        for (const air of sim.air) {
          inject(air, emit.list, w)
          step(air, STEP, w)
        }
      }
      if (steps === MAX_STEPS) spare = 0

      paint.current()
      if (frame++ % READ_EVERY === 0) publish.current()
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [showing, reduced, wind, sim])

  /**
   * Reduced motion: one settled frame, and the pace slider still works.
   *
   * The comparison is the content and the movement is the medium, so what this hands back is
   * the movement — the fields are run to steady state with nothing on screen and then drawn
   * once. It's the same code path the harness measures, so the still shows the numbers the
   * moving version would have arrived at rather than an early frame of them.
   */
  useEffect(() => {
    if (!reduced) return
    /* Fresh pools rather than eight more seconds on top of the last pace: continuing would
       make the picture depend on which paces you had already tried. */
    sim.air = FABRICS.map((spec) => createAir(spec)) as [Air, Air]
    sim.next = rng(SEED)
    sim.carry = 0
    settle(sim.air, windValue)
    paint.current()
    publish.current()
  }, [reduced, windValue, sim])
}
