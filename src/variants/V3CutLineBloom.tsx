import { motion, useTransform } from 'motion/react'
import { StartPhoto } from '../components/Photo'
import { Crossfade } from '../components/Crossfade'
import { MASTER, SHOE, SRC } from '../lib/shoe'
import type { VariantProps } from './types'

/**
 * Cut-line bloom — the reveal opens along the core of the shoe and spreads out.
 *
 * The other variants impose a shape on the shoe. This one takes its shape from the
 * shoe: the axis is `SHOE.spine`, the difference-weighted centre of each column, so
 * the interior surfaces where there's most interior to show and grows outward into
 * the upper and down into the foam. No sweep direction, no imposed geometry.
 *
 * Built as an SVG mask rather than a CSS one because a stroked path is the natural
 * way to express "thickness growing perpendicular to a line", and because
 * referencing an SVG <mask> from CSS `mask-image` is unreliable in Safari.
 */

/**
 * Quadratic smoothing through the spine points: each segment curves to the midpoint
 * of the next. A polyline's corners would show as facets along the bloom's edge.
 */
const D = (() => {
  const pts = SHOE.spine.map(([x, y]) => [(x / 100) * MASTER.w, (y / 100) * MASTER.h])
  const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 1; i < pts.length - 1; i++) {
    const [mx, my] = mid(pts[i], pts[i + 1])
    d += ` Q${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`
  }
  const last = pts[pts.length - 1]
  return `${d} L${last[0].toFixed(1)} ${last[1].toFixed(1)}`
})()

/**
 * Stroke width that just covers the silhouette, plus margin. Overshooting is free —
 * outside the shoe both photographs are identical — but it would waste the early
 * scroll growing invisibly.
 */
const MAX_WIDTH = SHOE.spineReach * 2.4

/** Revealed area grows with the square of the width, so linear growth reads as accelerating. */
const growth = (v: number) => Math.pow(v, 1.6)

export function V3CutLineBloom({ p, reduced }: VariantProps) {
  const core = useTransform(p, (v) => growth(v) * MAX_WIDTH)
  // Three stacked strokes stand in for a blur: widest and faintest underneath.
  // An feGaussianBlur here would re-filter the mask every frame for the same look.
  const mid = useTransform(core, (w) => w * 1.5)
  const outer = useTransform(core, (w) => w * 2.1)

  if (reduced) return <Crossfade p={p} />

  return (
    <>
      <StartPhoto />

      <svg
        className="layer"
        viewBox={`0 0 ${MASTER.w} ${MASTER.h}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          {/* userSpaceOnUse: the default objectBoundingBox region would clip the
              bloom to the image bbox + 10%. */}
          <mask
            id="cut-bloom"
            maskUnits="userSpaceOnUse"
            x={0}
            y={0}
            width={MASTER.w}
            height={MASTER.h}
          >
            <motion.path
              d={D}
              fill="none"
              stroke="#fff"
              strokeOpacity={0.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ strokeWidth: outer }}
            />
            <motion.path
              d={D}
              fill="none"
              stroke="#fff"
              strokeOpacity={0.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ strokeWidth: mid }}
            />
            <motion.path
              d={D}
              fill="none"
              stroke="#fff"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ strokeWidth: core }}
            />
          </mask>
        </defs>

        <image
          href={SRC.end}
          x={0}
          y={0}
          width={MASTER.w}
          height={MASTER.h}
          preserveAspectRatio="none"
          mask="url(#cut-bloom)"
        />
      </svg>
    </>
  )
}
