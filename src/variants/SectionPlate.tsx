import { motion, useMotionTemplate, useTransform } from 'motion/react'
import { EndPhoto, StartPhoto } from '../components/Photo'
import { Crossfade } from '../components/Crossfade'
import { SRC } from '../lib/shoe'
import { FEATHER, frontAt } from '../lib/front'
import { bell, fadeInOut } from '../lib/remap'
import { ParticleField } from '../lab/ParticleField'
import { Plot } from '../lab/Plot'
import { Callouts } from '../lab/Callouts'
import { Readout } from '../lab/Readout'
import type { VariantProps } from './types'

/**
 * Section plate — a product photograph becoming an engineering figure.
 *
 * The cut itself is the same soft front travelling toe → heel as the plain x-ray
 * dissolve, and for the same reasons: no bright sprite rides it, because the
 * moving thing is the thing the eye locks onto and a concentrated light reads as a
 * hard line sweeping across the shoe. What's different is everything around it.
 *
 * Scrolling doesn't just cut the shoe open, it changes what kind of picture you're
 * looking at. The warm wall becomes a sheet, a measurement frame draws itself around
 * the specimen in real millimetres, the cut face fills, the shell's material comes off
 * into the airflow as a point cloud, and each feature is named as the front clears it.
 * The photograph and the drawing are the two end states; the transition is the argument
 * that they're the same object.
 *
 * **Which sheet is a switch** — see `lib/sheet.ts`. A blueprint is a *reproduction* of a
 * finished drawing, made to be built from: deep blue, near-white ink, every mark printed.
 * A section on toned paper is someone working out what the thing is: warm stock with its
 * own tooth, graphite, 45° hatching, marks a hand made. Same geometry, same instrument,
 * opposite ends of the process — so both are kept and the viewer holds them side by side.
 *
 * None of the timing below changes with it, because the timing was never what made either
 * of them read as the document it is. What changes is colour, face and mark shape, and all
 * three live in the stylesheet apart from the point cloud's ink, which is a canvas.
 *
 * This is the one variant whose end state is deliberately **not** the bare
 * photograph — see `cleanEnds` in the registry. The technical state is the point,
 * so it has to survive at p = 1.
 */

export function SectionPlate({ p, reduced }: VariantProps) {
  const front = useTransform(p, frontAt)
  const solid = useTransform(front, (f) => (f - FEATHER) * 100)
  const gone = useTransform(front, (f) => (f + FEATHER) * 100)
  const maskImage = useMotionTemplate`linear-gradient(90deg, #000 ${solid}%, transparent ${gone}%)`

  // Solidity draining out of the shell, peaking mid-cut and gone at both ends.
  const wash = useTransform(p, (v) => bell(v) * 0.42)

  /**
   * The cut face: fine lines confined to the silhouette and to a band travelling with
   * the front — horizontal sampling rules on the blueprint, 45° hatching on paper, which
   * is the stylesheet's decision and not this one's.
   *
   * A bell curve over the whole shoe was the first attempt and it read as a filter
   * someone had switched on — the lines were everywhere, so they belonged to the page
   * rather than to the cut. Windowed, they belong to the drawing: material is only
   * marked where the section is actually happening, which is what both readings mean.
   */
  const band = {
    a: useTransform(front, (f) => (f - FEATHER * 1.6) * 100),
    b: useTransform(front, (f) => (f - FEATHER * 0.3) * 100),
    c: useTransform(front, (f) => (f + FEATHER * 0.3) * 100),
    d: useTransform(front, (f) => (f + FEATHER * 1.6) * 100),
  }
  const scanMask = useMotionTemplate`linear-gradient(90deg, transparent ${band.a}%, #000 ${band.b}%, #000 ${band.c}%, transparent ${band.d}%)`
  // The window alone doesn't quite clear the frame at p = 0, where its trailing
  // falloff still overlaps the toe. Both end states have to be the bare photograph.
  const scan = useTransform(p, (v) => fadeInOut(v, 0.12, 0.9) * 0.55)

  return (
    <>
      {reduced ? (
        <Crossfade p={p} />
      ) : (
        <>
          <StartPhoto />

          {/* Blurred once at rasterisation and cross-faded — animating filter:
              blur() would re-blur the whole layer every frame for the same look. */}
          <motion.div className="layer on-shoe wash" style={{ opacity: wash }} aria-hidden="true">
            <img className="layer" src={SRC.start} alt="" draggable={false} />
          </motion.div>

          <motion.div className="layer" style={{ maskImage, WebkitMaskImage: maskImage }}>
            <EndPhoto />
          </motion.div>

          {/* Two nested masks rather than one composited pair: the silhouette on the
              wrapper, the travelling window on the child. `mask-composite` would do
              it in one element, but it's the corner of the masking spec with the
              least agreement between engines and this needs none of its power. */}
          <motion.div className="layer on-shoe" style={{ opacity: scan }} aria-hidden="true">
            <motion.div
              className="layer scan"
              style={{ maskImage: scanMask, WebkitMaskImage: scanMask }}
            />
          </motion.div>

          <ParticleField p={p} />
        </>
      )}

      <Plot p={p} reduced={reduced} />
      <Callouts p={p} reduced={reduced} />
      <Readout p={p} />
    </>
  )
}
