import { motion, useTransform } from 'motion/react'
import type { MotionValue } from 'motion/react'

/**
 * The surface the specimen ends up on — a blueprint field or a sheet of toned paper,
 * whichever `lib/sheet.ts` is set to. Which one it is lives entirely in the stylesheet;
 * this owns the timing, and the timing is the same either way.
 *
 * At rest it's transparent and the page is whatever the background picker is set to — a
 * warm wall, a product shot. It comes up ahead of the section front so the surface
 * changes *before* the shoe does: the instrument switches on, or the paper goes down,
 * and then it cuts. The other order reads as the page catching up with the shoe.
 *
 * Three layers, because they need different timing, and the order is the order the
 * surface would actually acquire them. The wash and its grain arrive together and lead —
 * they're the stock. The grid resolves behind them, late enough to read as detail
 * arriving rather than as part of the same fade.
 */

/**
 * How dark the paper's grain gets, multiplied into the wash.
 *
 * It lives here rather than in the stylesheet because this component animates `opacity`
 * on that element, and an inline style from motion would overwrite a CSS one — so the
 * faintness has to ride on the same value as the fade.
 *
 * Faint on purpose. The moment grain is legible *as grain* it reads as a texture overlay
 * someone switched on, which is the same failure the scan lines had before they were
 * windowed.
 *
 * The blueprint has no tooth — it's a print, not a sheet — and gets it for free: the
 * stylesheet gives that layer no image, so this animates the opacity of nothing.
 */
const TOOTH = 0.055

export function Backdrop({ p }: { p: MotionValue<number> }) {
  const wash = useTransform(p, [0.04, 0.34], [0, 1])
  const tooth = useTransform(wash, (v) => v * TOOTH)
  const air = useTransform(p, [0.16, 0.52], [0, 1])

  return (
    <div className="lab" aria-hidden="true">
      <motion.div className="lab__wash" style={{ opacity: wash }} />
      {/* Tied to the wash's own ramp rather than given a third one: grain that arrives on
          a different schedule from the paper it belongs to reads as a filter. */}
      <motion.div className="lab__tooth" style={{ opacity: tooth }} />
      <motion.div className="lab__air" style={{ opacity: air }} />
    </div>
  )
}
