/**
 * Runs the wind tunnels headless, and reports what the section will show.
 *
 * The fabric section is the one part of this page that reads a clock, so it's also the one
 * part whose numbers can't be read off a screenshot with any confidence — a figure sampled
 * mid-scroll is a figure caught mid-settle. This runs the same module the page runs, on the
 * same fixed timestep from the same seed, and prints the steady state.
 *
 * Four things it's here to catch:
 *
 * - **The pool filling.** `dropped > 0` means the emitter was refused, which turns every
 *   figure below it into a measurement of a clamp rather than of a fabric. It has to be zero
 *   across the whole pace range, not just at the reference.
 * - **The airflow ratio drifting off the porosity ratio.** That equality is the section's
 *   claim — same air, same pressure, and the only difference is how open the knit is. If
 *   wandering particles are quietly finding their way through, this is where it shows.
 * - **The readout constants.** `RISE` in `lib/air.ts` converts a measured load into degrees,
 *   and the only honest way to pick it is against the loads this prints.
 * - **Determinism.** Two runs from the same seed have to agree exactly, or reduced motion's
 *   settled frame isn't reproducible and neither is anything built on it.
 *
 *   scripts/air.sh
 */
import {
  FABRICS,
  PACE,
  createAir,
  predict,
  riseOf,
  settle,
  verdict,
  windFor,
} from '../.context/air/air.js'

/** `settle`'s own default for `seconds`, deliberately — the harness must not settle for
    longer than the page does, or it would report a steady state the page never reaches. */
const pair = (wind, seconds) => {
  const air = FABRICS.map((spec) => createAir(spec))
  settle(air, wind, seconds)
  return air
}

const pct = (v) => `${(v * 100).toFixed(1)}%`
const pad = (s, n) => String(s).padEnd(n)

let failures = 0
const check = (label, ok, detail) => {
  if (!ok) failures++
  console.log(`   ${ok ? 'ok  ' : 'FAIL'}  ${pad(label, 42)} ${detail}`)
}

/**
 * A channel with nothing across it, for the floor.
 *
 * `riseOf` has no floor to subtract any more — the reading is a mean temperature, and air
 * arrives at ambient — so this is no longer a calibration input. It's a control: a channel with
 * nothing across it has to pass everything and read ambient, and if either stops being true the
 * measurement has picked up a dependence on something other than the fabric.
 */
const OPEN = { id: 'open', tag: 'open', pores: 1, porosity: 0.999 }

console.log('wind tunnel · steady state\n')
console.log(
  `   ${pad('', 8)}${pad('porosity', 10)}${pad('air in', 10)}${pad('skin', 8)}${pad('rise', 8)}${pad('inside', 8)}${pad('live', 7)}drop`,
)

for (const pace of [PACE.min, PACE.ref, PACE.max]) {
  const air = pair(windFor(pace))
  const open = createAir(OPEN)
  settle([open], windFor(pace))
  console.log(`   ${pace} km/h`)
  for (const a of [...air, open]) {
    console.log(
      `   ${pad('', 8)}${pad(pct(a.spec.porosity), 10)}${pad(pct(a.through), 10)}` +
        `${pad(a.load.toFixed(3), 8)}${pad(`${riseOf(a.load).toFixed(1)}°`, 8)}` +
        `${pad(a.inside, 8)}${pad(a.live, 7)}${a.dropped}`,
    )
  }
  const v = verdict(air[0], air[1])
  console.log(`   ${pad('', 8)}verdict   ${v.ratio.toFixed(2)}× the air in · ${v.drop.toFixed(1)}°C cooler\n`)
}

console.log('checks')

{
  const air = pair(windFor(PACE.ref))
  const [now, next] = air
  const want = next.spec.porosity / now.spec.porosity

  check('nothing is refused at the reference', now.dropped === 0 && next.dropped === 0, `${now.dropped} / ${next.dropped}`)
  check(
    'the pool has headroom',
    Math.max(now.live, next.live) < now.n * 0.85,
    `${Math.max(now.live, next.live)} of ${now.n}`,
  )
  check(
    'airflow is the porosity ratio',
    Math.abs(verdict(now, next).ratio - want) < 0.15,
    `${verdict(now, next).ratio.toFixed(2)}× against ${want.toFixed(2)}×`,
  )
  check(
    'neither knit is saturated',
    next.through < 0.92 && now.through > 0.05,
    `${pct(now.through)} → ${pct(next.through)}`,
  )
}

{
  // Across the whole pace range, because emission scales with pace and capacity doesn't.
  let worst = 0
  let dropped = 0
  for (let pace = PACE.min; pace <= PACE.max; pace += 1) {
    const air = pair(windFor(pace))
    for (const a of air) {
      worst = Math.max(worst, a.live)
      dropped += a.dropped
    }
  }
  check('and nothing is refused at any pace', dropped === 0, `${dropped} dropped, peak ${worst} live`)
}

{
  // Pace buys less than it costs — the reason the slider is worth touching.
  const slow = pair(windFor(PACE.min))
  const fast = pair(windFor(PACE.max))
  check(
    'a harder pace loses ground on both',
    fast[0].through < slow[0].through && fast[1].through < slow[1].through,
    `${pct(slow[0].through)}→${pct(fast[0].through)} · ${pct(slow[1].through)}→${pct(fast[1].through)}`,
  )
}

{
  /**
   * The temperature reading has to be *monotone in porosity*, which is the property that
   * makes it about the fabric at all — and a stronger check than the one it replaces. It used
   * to assert an open channel read ambient, which was a statement about a constant that has
   * since gone: a mean temperature has a floor the model earns rather than one subtracted from
   * it, because a body under moving air warms the air moving over it however open the fabric.
   * What must be true is the order.
   */
  const open = createAir(OPEN)
  settle([open], windFor(PACE.ref))
  const [now, next] = pair(windFor(PACE.ref))
  check(
    'more open is cooler, in order',
    open.load < next.load && next.load < now.load,
    `${riseOf(open.load).toFixed(1)}° < ${riseOf(next.load).toFixed(1)}° < ${riseOf(now.load).toFixed(1)}°`,
  )
  check('and an open channel passes everything', open.through > 0.95, pct(open.through))
}

{
  // The headline is measured off the fields at runtime, so it has to hold wherever the
  // slider is left rather than only at the pace the model was tuned at.
  const ratios = []
  for (let pace = PACE.ref; pace <= PACE.max; pace += 2) {
    const air = pair(windFor(pace))
    ratios.push(verdict(air[0], air[1]).ratio)
  }
  const lo = Math.min(...ratios)
  const hi = Math.max(...ratios)
  check('the headline holds across the range', hi - lo < 0.25, `${lo.toFixed(2)}× … ${hi.toFixed(2)}×`)
}

{
  /**
   * `CURVE` in `lib/air.ts` is a table of settled states pasted into the source, so the one thing
   * that has to be true of it is that it still *is* one. This re-derives every row and fails on
   * any drift — which is what makes a committed table safer than a formula rather than lazier: a
   * constant above it cannot move without this saying so.
   *
   * The tolerance is tight on purpose. These are not approximations of anything; they are the
   * numbers `settle()` produces, and the only reason they aren't exact is that `riseOf` rounds
   * through four decimal places on the way in.
   */
  const rows = []
  let worst = 0
  for (let pace = PACE.min; pace <= PACE.max; pace += 1) {
    const air = pair(windFor(pace))
    const p = predict(pace)
    for (let i = 0; i < 2; i++) {
      worst = Math.max(worst, Math.abs(p.through[i] - air[i].through))
      worst = Math.max(worst, Math.abs(p.rise[i] - riseOf(air[i].load)) / 100)
    }
    rows.push(
      `  [${air[0].through.toFixed(4)}, ${air[1].through.toFixed(4)}, ` +
        `${air[0].load.toFixed(4)}, ${air[1].load.toFixed(4)}], // ${pace} km/h`,
    )
  }
  check('the committed curve is the settled one', worst < 0.001, `${worst.toExponential(1)} off`)
  if (worst >= 0.001) {
    console.log('\n   paste over CURVE in lib/air.ts:\n')
    console.log(rows.join('\n'))
    console.log('')
  }
}

{
  /* And the half-steps the slider lands on have to sit between their neighbours rather than
     anywhere — an interpolation that indexed wrong would still look plausible at every whole
     number and be nonsense in between. */
  let ok = true
  for (let pace = PACE.min; pace < PACE.max; pace += 1) {
    const a = predict(pace).ratio
    const b = predict(pace + 0.5).ratio
    const c = predict(pace + 1).ratio
    if (b < Math.min(a, c) - 1e-9 || b > Math.max(a, c) + 1e-9) ok = false
  }
  check('and the half-steps interpolate it', ok, `${PACE.max - PACE.min} spans`)
}

{
  const a = pair(windFor(PACE.ref))
  const b = pair(windFor(PACE.ref))
  const same =
    a[0].through === b[0].through && a[0].load === b[0].load && a[1].through === b[1].through
  check('the same seed is the same field', same, `${a[0].through.toFixed(9)} twice`)
}

console.log(`\n${failures ? `${failures} failed` : 'all ok'}`)
process.exit(failures ? 1 : 0)
