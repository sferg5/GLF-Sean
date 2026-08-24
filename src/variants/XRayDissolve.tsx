import { motion, useMotionTemplate, useTransform } from 'motion/react'
import { EndPhoto, StartPhoto } from '../components/Photo'
import { Crossfade } from '../components/Crossfade'
import { XRayCallouts } from '../components/XRayCallouts'
import { SRC } from '../lib/shoe'
import { FEATHER, frontAt } from '../lib/front'
import { bell } from '../lib/remap'
import type { VariantProps } from './types'

/**
 * X-ray dissolve — the shell loses solidity and the interior surfaces through it.
 *
 * The intact shoe softens and lifts slightly while the cross-section is revealed
 * behind a soft front travelling toe → heel. Nothing grades the image: the shoe's
 * own coral and white are untouched at every frame, so translucency alone carries
 * the transition.
 *
 * There is deliberately no bright sprite riding the front. One used to, and even
 * with soft shoulders its light was concentrated enough (a ~40px core inside a 320px
 * sprite) to read as a hard line sweeping across the shoe — the moving thing is the
 * thing the eye locks onto. Without it the soft mask *is* the effect.
 *
 * The call-out layer rides on top and is switchable from the topbar. It is outside
 * the reduced-motion branch below because it is content rather than treatment: the
 * names of the materials are the thing being communicated, so they survive when the
 * movement does not.
 */

export function XRayDissolve({ p, reduced, callouts }: VariantProps) {
  /**
   * The front comes from `lib/front.ts`, which is also what the section plate cuts
   * with. It used to be a local constant, duplicated — and this variant's job is to
   * be the control for that one, which it can only do if the two cuts are provably
   * identical rather than incidentally similar.
   */
  const front = useTransform(p, frontAt)
  const solid = useTransform(front, (f) => (f - FEATHER) * 100)
  const gone = useTransform(front, (f) => (f + FEATHER) * 100)
  const maskImage = useMotionTemplate`linear-gradient(90deg, #000 ${solid}%, transparent ${gone}%)`

  const washOpacity = useTransform(p, (v) => bell(v) * 0.58)

  return (
    <>
      {reduced ? (
        <Crossfade p={p} />
      ) : (
        <>
          <StartPhoto />

          {/* Solidity draining out of the shell, peaking mid-transition and gone by
              both ends. Blurred once at rasterisation and cross-faded — animating
              filter: blur() would re-blur the whole layer every frame for the same
              look.

              `on-shoe` clips the blur's outward bleed to the silhouette. Unclipped it
              puts a soft bright rim around the shoe that comes and goes with the
              transition, which against a flat background reads as a bad cutout rather
              than as a glow. */}
          <motion.div
            className="layer on-shoe wash"
            style={{ opacity: washOpacity }}
            aria-hidden="true"
          >
            <img className="layer" src={SRC.start} alt="" draggable={false} />
          </motion.div>

          <motion.div className="layer" style={{ maskImage, WebkitMaskImage: maskImage }}>
            <EndPhoto />
          </motion.div>
        </>
      )}

      <XRayCallouts p={p} reduced={reduced} on={callouts} />
    </>
  )
}
