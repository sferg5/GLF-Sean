import { SRC } from '../lib/shoe'

const ALT_START = 'A running shoe photographed from the side, intact.'
const ALT_END =
  'The same shoe cut in half lengthwise, showing the foam midsole, the plate and the interior of the upper.'

/**
 * The two photographs. Neither is ever transformed directly — variants transform
 * wrappers around them. The images have no alpha channel, so the studio backdrop
 * is baked into the pixels: moving one layer on its own would tear the background
 * against the other layer.
 */
export const StartPhoto = () => (
  <img className="layer" src={SRC.start} alt={ALT_START} draggable={false} />
)

/**
 * `layer--end` picks up the debug nudge offset, so registration can be probed
 * during any variant, not just in the difference view.
 */
export const EndPhoto = () => (
  <img className="layer layer--end" src={SRC.end} alt={ALT_END} draggable={false} />
)
