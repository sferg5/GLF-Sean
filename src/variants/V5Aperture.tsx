import { motion, useMotionTemplate, useTransform } from 'motion/react'
import { EndPhoto, StartPhoto } from '../components/Photo'
import { Crossfade } from '../components/Crossfade'
import { SHOE } from '../lib/shoe'
import { bell, mix } from '../lib/remap'
import type { VariantProps } from './types'

/**
 * Aperture — a soft window opens on the inside of the shoe, with a lens push.
 *
 * Centred on the measured difference centroid (46%, 52.8%) rather than the frame's
 * centre, so the interior arrives where the interior actually is.
 *
 * The push scales a wrapper holding *both* photographs, so the studio backdrop
 * moves with them and it reads as a camera pushing in. Scaling only the revealed
 * layer would slide its baked-in backdrop against the other layer's and tear the
 * frame — the one thing these two images can't survive.
 */

const ORIGIN = `${SHOE.focus.x}% ${SHOE.focus.y}%`

/** Soft edge width, % of the gradient's extent. */
const FEATHER = 9

export function V5Aperture({ p, reduced }: VariantProps) {
  // Starts fully closed, and ends just past covering the silhouette — 100% here
  // would be the far *corner*, which is 30% further out than the shoe ever reaches,
  // so the reveal would finish with a quarter of the scroll still to go.
  const edge = useTransform(p, (v) => mix(-FEATHER - 3, 92, v))
  const inner = useTransform(edge, (e) => e - FEATHER)
  const outer = useTransform(edge, (e) => e + FEATHER)

  const maskImage =
    useMotionTemplate`radial-gradient(circle farthest-corner at ${SHOE.focus.x}% ${SHOE.focus.y}%, #000 ${inner}%, transparent ${outer}%)`

  // Lens flare on the aperture ring, gone at both ends.
  const ringImage =
    useMotionTemplate`radial-gradient(circle farthest-corner at ${SHOE.focus.x}% ${SHOE.focus.y}%, transparent ${inner}%, rgba(255,255,255,0.18) ${edge}%, transparent ${outer}%)`
  const ringOpacity = useTransform(p, bell)

  const scale = useTransform(p, (v) => 1 + bell(v) * 0.06)

  if (reduced) return <Crossfade p={p} />

  return (
    <motion.div className="layer" style={{ scale, transformOrigin: ORIGIN }}>
      <StartPhoto />

      <motion.div className="layer" style={{ maskImage, WebkitMaskImage: maskImage }}>
        <EndPhoto />
      </motion.div>

      <motion.div
        className="layer"
        style={{ backgroundImage: ringImage, opacity: ringOpacity }}
        aria-hidden="true"
      />
    </motion.div>
  )
}
