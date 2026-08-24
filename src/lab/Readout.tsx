import { motion, useTransform } from 'motion/react'
import type { MotionValue } from 'motion/react'
import { MASTER } from '../lib/shoe'
import { frontAt } from '../lib/front'
import { clamp } from '../lib/remap'
import { PLOT, SPECIMEN_MM } from './scale'
import { usePointCount } from './ParticleField'
import { Odometer } from './Odometer'

/**
 * The instrument's own furniture: what the specimen is, and where the cut has got to.
 *
 * Both live figures are real. `SECTION` is the progress value the whole page is
 * driven by, and `FRONT` is the section front converted through the same
 * millimetre scale the axis is labelled in — scrub to 50% and the front reads
 * ~150mm, which is where the gridline says it is. A readout that doesn't survive
 * being checked against the thing next to it is set dressing; one that does is
 * the difference between looking technical and being technical.
 *
 * They're driven by MotionValues, so scrolling updates them without going back
 * through React — and drawn as digit wheels rather than as text, so it doesn't go
 * back through layout either. See `Odometer`.
 */

const PLOT_W = 100 - PLOT.left - PLOT.right

/** Group thousands with a thin space — a comma reads as a decimal point at this size. */
const grouped = (n: number) => n.toLocaleString('en-US').replace(/,/g, ' ')

export function Readout({ p }: { p: MotionValue<number> }) {
  const fade = useTransform(p, [0.02, 0.3], [0, 1])

  // Handed to the odometer as integers scaled past the decimal point: 1000 reads
  // 100.0%, 300 reads 300mm.
  const section = useTransform(p, (v) => clamp(v) * 1000)
  const front = useTransform(
    p,
    (v) => clamp((frontAt(v) * 100 - PLOT.left) / PLOT_W) * SPECIMEN_MM,
  )

  const points = usePointCount()

  return (
    <>
      <motion.div className="hud hud--head" style={{ opacity: fade }} aria-hidden="true">
        <div className="hud__id">
          <b>Specimen 01</b>
          <span>Longitudinal section · medial</span>
        </div>

        <dl className="hud__live">
          <dt>Section</dt>
          <dd>
            <Odometer value={section} places={3} decimals={1} /> %
          </dd>
          <dt>Front</dt>
          <dd>
            <Odometer value={front} places={3} /> mm
          </dd>
        </dl>
      </motion.div>

      <motion.div className="hud hud--foot" style={{ opacity: fade }} aria-hidden="true">
        <span>Grid 25 mm · origin at toe, ground plane</span>
        <span>
          {MASTER.w} × {MASTER.h} src{points ? ` · ${grouped(points)} pt cloud` : ''}
        </span>
      </motion.div>
    </>
  )
}
