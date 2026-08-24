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

const TITLE = 'the faster you go, the cooler the feel.'

/**
 * The axis, said once for both channels.
 *
 * Both channels are the same geometry, so naming it twice would be labelling the picture rather
 * than the diagram. The same `WALL` as the moisture bench test upstairs, deliberately: a reader who
 * has seen one cross-section on this page already knows which end is the skin.
 *
 * Three marks rather than two. Naming only the outside left the far edge to be inferred, and the
 * whole reading of the section turns on knowing that the air on the right is the air held against
 * you — the microclimate is the subject, so it gets a name.
 */
const MARKS = [
  { at: 0, label: 'outside air', align: 'start' },
  { at: WALL, label: 'the knit', align: 'centre' },
  { at: 1, label: 'inside air', align: 'end' },
] as const

const LAYER_NAMES: { key: keyof Layers; label: string }[] = [
  { key: 'particles', label: 'wind' },
  { key: 'glyphs', label: 'flow' },
  { key: 'heat', label: 'heat' },
]

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
  const [pace, setPace] = useState(PACE.ref)
  const [layers, setLayers] = useState<Layers>({ particles: true, glyphs: true, heat: true })

  /**
   * Metric or imperial, display-only.
   *
   * The model runs in km/h and °C and nothing about it changes with this switch — `windFor`, the
   * committed CURVE and the published payload all stay metric, so the checks keep asserting one
   * set of numbers. Conversion happens at the last moment, in the copy. The °C figures are
   * *differences* (over ambient, cooler than), so Fahrenheit is the delta × 1.8 with no +32 — a
   * 2.5°C drop is a 4.5°F drop, not a 36.5°F one.
   */
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric')
  const speed = (kmh: number) =>
    units === 'metric' ? kmh.toFixed(1) + ' km/h' : (kmh * 0.621371).toFixed(1) + ' mph'
  const degrees = (c: number) =>
    units === 'metric' ? c.toFixed(1) + ' °C' : (c * 1.8).toFixed(1) + ' °F'

  /** Measured and committed, not read live — see the note on `CURVE` in `lib/perforation.ts`. */
  const figures = useMemo(() => predict(pace), [pace])
  /** Solved from the geometry, so a label is right on the first paint. */
  const open = useMemo(() => FABRICS.map((f) => porosityOf(f) * 100), [])

  /* The loop reads refs, so moving the slider never restarts a running field. */
  const paceRef = useRef(pace)
  paceRef.current = pace
  const layerRef = useRef(layers)
  layerRef.current = layers

  const nowFlow = useRef<HTMLCanvasElement>(null)
  const nowGlyph = useRef<HTMLCanvasElement>(null)
  const nextFlow = useRef<HTMLCanvasElement>(null)
  const nextGlyph = useRef<HTMLCanvasElement>(null)

  /* Stable across renders, or the effect that owns both fields would tear down on every movement
     of the slider. */
  const channels = useMemo(
    () =>
      [
        { flow: nowFlow, glyph: nowGlyph, spec: FABRICS[0] },
        { flow: nextFlow, glyph: nextGlyph, spec: FABRICS[1] },
      ] as const satisfies readonly [ChannelRefs, ChannelRefs],
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
      <div className="tunnel__frame">
        <h2 className="tunnel__title tunnel__inset">{TITLE}</h2>

        {/* The verdict, directly under the statement — three figures, and the first is live.
            The pace leads because it is the reader's own number: the two comparisons to its right
            are what that pace costs on one knit and buys on the other. */}
        <div className="tunnel__verdict tunnel__inset" aria-hidden="true">
          <p className="tunnel__figure">
            <b>{speed(pace)}</b>
            <span>is your speed</span>
          </p>
          <p className="tunnel__figure">
            <b>{figures.ratio.toFixed(2)}×</b>
            <span>more air through the knit</span>
          </p>
          <p className="tunnel__figure">
            <b>{degrees(figures.drop)}</b>
            <span>cooler against the skin</span>
          </p>
        </div>

        {/* The control, centred under the figure it drives. No inline label and no output: the
            first figure above it *is* the readout, and it updates as the thumb moves. */}
        <label className="tunnel__pace" aria-label="Set your pace">
          <input
            type="range"
            min={PACE.min}
            max={PACE.max}
            step={PACE.step}
            value={pace}
            onChange={(e) => setPace(Number(e.currentTarget.value))}
          />
        </label>

        {/* Units, under the control — a segmented pill, with the thumb slid by the container's
            data attribute so the two buttons stay plain text over it. */}
        <div className="tunnel__units" data-units={units}>
          {(['metric', 'imperial'] as const).map((u) => (
            <button
              key={u}
              type="button"
              className="tunnel__unit"
              aria-pressed={units === u}
              onClick={() => setUnits(u)}
            >
              {u}
            </button>
          ))}
        </div>

        <div className="tunnel__axis" aria-hidden="true">
          {MARKS.map((mark) => (
            <span
              key={mark.label}
              className="tunnel__mark"
              data-align={mark.align}
              style={mark.align === 'centre' ? { left: `${mark.at * 100}%` } : undefined}
            >
              {mark.label}
            </span>
          ))}
        </div>

        <div className="tunnel__channels">
          <Channel
            spec={FABRICS[0]}
            open={open[0]}
            rise={degrees(figures.rise[0])}
            flow={nowFlow}
            glyph={nowGlyph}
            hint="drag inside to disturb the flow"
            onFallbackFull={setFallbackFull}
          />

          {/* The band between the chambers, and it earns its height by saying what changed.
              Same composition as the prose block upstairs — the label out on the first column,
              the statement running from the fifth — so the page's voice interrupts the
              instrument, rather than a caption floating between two pictures. */}
          <div className="tunnel__between">
            <p className="tunnel__between-label">about the perforations</p>
            <p className="tunnel__between-lead">
              showzero v2 cuts its perforations on a 1.4 mm pitch instead of 2.5 — thirteen jets
              across the channel where today's knit has seven.
            </p>
          </div>

          <Channel
            spec={FABRICS[1]}
            open={open[1]}
            rise={degrees(figures.rise[1])}
            flow={nextFlow}
            glyph={nextGlyph}
            onFallbackFull={setFallbackFull}
          />
        </div>

        {/* The layer switches, centred under the pictures they turn on and off. */}
        <span className="tunnel__layers">
          {LAYER_NAMES.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className="tunnel__layer"
              aria-pressed={layers[key]}
              onClick={() => setLayers((v) => ({ ...v, [key]: !v[key] }))}
            >
              {label}
            </button>
          ))}
        </span>

        {/* Everything on this screen that is a picture, said once in words. */}
        <p className="tunnel__sr">
          Two cross-sections of the ShowZero knit in the same wind, outside air on the left and skin on
          the right, with the knit standing across each channel a third of the way in. Colour is air
          temperature: the body warms the air held against the skin, and airflow through the knit is
          what carries that warmth away. The current knit is{' '}
          {open[0].toFixed(0)} per cent open and holds a microclimate{' '}
          {figures.rise[0].toFixed(1)} °C above ambient. The new knit is {open[1].toFixed(0)} per
          cent open, moves {figures.ratio.toFixed(1)} times the air, and holds it{' '}
          {figures.drop.toFixed(1)} °C cooler at {pace.toFixed(1)} kilometres an hour.
          Both fabrics and every figure here are placeholder, derived from the simulation rather
          than measured in a wind tunnel.
        </p>
      </div>
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
  open,
  rise,
  flow,
  glyph,
  hint,
  onFallbackFull,
}: {
  spec: (typeof FABRICS)[number]
  open: number
  /** Already formatted, so the channel doesn't need to know which units are on. */
  rise: string
  flow: React.RefObject<HTMLCanvasElement | null>
  glyph: React.RefObject<HTMLCanvasElement | null>
  hint?: string
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
        {hint && (
          <p className="tunnel__hint" aria-hidden="true">
            {hint}
          </p>
        )}
        <p className="tunnel__knit">
          {spec.name}
          {spec.tag && <em> {spec.tag}</em>}
        </p>
        <p className="tunnel__read">
          {open.toFixed(0)}% open · {rise} over ambient
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
