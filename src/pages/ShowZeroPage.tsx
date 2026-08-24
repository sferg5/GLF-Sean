import { Prose, type ProseCopy } from '../components/Prose'
import { Perforation } from '../components/Perforation'
import { ShowZeroHero } from '../showzero/ShowZeroHero'

/**
 * Show zero. Three blocks: the moisture bench test, the words, and the airflow bench test.
 *
 * **The airflow block changed instrument.** It was `components/Fabric.tsx` — two fabrics side by
 * side in the same wind, particles counted through each — and it is now
 * `components/Perforation.tsx`, which solves the flow field against one specimen at a time and
 * reads its figures off it. The old component and its model (`lib/air.ts`, `lab/WindTunnel.tsx`)
 * are still in the tree and still tested by `scripts/air.sh`; nothing renders them. `scripts/fabric.mjs`
 * asserts the old markup and needs rewriting against `.tunnel`.
 * Default export because the page is a `lazy()` chunk — it's the boundary that keeps three.js
 * out of the shoe bundle.
 *
 * **There was a closing statement and it's gone.** "all of the work. none of the evidence." sat
 * between the prose and the wind tunnels, on the prose/FAQ composition, and its job was to be
 * the line you leave on. What it actually did was restate the hero in words directly under a
 * paragraph that had already explained it, and then hand off to a second bench test — so the
 * page said the same thing three times and ended on a measurement anyway. The page ends on the
 * measurement now, which is a better place to leave someone.
 *
 * The two tests are different questions, which is why they bracket the prose rather than sit
 * together: the hero is about what the knit *doesn't* do (show sweat) and the tunnels are about
 * what it does (move air, and keep the air on your skin near ambient). The first two blocks are
 * on `--page` — the picker is a control on the shoe page and its choice is persisted, so a
 * section here on `--bg` would take a near-black wall from a decision about a photograph that
 * isn't on this page — and the tunnels are a dark instrument, where the seam at the top of them
 * is the point at which the page stops making a claim and starts measuring one.
 */

/**
 * The knit, in the page's voice — lower case, and about the fabric rather than the garment.
 *
 * **Placeholder, and further from a real spec than the shoe's.** ShowZero is not a product:
 * the hero simulates a two-face moisture claim that this copy then states in words, and the
 * weight, the fibre and the date are invented to the shape of a fabric card. Nothing here
 * should ship without someone who owns an actual knit reading it first — the same caveat the
 * shoe's prose and the call-out labels carry.
 */
const KNIT_PROSE: ProseCopy = {
  label: 'about the knit',
  lead: 'sweat is not the problem. the map of it across your back is. showzero knit moves moisture through the fabric and lets it go before it can gather into a shape anyone can read.',
  body: 'it is a two-face knit: the inner face pulls moisture off the skin and the outer spreads it thin enough to leave, so the same water that blooms into one dark patch on standard jersey dries across a whole panel instead of pooling where you sweat hardest. the yarn is recycled nylon with elastane through the cross-grain, so it comes back to shape between reps, and the face is dyed to hold its value wet — nothing to show, and nothing to darken either.',
  facts: [
    { label: 'release date', value: 'august 2027' },
    { label: 'weight', value: '142 g/m²' },
    { label: 'composition', value: 'recycled nylon, elastane' },
    { label: 'activity', value: 'training, hot yoga' },
  ],
}

export default function ShowZeroPage() {
  return (
    <main className="showzero">
      <ShowZeroHero />

      {/* `page` rather than the picked wall: the picker is a control on the shoe page and its
          choice is persisted, so a section here on `--bg` would take a near-black wall from a
          decision somebody made about a photograph that isn't on this page. */}
      <Prose copy={KNIT_PROSE} wall="page" />

      <Perforation />
    </main>
  )
}
