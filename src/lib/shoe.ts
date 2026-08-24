/**
 * Geometry of the two photographs, in percentages of the stage box.
 *
 * Every number here is produced by `node scripts/measure.mjs`, which decodes both
 * PNGs and compares them pixel-by-pixel. Re-run it if the images are ever replaced;
 * none of this survives a re-shoot.
 *
 * The masters are 1536x1024 (= 3/2) RGBA cutouts: 44% solid shoe, 2.4% feathered
 * edge, 54% clear. Two consequences run through the whole app:
 *
 * 1. Outside the silhouette there is nothing in either image, so blending there is
 *    a literal no-op — the seam of any reveal only ever lands on shoe.
 * 2. Layers can be transformed independently. The previous pair had the studio
 *    backdrop baked into the pixels, so moving one layer tore the background against
 *    the other; with cutouts there's no background to tear, which is what makes
 *    END_FIT below possible.
 */

export const MASTER = { w: 1536, h: 1024 } as const

const px = (x: number) => (x / MASTER.w) * 100
const py = (y: number) => (y / MASTER.h) * 100

/**
 * Registration correction for the cross-section layer.
 *
 * These two were cut out separately and don't agree the way the previous pair did:
 * their tops align to within ~5px but B's sole sits ~12px lower, so no translation
 * fixes both ends — the shoe is 2.9% taller. A vertical squash does, and takes the
 * silhouette disagreement from 4.52% of its area down to 2.07%. What's left is
 * genuine shape difference: the heel counter and the collar.
 *
 * Applied to the end layer as `transform`, leaving the `translate` property free for
 * the debug nudge.
 */
export const END_FIT = {
  scaleY: 0.97,
  translateX: px(-6), // -0.4%
  translateY: py(10), //  1.0%
  originX: px(774), // 50.4%
  originY: py(196), // 19.1%
} as const

export const SHOE = {
  /** Union of both silhouettes. The shoe runs nearly edge to edge in this framing. */
  toeX: px(30), //   2.0%
  heelX: px(1518), // 98.8%
  topY: py(192), //  18.8%
  soleY: py(905), //  88.4%

  /**
   * Centroid of the difference between the two images, weighted by magnitude — i.e.
   * where "the inside of the shoe" visually is. Measured on the corrected pair, and
   * only where both images are solid.
   */
  focus: { x: 45.8, y: 55.6 },

  /**
   * The reveal's axis: the difference-weighted centre of each column, heavily
   * smoothed — a line through the heart of what changes, low at the toe, rising
   * through the midfoot, falling again at the heel.
   */
  spine: [
    [7.2, 60.1],
    [14.3, 61.7],
    [21.5, 63.7],
    [28.6, 63.4],
    [35.8, 60.0],
    [43.0, 55.6],
    [50.1, 50.9],
    [57.3, 46.7],
    [64.5, 49.9],
    [71.6, 55.9],
    [78.8, 56.4],
    [85.9, 54.7],
  ] as const,

  /** Half-width the bloom must reach to cover every shoe pixel from the spine. */
  spineReach: 391,
} as const

export const SRC = {
  start: '/shoe/start.png',
  end: '/shoe/end.png',
} as const
