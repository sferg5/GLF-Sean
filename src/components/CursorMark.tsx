import { useEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion, useSpring, type MotionValue } from 'motion/react'

/**
 * The mark that replaces the pointer over the strip.
 *
 * It's the lockup's own dot, taken off the tile and put under the cursor: same size,
 * same colour, and it takes the colourway you're pointing at, so the mark, the tile and
 * the wordmark are all saying the same thing at once. That's also why the tile's static
 * dot goes away while this is up — two circles of the same colour a few pixels apart is
 * one too many, and the one attached to the pointer is the one that's answering you.
 *
 * The arrow is knocked out in `--page` rather than in white, because a white arrow inside
 * Lunar White's grey has nothing to hold onto; the wall's own colour is the one value
 * guaranteed to contrast with a mark that was picked to contrast with the wall. It was
 * `--bg` when this section followed the picker, which is the same argument against a wall
 * that could move underneath it.
 *
 * **Position is sprung, not tracked.** A mark pinned exactly to the pointer is just a
 * cursor and reads as a rendering artefact — the small lag is what makes it an object
 * being dragged along. It's stiff enough to stay under the hand.
 */

/** Quick, with about a frame and a half of trail at speed. */
const FOLLOW = { stiffness: 620, damping: 42, mass: 0.7 }

export function CursorMark({
  shown,
  x,
  y,
  ink,
  inkDark,
}: {
  shown: boolean
  /** Viewport coordinates, written by whatever owns the region this appears over. */
  x: MotionValue<number>
  y: MotionValue<number>
  /** Colour on a light wall, and on a dark one — as everywhere else on the strip. */
  ink: string
  inkDark?: string
}) {
  const reduced = !!useReducedMotion()
  const sx = useSpring(x, FOLLOW)
  const sy = useSpring(y, FOLLOW)

  /**
   * Arrive where the pointer is, not from where the pointer was.
   *
   * The spring is still holding wherever the pointer left the strip last time, and
   * animating from there sends the mark flying in across the page to catch up. `jump`
   * sets the value without animating, which is the difference between a mark appearing
   * under the hand and a mark chasing it.
   */
  useEffect(() => {
    if (!shown) return
    sx.jump(x.get())
    sy.jump(y.get())
  }, [shown, sx, sy, x, y])

  return (
    /**
     * Two elements, and they have to be two.
     *
     * Position and appearance are both transforms, and with `x`, `scale` and an `initial`
     * on one element motion resolves them together: the entrance's target had no `x` in
     * it, so mounting the mark animated it to zero — from under the pointer to the corner
     * of the window — while the motion value it was supposed to be bound to sat at the
     * right number the whole time. Splitting them gives each transform one owner. The
     * outer one is never unmounted, so the binding survives the mark coming and going.
     */
    <motion.div
      className="cursormark"
      aria-hidden
      style={{
        // Under reduced motion the mark is pinned to the pointer. A spring is a thing
        // moving on its own, and the position has to keep up with the hand either way,
        // so the honest reduction is to remove the lag, not the mark.
        x: reduced ? x : sx,
        y: reduced ? y : sy,
        // Cast separately: these two are motion values and have to stay that way, so the
        // custom properties can't ride along in one `CSSProperties` claim.
        ...({ '--mark-ink': ink, '--mark-ink-dark': inkDark ?? ink } as React.CSSProperties),
      }}
    >
      <AnimatePresence>
        {shown && (
          <motion.div
            className="cursormark__body"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            /* All the way to nothing, and on opacity's own terms it stays at 1 the whole
               way — a mark that collapses to a point hands the cursor back, where one
               that fades leaves a ghost over the arrow that has already replaced it.
               Accelerating out, so the last frames are the small ones. */
            exit={{ scale: 0, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
            transition={{ duration: 0.2, ease: [0.19, 1, 0.22, 1] }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
              <path d="M8 16 16 8M9.5 8H16v6.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
