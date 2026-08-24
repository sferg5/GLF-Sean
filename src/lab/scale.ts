/**
 * The plate's millimetre scale.
 *
 * The axes could have been decorative — a ruler drawn to look like a ruler. They
 * aren't. One real measurement anchors the whole grid: a men's US10 road shoe is
 * about 300mm heel to toe, and `measure.mjs` already tells us the silhouette spans
 * 1.95%–98.83% of the stage. Everything else falls out of those two numbers and
 * the box's fixed 3:2.
 *
 * That's worth the arithmetic because the numbers are *read*. A grid labelled
 * 0–300 that puts 300 exactly on the heel and puts the collar just under its
 * 150mm ceiling looks like an instrument. One labelled 0–100 across an arbitrary
 * box looks like a texture, and the difference is legible even to someone who
 * never checks.
 */

import { SHOE } from '../lib/shoe'

/** Nominal specimen length. The one measured-from-the-world number here. */
export const SPECIMEN_MM = 300

const SPAN = (SHOE.heelX - SHOE.toeX) / 100

/** Stage box in millimetres. Height follows from the 3:2, so the scale is isotropic. */
export const STAGE_MM = { w: SPECIMEN_MM / SPAN, h: (SPECIMEN_MM / SPAN) * (2 / 3) } as const

/** Tallest gridline. 150mm clears the collar (~144mm) by a hair, which is what a sensible axis does. */
export const HEIGHT_MM = 150

/**
 * Plot rectangle, in % of the stage box.
 *
 * Its origin is the toe at ground level — the datum a shoe is actually measured
 * from — so the frame hugs the silhouette instead of floating around it.
 */
export const PLOT = {
  left: SHOE.toeX,
  right: 100 - SHOE.heelX,
  bottom: 100 - SHOE.soleY,
  top: SHOE.soleY - (HEIGHT_MM / STAGE_MM.h) * 100,
} as const

const width = 100 - PLOT.left - PLOT.right
const height = 100 - PLOT.top - PLOT.bottom

/** Position within the plot, 0..100, for a length in mm along each axis. */
export const alongX = (mm: number) => (mm / SPECIMEN_MM) * 100
export const alongY = (mm: number) => (mm / HEIGHT_MM) * 100

/** Same points expressed in stage %, for anything living outside the plot box. */
export const stageX = (mm: number) => PLOT.left + (alongX(mm) / 100) * width
export const stageY = (mm: number) => 100 - PLOT.bottom - (alongY(mm) / 100) * height

/** Gridlines every 25mm — square cells, since the scale is isotropic. */
export const STEP_MM = 25

const series = (max: number, step: number) =>
  Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step)

export const X_TICKS = series(SPECIMEN_MM, STEP_MM)
export const Y_TICKS = series(HEIGHT_MM, STEP_MM)

/** Labelled every other gridline: 25mm ticks are for reading against, not for reading. */
export const isMajor = (mm: number) => mm % (STEP_MM * 2) === 0

/** Cell size as a % of the plot box, for the CSS grid gradients. */
export const CELL = {
  x: (STEP_MM / SPECIMEN_MM) * 100,
  y: (STEP_MM / HEIGHT_MM) * 100,
} as const
