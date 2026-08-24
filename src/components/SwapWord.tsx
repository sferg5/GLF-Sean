import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

/**
 * One word replacing another, letter by letter, through a mask.
 *
 * Every letter sits in its own window the height of the line and leaves through the top
 * of it; the word that replaces it arrives from the bottom of its own. Nothing crosses
 * the space between lines, so the swap reads as the *same* word changing rather than two
 * words trading places.
 *
 * **Out the bottom, in from the bottom.** A letter drops out of its window and its
 * replacement comes back up through the same edge, so the two words hand over in place
 * rather than one passing the other. The word changes the way a split-flap board does:
 * position by position, and always in the same direction.
 *
 * **The two halves interleave, and are still never both visible in one place.** Each
 * letter's entrance is delayed by exactly the length of its own exit, so the column it
 * lands in is empty when it arrives. What that buys over waiting for the whole word to
 * clear is the middle of the new name arriving while the ends of the old one are still
 * leaving — which is the swap reading as one movement instead of two.
 *
 * The words are laid one over the other and each is centred on its own width, so the
 * thing that keeps them apart horizontally is the order the stagger runs in. **From the
 * middle out**, the letters still on screen from the old word are always the outer ones
 * and the letters already arrived from the new word are always the inner ones — an
 * annulus and a disc, which don't intersect. Left to right, the same timing would put
 * the new word's opening letters straight through the old word's closing ones.
 *
 * It's the better reading order for its own sake as well: from the middle, the letters
 * that carry most of a lower-case word's silhouette go first and the ends catch up. Left
 * to right makes the last letter change a beat after the word is already readable, so
 * the eye finishes the word and then gets interrupted. And the delay is symmetric, so
 * words of different lengths take the same time.
 */

/** The page's own out-curve. Its mirror takes the outgoing letters away. */
const ENTER = [0.19, 1, 0.22, 1] as const
const EXIT = [0.7, 0, 0.84, 0] as const

/**
 * The exit is quick — it's dead time in the column it's leaving, and the entrance is
 * the part with something to read. The middle of a word turns over in `OUT + IN`, 380ms,
 * and the ends follow at one step per letter of distance from it.
 */
const IN = 0.24
const OUT = 0.14

/**
 * Per letter of distance from the middle — the cascade, and the only thing making this
 * legible as letter-by-letter rather than as a word wiping. Five and a half steps at the
 * widest, so `lunar white` finishes ~140ms after `mars red` would.
 */
const STEP = 0.026

/**
 * `custom` is a letter's distance from the middle, in letters.
 *
 * `from` and `exit` are the same edge on purpose: a letter leaves through the bottom and
 * the next one comes back up through it. The entrance is offset by the exit's own
 * duration, so a letter starts rising exactly as its predecessor clears the window.
 */
const travel = {
  from: { y: '105%' },
  enter: (n: number) => ({
    y: '0%',
    transition: { duration: IN, delay: OUT + n * STEP, ease: ENTER },
  }),
  exit: (n: number) => ({
    y: '105%',
    transition: { duration: OUT, delay: n * STEP, ease: EXIT },
  }),
}

/**
 * Reduced motion gets the swap without the travel — and without the stagger, since a
 * staggered fade is still a thing crawling across the screen. It also drops to a
 * quarter of the duration: with nothing moving there's no gesture left to read, and
 * the only job remaining is to not blink.
 */
const fade = {
  from: { opacity: 0 },
  enter: { opacity: 1, transition: { duration: 0.12 } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
}

export function SwapWord({
  text,
  ink,
  inkDark,
  className,
}: {
  text: string
  /** Colour on a light wall, and on a dark one. CSS picks off `data-bg-light`. */
  ink: string
  inkDark?: string
  className?: string
}) {
  const reduced = !!useReducedMotion()
  const letters = [...text]
  const middle = (letters.length - 1) / 2

  return (
    // The label is on the control that sets this word, so the word itself is
    // decoration — and a per-letter split is read out one letter at a time, which is
    // worth hiding for its own sake.
    <span className={`swapword${className ? ` ${className}` : ''}`} aria-hidden>
      {/* Keyed on the text: a new word is a new subtree, which is what gives the old one
          an exit to run. `initial={false}` so the first paint is just the word, not the
          word arriving. Sync rather than `mode="wait"` — the handover is per column and
          the timing above is what sequences it, so making the whole word wait would only
          add the one delay this is designed not to have. */}
      <AnimatePresence initial={false}>
        <motion.span
          key={text}
          className="swapword__word"
          style={
            { '--word-ink': ink, '--word-ink-dark': inkDark ?? ink } as React.CSSProperties
          }
          initial="from"
          animate="enter"
          exit="exit"
        >
          {letters.map((ch, i) => (
            <span className="swapword__cell" key={i}>
              <motion.span
                className="swapword__glyph"
                variants={reduced ? fade : travel}
                custom={Math.abs(i - middle)}
              >
                {/* No-break space: a cell holding an ordinary one collapses to nothing,
                    and the word loses the gap between its halves. */}
                {ch === ' ' ? '\u00a0' : ch}
              </motion.span>
            </span>
          ))}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
