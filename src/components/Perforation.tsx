import { useEffect, useMemo, useRef, useState } from 'react'
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

  /**
   * Fullscreen, tracked here rather than only in the channel that owns the button, because it
   * gates the loop: inside native fullscreen only the fullscreen element paints, and an
   * IntersectionObserver watching the section is entitled to say the section left the viewport —
   * which would stop the very simulation the reader just enlarged. `showing || full` keeps it
   * running. It also forces the rebuild: the effect re-runs when this flips, and the rebuild
   * measures the host at its new size.
   */
  const [nativeFull, setNativeFull] = useState(false)
  const [fallbackFull, setFallbackFull] = useState(false)
  useEffect(() => {
    const doc = document as Document & { webkitFullscreenElement?: Element | null }
    const onChange = () => setNativeFull(!!(document.fullscreenElement ?? doc.webkitFullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange as EventListener)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange as EventListener)
    }
  }, [])

  usePerforation({
    channels,
    pace: paceRef,
    layers: layerRef,
    showing: showing || nativeFull || fallbackFull,
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
        onFallbackFull={setFallbackFull}
      />

      {/* The seam, said out loud.

          A hairline used to sit here doing nothing but keeping the two pictures from bleeding into
          each other. It now carries the one instruction, which is the only thing on this screen
          that isn't a picture or a name — and putting it in the join rather than in a corner of the
          top chamber makes it read as addressed to both of them, which it is. Black rather than the
          ground colour: a true black band is the one value that reads as a frame edge instead of as
          more sky, so the two fields stay separate pictures. */}
      <p className="tunnel__seam">touch to direct the air flow</p>

      <Channel
        spec={FABRICS[1]}
        flow={nextFlow}
        glyph={nextGlyph}
        onFallbackFull={setFallbackFull}
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
  onFallbackFull,
}: {
  spec: (typeof FABRICS)[number]
  flow: React.RefObject<HTMLCanvasElement | null>
  glyph: React.RefObject<HTMLCanvasElement | null>
  /** Reports CSS-overlay fullscreen up to the parent, which gates the loop on it. */
  onFallbackFull: (on: boolean) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const [full, setFull] = useState(false)
  const [fallback, setFallback] = useState(false)

  /* Native fullscreen is owned by the document, not by this button — Escape and the browser's own
     chrome both exit it — so the icon follows the document's state rather than assuming the click
     was the only way out. */
  useEffect(() => {
    const doc = document as Document & { webkitFullscreenElement?: Element | null }
    const onChange = () =>
      setFull((document.fullscreenElement ?? doc.webkitFullscreenElement) === host.current)
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange as EventListener)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange as EventListener)
    }
  }, [])

  /* The fallback exists for the browsers with no element fullscreen — iPhones, mainly, which is
     not a hypothetical audience for this page. Same interaction, a fixed overlay instead of the
     API, and Escape is wired by hand because nothing native is there to do it. */
  useEffect(() => {
    if (!fallback) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFallback(false)
        onFallbackFull(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fallback, onFallbackFull])

  const toggle = () => {
    const el = host.current as
      | (HTMLDivElement & { webkitRequestFullscreen?: () => void })
      | null
    if (!el) return
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null
      webkitExitFullscreen?: () => void
    }
    const supported = el.requestFullscreen ?? el.webkitRequestFullscreen
    if (supported) {
      if (document.fullscreenElement ?? doc.webkitFullscreenElement) {
        ;(document.exitFullscreen ?? doc.webkitExitFullscreen)?.call(document)
      } else {
        supported.call(el)
      }
    } else {
      const next = !fallback
      setFallback(next)
      onFallbackFull(next)
    }
  }

  const isFull = full || fallback

  return (
    <article className="tunnel__channel" data-knit={spec.id}>
      <div className="tunnel__window" ref={host} data-full={fallback || undefined}>
        <canvas className="tunnel__canvas" ref={flow} aria-hidden="true" />
        <canvas className="tunnel__canvas" ref={glyph} aria-hidden="true" />
        {/* Which chamber is which. The only thing telling them apart now that both are on screen. */}
        <p className="tunnel__knit">
          {spec.name}
          {spec.tag && <em> {spec.tag}</em>}
        </p>
        {/* Stops its own pointerdown: the window's drag handler sits on the host, and a click on
            the expand button should not also stir the corner of the flow. */}
        <button
          type="button"
          className="tunnel__expand"
          aria-pressed={isFull}
          aria-label={isFull ? 'Exit full screen' : 'View full screen'}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={toggle}
        >
          <svg
            data-icon="open"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9.75 2.75h3.5v3.5" />
            <path d="M13.25 2.75 9.5 6.5" />
            <path d="M6.25 13.25h-3.5v-3.5" />
            <path d="M2.75 13.25 6.5 9.5" />
          </svg>
          <svg
            data-icon="close"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3.25 3.25l9.5 9.5" />
            <path d="M12.75 3.25l-9.5 9.5" />
          </svg>
        </button>
      </div>
    </article>
  )
}
