import { useEffect, useMemo, useRef } from 'react'
import { useInView, useReducedMotion } from 'motion/react'
import { type ChannelRefs, type Layers, usePerforation } from '../lab/Perforation'
import { FABRICS, PACE, WALL, porosityOf, predict } from '../lib/perforation'

/**
 * ShowZero, twice, in the same wind.
 *
 * Two channels seen in cross-section, stacked and full bleed: **outside air at the left edge, skin
 * at the right**, the knit standing across each. Today's knit on top, the new one below. Same air
 * into both, same pace, and the only difference in the entire model is how open the knit is.
 *
 * **The comparison is a controlled experiment rather than a pair of illustrations.** One loop steps
 * both fields, both take the same wind and the same deterministic inflow perturbation, and nothing
 * in the step reads a random number. See `lab/Perforation.tsx`.
 *
 * **Colour is heat, and that is the whole point of the section.** Airflow is the mechanism; staying
 * cool is the claim. The body puts out heat at the skin edge at a rate that has nothing to do with
 * what you are wearing, and what differs between the two channels is whether the air arriving
 * through the knit carries it away. On today's knit it banks up against the skin and the
 * microclimate glows; on the new one the same body heat leaves as fast as it arrives.
 *
 * An earlier version of this section coloured the field by *velocity*, which said the opposite of
 * what it meant: fast air rendered hot, so the better fabric looked like the hotter one.
 *
 * **Nothing here reads scroll.** This is going on a display, and on a display nobody scrolls, a
 * section that only starts once you have scrolled into the middle of it is a section that is never
 * running when it is looked at. `showing` gates the loop for the frame budget, not for the
 * choreography — the composition and the figures are there from the first paint either way.
 *
 * **Every figure is solver-derived and none of it is measured.** The two porosities are the ones
 * `lib/air.ts` already commits to; the perforation geometry behind them is plausible rather than
 * specified, and the conversion to °C is a scale factor. Nothing here should be shown to a guest
 * without someone who owns the actual knit reading it first.
 */

export function Perforation() {
  const section = useRef<HTMLElement>(null)
  const reduced = !!useReducedMotion()

  /**
   * The reader's variable, and the section's only one.
   *
   * Not persisted and not in the URL, unlike nearly every other control on this site. The reel's
   * dials and the background picker are *settings* that a link should carry; this is an experiment
   * you run while standing in front of it, and it should always open at the reference pace the
   * copy is written against.
   */
  /**
   * Which layers draw. The heat raster is off for now — the temperature field is still solved every
   * frame, so flipping `heat` back to `true` brings the layer up on live data rather than a cold
   * start. See the note in `lab/Perforation.tsx`.
   */
  const layers: Layers = { particles: true, glyphs: true, heat: false }

  /**
   * The wind, fixed at the reference pace. The slider went with the figures it drove: the section
   * now makes exactly one claim — 30% more air — and a variable the copy never answers is a
   * control that only raises questions.
   */
  const pace = PACE.ref



  /** Measured and committed, not read live — see the note on `CURVE` in `lib/perforation.ts`. */
  const figures = useMemo(() => predict(pace), [pace])
  /** Solved from the geometry, so a label is right on the first paint. */
  const open = useMemo(() => FABRICS.map((f) => porosityOf(f) * 100), [])

  /* A ref because the loop's contract wants one; the value never changes any more. */
  const paceRef = useRef(pace)
  paceRef.current = pace
  const layerRef = useRef(layers)
  layerRef.current = layers

  const nowFlow = useRef<HTMLCanvasElement>(null)
  const nowGlyph = useRef<HTMLCanvasElement>(null)
  const nextFlow = useRef<HTMLCanvasElement>(null)
  const nextGlyph = useRef<HTMLCanvasElement>(null)

  /* Stable across renders, or the effect that owns both fields tears down on every parent update. */
  const channels = useMemo(
    () =>
      [
        { flow: nowFlow, glyph: nowGlyph, spec: FABRICS[0] },
        { flow: nextFlow, glyph: nextGlyph, spec: FABRICS[1] },
      ] as const satisfies readonly ChannelRefs[],
    [],
  )

  /**
   * The one thing about this section that depends on where the page is.
   *
   * Not an activation — the composition is drawn either way and the figures are up from the first
   * frame. It is that two pressure solves at sixty frames a second behind two screens of other
   * content is a frame budget spent on nothing.
   */
  const showing = useInView(section, { amount: 0.2 })

  usePerforation({
    channels,
    pace: paceRef,
    layers: layerRef,
    showing,
    reduced,
  })

  /**
   * Published for the checks.
   *
   * `pace`, `wall`, `porosity`, `ratio`, `drop` and `reduced` keep the names and the shapes the old
   * `components/Fabric.tsx` published, because they now mean the same things again: this is the
   * same two-fabric comparison at the same two porosities, so `ratio` is once more the new knit's
   * airflow over today's and `drop` is once more how many °C cooler it keeps the skin.
   *
   * `scripts/fabric.mjs` still asserts the old markup — `.fabric__canvas`, `.fabric__figure > b`,
   * `.fabric__pace` — and none of that is on this section. That script needs re-pointing at
   * `.tunnel`; it is not something this payload can paper over.
   */
  useEffect(() => {
    document.documentElement.dataset.fabric = JSON.stringify({
      pace,
      wall: WALL,
      porosity: open.map((v) => Number((v / 100).toFixed(4))),
      ratio: Number(figures.ratio.toFixed(3)),
      drop: Number(figures.drop.toFixed(2)),
      rise: figures.rise.map((v) => Number(v.toFixed(2))),
      reduced,
    })
  }, [figures, open, pace, reduced])

  return (
    <section className="tunnel" ref={section}>
      {/* Two chambers, half a screen each, and nothing else on the page. Every label is inside a
          picture; there is no white for text to sit on. */}
      <Channel
        spec={FABRICS[0]}
        flow={nowFlow}
        glyph={nowGlyph}
      />

      <Channel
        spec={FABRICS[1]}
        flow={nextFlow}
        glyph={nextGlyph}
      />

        {/* Everything on this screen that is a picture, said once in words. */}
        <p className="tunnel__sr">
          Two cross-sections of a knit in a wind tunnel, one above the other, outside air on the
          left and skin on the right, with the knit standing across the middle of each channel. The
          top channel is ShowZero and the bottom is ShowZero v2; colour is air speed, brightening
          from pale blue in the slow air to green where the flow is fastest. One thing is known
          about v2: it moves 30% more air through the knit, and the two simulations are tuned so
          their solved airflow differs by exactly that. Dragging inside either picture pushes the
          air in that channel. Everything else in the pictures is illustrative rather than
          measured.
        </p>
    </section>
  )
}

/**
 * One channel: the canvases, and the one line that says which knit it is.
 *
 * Both labels sit inside the window, in white, in the two bottom corners — the knit on the left
 * where the approach flow is quiet and dark, its reading on the right over the microclimate the
 * reading is about. Under the picture they cost two bands of page between the channels and pushed
 * the two windows apart, which is the last thing a side-by-side comparison wants.
 */
function Channel({
  spec,
  flow,
  glyph,
}: {
  spec: (typeof FABRICS)[number]
  flow: React.RefObject<HTMLCanvasElement | null>
  glyph: React.RefObject<HTMLCanvasElement | null>
}) {
  const host = useRef<HTMLDivElement>(null)

  return (
    <article className="tunnel__channel" data-knit={spec.id}>
      <div className="tunnel__window" ref={host}>
        <canvas className="tunnel__canvas" ref={flow} aria-hidden="true" />
        <canvas className="tunnel__canvas" ref={glyph} aria-hidden="true" />
        {/* Which chamber is which. The only thing telling them apart now that both are on screen. */}
        <p className="tunnel__knit">
          {spec.name}
          {spec.tag && <em> {spec.tag}</em>}
        </p>
      </div>
    </article>
  )
}
