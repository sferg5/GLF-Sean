import { motion } from 'motion/react'
import { EndPhoto, StartPhoto } from './Photo'
import type { VariantProps } from '../variants/types'

/**
 * The `prefers-reduced-motion` form of every variant.
 *
 * Reduced motion means gentler, not nothing: the state change still has to be
 * communicated, so opacity stays and it stays scroll-linked. What goes is all
 * movement — no sweeps, no scan bars, no camera push, nothing travelling across
 * the frame.
 *
 * This does ghost slightly at the heel collar and laces, which genuinely differ
 * between the two photographs. Unavoidable without motion to hide it.
 */
export const Crossfade = ({ p }: Pick<VariantProps, 'p'>) => (
  <>
    <StartPhoto />
    <motion.div className="layer" style={{ opacity: p }}>
      <EndPhoto />
    </motion.div>
  </>
)
