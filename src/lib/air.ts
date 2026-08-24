/**
 * Two wind tunnels, one air supply, and the only difference between them is the knit.
 *
 * This is the model behind the fabric section: a channel seen in cross-section, **outside air
 * at the left edge, skin at the right**, and the fabric standing across it at `WALL`. Cool air
 * arrives from outside, and either finds a pore or doesn't. What gets through flushes the
 * microclimate against the skin; what doesn't never gets in. So the claim is made twice over
 * in the same frame — how much air reaches you, and how hot the air already there gets while
 * it waits to be replaced.
 *
 * **It ran the other way first**, skin on the left and the plume leaving to the right, and the
 * flip is more than a label swap. Heat used to accumulate *upstream* of the knit, in air on its
 * way out that couldn't leave; now it accumulates *downstream*, in the microclimate, which is
 * the side of the fabric the claim is actually about. Everything hot in the frame is now
 * against the skin, which is where "cooler against the skin" has to be measured.
 *
 * **The two tunnels are a controlled experiment, and the code is what makes that true.**
 * `puffs()` is called once per frame and the *same* list is injected into both tunnels, so
 * particle *i* is born at the same instant, at the same height, at the same speed, in both.
 * Nothing in `step()` reads a random number — the wander is two sinusoids keyed on a
 * particle's own seed and age — so a paired particle shakes identically on both sides until
 * the wall does something different to it. The only asymmetry in the whole file is
 * `FABRICS[n].pores` and `.porosity`.
 *
 * **It reads the clock, and that's a departure worth naming.** Everything else on this page
 * is a pure function of scroll (`lab/ParticleField.tsx` says why at length: reproducible
 * screenshots, a pixel-comparable `verify.mjs`, no rAF at rest). Airflow can't be: the thing
 * being compared *is* a rate, and a frozen frame of two particle fields shows two
 * arrangements of dots rather than one fabric moving twice the air. So this one runs on time
 * — but on a fixed timestep from a seeded emitter, so it's still deterministic: same seed and
 * same pace in, same frames out. `scripts/air.mjs` runs it headless and that's how the
 * readout constants below were set.
 *
 * No DOM in here, deliberately, and no imports either. The drawing is `lab/WindTunnel.tsx`;
 * this file is the physics and it has to stay runnable under node for the harness to mean
 * anything. `scripts/air.sh` compiles this one file with `tsc` on its own, which is why it
 * imports nothing: `tsc` emits an extensionless import that node then can't resolve.
 */

/* Geometry. All of it in the channel's own box: x and y both 0..1, x across the channel from
   the outside air at 0 to the skin at 1, y down it. The box is much wider than it is tall, so a
   velocity in x and a velocity in y are not the same speed on screen — the constants below are
   tuned in these units and converted once, at the draw.
   ------------------------------------------------------------------ */

/**
 * Where the fabric stands, measured from the outside.
 *
 * Just over a third across, so the larger part of the frame is the microclimate — which is
 * where the temperature is, and so where the section's second claim lives. It was the same
 * number when the flow ran the other way and the larger part was the plume; the fabric sitting
 * nearer one edge than the other is what makes a cross-section read as having an inside and an
 * outside at all.
 */
export const WALL = 0.36

/** The outer face of the air. Nothing goes left of this — it's already outdoors. */
export const OUTSIDE = 0.02

/**
 * How far out from the fabric its presence is felt — the boundary layer on the outside face.
 *
 * Thin, and it was three times this. The reversal that turns refused air around used to be
 * applied flat across the whole zone, so the trapped mass piled up at the *outer edge* of it
 * and left a clean band of nothing between the air and the fabric it was supposedly stuck
 * against. It's ramped with proximity now (see `step`), and the zone is thin enough that what
 * gets through has somewhere to converge from.
 */
const MOUTH = 0.03

/** Top and bottom of the channel. Air doesn't leave through those. */
const EDGE = 0.02

/* The air
   ------------------------------------------------------------------ */

/** Free-stream speed of the outside air at the reference pace, in channel widths per second. */
export const DRIVE = 0.55

/** How fast a particle's velocity relaxes onto the local target, per second. */
const FOLLOW = 9

/** A pore is a nozzle: what goes through it goes through faster than it arrived. */
const JET = 1.9

/**
 * And slower again once it's through, inside the microclimate.
 *
 * Lower than it looks like it should be, for a reason that is about the picture: air spreading
 * into a much larger volume on the far side came out eight times sparser than the air queued
 * on the near side, and read as dust next to a smear. Slowing it keeps the microclimate
 * populated — which is also what a jet decelerating into a still cavity actually does, and it
 * is the residence time the temperature is set by.
 */
const WAKE = 0.5

/** Vertical authority of the pore on air that is already at it. */
const CONVERGE = 7

/**
 * How far upstream the streamlines start bending towards the openings, and how hard.
 *
 * Without this, whether a particle got through was mostly whether its lane happened to be in
 * front of a pore — so arrivals at the pores were `porosity` of the flow plus a third for the
 * wander, which put a ceiling on throughput that had nothing to do with the fabric's capacity
 * and everything to do with the geometry of the emitter. It capped the open knit at ~56%
 * through however open it was, which capped the *trapped* difference between the two channels
 * at under 2× and made the two look nearly the same.
 *
 * Flow converging into an opening is also what actually happens, and it's the single thing
 * that made the field read as a flow field rather than as a sheet of dashes moving right.
 * With it, nearly everything arrives aligned with some pore and what limits the throughput is
 * the pore's own capacity — which is the fabric, which is the point.
 *
 * `REACH` is where the bend starts and the authority ramps from nothing to `APPROACH` across
 * it, so the convergence has somewhere to come from. The pair is a trade: enough authority to
 * close half a lane inside the distance, spread over enough of it that the flow *bends*. At 9
 * over 0.2 it turned — hard Vs converging on each pore, which reads as particles being aimed.
 * At 6 over 0.24 there is more than twice the margin needed on the alignment and it looks
 * like a flow field.
 */
const REACH = 0.24
const APPROACH = 6

/** Vertical wash along the outside face, for air that can't. */
const WASH = 0.16

/** Fraction of the drive that comes back off the outside of the membrane. */
const BACK = 0.3

/** Turbulence — see the note in `step`. Not a random walk. */
const TURB = 0.5

/** The flow opening out once it's inside. */
const SPREAD = 0.05

/**
 * How fast transverse momentum dies once the air is through, per second.
 *
 * A jet leaving a pore carries whatever sideways speed the convergence gave it, and with
 * nothing to take that away it keeps it — so a parcel crosses the microclimate on a straight
 * diagonal and bounces off the far wall. Which is wrong (a jet's transverse momentum
 * dissipates into the bulk within a fraction of a second) and, in the streamline look, is what
 * made the skin side come out as a lattice of long crossing lines rather than as flow.
 *
 * Only inside. On the outside face the sideways motion *is* the story — it's air washing along
 * the knit looking for a way through — and damping it there would flatten the queue.
 */
const DAMP = 2.6

/**
 * Emission at the reference pace, particles per second. Both tunnels get every one.
 *
 * Set for density on screen rather than for the physics, which only ever sees ratios: at 170
 * the closed channel held ~800 particles across 46 000 device pixels of trapped region and
 * read as scattered dashes rather than as air.
 *
 * **And then set back down, because it's the section's whole frame budget.** Every particle
 * costs two canvas path calls a frame, and path construction is what this section spends its
 * time on — at 420 the loop measured ~17ms a frame under a 4× CPU throttle, which is a
 * mid-range laptop at 20fps. Nothing else moved the number: the pool size tracks this
 * linearly and the rasterisation is under a millisecond of it. So the density is bought back
 * with weight instead — a slightly wider, slightly brighter mark at half the count reads the
 * same and costs half.
 */
const EMIT = 240

/**
 * Pore capacity, in particles per second per unit of open height, at the reference pace.
 *
 * This is the constant that makes the comparison mean anything, and it's why a wandering
 * particle finding its way to a pore doesn't quietly equalise the two tunnels. Volumetric
 * flow through a porous sheet is limited by open *area*, not by how many particles are
 * queued at it — so each pore passes at a finite rate, `CAP × poreHeight`, and the rest of
 * the air waits or dies waiting. Total capacity is `CAP × porosity`, so while the knit is
 * the bottleneck the airflow ratio between the two tunnels is exactly the ratio of their
 * porosities.
 *
 * **The equality holds only while capacity is what's binding**, which is what `APPROACH`
 * above is for: with the streamlines converging on the openings, essentially all of the air
 * arrives at a pore, so what limits it is the pore. 420 against `EMIT` of 240 is 1.75 — high
 * enough that the open knit clears three quarters of its air and its channel visibly empties,
 * and low enough that it never reaches the top and starts measuring the emitter instead.
 *
 * It's a ratio to `EMIT` and nothing else, so the two move together.
 */
const CAP = 420

/**
 * Capacity goes as a sub-linear power of pace while production goes linearly with it.
 *
 * Flow through a porous medium is only linear in pressure while it's laminar; past that it's
 * Forchheimer's regime and the extra push buys less than it costs. That asymmetry is what
 * makes the pace slider worth touching: crank it and both channels fall behind, but the
 * closed one falls behind from a position it was already losing from.
 *
 * 0.85 rather than the square root it started as, and the constraint is the top of the
 * *slider* rather than the physics: with capacity this far above the closed knit's needs, a
 * square law hands the open knit more capacity than there is air to use at a walking pace, and
 * a channel reading 100% through is a channel measuring the emitter. At 0.85 the open knit
 * peaks near 85% at 6 km/h, which is a fabric coping rather than a reading saturating.
 */
const PACE_LAW = 0.85

/**
 * Seconds a particle of outside air gets to find a way in, and seconds it gets once it has.
 *
 * `blocked` is what bounds the queue on the outside face: air that never gets through is air
 * that went somewhere else, and giving it a finite life is how the channel reaches a steady
 * state instead of filling with everything it ever refused.
 *
 * `inside` is the one that matters to the reading, and it has to clear the microclimate's own
 * transit by a margin at *every* pace on the slider — not just at the reference. 0.64 of the
 * channel at `DRIVE × WAKE` is 2.3 seconds at the reference and twice that at the bottom of the
 * range, and it was 5: close enough that the population stopped being uniform in age down there
 * and the field ran half a degree hotter than the closed form `predict()` quotes. 9 leaves the
 * slowest parcel most of its allowance unspent, which is what keeps the picture and the figure
 * the same claim.
 */
const LIFE = { blocked: 4.5, inside: 9 } as const

/**
 * Seconds of a particle's life spent fading out, and in.
 *
 * The tail is the load-bearing one: in the closed knit most of the air dies of old age on the
 * outside face, by definition, so without it the field pops a hole in itself several hundred
 * times a second.
 */
const FADE = { in: 0.12, out: 0.45 } as const

/**
 * The skin's heat output, and the ceiling on how hot air against it can get.
 *
 * **`FLUX` is a total, not a rate per particle, and that is the whole model.** A body puts out
 * a fixed amount of heat per second whatever fabric is over it, so how hot the microclimate
 * gets is that heat *shared among however much air is in there to carry it* — which makes the
 * temperature rise inversely proportional to the ventilation rate. That's the textbook result,
 * and dividing by the live population is the one line that gets it:
 *
 * ```
 * heat per particle per second  =  FLUX / (air in the microclimate)
 * mean temperature              ∝  (1 / population) × residence  ∝  1 / through
 * ```
 *
 * A per-particle soak rate does *not* give that. It was the first version, and it measures
 * residence time only: both channels move their air at the same speed, so both warmed it by
 * the same amount and the closed one was hotter only in the sense that it had less air. The
 * ratio came out at 1.8 rather than at the ratio of the throughputs.
 *
 * **It scales with pace**, because you produce more heat when you work harder. Without that
 * the reading falls off a cliff at the top of the slider — more air per second through the
 * same knit — and a fabric comparison that says a sprint is cooler than a walk is measuring
 * the wrong thing. With it the temperature depends on the *fraction* that gets through and
 * barely on the pace, which is the honest reading: harder running ventilates you more and
 * produces more to ventilate.
 *
 * `HOT` is as hot as still air against skin gets here, and nothing reaches it — the closed
 * knit's air leaves the frame at around 3.4.
 */
const FLUX = 250
export const HOT = 4

/**
 * The floor under the population `FLUX` is divided by.
 *
 * Only ever binds while a channel is filling, where a genuinely empty microclimate would
 * otherwise divide a fixed heat output by nothing and hand the first particle through it a
 * temperature off the top of the scale.
 */
const MIN_INSIDE = 40

/**
 * The temperature the warm parts of the picture are scaled against.
 *
 * Exported because two things scale off this one number — the wash inside the canvas and the
 * glow on the skin edge in the DOM — and they have to be the same reading shown twice rather
 * than two effects that drift apart. `load` is a mean temperature in the same units as
 * `heat`, so this is just "hot enough to draw at full strength".
 */
export const LOAD_REF = 2.2

/** Time constants for the readouts. Long — these are instruments, not counters. */
const TAU = { flow: 0.9, glow: 0.28 } as const

/**
 * What one particle through a pore adds to that pore's glow.
 *
 * Set against `TAU.glow` so a pore working at the capacity the reference pace gives it sits
 * at the ceiling and one that has stopped passing anything falls dark in about a third of a
 * second. It's a per-pore figure, so the two knits' *vents* are about equally bright — what
 * differs is how many of them there are, which is the honest reading: capacity per unit of
 * open area is a property of the fabric, and there is simply more of it in one of them.
 */
const GLOW_STEP = 0.18

/**
 * How much capacity a pore is allowed to bank while nothing is using it.
 *
 * A pore's allowance is a token bucket — `cap × dt` a second, one token per particle. It has
 * to be a bucket rather than a "busy until" timestamp, and that was a real bug: a pore held
 * closed for `1/cap` seconds after each pass passes *at most one particle per frame*
 * whatever `cap` says, so the tunnel's throughput came out as a function of the timestep
 * rather than of the fabric. The open reference channel read 18% through with nothing across
 * it, which is what gave it away.
 *
 * Two tokens rather than one, so a pore that has been idle for a moment can take the pair of
 * particles that arrive together — but not a whole second's worth, which would let the field
 * pay off a queue in one frame. Two *or* two frames' worth of capacity, whichever is larger:
 * a pore wide enough to pass more than two particles a frame must not be held to two, and
 * the diagnostic open channel in `scripts/air.mjs` is exactly that pore.
 */
const BANK = 2

/* The fabrics
   ------------------------------------------------------------------ */

export type FabricId = 'now' | 'next'

export type FabricSpec = {
  id: FabricId
  /** What the plate says, big. The comparison has to be readable in one word. */
  tag: string
  /**
   * Pores across the height of the channel.
   *
   * Fewer than a fabric has, and set by what a reader can *count*: total capacity is
   * `CAP × porosity` however it's divided up, so the count changes nothing about the physics
   * and everything about the picture. Divided finely, each pore came out narrower than the
   * membrane is thick and the two knits both read as a continuous chain of beads — same
   * porosity, no visible difference. At three against eight the openings are wider than the
   * yarn and the answer to "how many ways out are there" is a number you can see.
   */
  pores: number
  /**
   * Fraction of the fabric that is open. The ratio between the two tunnels' airflow is the
   * ratio of these two numbers, by construction — see `CAP`.
   */
  porosity: number
}

/**
 * The two knits. **Both numbers in each are placeholder**, and they're the ones on screen,
 * so they need someone who owns the real spec before this ships — the same caveat the
 * call-out labels and the prose copy carry. What isn't placeholder is the relationship: the
 * section's headline figure is measured off these two fields at runtime rather than typed
 * in, so changing a porosity here changes the claim on the page and nothing has to agree
 * with it separately.
 *
 * `now` first, because the page is arguing from what the fabric does today.
 */
export const FABRICS: readonly [FabricSpec, FabricSpec] = [
  { id: 'now', tag: 'today', pores: 3, porosity: 0.18 },
  { id: 'next', tag: 'next', pores: 8, porosity: 0.44 },
]

/**
 * The pace the model is tuned at, the range the slider covers, and what it opens on.
 *
 * `ref` is the pace every constant in this file is tuned at — `windFor` is `pace / ref`, so the
 * reference is where the wind is 1 and the model is at its designed operating point. Moving it
 * moves the *whole* range the physics sees, which is why `LIFE.inside` had to grow with it: at
 * the bottom of the slider a parcel's transit is twice what it is at the reference, and if that
 * approaches its allowance the population stops being uniform in age and the field runs hotter
 * than `predict()` says it does. `scripts/air.sh` is what holds the two together.
 */
export const PACE = { min: 4, max: 12, ref: 8 } as const

/** Pace in km/h → the dimensionless wind the model runs on. */
export const windFor = (pace: number) => pace / PACE.ref

/* Pore geometry. Shared with the drawing, so the membrane on screen is the membrane the
   particles are tested against rather than a picture of one.
   ------------------------------------------------------------------ */

/** Height of one pore, as a fraction of the channel. */
export const poreHeight = (spec: FabricSpec) => spec.porosity / spec.pores

/** Which pore's lane a height falls in. */
export const poreAt = (y: number, pores: number) =>
  Math.min(pores - 1, Math.max(0, Math.floor(y * pores)))

/** The centre of pore `k`. Evenly spaced, so the solid runs between them are equal too. */
export const poreCentre = (k: number, pores: number) => (k + 0.5) / pores

/**
 * The solid runs of the fabric, top to bottom — everything that isn't a pore.
 *
 * The drawing needs these and the physics doesn't (a particle only ever asks about the pore
 * it's in front of), which is exactly why they're derived here from the same two numbers
 * rather than laid out twice.
 */
export const solids = (spec: FabricSpec): [number, number][] => {
  const half = poreHeight(spec) / 2
  const runs: [number, number][] = []
  let at = 0
  for (let k = 0; k < spec.pores; k++) {
    const c = poreCentre(k, spec.pores)
    runs.push([at, c - half])
    at = c + half
  }
  runs.push([at, 1])
  return runs
}

/* The pool
   ------------------------------------------------------------------ */

export type Air = {
  spec: FabricSpec
  /** Pool size. Nothing in this module allocates after `createAir`. */
  n: number
  x: Float32Array
  y: Float32Array
  vx: Float32Array
  vy: Float32Array
  /** 1 at the skin, 0 by the far edge. What the colour is taken from. */
  heat: Float32Array
  /** Seconds since release. Drives the wander, so it has to be per particle. */
  age: Float32Array
  /** Seconds left. Zero is dead, and dead is the free list. */
  life: Float32Array
  seed: Float32Array
  /** Where the free-list scan starts, so injection isn't O(n) per particle. */
  cursor: number
  /** Each pore's allowance, in particles. A pore with less than one is closed. */
  tokens: Float32Array
  /** How lit each pore's mouth is — recent flux, smoothed, for the glow. */
  glow: Float32Array

  /* Counters. `dropped` is the one that would invalidate a reading: it means the pool
     filled and the emitter was refused, which turns a measurement into a clamp.
     `scripts/air.mjs` asserts it stays at zero. */
  emitted: number
  passed: number
  dropped: number
  live: number
  /** Released by `inject` this step, and consumed by `step` as the in-rate's numerator. */
  pending: number

  /* Smoothed measurements, and the only things the component reads. */
  inRate: number
  outRate: number
  /** Fraction of the air that clears the fabric. */
  through: number
  /**
   * The microclimate's temperature: the mean `heat` of the air on the skin side.
   *
   * In the same units as `heat` and bounded by `HOT`, so it needs no normalising constant —
   * which is the property every earlier version of this reading lacked.
   */
  load: number
  /** Live particles in the microclimate. What the skin's heat output is divided among. */
  inside: number
}

/**
 * Pool size.
 *
 * Steady state at the reference pace is ~740 per tunnel and ~1230 at the top of the pace
 * Steady state is ~1180 in the closed channel at the reference pace and ~1840 at the top of the
 * pace range, where emission is up two thirds and the back-pressure has slowed everything down
 * (measured — `scripts/air.mjs`). This leaves that worst case with room, so the emitter is
 * never refused: a refusal would turn every figure on screen into a measurement of the pool
 * rather than of the fabric.
 *
 * Sized tightly rather than generously, and the harness's headroom check is what keeps that
 * honest. Both loops iterate the whole pool, dead slots included, so slack here is slack paid
 * for every frame — and a compact live list to avoid that is complexity for a ratio that is
 * only ever about 1.2 at the pace where it matters.
 *
 * It's a drawing decision, not a physical one — `load` is normalised against a physical
 * maximum rather than against this, so resizing the pool can't move a temperature.
 */
const POOL = 2400

export function createAir(spec: FabricSpec, n = POOL): Air {
  return {
    spec,
    n,
    x: new Float32Array(n),
    y: new Float32Array(n),
    vx: new Float32Array(n),
    vy: new Float32Array(n),
    heat: new Float32Array(n),
    age: new Float32Array(n),
    life: new Float32Array(n),
    seed: new Float32Array(n),
    cursor: 0,
    tokens: new Float32Array(spec.pores),
    glow: new Float32Array(spec.pores),
    emitted: 0,
    passed: 0,
    dropped: 0,
    live: 0,
    pending: 0,
    inside: 0,
    inRate: 0,
    outRate: 0,
    through: 0,
    load: 0,
  }
}

/* The emitter
   ------------------------------------------------------------------ */

/** One release: where on the skin, how hard, and the seed that shapes its whole life. */
export type Puff = { y: number; v: number; seed: number }

/**
 * Mulberry32. Small, fast, and seeded — which is the only property that matters here:
 * `Math.random()` would cost the section its reproducibility, and reproducibility is what
 * lets the harness quote a number the page will also show.
 */
export const rng = (seed: number) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * The emitter, in front of the tunnels rather than inside either of them.
 *
 * Emission is `EMIT × wind` particles a second, accumulated across frames so a slow frame
 * releases more rather than the rate quietly depending on the frame rate. The whole list
 * goes to both tunnels — that's the experiment.
 */
export function puffs(next: () => number, dt: number, wind: number, carry: number) {
  const want = carry + EMIT * wind * dt
  const count = Math.floor(want)
  const list: Puff[] = []
  for (let i = 0; i < count; i++) {
    list.push({ y: EDGE + next() * (1 - 2 * EDGE), v: next(), seed: next() })
  }
  return { list, carry: want - count }
}

/** First dead slot at or after the cursor, or -1 if the pool is full. */
const free = (air: Air) => {
  for (let i = 0; i < air.n; i++) {
    const at = (air.cursor + i) % air.n
    if (air.life[at] <= 0) {
      air.cursor = (at + 1) % air.n
      return at
    }
  }
  return -1
}

export function inject(air: Air, list: Puff[], wind: number) {
  for (const puff of list) {
    const i = free(air)
    if (i < 0) {
      air.dropped++
      continue
    }
    /* Spread across the first hundredth of the channel rather than all on one line: a
       column of particles appearing at exactly x = OUTSIDE reads as an emitter, and what's
       wanted is air already moving past a surface. */
    air.x[i] = OUTSIDE + puff.seed * 0.01
    air.y[i] = puff.y
    air.vx[i] = DRIVE * wind * (0.55 + puff.v * 0.7)
    air.vy[i] = 0
    /* Ambient, with a little variance — a mass of particles at exactly one temperature reads
       as a colour fill rather than as air, and the gradient from here to the skin is doing
       most of the storytelling. */
    air.heat[i] = 0.06 + puff.v * 0.14
    air.age[i] = 0
    air.life[i] = LIFE.blocked
    air.seed[i] = puff.seed
    air.emitted++
    air.pending++
  }
}

/* The flow field
   ------------------------------------------------------------------ */

/** What the flow is doing at a point: where it's pulling, how hard, and whether it's getting in. */
export type Flow = {
  /** Forward speed the flow is pulling towards, in channel widths per second. */
  vx: number
  /** How fast that pull is applied, per second. */
  pull: number
  /** Vertical acceleration, in channel heights per second squared. */
  ay: number
  /** Whether a pore is taking this parcel of air. */
  open: boolean
}

/**
 * The rule, at one point, for one parcel of air.
 *
 * **Pulled out of `step` so that anything wanting to *trace* the field obeys the same rule
 * rather than a copy of it.** `lab/WindTunnel.tsx` draws one of its three looks as
 * streamlines, which means integrating probes through this field — and a second
 * implementation of a four-branch flow rule sitting in a renderer is exactly the thing that
 * drifts. `step` is now the only caller that also spends pore capacity; the tracer passes its
 * own `admits`.
 *
 * `admits` rather than reading `air.tokens` directly, because a streamline is not a particle:
 * it can't consume a token, and which strands get through has to come from the measured
 * throughput instead. See `drawLines`.
 *
 * It takes `vy` and not `vx`, which looks lopsided and isn't: forward motion is expressed as a
 * target the caller relaxes towards, and sideways motion as an acceleration — so the only one
 * of the two this needs to know is the one it damps.
 */
export function flowAt(
  air: Air,
  x: number,
  y: number,
  vy: number,
  seed: number,
  age: number,
  drive: number,
  admits: (pore: number) => boolean,
): Flow {
  const { pores } = air.spec
  const half = poreHeight(air.spec) / 2

  /**
   * The wander, and it is not a random walk.
   *
   * Two sinusoids, one keyed on the parcel's own age and one on where it is, both phased by
   * its seed. That buys two things a `Math.random()` per step would cost: the field is
   * reproducible frame for frame, and a paired particle in the other channel is shaken
   * *identically* — so when one gets through and its twin doesn't, the fabric is the only
   * thing that can have decided it.
   */
  const swirl = Math.sin(age * 5.7 + seed * 6.2832) * 0.7 + Math.sin(x * 21 + seed * 12.566) * 0.3

  if (x < WALL - MOUTH) {
    /* Bending towards the opening it's going to use, with the authority ramping up as it gets
       closer — see `APPROACH`. Every lane belongs to some pore, so this is a flow field
       converging on a row of holes rather than a set of particles being aimed. */
    let ay = swirl * TURB
    if (x > WALL - REACH) {
      const c = poreCentre(poreAt(y, pores), pores)
      const near = (x - (WALL - REACH)) / (REACH - MOUTH)
      ay += (c - y) * APPROACH * near
    }
    return { vx: drive, pull: FOLLOW, ay, open: false }
  }

  if (x < WALL) {
    const k = poreAt(y, pores)
    const c = poreCentre(k, pores)
    if (Math.abs(y - c) < half && admits(k)) {
      // A nozzle: squeezed onto the pore's centreline and accelerated through it.
      return { vx: drive * JET, pull: FOLLOW * 2, ay: (c - y) * CONVERGE, open: true }
    }
    /* The membrane. Forward velocity bleeds off into the boundary layer and the flow turns,
       washing along the outside face towards the nearest opening — which is what a knit's face
       actually does to the air arriving at it, and what queues the refused air into bands
       rather than into an even fog.

       The turn is ramped with how close to the face the parcel is: free-stream speed at the
       outer edge of the layer, fully reversed at the fabric. Applied flat, refused air turned
       around the moment it entered the layer and the mass banked up against the *edge* of it —
       a band of empty channel between the air and the thing stopping it, which reads as a bug
       rather than as a boundary layer. */
    const close = (x - (WALL - MOUTH)) / MOUTH
    return {
      vx: drive * (1 - close * (1 + BACK)),
      pull: FOLLOW,
      ay: Math.sign(c - y) * WASH + swirl * TURB * 1.6,
      open: false,
    }
  }

  // Through, and into the microclimate.
  return {
    vx: drive * WAKE,
    pull: FOLLOW * 0.7,
    ay: swirl * TURB * 0.5 + Math.sign(y - 0.5) * SPREAD - vy * DAMP,
    open: false,
  }
}

/* The step
   ------------------------------------------------------------------ */

/** Exponential smoothing factor for a time constant, at this timestep. */
const lag = (dt: number, seconds: number) => 1 - Math.exp(-dt / seconds)

/** `lib/remap`'s, redeclared — this file imports nothing, see the note at the top. */
const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v))

export function step(air: Air, dt: number, wind: number) {
  const { pores } = air.spec
  const poreH = poreHeight(air.spec)
  const drive = DRIVE * wind
  /** Particles per second this one pore can pass. */
  const cap = CAP * poreH * wind ** PACE_LAW
  const bank = Math.max(BANK, cap * dt * BANK)
  const glowFade = lag(dt, TAU.glow)
  /**
   * The skin's heat output, shared among the air currently in the microclimate — see `FLUX`.
   *
   * Read off last step's count, which is the only sense in which a particle can know how much
   * company it has. One frame of lag on a population that turns over in seconds is not a thing
   * anyone could measure.
   */
  const soak = (FLUX * wind) / Math.max(MIN_INSIDE, air.inside)

  for (let k = 0; k < pores; k++) {
    air.tokens[k] = Math.min(bank, air.tokens[k] + cap * dt)
    air.glow[k] -= air.glow[k] * glowFade
  }

  /* Hoisted rather than written inline at the call, so the closure is built once a step
     instead of once a particle. */
  const tokenAdmits = (k: number) => air.tokens[k] >= 1

  let passN = 0
  let warmth = 0
  let insideN = 0
  let liveN = 0

  for (let i = 0; i < air.n; i++) {
    if (air.life[i] <= 0) continue
    const left = air.life[i] - dt
    if (left <= 0) {
      air.life[i] = 0
      continue
    }
    air.life[i] = left

    const x0 = air.x[i]
    const seed = air.seed[i]
    const age = (air.age[i] += dt)
    let x = x0
    let y = air.y[i]
    let vx = air.vx[i]
    let vy = air.vy[i]

    const f = flowAt(air, x, y, vy, seed, age, drive, tokenAdmits)
    const allowed = f.open
    vx += (f.vx - vx) * f.pull * dt
    vy += f.ay * dt

    x += vx * dt
    y += vy * dt

    /* The crossing, resolved after integration rather than before it: whether a particle
       got through is a fact about where it ended up, and a pore's capacity has to be spent
       at the moment it's used or two particles in one frame both pass through a pore that
       could only take one. */
    if (x0 < WALL && x >= WALL) {
      if (allowed) {
        const k = poreAt(y, pores)
        air.tokens[k] -= 1
        air.glow[k] = Math.min(1, air.glow[k] + GLOW_STEP)
        air.life[i] = LIFE.inside
        air.passed++
        passN++
      } else {
        /* It didn't. Held just short of the face, with what forward speed it had turned
           around. Short of, and not at: the fabric is drawn from `WALL` outward (see
           `drawTunnel`), so anything held exactly there is painted inside the yarn. */
        x = WALL - 0.002
        vx = -Math.abs(vx) * 0.3
      }
    }

    if (y < EDGE) {
      y = EDGE
      vy = Math.abs(vy) * 0.4
    } else if (y > 1 - EDGE) {
      y = 1 - EDGE
      vy = -Math.abs(vy) * 0.4
    }

    if (x < OUTSIDE) {
      x = OUTSIDE
      vx = Math.abs(vx) * 0.2
    }

    // Out of the frame, and out of the pool with it.
    if (x > 1.03) {
      air.life[i] = 0
      continue
    }

    air.x[i] = x
    air.y[i] = y
    air.vx[i] = vx
    air.vy[i] = vy

    /**
     * Temperature. Only the microclimate has one — outside air is ambient and stays ambient,
     * because nothing in this frame is warming it.
     *
     * `soak` is the skin's whole output divided by the company each particle is keeping, so a
     * flushed microclimate warms slowly and a still one warms fast. See `FLUX`.
     */
    if (x > WALL) {
      air.heat[i] = Math.min(HOT, air.heat[i] + soak * dt)
      warmth += air.heat[i]
      insideN++
    }
    liveN++
  }

  air.live = liveN
  air.inside = insideN

  /**
   * The readouts.
   *
   * `through` is a ratio of two smoothed *rates* rather than of two running totals, so it
   * answers "what is this fabric doing now" rather than "what has it done since the section
   * came on screen" — which is the reading that has to respond when the pace changes.
   */
  const flow = lag(dt, TAU.flow)
  air.inRate += (air.pending / dt - air.inRate) * flow
  air.outRate += (passN / dt - air.outRate) * flow
  air.through = air.inRate > 1 ? Math.min(1, air.outRate / air.inRate) : 0
  /**
   * The microclimate's temperature: the *mean* of what's in it, not the total.
   *
   * A mean is what "how hot is the air against your skin" means, and it needs no normalising
   * constant at all — it's already in the same units as `heat`, bounded by `HOT`. Every
   * earlier version of this reading was a total divided by some invented maximum, and each
   * one moved whenever the pool was resized for drawing reasons.
   *
   * An empty microclimate has no temperature, so it holds the last one rather than reading
   * zero: a channel that has just been switched on is not a cool channel.
   */
  if (insideN > 0) air.load += (warmth / insideN - air.load) * flow
  air.pending = 0
}

/**
 * The alpha a particle is drawn at, 0..1 — its own fade in and out, and nothing else.
 *
 * In here rather than in the drawing because it's a property of the particle's life, not of how
 * it's painted — and because the two would otherwise be two sets of constants that have to
 * agree about when a particle exists.
 */
export const alphaOf = (air: Air, i: number) =>
  Math.min(1, air.age[i] / FADE.in) * Math.min(1, air.life[i] / FADE.out)

/* Readings the component turns into figures. Kept here so the mapping from a measured field
   to a number on screen is one place.
   ------------------------------------------------------------------ */

/**
 * The microclimate, in °C over ambient.
 *
 * **The measurement is real and the conversion is invented**, and the two halves of that are
 * worth keeping apart. `load` is the mean temperature of the air on the skin side, read off a
 * genuine field, in the model's own heat units. Turning that into degrees needs a heat-transfer
 * model this prototype doesn't have, so `RISE` is chosen to put the closed knit at about +7 °C
 * at a 12 km/h pace — the sort of figure a microclimate under running kit actually sits at.
 * It's placeholder in exactly the way the porosities are, and it's the number to check with
 * someone who owns the real data first.
 *
 * **There is no floor to subtract any more**, and losing it is the clearest sign the reversal
 * was worth making. When the flow ran the other way this measured a total, so it had to have
 * the load of a fabric-less channel taken off it — air merely in transit past where a fabric
 * would be, counted as heat a fabric was holding, and a constant that had to be measured and
 * kept up to date. A mean temperature needs none of it: the reading has a floor, but the model
 * *earns* it rather than having it subtracted. A channel with nothing across it still comes out
 * at about +2.6 °C, because a body under moving air still warms the air moving over it, and
 * only an infinite draught would read ambient. `scripts/air.mjs` checks the ordering instead —
 * open coolest, closed hottest — which is the property that has to hold.
 */
const RISE = 3.9

export const riseOf = (load: number) => load * RISE

/** Both tunnels' figures at once, which is what the verdict line is. */
export const verdict = (now: Air, next: Air) => ({
  /** How much more air the open knit moves. Measured, not typed in. */
  ratio: now.through > 0.001 ? next.through / now.through : 0,
  /** And how much cooler it keeps the skin. */
  drop: Math.max(0, riseOf(now.load) - riseOf(next.load)),
})

/* The readout, in closed form
   ------------------------------------------------------------------ */

/**
 * What the two channels settle at, at each pace on the slider — measured, and committed.
 *
 * **The figures on screen used to be a live reading and they aren't any more.** An EMA of two
 * particle fields is never quite still: the headline sat between 2.43× and 2.47× and the last
 * digit of every figure crawled, which reads as instability rather than as liveness. What it
 * should do instead is answer the pace slider — one number per position, the same number every
 * time you come back to it.
 *
 * **And it's a table rather than a formula, which was two attempts.** The steady state *does*
 * solve in closed form, and elegantly: population and residence both cancel their winds, so the
 * microclimate's rise comes out as `FLUX / (2 · EMIT · through)` — the rise depends on the
 * fraction that gets through and on nothing else about the pace, which is the physical statement
 * as well. It agrees with the simulation to 2% over the top two thirds of the slider and drifts
 * to 12% at the bottom, because the mean of a population is only `exit / 2` if its ages are
 * uniformly distributed, and at the slowest pace they aren't. A fitted correction would have been
 * a fudge on top of an approximation.
 *
 * So these are the numbers `settle()` actually produces, one row per whole km/h, generated by
 * `scripts/air.sh` and pasted here — the same arrangement `lib/shoe.ts` has with `measure.mjs`.
 * The harness re-derives them on every run and fails if a constant above has moved without this
 * following, which is the property that makes a committed table safer than a formula rather than
 * lazier: it cannot be *approximately* right.
 *
 * Each row is `[through now, through next, load now, load next]`, and the half-steps between them
 * are interpolated.
 */
const CURVE: [number, number, number, number][] = [
  [0.3496, 0.8632, 1.9404, 0.9398], // 4 km/h
  [0.3478, 0.8217, 1.7634, 0.8253], // 5 km/h
  [0.3285, 0.81, 1.749, 0.8027], // 6 km/h
  [0.3201, 0.7895, 1.7732, 0.8074], // 7 km/h
  [0.3146, 0.7727, 1.7972, 0.8166], // 8 km/h
  [0.3089, 0.7582, 1.823, 0.8271], // 9 km/h
  [0.3024, 0.7477, 1.856, 0.8376], // 10 km/h
  [0.3003, 0.7354, 1.8832, 0.851], // 11 km/h
  [0.2977, 0.7239, 1.9062, 0.8612], // 12 km/h
]

export type Prediction = {
  /** Share of the outside air that reaches the skin, per fabric, in `FABRICS` order. */
  through: [number, number]
  /** The microclimate in °C over ambient, same order. */
  rise: [number, number]
  /** How much more air the open knit lets in. */
  ratio: number
  /** And how much cooler it keeps the skin. */
  drop: number
}

/** The settled state at a pace in km/h, straight off `CURVE`. */
export function predict(pace: number): Prediction {
  const at = clamp(pace, PACE.min, PACE.max) - PACE.min
  const lo = CURVE[Math.min(CURVE.length - 1, Math.floor(at))]
  const hi = CURVE[Math.min(CURVE.length - 1, Math.ceil(at))]
  const f = at - Math.floor(at)
  const mix = (i: number) => lo[i] + (hi[i] - lo[i]) * f

  const through: [number, number] = [mix(0), mix(1)]
  const rise: [number, number] = [riseOf(mix(2)), riseOf(mix(3))]
  return {
    through,
    rise,
    ratio: through[0] > 0.001 ? through[1] / through[0] : 0,
    drop: Math.max(0, rise[0] - rise[1]),
  }
}

/* Reduced motion, and the harness
   ------------------------------------------------------------------ */

/** The fixed timestep everything runs at. Capped rather than measured — see the loop. */
export const STEP = 1 / 60

/**
 * Run a pair of tunnels from empty to steady state and stop.
 *
 * This is what reduced motion is served with: one settled frame, drawn once, showing the
 * same comparison the moving version makes. It's also what the harness measures, so the
 * numbers quoted in the comments above are numbers from this function.
 *
 * Eight seconds, and the figure matters: it has to clear the longest life in the model —
 * `LIFE.inside` is 5 — or the field is still filling and every reading is low. At 2.6 the
 * closed channel measured a little over half its true steady-state population, which reads as a
 * fabric doing rather better than it does. It's ~480 steps, which is about ten milliseconds.
 */
export function settle(pair: Air[], wind: number, seconds = 8, seed = 0x5eed) {
  const next = rng(seed)
  let carry = 0
  for (let t = 0; t < seconds; t += STEP) {
    const emit = puffs(next, STEP, wind, carry)
    carry = emit.carry
    for (const air of pair) {
      inject(air, emit.list, wind)
      step(air, STEP, wind)
    }
  }
}
