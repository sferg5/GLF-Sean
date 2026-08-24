import { motion, useTransform } from 'motion/react'
import { EndPhoto, StartPhoto } from '../components/Photo'
import { Crossfade } from '../components/Crossfade'
import { easeOutQuad, staggerWindow } from '../lib/remap'
import type { VariantProps } from './types'

/**
 * Slice bands — vertical bands swap toe → heel like a bandsaw pass.
 *
 * The most forgiving variant: each band swaps across a strip 1/14th of the frame
 * wide, so even a gross misregistration would have nowhere to show itself. Useful
 * as the safe option if the pair ever gets re-shot and stops matching.
 *
 * All 14 bands live in *one* element. The obvious build — 14 stacked full-size
 * layers, one per band — asks the compositor for 14 textures of the same 800k-pixel
 * bitmap. Instead the mask is 14 gradient layers on a single element: `mask-size`
 * and `mask-position` are static per band, and only the stop positions move.
 */

const COUNT = 14

/** Each band's own reveal takes 18% of total progress → ~65% overlap with its neighbour. */
const SPAN = 0.18

const BAND_W = 100 / COUNT

/** Percentages resolve against (element − layer) size, so the last band is 100%. */
const positions = Array.from({ length: COUNT }, (_, i) => `${(i / (COUNT - 1)) * 100}% 0%`)

const progressOf = (v: number, i: number) =>
  easeOutQuad(staggerWindow(v, i, COUNT, SPAN))

export function V4SliceBands({ p, reduced }: VariantProps) {
  const maskImage = useTransform(p, (v) =>
    positions
      .map((_, i) => {
        const t = progressOf(v, i) * 100
        return `linear-gradient(90deg, #000 ${t}%, transparent ${t}%)`
      })
      .join(', '),
  )

  // Leading edge of each band's wipe, painted into a single layer the same way.
  const backgroundImage = useTransform(p, (v) =>
    positions
      .map((_, i) => {
        const t = progressOf(v, i)
        if (t <= 0.001 || t >= 0.999) return 'linear-gradient(90deg, transparent 0%, transparent 0%)'
        const at = t * 100
        return `linear-gradient(90deg, transparent ${at - 2}%, rgba(255,255,255,0.45) ${at}%, transparent ${at + 2}%)`
      })
      .join(', '),
  )

  if (reduced) return <Crossfade p={p} />

  const tiling = {
    maskSize: `${BAND_W}% 100%`,
    maskPosition: positions.join(', '),
    maskRepeat: 'no-repeat',
    WebkitMaskSize: `${BAND_W}% 100%`,
    WebkitMaskPosition: positions.join(', '),
    WebkitMaskRepeat: 'no-repeat',
  } as const

  return (
    <>
      <StartPhoto />

      <motion.div
        className="layer"
        style={{ maskImage, WebkitMaskImage: maskImage, ...tiling }}
      >
        <EndPhoto />
      </motion.div>

      {/* `bandedge` fades the leading edges out above and below the shoe. Full-height
          lines over empty backdrop read as UI artefacts, not saw marks. */}
      <motion.div
        className="layer bandedge"
        style={{
          backgroundImage,
          backgroundSize: `${BAND_W}% 100%`,
          backgroundPosition: positions.join(', '),
          backgroundRepeat: 'no-repeat',
        }}
        aria-hidden="true"
      />
    </>
  )
}
