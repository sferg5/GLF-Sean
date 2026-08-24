import { motion, useTransform } from 'motion/react'
import type { MotionValue } from 'motion/react'
import { CELL, PLOT, X_TICKS, Y_TICKS, alongX, alongY, isMajor } from './scale'

/**
 * The measurement frame: grid, datum axes, ticks, labels.
 *
 * It builds in four passes rather than fading in as one object, because an
 * instrument that arrives all at once reads as a PNG dropped on top. Grid first
 * (the paper), then the two datum axes drawing out from the origin, then the ticks,
 * then the numbers. Each pass overlaps the next, so it's one continuous move — but
 * the order is legible, and the order is what makes it read as being *drawn*.
 *
 * The axes draw with `scaleX`/`scaleY` on a 1px rule instead of an SVG dash offset:
 * same look, composite-only, and no path length to keep in sync with the layout.
 *
 * Under reduced motion the four passes collapse into one opacity ramp and the
 * axes stop drawing. The frame still arrives, still scroll-linked — reduced motion
 * means gentler, not "you don't get the instrument".
 */
export function Plot({ p, reduced }: { p: MotionValue<number>; reduced: boolean }) {
  const plain = useTransform(p, [0.06, 0.42], [0, 1])
  const staged = {
    grid: useTransform(p, [0.1, 0.36], [0, 1]),
    rule: useTransform(p, [0.15, 0.44], [0, 1]),
    ticks: useTransform(p, [0.28, 0.52], [0, 1]),
    labels: useTransform(p, [0.36, 0.6], [0, 1]),
  }

  const grid = reduced ? plain : staged.grid
  const ticks = reduced ? plain : staged.ticks
  const labels = reduced ? plain : staged.labels
  const lift = useTransform(staged.labels, [0, 1], [3, 0])

  return (
    <div
      className="plot"
      aria-hidden="true"
      style={
        {
          left: `${PLOT.left}%`,
          right: `${PLOT.right}%`,
          top: `${PLOT.top}%`,
          bottom: `${PLOT.bottom}%`,
          // The grid is drawn by CSS gradients and the ticks by JS; both read the
          // same cell size so they can't drift apart.
          '--cell-x': `${CELL.x}%`,
          '--cell-y': `${CELL.y}%`,
        } as React.CSSProperties
      }
    >
      <motion.div className="plot__grid" style={{ opacity: grid }} />
      <motion.div className="plot__box" style={{ opacity: grid }} />

      {/* The datum axes: ground level and the toe, drawn heavier than the grid
          because they're where the numbers are measured from. */}
      <motion.div
        className="plot__datum plot__datum--x"
        style={reduced ? { opacity: plain } : { scaleX: staged.rule }}
      />
      <motion.div
        className="plot__datum plot__datum--y"
        style={reduced ? { opacity: plain } : { scaleY: staged.rule }}
      />

      <motion.div className="plot__ticks" style={{ opacity: ticks }}>
        {X_TICKS.map((mm) => (
          <i
            key={`x${mm}`}
            className="tick tick--x"
            data-major={isMajor(mm) || undefined}
            style={{ left: `${alongX(mm)}%` }}
          />
        ))}
        {Y_TICKS.map((mm) => (
          <i
            key={`y${mm}`}
            className="tick tick--y"
            data-major={isMajor(mm) || undefined}
            style={{ bottom: `${alongY(mm)}%` }}
          />
        ))}
      </motion.div>

      <motion.div className="plot__labels" style={{ opacity: labels, y: reduced ? 0 : lift }}>
        {X_TICKS.filter(isMajor).map((mm) => (
          <span key={`x${mm}`} className="tick__n tick__n--x" style={{ left: `${alongX(mm)}%` }}>
            {mm}
          </span>
        ))}
        {/* The origin is labelled once, by the x axis — "0" in both corners is noise. */}
        {Y_TICKS.filter((mm) => isMajor(mm) && mm > 0).map((mm) => (
          <span key={`y${mm}`} className="tick__n tick__n--y" style={{ bottom: `${alongY(mm)}%` }}>
            {mm}
          </span>
        ))}
        <span className="plot__unit">mm</span>
      </motion.div>
    </div>
  )
}
