import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { easeOutQuad, remap } from '../lib/remap'

/**
 * The one section with nothing to look at.
 *
 * The composition is the one from the reference: a small label out on the left, eight of the
 * twelve columns given to text set large, and a row of facts under it. The label sits alone in
 * a lot of empty space, which is the whole point of it — the emptiness is what turns eight
 * columns of type into a page rather than a paragraph. After three sections of photographs,
 * footage and product, the page needs somewhere to say a thing in words, and the way this reads
 * as a *pause* is that it has no picture in it at all.
 *
 * **The copy is a prop, and the shoe's is the default.** Show zero wanted the same composition
 * after its bench test — same reason, same shape, different subject — and the alternative was a
 * second copy of the reveal, the grid classes and the `dl` markup with three sentences changed.
 * So the section takes its words, and the wall it stands on, and nothing else: everything about
 * how it reads is here, everything it says is at the call site.
 *
 * **The copy is placeholder**, but it is placeholder built out of a real spec: the features and
 * numbers are lululemon's Split Shift running shoe — engineered mesh, ShiftFoam, the rocker,
 * the women's flex groove, 221g and 7mm — rearranged into this page's voice. The shoe on the
 * stage is still an invented model, so nothing here should ship as product copy without someone
 * who owns the actual spec reading it first. The same caveat the call-out labels carry — and it
 * covers the facts below too, the release date most of all.
 */

export type ProseCopy = {
  label: string
  lead: string
  body: string
  /**
   * The facts under the text. A spec sheet's worth of a product page, reduced to the things that
   * would decide whether you read any further: when, who for, how many ways, what for. Four of
   * them, because the row is four columns of the eight the text has — a fifth wraps onto a
   * second line under the first, which reads as a table that ran out of room.
   */
  facts: readonly { label: string; value: string }[]
}

export const SHOE_PROSE: ProseCopy = {
  label: 'About',
  lead: 'Two hundred and twenty-one grams, seven millimetres of drop, and a shape that would rather you kept moving. Most of what makes a shoe feel fast is geometry you never see.',
  body: 'The upper is engineered mesh — open where the foot needs air, structured where it needs holding — with a gusseted tongue and a padded collar doing the work a lace can’t do alone. Under it, ShiftFoam takes the impact and hands most of it back, shaped into a rocker that rolls you off the toe rather than asking you to lever yourself over it. The arch is reinforced without being sealed shut, and there’s an extra flex groove cut into the outsole along the line a woman’s footstrike actually follows.',
  facts: [
    { label: 'Release date', value: 'September 2027' },
    { label: 'Gender', value: 'Men and women' },
    { label: 'Total colors', value: '6' },
    { label: 'Activity', value: 'Running' },
  ],
}

/**
 * The reveal runs over the section's arrival: the label and the text rise together, the facts
 * follow them. In `svh` of scroll like the reel, because these are beats rather than fractions —
 * and short ones, because the section is a pause and not an event.
 */
const HEAD = [16, 62] as const
const TEXT = [40, 86] as const

/**
 * Which wall the section stands on.
 *
 * `shot` is the picked one — the statement about the shoe stays on the wall the shoe was
 * photographed against, and its ink flips with the picker. `page` is the fixed light wall
 * every other section is on, which is the only correct answer anywhere the picker isn't:
 * `--bg` is persisted, so a section on another page would otherwise inherit a near-black
 * wall from a choice somebody made about a photograph they aren't looking at.
 */
type Wall = 'shot' | 'page'

export function Prose({ copy = SHOE_PROSE, wall = 'shot' }: { copy?: ProseCopy; wall?: Wall } = {}) {
  const section = useRef<HTMLElement>(null)
  const reduced = !!useReducedMotion()

  /**
   * `start end` → `end end`: the whole reveal happens while the section is arriving, so it is
   * finished by the time it's centred and there's nothing left animating while you read.
   */
  const { scrollYProgress } = useScroll({ target: section, offset: ['start end', 'end end'] })
  const s = useTransform(scrollYProgress, (v) => v * 100)

  const head = useTransform(s, (v) => easeOutQuad(remap(v, HEAD[0], HEAD[1], 0, 1)))
  const text = useTransform(s, (v) => easeOutQuad(remap(v, TEXT[0], TEXT[1], 0, 1)))

  /**
   * Reduced motion keeps the fade and drops the rise. The two forms end identically — which
   * they must, since this is type and the only thing that could differ is where it stopped.
   */
  const headY = useTransform(head, (v) => (reduced ? 0 : `${(1 - v) * 2.4}svh`))
  const textY = useTransform(text, (v) => (reduced ? 0 : `${(1 - v) * 1.6}svh`))

  return (
    <section className={`prose prose--${wall}`} ref={section}>
      {/* The label rides the text's beat rather than one of its own: they're one line of the
          composition read left to right, and staggering them would make the label an event. */}
      <motion.p className="prose__label" style={{ opacity: head, y: headY }}>
        {copy.label}
      </motion.p>

      {/* The two paragraphs take the beat one at a time rather than the block taking it once.
          They're identical transforms on adjacent boxes, so it looks the same — but the copy
          is what this section is, and an opacity on each paragraph is the thing a check can
          read. See `scripts/sections.mjs`. */}
      <div className="prose__text">
        <motion.p className="prose__lead" style={{ opacity: head, y: headY }}>
          {copy.lead}
        </motion.p>
        <motion.p className="prose__body" style={{ opacity: head, y: headY }}>
          {copy.body}
        </motion.p>
      </div>

      <motion.dl className="prose__facts" style={{ opacity: text, y: textY }}>
        {copy.facts.map((fact) => (
          /* `dl` in columns needs the pairs wrapped, otherwise the grid lays out eight
             independent cells and a two-line value shoves its neighbour's label down. */
          <div className="prose__fact" key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </motion.dl>
    </section>
  )
}
