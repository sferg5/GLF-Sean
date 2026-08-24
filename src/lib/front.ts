/**
 * The section front: one travelling edge, shared by everything that has to agree
 * with it.
 *
 * The reveal mask, the point cloud's release order and the scan rule are three
 * different renderers — CSS gradient, canvas, DOM — and they sit directly on top
 * of each other. If any of them derives its own idea of where the front is, the
 * cloud detaches somewhere the mask hasn't reached and the whole thing stops
 * reading as one instrument passing over the shoe. So the geometry lives here and
 * they all consume it.
 *
 * Units are fractions of the stage box's width, matching `lib/points.ts`. The
 * front travels past both edges: outside the silhouette there is nothing in
 * either photograph, so overshooting costs nothing and avoids a visible hard stop.
 */

import { mix } from './remap'

/**
 * Half-width of the blend ramp. The full ramp spans twice this — ~370px on a
 * 1150px stage — which is wide enough that the ~7px of genuine shape difference
 * between the two cutouts has no edge to show at.
 *
 * Verified as a genuine linear blend rather than an eased-looking step by
 * recovering the per-column blend weight from a render: 1.00 at x=240 falling
 * smoothly to 0.05 at x=600, exactly the span configured here.
 */
export const FEATHER = 0.16

/** Front position for progress `p`, in fractions of stage width. */
export const frontAt = (p: number) => mix(-FEATHER, 1 + FEATHER, p)

/**
 * How long a released point keeps travelling, measured in how far the front moves
 * on past it — again in stage widths.
 *
 * This is deliberately several times the ramp. A short wake keeps every point
 * inside the silhouette for its whole life, and a point on top of the photograph
 * it was sampled from is invisible either way: white foam under white marks on the
 * blueprint, graphite lost in the shoe's own detail on paper. The cloud only reads
 * once it has cleared the shoe and is over the open sheet, which takes distance and
 * therefore takes time.
 */
export const WAKE = FEATHER * 5.2
