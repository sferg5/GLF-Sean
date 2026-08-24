/**
 * Air through a perforated membrane, solved rather than staged.
 *
 * This is the physics and nothing else — no canvas, no React, no colour. `lab/Perforation.tsx` is
 * the picture and the loop, `components/Perforation.tsx` is the section. Same split as
 * `lib/air.ts` / `lab/WindTunnel.tsx` / `components/Fabric.tsx`, and for the same reason: the model
 * is the part worth testing headlessly.
 *
 * **What makes it different from `lib/air.ts`.** That model is a particle transport test: puffs are
 * emitted, tested against a wall's open fraction, and either pass or don't. It answers *how much
 * gets through*, which is the question that section asks, and it answers it cheaply.
 *
 * This one solves the flow field itself — a staggered-free, collocated stable-fluids step
 * (semi-Lagrangian advection, Jacobi pressure projection, vorticity confinement) against a
 * membrane whose permeability is built cell by cell from a perforation diameter and pitch. It
 * costs a great deal more, and what it buys is everything the transport model can't have: air
 * *accelerating* through a hole because continuity demands it, stagnation banking up on the
 * upstream face, and the jets shedding into a wake behind. The reading is no longer "a fraction
 * passed" but "here is the flow, measure it" — so pressure drop and jet velocity come off the
 * field rather than out of a table.
 *
 * **Every figure it produces is solver-derived and none of it is measured.** The perforation
 * geometry per fabric is plausible rather than specified, the conversion from solver units to
 * m/s and cfm/ft² is a scale factor chosen to land in the right order of magnitude, and no
 * lululemon knit was in a wind tunnel to check any of it. Same caveat `lib/air.ts` carries about
 * `riseOf`, and it applies harder here because these numbers *look* like instrument readings.
 */

/* Specimens
   ------------------------------------------------------------------ */

export type FabricId =
  | 'warpstreme'
  | 'nulu'
  | 'luon'
  | 'nulux'
  | 'everlux'
  | 'swift'
  | 'mesh'

/** Construction family. It groups the rail, and it is the only thing in here that isn't a number. */
export type Family = 'woven' | 'knit' | 'mesh'

export type FabricSpec = {
  id: FabricId
  /** Lower case at the point of use — the page's voice, not this file's business. */
  name: string
  family: Family
  /** Three or four words. Long enough to say what the construction is, short enough for one line. */
  note: string
  /** Perforation diameter, mm. */
  dia: number
  /** Centre-to-centre spacing, mm. */
  pitch: number
  /**
   * Fibre drag inside a partially-open cell, 0–1.
   *
   * Not the same thing as blocking. The geometry already blocks — a cell below the open threshold
   * is solid and the flow has to go round it. This is the shear a tight construction adds in the
   * cells that *are* open, which is why it runs opposite to porosity: a dense woven resists across
   * its whole face, an open mesh barely touches the air passing through it.
   */
  drag: number
}

/**
 * Seven specimens, ordered by how open they are rather than by family.
 *
 * The order is the argument. Grouping by construction would put the two wovens together at
 * opposite ends of the range and bury the thing the section exists to show, which is that open
 * area is a dial and every fabric is a position on it. Family is a label on the row instead.
 */
export const FABRICS: FabricSpec[] = [
  { id: 'warpstreme', name: 'Warpstreme', family: 'woven', note: 'Tight commuter woven', dia: 0.3, pitch: 3.1, drag: 0.3 },
  { id: 'nulu', name: 'Nulu', family: 'knit', note: 'Brushed jersey knit', dia: 0.42, pitch: 2.6, drag: 0.24 },
  { id: 'luon', name: 'Luon', family: 'knit', note: 'Four-way stretch knit', dia: 0.58, pitch: 2.35, drag: 0.19 },
  { id: 'nulux', name: 'Nulux', family: 'knit', note: 'Smooth-face run knit', dia: 0.72, pitch: 2.2, drag: 0.15 },
  { id: 'everlux', name: 'Everlux', family: 'knit', note: 'Sweat-wicking knit', dia: 0.95, pitch: 2.0, drag: 0.11 },
  { id: 'swift', name: 'Swift', family: 'woven', note: 'Ripstop-face woven', dia: 1.2, pitch: 2.25, drag: 0.08 },
  { id: 'mesh', name: 'Silverescent Mesh', family: 'mesh', note: 'Engineered open mesh', dia: 1.95, pitch: 3.0, drag: 0.04 },
]

/** The reference specimen the copy is written against — the signature knit. */
export const REFERENCE: FabricId = 'luon'

export const byId = (id: FabricId): FabricSpec =>
  FABRICS.find((f) => f.id === id) ?? FABRICS[2]

/* Ranges
   ------------------------------------------------------------------ */

/**
 * Freestream, in m/s, and the pace it stands for.
 *
 * Quoted to the reader in m/s rather than km/h, unlike the old section's `PACE`: this is an
 * instrument reading against a specimen, not a runner's speed, and the pressure drop underneath is
 * quoted in Pa. Mixing a runner's unit into a bench test was the thing that made the old figures
 * read as marketing.
 */
export const WIND = { min: 0.6, max: 7.4, ref: 3.4, step: 0.1 }

export const DIA = { min: 0.1, max: 2.6, step: 0.01 }
export const PITCH = { min: 0.8, max: 6.0, step: 0.01 }

/**
 * Where the membrane stands, as a fraction of the channel's width.
 *
 * Same value as `WALL` in `lib/air.ts` and deliberately so — the axis marks above the two sections
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

/** Pressure iterations. Enough to resolve a jet; more is invisible and costs the frame. */
const ITERATIONS = 7

/* The field
   ------------------------------------------------------------------ */

export type Field = {
  /** Columns. Set from the stage's aspect so cells stay square-ish. */
  w: number
  /** Rows. Fixed, because it is what sets how many perforations are on screen. */
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
  /** Per-cell open fraction, 0–1. Only the membrane band is ever anything but 1. */
  perm: Float32Array
  /** Derived from `perm`: 1 where the flow must go round. */
  solid: Uint8Array
  /** First column of the membrane band. */
  band: number
  thickness: number
  /** Mean open fraction across the band — the specimen's open area as solved, not as specified. */
  porosity: number
  /** Freestream, in cells per step. */
  wind: number
  drag: number
  /** Step counter. Drives the inflow perturbation, and nothing reads a random number. */
  tick: number
}

const ROWS = 88

/** Columns for a stage of this aspect, clamped so a very wide or very tall box stays affordable. */
export const columnsFor = (aspect: number) =>
  Math.max(150, Math.min(320, Math.round(ROWS * aspect)))

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
    perm: new Float32Array(n).fill(1),
    solid: new Uint8Array(n),
    band: Math.round(w * WALL),
    thickness: THICKNESS,
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
 * **Coverage is supersampled rather than rounded**, which is the whole reason a slider over this
 * feels continuous. At 0.3mm a cell, a 0.42mm hole is 1.4 cells across: rounded to the nearest
 * cell, dragging the diameter would snap the membrane between two states and half the range would
 * do nothing. Sampled eight times down each cell's height instead, a cell carries the *fraction*
 * of itself that is hole, and a fraction is something the resistance term can use.
 */
export function buildMembrane(f: Field, dia: number, pitch: number, drag: number): void {
  const pitchCells = Math.max(1.2, pitch / MM_PER_CELL)
  const diaCells = Math.max(0.05, dia / MM_PER_CELL)
  const S = 8
  let open = 0

  f.drag = drag

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
  const { w, h, u, v, p } = f
  for (let j = 0; j < h; j++) {
    const a = j * w
    u[a] = f.wind
    v[a] = 0
    u[a + 1] = f.wind
    v[a + 1] *= 0.4

    const b = w - 1 + j * w
    u[b] = u[b - 1]
    v[b] = v[b - 1]
    p[b] = 0
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
function advect(f: Field, d: Float32Array, src: Float32Array, dt: number): void {
  const { w, h, u0, v0, solid } = f
  for (let j = 1; j < h - 1; j++) {
    for (let i = 1; i < w - 1; i++) {
      const k = i + j * w
      if (solid[k]) {
        d[k] = 0
        continue
      }
      let x = i - dt * u0[k]
      let y = j - dt * v0[k]
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
 * **Only downstream of the specimen.** Applied across the whole field it roughens the approach
 * flow into noise, and an approach flow that arrives already turbulent has nothing to say about
 * what the fabric did to it. Upstream stays laminar; the wake is where the energy belongs.
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

export type Stir = { x: number; y: number; dx: number; dy: number } | null

/** A drag inside the channel, in grid coordinates. The only thing here a reader can push. */
function applyStir(f: Field, stir: Stir): void {
  if (!stir) return
  const { w, h, u, v, solid } = f
  const R = 7
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

/** One step. Project, advect, resist, confine, project — Stam's order with the membrane in it. */
export function step(f: Field, stir: Stir): void {
  const { w, h, u, v, u0, v0, solid, spd } = f
  f.tick++

  /* Broadband inflow perturbation, so the wake never locks into a steady stripe. Four sines
     rather than a random number: the field has to be reproducible for a screenshot check to mean
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

  /* A trip just aft of the specimen. Perforated plates do shed unsteadily, and at this grid
     spacing a two-cell jet has no room to roll up on its own — without it the jets run parallel
     to the outlet and the wake is a set of stripes. */
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
  advect(f, u, u0, 1)
  advect(f, v, v0, 1)

  resist(f)
  confine(f, 0.125)
  bounds(f)
  project(f)
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
  /** Static pressure drop across the specimen, Pa. */
  drop: number
  /** RMS wake vorticity as a percentage of the freestream. */
  turbulence: number
  /** Peak speed in the exit plane, m/s — what a jet reaches when continuity squeezes it. */
  jet: number
  /** Freestream, m/s. */
  wind: number
}

/** Solver cells per step to m/s. A scale factor, not a calibration — see the module note. */
export const MPS = 2.85

/**
 * Read the field.
 *
 * Every number here comes off the solved flow rather than out of a table, which is the difference
 * between this section and the one it replaced: pressure drop is the mean static pressure on the
 * upstream face minus the downstream one, permeability integrates the actual mass flux through the
 * exit plane, and turbulence is RMS vorticity over the wake box. Change the geometry and they move
 * because the flow moved.
 */
export function measure(f: Field): Reading {
  const { w, h, u, p, spd, solid } = f

  const upFrom = Math.max(2, f.band - 9)
  const upTo = f.band - 3
  const downFrom = f.band + f.thickness + 3
  const downTo = Math.min(w - 3, f.band + f.thickness + 9)

  let up = 0
  let down = 0
  let rows = 0
  for (let j = 2; j < h - 2; j++) {
    for (let i = upFrom; i < upTo; i++) up += p[i + j * w]
    for (let i = downFrom; i < downTo; i++) down += p[i + j * w]
    rows++
  }
  up /= rows * Math.max(1, upTo - upFrom)
  down /= rows * Math.max(1, downTo - downFrom)

  /* Throughflow and peak jet, both in the exit plane. Mean flux is what permeability is; the peak
     is what the reader can see happening at each hole. */
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

  let vor = 0
  let count = 0
  const wakeTo = Math.min(w - 3, exit + 46)
  for (let j = 3; j < h - 3; j++) {
    for (let i = exit + 2; i < wakeTo; i++) {
      const k = i + j * w
      const omega = f.v[k + 1] - f.v[k - 1] - (u[k + w] - u[k - w])
      vor += omega * omega
      count++
    }
  }
  vor = Math.sqrt(vor / Math.max(1, count))

  const mps = f.wind * MPS
  return {
    porosity: f.porosity * 100,
    permeability: (flux / Math.max(0.01, f.wind)) * mps * 62,
    drop: Math.max(0, up - down) * 240 * ((mps * mps) / 9),
    turbulence: Math.min(99, (vor / Math.max(0.02, f.wind)) * 46),
    jet: jet * MPS,
    wind: mps,
  }
}

/**
 * Exposure window for the velocity ramp.
 *
 * **Pinned to the freestream, not to the specimen.** Auto-scaling to the field's own maximum was
 * the first thing tried and it is the wrong instrument: an open mesh barely disturbs the flow, so
 * its maximum is near ambient, so auto-exposure amplifies a flat field into a hot one and the mesh
 * reads more dramatic than the dense woven that is actually doing something. Fixing the window to
 * the approach flow means the picture only changes when the physics does — which is the entire
 * claim the section makes.
 */
export const window0 = (wind: number) => wind * 0.1
export const window1 = (wind: number) => wind * 2.5
