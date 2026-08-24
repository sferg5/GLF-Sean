/**
 * Fast and Free, twice, in the same wind — and what it costs the skin.
 *
 * This is the physics and nothing else. `lab/Perforation.tsx` is the picture and the loop,
 * `components/Perforation.tsx` is the section. Same split as `lib/air.ts` /
 * `lab/WindTunnel.tsx` / `components/Fabric.tsx`, and for the same reason: the model is the part
 * worth testing headlessly.
 *
 * **What this asks that `lib/air.ts` doesn't.** That model is a particle transport test: puffs are
 * emitted, tested against a wall's open fraction, and either pass or don't. It answers *how much
 * gets through*, cheaply and well. This one solves the flow field itself — semi-Lagrangian
 * advection, Jacobi pressure projection, vorticity confinement — against a membrane whose
 * permeability is built cell by cell from a perforation diameter and pitch. What that buys is air
 * *accelerating* through a hole because continuity demands it, stagnation banking up on the
 * upstream face, and jets shedding into a wake behind.
 *
 * **And then it carries heat, which is the whole point of the section.** Airflow is the mechanism;
 * cooling is the claim. So a temperature field rides on the velocity field: the skin at the right
 * edge is a heat source, air arriving from outside is at ambient, and the microclimate between the
 * knit and the skin is where the two compete. A closed knit lets little through, so heat banks up
 * against the skin. An open one flushes it, so the same body heat leaves as fast as it arrives.
 * The temperature is *solved*, not asserted — change the open area and the skin figure moves
 * because the flow moved.
 *
 * **The two specimens are the ones `lib/air.ts` already committed to.** 18% open and 44% open, the
 * current Fast and Free knit and the new one. Those numbers are in that file, they are what
 * `scripts/air.sh` asserts against, and there is no reason for two models of the same pair of
 * fabrics to disagree about how open they are.
 *
 * **Every figure is solver-derived and none of it is measured.** The perforation geometry behind
 * each porosity is plausible rather than specified, and the conversion from solver units to °C and
 * to cfm/ft² is a scale factor chosen to land in the right order of magnitude. Same caveat
 * `lib/air.ts` carries about `riseOf`, and it applies harder here because these numbers look like
 * instrument readings.
 */

/* The two specimens
   ------------------------------------------------------------------ */

export type FabricId = 'now' | 'next'

export type FabricSpec = {
  id: FabricId
  /** The product. Both channels are the same garment, which is the entire argument. */
  name: string
  /** Which version. Lower case at the point of use — the page's voice, not this file's business. */
  tag: string
  /** What changed, in a handful of words. */
  note: string
  /** Perforation diameter, mm. */
  dia: number
  /** Centre-to-centre spacing, mm. */
  pitch: number
  /**
   * Fibre drag inside a partially-open cell, 0–1.
   *
   * Not the same thing as blocking — the geometry already blocks, and a cell below the open
   * threshold is solid. This is the shear a tight construction adds in the cells that *are* open,
   * which is why it runs opposite to porosity.
   */
  drag: number
}

/**
 * Both knits, in the order the argument runs: what it is now, then what it becomes.
 *
 * **The porosities are `lib/air.ts`'s**, 0.18 and 0.44. The diameter and pitch behind each are
 * chosen to land on those two numbers and to differ the way the older model says they differ — it
 * describes the open knit as having *more* pores (8 against 3) rather than bigger ones, so the new
 * knit here is a finer pitch with a slightly larger hole rather than the same grid opened up. On
 * screen that reads as a denser row of smaller jets, which is what more perforations look like.
 */
export const FABRICS: readonly [FabricSpec, FabricSpec] = [
  {
    id: 'now',
    name: 'Fast and Free',
    tag: 'current',
    note: 'today’s knit',
    dia: 0.395,
    pitch: 2.5,
    drag: 0.26,
  },
  {
    id: 'next',
    name: 'Fast and Free',
    tag: 'new',
    note: 'engineered open knit',
    dia: 0.61,
    pitch: 1.4,
    drag: 0.12,
  },
]

export const byId = (id: FabricId): FabricSpec => (id === 'next' ? FABRICS[1] : FABRICS[0])

/* Pace
   ------------------------------------------------------------------ */

/**
 * The reader's one variable, in km/h, and what the model is tuned at.
 *
 * **A pace and not a wind speed**, unlike the version of this file that showed seven fabrics. The
 * claim is about cooling during activity, so the number the reader moves should be the activity —
 * an easy jog, a hard one — rather than a figure in metres per second that they then have to
 * convert into an effort. Same reasoning, and the same units, as `PACE` in `lib/air.ts`.
 */
export const PACE = { min: 3, max: 17, ref: 9, step: 0.5 }

/** Solver wind for a pace. 1 at the reference, which is where every constant below is tuned. */
export const windFor = (pace: number) => (0.34 + 0.66 * (pace / PACE.ref)) * 1.15

/**
 * Where the membrane stands, as a fraction of the channel's width.
 *
 * Same value as `WALL` in `lib/air.ts` and deliberately so: the axis marks over both bench tests
 * mean the same thing, and a reader who has seen one should not have to re-learn where the fabric
 * is. Outside air arrives at the left edge, skin is at the right.
 */
export const WALL = 0.365

/** Physical scale of one solver cell, mm. Sets how many perforations fit the channel's height. */
const MM_PER_CELL = 0.3

/** Membrane thickness, in cells. Thin enough for a sharp jet, thick enough to hold a pressure. */
const THICKNESS = 4

/** A cell this closed is solid. Below it the flow goes round rather than through. */
const SOLID_AT = 0.07

/** Pressure iterations. Two fields now run per frame, so this is half the frame budget. */
const ITERATIONS = 6

/* Heat
   ------------------------------------------------------------------ */

/**
 * Body heat, per cell per step, in the band of channel against the skin.
 *
 * A constant: the runner produces heat at a rate that has nothing to do with how open their shirt
 * is, and making the source depend on the fabric would beg the question the section is asking.
 */
const SKIN_HEAT = 0.055

/**
 * How wide the microclimate is, as a fraction of the channel — the layer of air held between the
 * inside face of the knit and the skin.
 *
 * **Wider than it first was, and the first value was wrong.** At 0.17 the body warmed only a thin
 * film against the right wall, so on screen the heat was a stripe at the far edge and the whole gap
 * behind the knit — the space the argument is actually about — rendered as cold as the outside air.
 * The trapped layer under a running shirt is not a film; it is everything between the fabric and
 * you, which is where the knit's open area does its work.
 */
const SKIN_BAND = 0.42

/**
 * Loss to everything that isn't airflow: conduction into the fabric, radiation, air moving along
 * the garment rather than across this slice.
 *
 * **Without it the model has no steady state.** A closed knit passes almost nothing, so almost
 * nothing leaves through the outlet either, and a heat source with no sink integrates forever —
 * the closed channel would climb until it saturated the ramp no matter how the rest was tuned.
 * With it, a stagnant cell settles at `SKIN_HEAT / LEAK` and airflow is what pulls it below that.
 * So this constant sets the top of the scale and the flushing sets where each fabric lands on it.
 */
const LEAK = 0.009

/** A little smearing, so the microclimate reads as a body of warm air rather than as filaments. */
const SPREAD = 0.09

/* The field
   ------------------------------------------------------------------ */

export type Field = {
  w: number
  h: number
  u: Float32Array
  v: Float32Array
  /** Advection source buffers. Reused rather than allocated per step. */
  u0: Float32Array
  v0: Float32Array
  p: Float32Array
  div: Float32Array
  curl: Float32Array
  /** Speed magnitude, refreshed at the end of every step so the renderer never recomputes it. */
  spd: Float32Array
  /** Air temperature above ambient, in solver units. This is what the picture is now coloured by. */
  temp: Float32Array
  temp0: Float32Array
  /** Per-cell open fraction, 0–1. Only the membrane band is ever anything but 1. */
  perm: Float32Array
  /** Derived from `perm`: 1 where the flow must go round. */
  solid: Uint8Array
  band: number
  thickness: number
  /** First column of the microclimate. */
  skin: number
  /** Mean open fraction across the band — the knit's open area as solved, not as specified. */
  porosity: number
  wind: number
  drag: number
  /** Step counter. Drives the inflow perturbation, and nothing reads a random number. */
  tick: number
}

/**
 * Rows per channel.
 *
 * Fewer than the single-channel version had, because there are two of them now and the pressure
 * solve is the frame. Sixty still puts seven perforations across the current knit and thirteen
 * across the new one, which is the comparison legible at a glance.
 */
const ROWS = 60

/** Columns for a channel of this aspect, clamped so a very wide or very tall box stays affordable. */
export const columnsFor = (aspect: number) =>
  Math.max(150, Math.min(300, Math.round(ROWS * aspect)))

export function createField(aspect: number): Field {
  const w = columnsFor(aspect)
  const h = ROWS
  const n = w * h
  const f: Field = {
    w,
    h,
    u: new Float32Array(n),
    v: new Float32Array(n),
    u0: new Float32Array(n),
    v0: new Float32Array(n),
    p: new Float32Array(n),
    div: new Float32Array(n),
    curl: new Float32Array(n),
    spd: new Float32Array(n),
    temp: new Float32Array(n),
    temp0: new Float32Array(n),
    perm: new Float32Array(n).fill(1),
    solid: new Uint8Array(n),
    band: Math.round(w * WALL),
    thickness: THICKNESS,
    skin: Math.round(w * (1 - SKIN_BAND)),
    porosity: 1,
    wind: 1.2,
    drag: 0.19,
    tick: 0,
  }
  f.u.fill(f.wind)
  return f
}

/**
 * Cut the perforations.
 *
 * **Coverage is supersampled rather than rounded.** At 0.3mm a cell, a 0.45mm hole is 1.5 cells
 * across: rounded to the nearest cell the two fabrics would differ by a whole cell per hole and
 * the geometry would be a caricature of itself. Sampled eight times down each cell's height
 * instead, a cell carries the *fraction* of itself that is hole, and a fraction is something the
 * resistance term can use.
 */
/**
 * The open area a geometry actually solves to, without building a field for it.
 *
 * The same supersample `buildMembrane` runs, factored out so a label can state a knit's open area
 * on the first paint rather than waiting for a reading. It differs from the naive `dia / pitch` by
 * a few tenths, because a row is sampled in eighths — and the solved figure is the honest one,
 * since it is the geometry the flow is actually meeting.
 */
export function porosityOf(spec: FabricSpec): number {
  const pitchCells = Math.max(1.2, spec.pitch / MM_PER_CELL)
  const diaCells = Math.max(0.05, spec.dia / MM_PER_CELL)
  const S = 8
  let open = 0
  for (let j = 0; j < ROWS; j++) {
    let hits = 0
    for (let s = 0; s < S; s++) {
      const y = j + (s + 0.5) / S
      const t = y / pitchCells
      if ((t - Math.floor(t)) * pitchCells < diaCells) hits++
    }
    open += hits / S
  }
  return open / ROWS
}

export function buildMembrane(f: Field, spec: FabricSpec): void {
  const pitchCells = Math.max(1.2, spec.pitch / MM_PER_CELL)
  const diaCells = Math.max(0.05, spec.dia / MM_PER_CELL)
  const S = 8
  let open = 0

  f.drag = spec.drag

  for (let j = 0; j < f.h; j++) {
    let hits = 0
    for (let s = 0; s < S; s++) {
      const y = j + (s + 0.5) / S
      const t = y / pitchCells
      if ((t - Math.floor(t)) * pitchCells < diaCells) hits++
    }
    const coverage = hits / S
    open += coverage
    for (let t = 0; t < f.thickness; t++) {
      const k = f.band + t + j * f.w
      f.perm[k] = coverage
      f.solid[k] = coverage < SOLID_AT ? 1 : 0
    }
  }

  f.porosity = open / f.h
}

/* The step
   ------------------------------------------------------------------ */

/** Inflow at the left, outflow at the right, free-slip top and bottom. */
function bounds(f: Field): void {
  const { w, h, u, v, p, temp } = f
  for (let j = 0; j < h; j++) {
    const a = j * w
    u[a] = f.wind
    v[a] = 0
    u[a + 1] = f.wind
    v[a + 1] *= 0.4
    /* Air arriving from outside is at ambient, always. It is the reference the whole scale is
       measured against. */
    temp[a] = 0
    temp[a + 1] = 0

    const b = w - 1 + j * w
    u[b] = u[b - 1]
    v[b] = v[b - 1]
    p[b] = 0
    /* Zero-gradient at the outlet, so warmed air leaves rather than piling against the wall. */
    temp[b] = temp[b - 1]
  }
  for (let i = 0; i < w; i++) {
    u[i] = u[i + w]
    v[i] = 0
    const k = i + (h - 1) * w
    u[k] = u[k - w]
    v[k] = 0
  }
}

/** Semi-Lagrangian backtrace. Solid cells hold zero rather than sampling through the membrane. */
function advect(f: Field, d: Float32Array, src: Float32Array, keepInSolid: boolean): void {
  const { w, h, u0, v0, solid } = f
  for (let j = 1; j < h - 1; j++) {
    for (let i = 1; i < w - 1; i++) {
      const k = i + j * w
      if (solid[k]) {
        if (!keepInSolid) d[k] = 0
        continue
      }
      let x = i - u0[k]
      let y = j - v0[k]
      if (x < 0.5) x = 0.5
      else if (x > w - 1.5) x = w - 1.5
      if (y < 0.5) y = 0.5
      else if (y > h - 1.5) y = h - 1.5
      const i0 = x | 0
      const j0 = y | 0
      const s1 = x - i0
      const s0 = 1 - s1
      const t1 = y - j0
      const t0 = 1 - t1
      d[k] =
        s0 * (t0 * src[i0 + j0 * w] + t1 * src[i0 + (j0 + 1) * w]) +
        s1 * (t0 * src[i0 + 1 + j0 * w] + t1 * src[i0 + 1 + (j0 + 1) * w])
    }
  }
}

/**
 * Make the field divergence-free.
 *
 * A solid neighbour contributes the cell's own pressure rather than its neighbour's, which is the
 * Neumann condition written the cheap way: no flux across the membrane's faces, so the only way
 * through is a hole, so the flow through a hole has to speed up. That substitution is the entire
 * reason the jets exist — with a plain 4-neighbour stencil the air leaks through the fabric and
 * the picture is a uniform drift.
 */
function project(f: Field): void {
  const { w, h, u, v, p, div, solid } = f

  for (let j = 1; j < h - 1; j++) {
    for (let i = 1; i < w - 1; i++) {
      const k = i + j * w
      if (solid[k]) {
        div[k] = 0
        p[k] = 0
        continue
      }
      const ur = solid[k + 1] ? 0 : u[k + 1]
      const ul = solid[k - 1] ? 0 : u[k - 1]
      const vd = solid[k + w] ? 0 : v[k + w]
      const vu = solid[k - w] ? 0 : v[k - w]
      div[k] = -0.5 * (ur - ul + vd - vu)
      p[k] = 0
    }
  }

  for (let it = 0; it < ITERATIONS; it++) {
    for (let j = 1; j < h - 1; j++) {
      for (let i = 1; i < w - 1; i++) {
        const k = i + j * w
        if (solid[k]) continue
        const c = p[k]
        const pr = solid[k + 1] ? c : p[k + 1]
        const pl = solid[k - 1] ? c : p[k - 1]
        const pd = solid[k + w] ? c : p[k + w]
        const pu = solid[k - w] ? c : p[k - w]
        p[k] = (div[k] + pl + pr + pu + pd) * 0.25
      }
    }
  }

  for (let j = 1; j < h - 1; j++) {
    for (let i = 1; i < w - 1; i++) {
      const k = i + j * w
      if (solid[k]) {
        u[k] = 0
        v[k] = 0
        continue
      }
      const c = p[k]
      const pr = solid[k + 1] ? c : p[k + 1]
      const pl = solid[k - 1] ? c : p[k - 1]
      const pd = solid[k + w] ? c : p[k + w]
      const pu = solid[k - w] ? c : p[k - w]
      u[k] -= 0.5 * (pr - pl)
      v[k] -= 0.5 * (pd - pu)
    }
  }
}

/** Fibre shear, in the cells that are open at all. The geometry does the blocking; this is friction. */
function resist(f: Field): void {
  const { w, u, v, perm, solid } = f
  for (let j = 0; j < f.h; j++) {
    for (let t = 0; t < f.thickness; t++) {
      const k = f.band + t + j * w
      if (solid[k]) {
        u[k] = 0
        v[k] = 0
        continue
      }
      let r = 1 - f.drag * (1 - perm[k]) * 0.55
      if (r < 0.35) r = 0.35
      u[k] *= r
      v[k] *= r
    }
  }
}

/**
 * Vorticity confinement — put back the swirl that semi-Lagrangian advection eats.
 *
 * **Only downstream of the knit.** Applied across the whole field it roughens the approach flow
 * into noise, and an approach flow that arrives already turbulent has nothing to say about what
 * the fabric did to it.
 */
function confine(f: Field, eps: number): void {
  const { w, h, u, v, curl, solid } = f
  for (let j = 1; j < h - 1; j++) {
    for (let i = 1; i < w - 1; i++) {
      const k = i + j * w
      curl[k] = solid[k] ? 0 : (v[k + 1] - v[k - 1] - (u[k + w] - u[k - w])) * 0.5
    }
  }
  const from = Math.max(2, f.band - 2)
  for (let j = 2; j < h - 2; j++) {
    for (let i = from; i < w - 2; i++) {
      const k = i + j * w
      if (solid[k]) continue
      let dx = (Math.abs(curl[k + 1]) - Math.abs(curl[k - 1])) * 0.5
      let dy = (Math.abs(curl[k + w]) - Math.abs(curl[k - w])) * 0.5
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len < 1e-5) continue
      dx /= len
      dy /= len
      u[k] += eps * dy * curl[k]
      v[k] -= eps * dx * curl[k]
    }
  }
}

/**
 * The heat step: the body adds, the airflow removes, and everything else leaks.
 *
 * Run after the velocity field is divergence-free, so the temperature is carried by the flow that
 * actually exists this frame rather than by last frame's.
 */
function heat(f: Field): void {
  const { w, h, temp, temp0, solid } = f

  temp0.set(temp)
  advect(f, temp, temp0, false)

  for (let j = 1; j < h - 1; j++) {
    for (let i = 1; i < w - 1; i++) {
      const k = i + j * w
      if (solid[k]) {
        temp[k] = 0
        continue
      }
      /* The body. A constant rate over the band of air against the skin — a runner's output does
         not depend on how open their shirt is. */
      if (i >= f.skin) temp[k] += SKIN_HEAT
      /* Everything that isn't this slice's airflow. Also what gives the model a steady state. */
      temp[k] -= temp[k] * LEAK
    }
  }

  /* One smoothing pass, skipping solids so heat doesn't conduct across the knit — the fabric is an
     insulator here, and letting warmth diffuse through it would quietly undo the comparison. */
  temp0.set(temp)
  for (let j = 1; j < h - 1; j++) {
    for (let i = 1; i < w - 1; i++) {
      const k = i + j * w
      if (solid[k]) continue
      let sum = 0
      let n = 0
      if (!solid[k - 1]) {
        sum += temp0[k - 1]
        n++
      }
      if (!solid[k + 1]) {
        sum += temp0[k + 1]
        n++
      }
      if (!solid[k - w]) {
        sum += temp0[k - w]
        n++
      }
      if (!solid[k + w]) {
        sum += temp0[k + w]
        n++
      }
      if (n) temp[k] += (sum / n - temp[k]) * SPREAD
    }
  }
}

export type Stir = { x: number; y: number; dx: number; dy: number } | null

/** A drag inside the channel, in grid coordinates. The only thing here a reader can push. */
function applyStir(f: Field, stir: Stir): void {
  if (!stir) return
  const { w, h, u, v, solid } = f
  const R = 6
  const ci = stir.x | 0
  const cj = stir.y | 0
  for (let j = cj - R; j <= cj + R; j++) {
    if (j < 1 || j >= h - 1) continue
    for (let i = ci - R; i <= ci + R; i++) {
      if (i < 1 || i >= w - 1) continue
      const d2 = (i - stir.x) ** 2 + (j - stir.y) ** 2
      if (d2 > R * R) continue
      const k = i + j * w
      if (solid[k]) continue
      const weight = 1 - Math.sqrt(d2) / R
      u[k] += stir.dx * weight * 1.6
      v[k] += stir.dy * weight * 1.6
    }
  }
}

/** One step. Project, advect, resist, confine, project, then carry the heat. */
export function step(f: Field, stir: Stir): void {
  const { w, h, u, v, u0, v0, solid, spd } = f
  f.tick++

  /* Broadband inflow perturbation, so the wake never locks into a steady stripe. Four sines rather
     than a random number: the field has to be reproducible for a screenshot check to mean
     anything, and `Math.random()` in here would make every run a different picture. */
  for (let j = 2; j < h - 2; j++) {
    const k = 1 + j * w
    const n =
      Math.sin(j * 0.37 + f.tick * 0.031) +
      Math.sin(j * 0.11 - f.tick * 0.017) * 0.8 +
      Math.sin(j * 0.83 + f.tick * 0.0083) * 0.5 +
      Math.sin(j * 1.61 - f.tick * 0.047) * 0.3
    v[k] += n * 0.016 * f.wind
    u[k] *= 1 + Math.sin(j * 0.53 + f.tick * 0.019) * 0.025
  }

  /* A trip just aft of the knit. Perforated plates do shed unsteadily, and at this grid spacing a
     two-cell jet has no room to roll up on its own. */
  const trip = f.band + f.thickness + 1
  for (let j = 2; j < h - 2; j++) {
    const k = trip + j * w
    if (solid[k]) continue
    v[k] +=
      (Math.sin(j * 0.74 + f.tick * 0.055) + Math.sin(j * 0.23 - f.tick * 0.037) * 0.85) *
      0.03 *
      f.wind
  }

  applyStir(f, stir)
  bounds(f)
  project(f)

  u0.set(u)
  v0.set(v)
  advect(f, u, u0, false)
  advect(f, v, v0, false)

  resist(f)
  confine(f, 0.125)
  bounds(f)
  project(f)
  bounds(f)

  /* Heat last, on the settled field — and it reuses `u0`/`v0`, which still hold this step's
     velocities, as the backtrace. */
  u0.set(u)
  v0.set(v)
  heat(f)
  bounds(f)

  for (let i = 0; i < spd.length; i++) {
    spd[i] = Math.hypot(u[i], v[i])
  }
}

/** Bilinear sample of any cell-centred field, in grid coordinates. */
export function sample(f: Field, src: Float32Array, x: number, y: number): number {
  const { w, h } = f
  if (x < 0.5) x = 0.5
  else if (x > w - 1.5) x = w - 1.5
  if (y < 0.5) y = 0.5
  else if (y > h - 1.5) y = h - 1.5
  const i0 = x | 0
  const j0 = y | 0
  const s1 = x - i0
  const s0 = 1 - s1
  const t1 = y - j0
  const t0 = 1 - t1
  return (
    s0 * (t0 * src[i0 + j0 * w] + t1 * src[i0 + (j0 + 1) * w]) +
    s1 * (t0 * src[i0 + 1 + j0 * w] + t1 * src[i0 + 1 + (j0 + 1) * w])
  )
}

/* Reading the field
   ------------------------------------------------------------------ */

export type Reading = {
  /** Open area as solved, per cent. */
  porosity: number
  /** Air permeability, cfm/ft². */
  permeability: number
  /** Mean throughflow at the exit plane, in solver units — the basis of the airflow ratio. */
  through: number
  /** How far the microclimate sits above ambient, °C. The figure the section exists to produce. */
  skinRise: number
  /** Peak speed in the exit plane, m/s — what a jet reaches when continuity squeezes it. */
  jet: number
}

/** Solver cells per step to m/s. A scale factor, not a calibration — see the module note. */
export const MPS = 2.85

/**
 * Solver temperature to °C above ambient.
 *
 * Not guessed — solved. `lib/perforation.ts` imports nothing and touches no DOM, so it compiles
 * and runs under node on its own (the argument `lib/air.ts` makes for staying importless), and
 * this constant was set by settling both channels headlessly for 1600 steps at the reference pace
 * and reading the raw microclimate back: 2.118 for today's knit, 1.277 for the new one. 1.50 puts
 * today's knit at 6.0°C over ambient at the reference pace and the new one at 3.5°C, which is the
 * same order as `riseOf` in `lib/air.ts` — two models of one pair of fabrics should not disagree
 * about how warm it gets in there.
 */
export const DEG = 1.5

/**
 * The ceiling of the temperature scale: what a cell with no airflow at all settles at.
 *
 * Exposure is pinned to this rather than to each channel's own maximum, and that is the single
 * most important decision in the file. Auto-exposing per channel would normalise away the entire
 * comparison — the open knit's warmest air would render as hot as the closed knit's, because it
 * would be the warmest thing *in its own frame*. Both channels are measured against the same
 * stagnant ceiling, so cooler genuinely looks cooler.
 */
export const HOT = SKIN_HEAT / LEAK

export function measure(f: Field): Reading {
  const { w, h, u, spd, temp, solid } = f

  const exit = f.band + f.thickness
  let flux = 0
  let jet = 0
  for (let j = 1; j < h - 1; j++) {
    const k = exit + j * w
    if (!solid[k]) {
      flux += Math.max(0, u[k])
      if (spd[k] > jet) jet = spd[k]
    }
  }
  flux /= h - 2

  /* The microclimate, meaned over the band of air against the skin. This is the number the section
     is about, so it is read from the field rather than derived from the throughflow. */
  let warm = 0
  let cells = 0
  for (let j = 1; j < h - 1; j++) {
    for (let i = f.skin; i < w - 1; i++) {
      const k = i + j * w
      if (solid[k]) continue
      warm += temp[k]
      cells++
    }
  }
  warm /= Math.max(1, cells)

  return {
    porosity: f.porosity * 100,
    permeability: (flux / Math.max(0.01, f.wind)) * f.wind * MPS * 62,
    through: flux,
    skinRise: warm * DEG,
    jet: jet * MPS,
  }
}

/**
 * Both channels' figures at once, which is what the verdict line is.
 *
 * Same shape and the same two names as `verdict` in `lib/air.ts`: how much more air the open knit
 * moves, and how much cooler it keeps the skin.
 */
export const verdict = (now: Reading, next: Reading) => ({
  ratio: now.through > 0.0005 ? next.through / now.through : 0,
  drop: Math.max(0, now.skinRise - next.skinRise),
})

/* The readout, in closed form
   ------------------------------------------------------------------ */

/**
 * What the two channels settle at, at each pace on the slider — measured, and committed.
 *
 * **The figures on screen are not a live reading, and that is deliberate.** They were, and it was
 * wrong twice over. A field that has just been handed a new wind takes tens of seconds to reach its
 * new microclimate, so a reader dragging the slider watched the numbers crawl — and worse, *move
 * the wrong way first*, because a faster jet pushes warm air out of the wake and into the skin band
 * before it flushes it. A control whose figure briefly disagrees with its own direction is a
 * control nobody will trust.
 *
 * This is the same answer `lib/air.ts` reached for the same reason, in almost the same words: one
 * number per slider position, the same number every time you come back to it. The picture stays
 * live, because a picture of moving air has to move; the figures answer the slider.
 *
 * **Measured, not typed in.** `lib/perforation.ts` imports nothing and touches no DOM, so it
 * compiles and runs under node alone — both knits were settled for 1200 steps at each of eight
 * paces and the microclimate and throughflow read back. The columns are then smoothed with one
 * `[0.25, 0.5, 0.25]` pass, which is solver noise removal and not shaping: at 1200 steps the
 * throughflow ratio scatters by about ±0.15 between neighbouring paces, and a figure that jumps
 * from 3.34 to 3.07 as you nudge the slider is reporting the sample size rather than the physics.
 *
 * **The drop is not monotonic in pace, and that is the model rather than an artefact.** It runs
 * 1.8°C at a walk, peaks near 2.6°C around 11 km/h and eases to 2.1°C at 17. At the bottom there
 * is barely any airflow for the open knit to have an advantage with; at the top both knits are
 * flushed well enough that the gap between them narrows again. The advantage is largest where a
 * runner actually spends their time.
 */
const CURVE: readonly (readonly [number, number, number, number])[] = [
  /* warm-now, warm-next, through-now, through-next */
  [4.964, 3.7396, 0.08675, 0.2587],
  [4.628, 3.166, 0.10858, 0.33474],
  [4.3058, 2.7012, 0.13006, 0.41276],
  [4.0112, 2.3343, 0.15511, 0.4905],
  [3.7523, 2.0422, 0.18003, 0.56548],
  [3.4686, 1.8254, 0.20482, 0.64077],
  [3.1698, 1.6614, 0.23127, 0.72188],
  [2.9131, 1.5193, 0.25934, 0.80813],
]

/** The pace of `CURVE[0]`, and the gap between rows. */
const CURVE_FROM = 3
const CURVE_STEP = 2

export type Verdict = {
  /** Microclimate above ambient for each knit, °C, in `FABRICS` order. */
  rise: [number, number]
  /** How much more air the new knit moves. */
  ratio: number
  /** And how much cooler it keeps the skin, °C. */
  drop: number
}

/** Both channels' settled figures at a pace, interpolated between the committed rows. */
export function predict(pace: number): Verdict {
  const clamped = Math.min(PACE.max, Math.max(PACE.min, pace))
  const at = (clamped - CURVE_FROM) / CURVE_STEP
  const i = Math.max(0, Math.min(CURVE.length - 2, Math.floor(at)))
  const f = at - i
  const mix = (k: 0 | 1 | 2 | 3) => CURVE[i][k] + (CURVE[i + 1][k] - CURVE[i][k]) * f

  const rise: [number, number] = [mix(0) * DEG, mix(1) * DEG]
  const now = mix(2)
  const next = mix(3)
  return {
    rise,
    ratio: now > 0.0005 ? next / now : 0,
    drop: Math.max(0, rise[0] - rise[1]),
  }
}
