import { motion, useTransform } from 'motion/react'
import type { MotionValue } from 'motion/react'
import { clamp, remap } from '../lib/remap'
import { FEATHER } from '../lib/front'

/**
 * Leader lines onto the section.
 *
 * Each one arrives shortly after the section front has passed the feature it
 * names, so the order they appear in is the order the cut reveals them — 02 at the
 * forefoot, then 01, then 03, then 04 at the heel — and nothing is ever labelled
 * before it exists. That's derived from the target's own x position rather than
 * from its index in this list, which means reordering or moving a callout can't
 * put a label on a part of the shoe that's still intact.
 *
 * Each one is a shelf rule with the text on it and a leader running to a ringed
 * point on the feature. Every leader is stroked twice — a dark halo under a light
 * hairline — so it survives crossing the white foam, which a single light stroke
 * does not. That's what technical drafting does for the same reason.
 *
 * Text sits above the shelf or below it, chosen per callout so the leader never
 * has to travel across its own label.
 */

type Callout = {
  n: string
  label: string
  /** The feature, in % of the stage box. Read off the cross-section. */
  target: [number, number]
  /** Where the shelf starts. The leader leaves from this end. */
  anchor: [number, number]
  side: 'above' | 'below'
}

const CALLOUTS: Callout[] = [
  {
    n: '01',
    label: 'Engineered knit upper',
    target: [37, 47],
    anchor: [2.5, 21.5],
    side: 'above',
  },
  {
    n: '02',
    label: 'Bead foam midsole',
    target: [28, 70],
    anchor: [3, 92.5],
    side: 'below',
  },
  {
    n: '03',
    label: 'Embedded plate',
    target: [45, 74],
    anchor: [39, 92.5],
    side: 'below',
  },
  {
    n: '04',
    label: 'Heel unit',
    target: [77, 70],
    anchor: [72, 92.5],
    side: 'below',
  },
]

/** Progress at which the section front sits at `x` (0..1 of the stage). Inverse of `frontAt`. */
const progressAtX = (x: number) => (x + FEATHER) / (1 + 2 * FEATHER)

/**
 * A leader as a rotated rule rather than an SVG line: length as a % of stage width,
 * and an angle, both of which are constants.
 *
 * They're constants because the stage is locked to 3:2, which makes a percentage of
 * its height exactly two thirds of a percentage of its width in real pixels. So the
 * geometry can be solved once here instead of being re-derived from element sizes.
 *
 * This replaced an SVG whose endpoint was animated. That worked and it cost a
 * layout every frame — changing `x2` is changing geometry, and geometry reflows,
 * where a rotated div growing by `scaleX` is composite-only. It also removes the
 * `vector-effect` the SVG needed to keep a 1px stroke under a stretched viewBox.
 */
function geometry(c: Callout) {
  const dx = (c.target[0] - c.anchor[0]) / 100
  const dy = ((c.target[1] - c.anchor[1]) / 100) * (2 / 3)
  return { length: Math.hypot(dx, dy) * 100, angle: (Math.atan2(dy, dx) * 180) / Math.PI }
}

/** A beat after the front clears the target, so the label lands on finished section. */
const LAG = 0.12

/** How long one callout takes to arrive, in progress. The heel's is clipped by the end. */
const SPAN = 0.3

function Leader({ c, p, reduced }: { c: Callout; p: MotionValue<number>; reduced: boolean }) {
  const start = clamp(progressAtX(c.target[0] / 100 + LAG), 0, 0.97 - SPAN * 0.5)
  const reveal = useTransform(p, (v) => remap(v, start, Math.min(0.99, start + SPAN), 0, 1))

  // Line, then point, then text — the order a hand would do it in. Reduced motion
  // keeps the set and the order and drops the travel: the leader fades in at full
  // length instead of drawing, and the label doesn't slide.
  const draw = useTransform(reveal, [0, 0.55], [0, 1])
  const dot = useTransform(reveal, [0.4, 0.72], [0, 1])
  const text = useTransform(reveal, [0.55, 1], [0, 1])
  const slide = useTransform(text, [0, 1], [c.side === 'below' ? -3 : 3, 0])

  const [tx, ty] = c.target
  const [ax, ay] = c.anchor
  const { length, angle } = geometry(c)

  return (
    <>
      {/* Outer holds the static geometry, inner does the drawing. Nesting is what
          lets `scaleX` run along the *line's* axis: put the rotation and the scale
          on one element and CSS applies the scale in the parent's axes instead,
          which stretches the line sideways rather than extending it. */}
      <motion.div
        className="callout__leader"
        style={{
          left: `${ax}%`,
          top: `${ay}%`,
          width: `${length}%`,
          rotate: `${angle}deg`,
          opacity: reduced ? dot : 1,
        }}
      >
        <motion.i style={{ scaleX: reduced ? 1 : draw }} />
      </motion.div>

      <motion.i
        className="callout__dot"
        style={{ left: `${tx}%`, top: `${ty}%`, scale: dot, opacity: dot }}
      />

      <motion.div
        className="callout__label"
        data-side={c.side}
        style={{ left: `${ax}%`, top: `${ay}%`, opacity: text, y: reduced ? 0 : slide }}
      >
        <b>{c.n}</b>
        {c.label}
      </motion.div>
    </>
  )
}

export function Callouts({ p, reduced }: { p: MotionValue<number>; reduced: boolean }) {
  return (
    <div className="callouts" aria-hidden="true">
      {CALLOUTS.map((c) => (
        <Leader key={c.n} c={c} p={p} reduced={reduced} />
      ))}
    </div>
  )
}
