import { useEffect, useRef, useState } from 'react'
import type { MotionValue } from 'motion/react'
import { sampleShoe, type PointCloud } from '../lib/points'
import { FEATHER, WAKE, frontAt } from '../lib/front'
import { clamp, fadeInOut } from '../lib/remap'
import { useSheet, type Sheet } from '../lib/sheet'

/**
 * The shell coming apart into the airflow.
 *
 * Each point is released as the section front reaches it, then advects downstream
 * — the same direction the front travels, so the shell reads as material being
 * carried off the specimen rather than as dust falling out of it. Curl comes from
 * a cheap sinusoid keyed on the point's own height, which is what turns a uniform
 * drift into the braided wake the reference images have.
 *
 * The drift is weighted hard upward, and that's the load-bearing decision. Drifting
 * along the front's own axis keeps every point over the shoe, where the mark is lost
 * either way — white on white foam, or graphite in the shoe's own detail; lifting them
 * takes the wake off the silhouette and onto the open sheet within a few tenths of its
 * life, which is the only place it can actually be seen. It also happens to be what a
 * wind tunnel photograph looks like, so the physics and the legibility want the same
 * thing.
 *
 * **Every position here is a pure function of `p`.** Nothing reads the clock.
 * That costs the field its idle shimmer — stop scrolling mid-transition and it
 * freezes — and buys three things worth more than the shimmer:
 *
 * - `verify.mjs` can compare a scrolled frame against a scrubbed one pixel by
 *   pixel, which is the check that catches easing and spring bugs.
 * - Screenshots at `?p=` are reproducible.
 * - There is no rAF running when nobody is scrolling.
 *
 * A frozen field also happens to be the right read: this is an instrument holding
 * a frame, not an aquarium.
 */

/**
 * Alpha quantisation. Every point in a bucket is stroked in one path, so this is
 * the number of draw calls per colour — 8 is past the point where the banding is
 * visible on 1px marks and still only 16 strokes for ~9000 segments.
 */
const BUCKETS = 8

/**
 * Densest a single point ever gets. The field is meant to accumulate, not to shout.
 *
 * Two numbers, because the two sheets composite in opposite directions. Dark ink laid
 * down normally reads heavier at the same alpha than light ink added does — one mark is
 * subtracting from the paper where the other is contributing to a glow — so at the
 * blueprint's 0.5 the graphite plume comes out as smoke rather than as spray.
 */
const PEAK = { blueprint: 0.5, paper: 0.44 } as const

/** Mean drift over a point's life, in stage widths and heights, and its shape over time. */
const DRIFT = { x: 0.3, y: 0.5, curve: 1.45 } as const

/**
 * Streak length as a fraction of the current velocity.
 *
 * Long streaks were the first thing tried and they read as scratches on the print,
 * not as particulate — a mark whose length is much greater than the space between
 * marks stops being a point and starts being a line. Short enough that the plume
 * resolves into grain is the whole difference.
 */
const TRAIL = 0.022

/** Fraction of the canvas height the plume fades out over as it approaches the top. */
const EDGE_FADE = 0.1

/**
 * The cloud's two inks, per sheet — and the pair is more than a recolour.
 *
 * On the blueprint the marks are a near-white blue and composite `lighter`: that's how
 * you accumulate density in *light*, and overlapping points get brighter, which is what
 * a point cloud on a print has to do. On paper it inverts — adding graphite to graphite
 * would lighten it towards white — so the marks go dark and composite `source-over`,
 * where translucent strokes stack the way ink actually does, each overlap a little
 * denser than the last.
 *
 * It changes what the field *is*, too. Light specks read as luminous particulate in a
 * wind tunnel; dark ones read as pencil spray coming off the drawing, which is the right
 * claim on a sheet.
 *
 * The second ink in each pair is the shoe's own coral, carried into the cloud so the
 * product stays legible inside it — pulled deeper on paper, where a bright coral would
 * be the one thing on the sheet that wasn't drawn.
 */
const INK = {
  blueprint: { cool: 'rgb(198, 224, 255)', warm: 'rgb(255, 122, 108)', op: 'lighter' },
  paper: { cool: 'rgb(52, 47, 42)', warm: 'rgb(214, 76, 64)', op: 'source-over' },
} as const

/** Retina buys nothing on 1px marks past 2×, and costs the fill rate. */
const MAX_DPR = 2

type Bucket = { data: Float32Array; n: number }

const makeBuckets = (count: number): Bucket[] =>
  Array.from({ length: 2 * BUCKETS }, () => ({ data: new Float32Array(count * 4), n: 0 }))

function draw(
  ctx: CanvasRenderingContext2D,
  cloud: PointCloud,
  buckets: Bucket[],
  p: number,
  w: number,
  h: number,
  dpr: number,
  sheet: Sheet,
) {
  const ink = INK[sheet]
  const peak = PEAK[sheet]

  ctx.clearRect(0, 0, w, h)

  // Both end states are photographs, so the field has to be completely gone at
  // each of them — not merely faint.
  const gate = fadeInOut(p, 0.15, 0.82)
  if (gate < 0.004) return

  const front = frontAt(p)
  const lead = FEATHER * 1.1

  for (const b of buckets) b.n = 0

  for (let i = 0; i < cloud.count; i++) {
    const hx = cloud.x[i]
    const d = front - hx
    // Ahead of the glow and behind the wake there is nothing to draw. Most of the
    // cloud is outside the band at any one frame, so this is most of the saving.
    if (d < -lead || d > WAKE) continue

    const t = clamp(d / WAKE)
    let a = gate * clamp((d + lead) / lead) * (1 - t) ** 1.35 * cloud.weight[i] * peak
    if (a < 0.01) continue

    const hy = cloud.y[i]
    const seed = cloud.seed[i]

    /**
     * Horizontal and vertical drift are scaled by *different* functions of the
     * seed, which is the only reason this reads as a plume.
     *
     * Scaling both by one speed varies how far each point gets but not which way
     * it goes, so every streak comes out at the same angle and the field reads as
     * a comb dragged across the frame. Decorrelating the two axes fans them out.
     * `seed` and this cheap hash of it are independent enough for that, and both
     * are still fixed per point, so nothing here moves without `p` moving.
     */
    const spin = (seed * 7.3129) % 1
    const gx = DRIFT.x * (0.45 + spin * 1.25)
    const gy = DRIFT.y * (0.5 + seed * 1.1)

    /**
     * Still accelerating — a point that leaves at constant velocity reads as a
     * scrolling texture, one that accelerates reads as something letting go — but
     * gently. A square law spends most of a point's life barely moving, which
     * strands it over the photograph it came from until it has already begun to
     * fade, and the plume comes out as a thin wisp instead of a body of spray. The
     * exponent is the trade between "lets go" and "gets clear in time to be seen".
     */
    const e = t ** DRIFT.curve
    const dEdt = DRIFT.curve * t ** (DRIFT.curve - 1)

    const x = (hx + e * gx) * w
    const y = (hy - e * gy + Math.sin(hy * 17.3 + seed * 6.283 + t * 2.6) * e * 0.06) * h

    const vx = dEdt * gx
    const vy = -dEdt * gy

    // The plume rises, so on a short or wide viewport it can still be bright when
    // it reaches the top of the box — which would end it on a ruler-straight line
    // at the canvas boundary. Fading it into the last tenth costs nothing and makes
    // the field independent of the stage's aspect ratio.
    a *= clamp(y / (h * EDGE_FADE))
    if (a < 0.01) continue

    // Trail taken from the drift's own derivative: a just-released point is a dot,
    // a fast one is a streak, with no separate parameter to keep in sync.
    const bucket = buckets[cloud.warm[i] * BUCKETS + Math.min(BUCKETS - 1, ((a / peak) * BUCKETS) | 0)]
    const n = bucket.n
    bucket.data[n] = x
    bucket.data[n + 1] = y
    bucket.data[n + 2] = x - vx * TRAIL * w
    bucket.data[n + 3] = y - vy * TRAIL * h
    bucket.n = n + 4
  }

  // Per sheet — see INK. `lighter` accumulates in light on the blueprint; `source-over`
  // accumulates in ink on paper. The canvas itself always composites over the page
  // normally, whichever of the two is in force inside it.
  ctx.globalCompositeOperation = ink.op
  ctx.lineCap = 'round'
  ctx.lineWidth = 1 * dpr

  for (let g = 0; g < 2; g++) {
    ctx.strokeStyle = g ? ink.warm : ink.cool
    for (let b = 0; b < BUCKETS; b++) {
      const bucket = buckets[g * BUCKETS + b]
      if (!bucket.n) continue
      ctx.beginPath()
      for (let i = 0; i < bucket.n; i += 4) {
        ctx.moveTo(bucket.data[i], bucket.data[i + 1])
        ctx.lineTo(bucket.data[i + 2], bucket.data[i + 3])
      }
      ctx.globalAlpha = ((b + 0.5) / BUCKETS) * peak
      ctx.stroke()
    }
  }

  ctx.globalAlpha = 1
  // Left as it was found, so a later layer on this context isn't handed the blueprint's
  // additive blend.
  ctx.globalCompositeOperation = 'source-over'
}

export function ParticleField({ p }: { p: MotionValue<number> }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [cloud, setCloud] = useState<PointCloud | null>(null)
  /**
   * Subscribed to directly rather than taken as a prop — see `lib/sheet.ts`. A canvas
   * four levels inside the variant is exactly the case that store exists for.
   *
   * It's in the effect's dependencies below, so swapping the sheet tears down the
   * subscription and redraws immediately. That matters more here than anywhere else on
   * the page: nothing in this component reads the clock, so a frame is only ever
   * re-rasterised when `p` changes — and if you swap the sheet while holding still, a
   * field that waited for the next scroll would sit there in the other document's ink.
   */
  const [sheet] = useSheet()

  useEffect(() => {
    let alive = true
    sampleShoe().then((c) => alive && setCloud(c))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const el = canvas.current
    if (!el || !cloud || !cloud.count) return
    const ctx = el.getContext('2d')
    if (!ctx) return

    const buckets = makeBuckets(cloud.count)
    let size = { w: 0, h: 0, dpr: 1 }
    let queued = 0

    const render = () => {
      queued = 0
      if (size.w) draw(ctx, cloud, buckets, p.get(), size.w, size.h, size.dpr, sheet)
    }

    // Scroll and the smoothing spring can both land in one frame; coalesce so the
    // field is rasterised once per frame at most.
    const schedule = () => {
      if (!queued) queued = requestAnimationFrame(render)
    }

    const resize = () => {
      const rect = el.getBoundingClientRect()
      if (!rect.width) return
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1)
      size = { w: Math.round(rect.width * dpr), h: Math.round(rect.height * dpr), dpr }
      el.width = size.w
      el.height = size.h
      render()
    }

    const observer = new ResizeObserver(resize)
    observer.observe(el)
    resize()

    const stop = p.on('change', schedule)
    return () => {
      stop()
      observer.disconnect()
      if (queued) cancelAnimationFrame(queued)
    }
  }, [cloud, p, sheet])

  return <canvas ref={canvas} className="layer field" aria-hidden="true" />
}

/** Quoted in the readout — the field's own point count, not a decorative number. */
export function usePointCount() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let alive = true
    sampleShoe().then((c) => alive && setCount(c.count))
    return () => {
      alive = false
    }
  }, [])
  return count
}
