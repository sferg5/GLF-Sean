/**
 * A small Verlet cloth, so the samples hang and stir like fabric instead of like a
 * displaced plane.
 *
 * The constraint recipe — structural (1.0), shear (0.85), bend (0.35), heavy
 * per-frame damping, a touch of Laplacian smoothing so wrinkles relax back out —
 * follows dmitrykurash/holocloth (MIT), which is the reference for how this cloth
 * should *look*: big soft billows, tension at the held points, folds that settle.
 * What's different here is the situation: their sheet floats in zero-g gel and moves
 * only when grabbed; ours hangs from two clips in a slight breeze. So this sim adds
 * pins (snapped hard to the pose every iteration), a gentle time-varying wind field,
 * and a weak restoring pull toward the baked hung pose so the composition can drift
 * with the air but never wander off camera.
 *
 * Rest lengths come from the *flat* rectangle — the cloth always wants to be its
 * true cut — while the pose supplies the hang. Every sag, billow and pinch in the
 * pose is (near enough) an isometry of that rectangle, so the two never fight.
 *
 * This is the moving half of the repo's one clock exception. When the hero is
 * frozen (`?breeze=0`, `?p=`, reduced motion) the sim is simply never stepped and
 * the vertices are byte-for-byte the baked pose — which is what keeps the
 * verification screenshots reproducible.
 */

const SUBSTEP = 1 / 120
const MAX_SUBSTEPS = 3

/** Motion decay per 60Hz frame — air, not holocloth's gel (they run 0.6). */
const VISCOSITY = 0.08
const STIFFNESS = 1.0
const ITERATIONS = 6
/** Laplacian relax per substep — keeps the surface soft, never crumpled. */
const SMOOTHING = 0.03
/** Pull toward the baked pose per substep — starch, effectively. Light enough
    that the wind can actually take the sheet somewhere. */
const RESTORE = 0.0025

/**
 * The dials' live half — mutated by the panel, read by the sim every substep, no
 * re-render in between. `wind` scales the steady breeze, `gust` how much it
 * breathes, `force` the shove when the spray lands.
 */
export type Tuning = { wind: number; gust: number; force: number }

/** Deterministic per-index jitter, so a spray lands as droplets, not a plank. */
const jitter = (i: number) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

export class ClothSim {
  readonly count: number
  readonly positions: Float32Array
  private prev: Float32Array
  private pose: Float32Array

  private cA: Int32Array
  private cB: Int32Array
  private cRest: Float32Array
  private cMul: Float32Array
  private neighbors: Int32Array

  /** Per-vertex garment coords for the wind field (grid coords, not live ones). */
  private gx: Float32Array
  private gy: Float32Array
  /** 0 at the top edge, 1 at the hem — wind authority grows away from the clips. */
  private below: Float32Array

  private time = 0
  private cavityScratch: Float32Array
  private minStep: number

  constructor(
    readonly cols: number,
    readonly rows: number,
    /** The baked hung pose — initial state, and what RESTORE pulls toward. */
    pose: Float32Array,
    /** Flat-grid coords per vertex, x then y interleaved is avoided: two arrays. */
    grid: { gx: Float32Array; gy: Float32Array; below: Float32Array },
    /** Flat rest spacing of the true rectangle. */
    stepX: number,
    stepY: number,
    /** Vertex indices held by the clips. */
    private pins: number[],
    /** The two samples share the air but not the phase. */
    private phase: number,
    /** Live dial values — shared with the panel, read per substep. */
    private tuning: Tuning,
  ) {
    this.count = cols * rows
    this.pose = pose
    this.positions = pose.slice()
    this.prev = pose.slice()
    this.gx = grid.gx
    this.gy = grid.gy
    this.below = grid.below
    this.cavityScratch = new Float32Array(this.count)
    this.minStep = Math.min(stepX, stepY)

    const a: number[] = []
    const b: number[] = []
    const mul: number[] = []
    const rest: number[] = []
    const idx = (x: number, y: number) => y * cols + x
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (x + 1 < cols) { a.push(idx(x, y)); b.push(idx(x + 1, y)); mul.push(1.0); rest.push(stepX) }
        if (y + 1 < rows) { a.push(idx(x, y)); b.push(idx(x, y + 1)); mul.push(1.0); rest.push(stepY) }
        if (x + 1 < cols && y + 1 < rows) {
          const d = Math.hypot(stepX, stepY)
          a.push(idx(x, y)); b.push(idx(x + 1, y + 1)); mul.push(0.85); rest.push(d)
          a.push(idx(x + 1, y)); b.push(idx(x, y + 1)); mul.push(0.85); rest.push(d)
        }
        if (x + 2 < cols) { a.push(idx(x, y)); b.push(idx(x + 2, y)); mul.push(0.35); rest.push(stepX * 2) }
        if (y + 2 < rows) { a.push(idx(x, y)); b.push(idx(x, y + 2)); mul.push(0.35); rest.push(stepY * 2) }
      }
    }
    this.cA = new Int32Array(a)
    this.cB = new Int32Array(b)
    this.cMul = new Float32Array(mul)
    this.cRest = new Float32Array(rest)

    this.neighbors = new Int32Array(this.count * 4).fill(-1)
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = idx(x, y) * 4
        this.neighbors[i + 0] = x > 0 ? idx(x - 1, y) : -1
        this.neighbors[i + 1] = x + 1 < cols ? idx(x + 1, y) : -1
        this.neighbors[i + 2] = y > 0 ? idx(x, y - 1) : -1
        this.neighbors[i + 3] = y + 1 < rows ? idx(x, y + 1) : -1
      }
    }
  }

  /**
   * The moment of being hung: one soft push, strongest at the hem, written into
   * the previous positions so Verlet reads it as velocity. Deterministic — every
   * visit starts with the same settle.
   */
  justHung() {
    for (let i = 0; i < this.count; i++) {
      const s = 0.016 * Math.pow(this.below[i], 1.5)
      this.prev[i * 3 + 2] -= s
      this.prev[i * 3] += s * 0.3 * Math.sin(this.gy[i] * 4 + this.phase)
    }
  }

  /**
   * The wind. Two registers, and the split is what earlier versions got wrong:
   *
   * The **coherent** term is the same for every vertex — the whole sheet takes one
   * push, which is what wind visibly does to hanging laundry. A field made only of
   * travelling waves mostly cancels across the sheet and never moves it anywhere;
   * this term is why the cloth *swings* at idle rather than merely shimmering. Two
   * incommensurate periods so the swing never quite repeats.
   *
   * The **detail** term is the local ripple riding on top — the flutter within the
   * swing. Both scale with the `wind` dial and fade toward the clips; `gust` blends
   * the slow breathing envelope between flat air and full swells.
   */
  private wind(i: number, t: number): number {
    const swell = 0.55 + 0.45 * Math.sin(0.13 * t + this.phase * 0.7)
    const gust = 1 + (swell - 1) * this.tuning.gust
    const coherent =
      0.7 * Math.sin(0.5 * t + this.phase) + 0.5 * Math.sin(0.23 * t + 1.7 + this.phase * 1.3)
    const detail =
      0.55 * Math.sin(2.3 * this.gx[i] + 1.1 * this.gy[i] + 1.4 * t + this.phase) +
      0.35 * Math.sin(4.1 * this.gx[i] - 0.9 * t + 1.3)
    return (
      (coherent + detail) * gust * (0.15 + 0.85 * this.below[i]) * 4.5 * this.tuning.wind
    )
  }

  /**
   * The spray lands: a shove away from the viewer, strongest mid-sheet, jittered
   * per vertex so the cloth takes droplets rather than a gust — plus a little
   * downward drag, the way water drives fabric. Written into the previous
   * positions so Verlet reads it as velocity; the constraints and the pins turn
   * it into a swing and a shudder.
   */
  spray() {
    const cy = 0.15
    const R = 0.6
    const s = 0.012 * this.tuning.force
    for (let i = 0; i < this.count; i++) {
      const dx = this.gx[i]
      const dy = this.gy[i] - cy
      const d = Math.hypot(dx, dy)
      if (d > R) continue
      const t = 1 - d / R
      const w = t * t * (3 - 2 * t) * (0.55 + 0.9 * jitter(i))
      this.prev[i * 3 + 2] += w * s
      this.prev[i * 3 + 1] += w * s * 0.25
    }
  }

  step(dt: number) {
    this.time += Math.min(dt, 0.05)
    let budget = Math.min(dt, 0.05)
    let steps = 0
    while (budget >= SUBSTEP && steps < MAX_SUBSTEPS) {
      this.substep()
      budget -= SUBSTEP
      steps++
    }
  }

  private substep() {
    const p = this.positions
    const prev = this.prev
    const pose = this.pose
    const n = this.count
    const t = this.time

    /* Integrate: damping per 60Hz frame converted to substep rate, wind as an
       acceleration on z, and the starch pull toward the pose. */
    const damp = Math.pow(1 - VISCOSITY, SUBSTEP * 60)
    const dt2 = SUBSTEP * SUBSTEP
    const WIND = 0.55
    for (let i = 0; i < n; i++) {
      const j = i * 3
      const az = this.wind(i, t) * WIND
      for (let c = 0; c < 3; c++) {
        const cur = p[j + c]
        const vel = (cur - prev[j + c]) * damp
        prev[j + c] = cur
        p[j + c] = cur + vel + (pose[j + c] - cur) * RESTORE
      }
      p[j + 2] += az * dt2
    }

    /* Laplacian smoothing — wrinkles relax back out; the softness of the sheet. */
    const k = SMOOTHING * 0.5
    const nb = this.neighbors
    for (let i = 0; i < n; i++) {
      let ax = 0
      let ay = 0
      let az = 0
      let cnt = 0
      for (let j = 0; j < 4; j++) {
        const ni = nb[i * 4 + j]
        if (ni < 0) continue
        ax += p[ni * 3]
        ay += p[ni * 3 + 1]
        az += p[ni * 3 + 2]
        cnt++
      }
      if (cnt === 0) continue
      const inv = 1 / cnt
      p[i * 3] += (ax * inv - p[i * 3]) * k
      p[i * 3 + 1] += (ay * inv - p[i * 3 + 1]) * k
      p[i * 3 + 2] += (az * inv - p[i * 3 + 2]) * k
    }

    /* Constraint relaxation, pins snapped hard after every pass. */
    const { cA, cB, cRest, cMul } = this
    const nc = cA.length
    for (let it = 0; it < ITERATIONS; it++) {
      for (let c = 0; c < nc; c++) {
        const ia = cA[c] * 3
        const ib = cB[c] * 3
        const dx = p[ib] - p[ia]
        const dy = p[ib + 1] - p[ia + 1]
        const dz = p[ib + 2] - p[ia + 2]
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (d < 1e-9) continue
        const diff = ((d - cRest[c]) / d) * 0.5 * STIFFNESS * cMul[c]
        const ox = dx * diff
        const oy = dy * diff
        const oz = dz * diff
        p[ia] += ox
        p[ia + 1] += oy
        p[ia + 2] += oz
        p[ib] -= ox
        p[ib + 1] -= oy
        p[ib + 2] -= oz
      }
      for (const pin of this.pins) {
        const j = pin * 3
        p[j] = pose[j]
        p[j + 1] = pose[j + 1]
        p[j + 2] = pose[j + 2]
      }
    }
  }

  /**
   * Per-vertex cavity for fold occlusion: the discrete Laplacian projected onto
   * the vertex normal — concave (valley) vertices score > 0 — then one smoothing
   * pass against grid artifacts. Ported from holocloth. Writes [0,1] into `out`.
   */
  computeCavity(normals: ArrayLike<number>, out: Float32Array, gain = 6) {
    const p = this.positions
    const nb = this.neighbors
    const n = this.count
    const invStep = 1 / this.minStep
    const tmp = this.cavityScratch
    for (let i = 0; i < n; i++) {
      let ax = 0
      let ay = 0
      let az = 0
      let cnt = 0
      for (let j = 0; j < 4; j++) {
        const ni = nb[i * 4 + j]
        if (ni < 0) continue
        ax += p[ni * 3]
        ay += p[ni * 3 + 1]
        az += p[ni * 3 + 2]
        cnt++
      }
      if (cnt === 0) {
        tmp[i] = 0
        continue
      }
      const inv = 1 / cnt
      const lx = ax * inv - p[i * 3]
      const ly = ay * inv - p[i * 3 + 1]
      const lz = az * inv - p[i * 3 + 2]
      const c = (lx * normals[i * 3] + ly * normals[i * 3 + 1] + lz * normals[i * 3 + 2]) * invStep
      tmp[i] = Math.min(1, Math.max(0, c * gain))
    }
    for (let i = 0; i < n; i++) {
      let sum = 0
      let cnt = 0
      for (let j = 0; j < 4; j++) {
        const ni = nb[i * 4 + j]
        if (ni < 0) continue
        sum += tmp[ni]
        cnt++
      }
      out[i] = cnt > 0 ? tmp[i] * 0.5 + (sum / cnt) * 0.5 : tmp[i]
    }
  }
}
