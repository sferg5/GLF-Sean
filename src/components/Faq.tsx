import { useId, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

/**
 * The questions, at the bottom, in the same voice as the prose section above it: a statement at
 * display size, and the answers set small and quiet. The only difference is that here the
 * answers are folded away until asked for.
 *
 * **The copy is placeholder**, on the same terms as `Prose.tsx`: the features and numbers are
 * lululemon's Split Shift running shoe, rewritten in this page's voice and hung on an invented
 * model. The last answer describes another section of this page rather than the product, which
 * is the honest kind of filler — it's true.
 */

const LEAD = 'Frequently asked questions'

const ITEMS = [
  {
    q: 'What is the midsole made of?',
    a: 'ShiftFoam — the lightest, most responsive foam in the range, and the reason the shoe feels springy rather than soft. It compresses under the foot and hands most of that energy back, which is what you notice on the second half of a run rather than the first.',
  },
  {
    q: 'Why does it roll forward like that?',
    a: 'The midsole is shaped as a rocker, so the platform is already curved in the direction you’re travelling. You aren’t levering yourself over the toe at the end of each stride — the geometry does it, and the heel-to-toe transition smooths out as a result.',
  },
  {
    q: 'How does the upper hold the foot?',
    a: 'Engineered mesh, so the open and closed structures are built in where they’re needed: airflow across the forefoot, more structure through the midfoot. A gusseted tongue keeps it from sliding sideways and a padded collar locks the heel, which together do the work a lace can’t do alone.',
  },
  {
    q: 'What does it weigh, and how does it fit?',
    a: '221g — 7.8oz — in a US women’s 8, on a 7mm heel-to-toe drop. It’s a neutral everyday trainer rather than a race shoe, and it fits true to size for most people.',
  },
  {
    q: 'What colors does it come in?',
    a: 'Five: Lunar White, Mars Red, Neptune Blue, Eclipse Black and Venus Pink. The strip further up the page will say each of their names as you point at them, and the one on the stage is Mars Red — the only name in the set that isn’t invented.',
  },
]

/**
 * Springy but not bouncy, and the same on the way in as on the way out. A drawer that opens
 * faster than it closes reads as two different mechanisms; this one is a fold.
 */
const FOLD = { type: 'spring', stiffness: 320, damping: 34, mass: 0.9 } as const

export function Faq() {
  /**
   * One open at a time, which is what makes it an accordion rather than a list of toggles: the
   * answers are long enough that two open at once pushes the third off the screen, and the
   * question you just asked is the one you want under your eye.
   */
  const [open, setOpen] = useState<number | null>(null)
  const base = useId()

  return (
    <section className="faq" aria-labelledby={`${base}-lead`}>
      <h2 className="faq__lead" id={`${base}-lead`}>
        {LEAD}
      </h2>

      <ul className="faq__list">
        {ITEMS.map((item, i) => (
          <Row
            key={item.q}
            id={`${base}-${i}`}
            item={item}
            open={open === i}
            onToggle={() => setOpen(open === i ? null : i)}
          />
        ))}
      </ul>
    </section>
  )
}

function Row({
  id,
  item,
  open,
  onToggle,
}: {
  id: string
  item: { q: string; a: string }
  open: boolean
  onToggle: () => void
}) {
  const reduced = !!useReducedMotion()

  return (
    <li className="faq__row" data-open={open ? '' : undefined}>
      {/* A `button` inside the row rather than a clickable row: the question is the control, so
          it should be the thing that takes focus and announces its state. `aria-expanded` is
          what says "expanded", and the mark beside it is styled off the same attribute so the
          two can't disagree. */}
      <button
        type="button"
        className="faq__q"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
      >
        <span>{item.q}</span>
        <span className="faq__mark" aria-hidden="true" />
      </button>

      {/**
       * `height: auto` both ways, which motion measures for us — the alternative is a
       * max-height guess that either clips a long answer or eases through empty space on a
       * short one, and these answers differ by a factor of two.
       *
       * `AnimatePresence` rather than a permanently-mounted panel at `height: 0`, so a closed
       * answer is out of the accessibility tree and out of a find-in-page rather than merely
       * invisible.
       */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            role="region"
            className="faq__a"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            /* Reduced motion gets the answer, not the fold: the height is what moves the rest
               of the list, and that's the movement to hand back. */
            transition={reduced ? { duration: 0 } : FOLD}
          >
            <p>{item.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}
