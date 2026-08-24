import { motion, useMotionTemplate, useTransform } from 'motion/react'
import { EndPhoto, StartPhoto } from '../components/Photo'
import { Crossfade } from '../components/Crossfade'
import { MASTER, SHOE } from '../lib/shoe'
import { cubicBezier, fadeInOut, mix } from '../lib/remap'
import type { VariantProps } from './types'

/**
 * Blade wipe — a hard boundary sweeps heel → toe, cross-section trailing behind it.
 *
 * The whole variant rests on one measured fact: the two photographs are
 * registered to within a pixel, so a hard seam between them lands on continuous
 * material. The only place the eye could catch a mismatch is the seam itself, and
 * the blade highlight sits exactly there.
 */

/** Half-lean of the cut, % of stage width. A vertical wipe reads as a wipe; a leaning one reads as a blade. */
const LEAN = 2.2
const LEAN_DEG = (Math.atan((LEAN / 100) * (MASTER.w / MASTER.h)) * 180) / Math.PI

/** Fast in, slow through the thick midfoot, fast out — resistance, not linear travel. */
const resist = cubicBezier(0.25, 0.62, 0.75, 0.38)

/** Approach and exit off-frame quickly; spend the scroll on the shoe itself. */
const ENTER = 0.1
const LEAVE = 0.88

const boundaryAt = (v: number) => {
  if (v < ENTER) return mix(100, SHOE.heelX, v / ENTER)
  if (v > LEAVE) return mix(SHOE.toeX, 0, (v - LEAVE) / (1 - LEAVE))
  return mix(SHOE.heelX, SHOE.toeX, resist((v - ENTER) / (LEAVE - ENTER)))
}

export function V1BladeWipe({ p, reduced }: VariantProps) {
  const boundary = useTransform(p, boundaryAt)

  // The revealed wedge leans with the blade: top edge ahead of the bottom edge.
  const top = useTransform(boundary, (b) => b + LEAN)
  const bottom = useTransform(boundary, (b) => b - LEAN)
  const clipPath = useMotionTemplate`polygon(${top}% -1%, 101% -1%, 101% 101%, ${bottom}% 101%)`

  const bladeX = useMotionTemplate`${boundary}%`
  const bladeOpacity = useTransform(p, (v) => fadeInOut(v, 0.05, 0.95))

  if (reduced) return <Crossfade p={p} />

  return (
    <>
      <StartPhoto />

      <motion.div className="layer" style={{ clipPath }}>
        <EndPhoto />
      </motion.div>

      {/* Full-width layer carrying a narrow gradient sprite at its left edge, so the
          blade moves by transform alone — translateX percentages resolve against the
          element's own width, which here is the stage. */}
      <motion.div
        className="layer blade"
        style={{ x: bladeX, rotate: LEAN_DEG, opacity: bladeOpacity }}
        aria-hidden="true"
      />
    </>
  )
}
