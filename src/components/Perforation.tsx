import { useEffect, useMemo, useRef, useState } from 'react'
import { useInView, useReducedMotion } from 'motion/react'
import { type Layers, usePerforation } from '../lab/Perforation'
import {
  DIA,
  FABRICS,
  type FabricId,
  PITCH,
  REFERENCE,
  type Reading,
  WALL,
  WIND,
  byId,
} from '../lib/perforation'

/**
 * The airflow bench test, replacing the two-channel comparison that stood here.
 *
 * **What changed and why.** The old section put two fabrics side by side in the same wind and
 * counted what got through — a clean argument, and a closed one: two fixtures, one slider, one
 * verdict. This is the same question asked as an instrument instead. One specimen at a time, seven
 * of them across the whole range from a tight commuter woven to an open mesh, and the perforation
 * geometry itself on two sliders underneath — so the reader is not choosing between two answers
 * somebody else prepared, they are moving the variable and watching the flow answer.
 *
 * That trade is worth stating plainly, because the old section was better at one thing: a
 * comparison is legible in a second and a parameter space is not. What this buys is that the
 * picture is now *solved* rather than transported — air accelerates through a hole because
 * continuity makes it, stagnation banks up on the upstream face, the jets shed into a wake — and
 * the figures underneath are read off that field rather than looked up. See `lib/perforation.ts`.
 *
 * **Nothing here reads scroll**, same as the section it replaces and for the same reason: this is
 * going on a display, and on a display nobody scrolls, a section that only starts once you have
 * scrolled into the middle of it is a section that is never running when it's looked at. `showing`
 * gates the loop for the frame budget, not for the choreography — the composition and the figures
 * are there from the first paint either way.
 *
 * **Every figure is solver-derived and none of it is measured.** The perforation numbers per fabric
 * are plausible rather than specified and the unit conversions are scale factors. Nothing here
 * should be shown to a guest without someone who owns an actual knit reading it first — the same
 * caveat the shoe's prose, the call-out labels and the old section all carry, and it applies harder
 * here because these numbers look like instrument readings.
 */

const TITLE = 'the same wind, through seven different knits'

/**
 * The axis, said once.
 *
 * Same two marks and the same `WALL` as the old section, deliberately: a reader who has seen the
 * moisture bench test upstairs should not have to re-learn which end of a cross-section is the
 * skin. Outside air arrives at the left, the fabric stands at 36%.
 */
const MARKS = [
  { at: 0, label: 'outside air', align: 'start' },
  { at: WALL, label: 'the knit', align: 'centre' },
] as const

const LAYER_NAMES: { key: keyof Layers; label: string }[] = [
  { key: 'particles', label: 'streaklines' },
  { key: 'glyphs', label: 'glyphs' },
  { key: 'heat', label: 'heat' },
]

export function Perforation() {
  const section = useRef<HTMLElement>(null)
  const reduced = !!useReducedMotion()

  /**
   * The reader's variables. Three of them where the old section had one.
   *
   * None are persisted or in the URL, on the same argument the old pace slider made: the reel's
   * dials and the background picker are *settings* that a link should carry, and this is an
   * experiment you run standing in front of it. It should always open on the reference specimen at
   * the reference wind.
   */
  const [fabric, setFabric] = useState<FabricId | null>(REFERENCE)
  const [wind, setWind] = useState(WIND.ref)
  const [dia, setDia] = useState(byId(REFERENCE).dia)
  const [pitch, setPitch] = useState(byId(REFERENCE).pitch)
  const [drag, setDrag] = useState(byId(REFERENCE).drag)
  const [layers, setLayers] = useState<Layers>({ particles: true, glyphs: true, heat: true })
  const [open, setOpen] = useState(true)

  /**
   * The reading, at 4Hz off the solved field.
   *
   * Held in state rather than written straight to the DOM because the figures are type and want to
   * be type — and 4Hz is slow enough that a React render per reading costs nothing measurable.
   */
  const [reading, setReading] = useState<Reading | null>(null)

  /* The loop reads refs, so moving a slider never restarts a running field. */
  const windRef = useRef(wind)
  windRef.current = wind / 2.85
  const geometry = useRef({ dia, pitch, drag })
  geometry.current = { dia, pitch, drag }
  const layerRef = useRef(layers)
  layerRef.current = layers

  const flow = useRef<HTMLCanvasElement>(null)
  const glyph = useRef<HTMLCanvasElement>(null)

  /**
   * The one thing about this section that depends on where the page is.
   *
   * Not an activation — the composition is drawn either way and the figures are up from the first
   * frame. It's that a pressure solve at sixty frames a second behind two screens of other content
   * is a frame budget spent on nothing.
   */
  const showing = useInView(section, { amount: 0.2 })

  usePerforation({
    flow,
    glyph,
    wind: windRef,
    geometry,
    layers: layerRef,
    showing,
    reduced,
    onReading: setReading,
  })

  /** Selecting a specimen writes its geometry into the sliders; moving a slider clears the selection. */
  const pick = (id: FabricId) => {
    const spec = byId(id)
    setFabric(id)
    setDia(spec.dia)
    setPitch(spec.pitch)
    setDrag(spec.drag)
  }

  /* Diameter and pitch are not independent — a hole wider than its own spacing is not a
     perforation, it is a slot. Whichever one is being moved wins and the other follows. */
  const onDia = (v: number) => {
    setFabric(null)
    setDia(v)
    if (v > pitch * 0.95) setPitch(v / 0.95)
  }
  const onPitch = (v: number) => {
    setFabric(null)
    setPitch(v)
    if (dia > v * 0.95) setDia(v * 0.95)
  }

  /** Specified open area, for the rail. The solved figure is on the dial and they differ slightly. */
  const specified = useMemo(
    () => FABRICS.map((f) => Math.min(1, f.dia / f.pitch)),
    [],
  )

  const current = fabric ? byId(fabric) : null
  const porosity = reading ? reading.porosity : Math.min(100, (dia / pitch) * 100)

  /**
   * Published for the checks.
   *
   * A superset of what the old section published — `pace`, `wall`, `porosity` and `reduced` keep
   * their names and their shapes so anything already parsing this payload still parses it — plus
   * the figures that only exist because the field is solved now.
   *
   * **`ratio` and `drop` are gone rather than reinterpreted**, and that is the honest choice. Both
   * were comparisons between two fixed fabrics in the same wind, and there is only one specimen in
   * the channel now — a `ratio` computed against whichever fabric happened to be densest would be
   * the same key name meaning a different thing, which is worse for a script than an absent key.
   * `drop` in particular was a temperature in °C derived from an invented conversion; the `drop`
   * here is a pressure in Pa read off the field, so it is not the same quantity and does not
   * inherit the name. It is published as `dropPa`.
   *
   * `scripts/fabric.mjs` asserts the old markup directly — two `.fabric__canvas` elements, two
   * `.fabric__figure > b` values, a `.fabric__pace` slider — and none of that is on this section.
   * That script needs rewriting against `.tunnel`; it is not a thing this payload can paper over.
   */
  useEffect(() => {
    if (!reading) return
    document.documentElement.dataset.fabric = JSON.stringify({
      pace: Number(wind.toFixed(1)),
      wall: WALL,
      porosity: specified,
      reduced,
      specimen: fabric ?? 'custom',
      dia: Number(dia.toFixed(2)),
      pitch: Number(pitch.toFixed(2)),
      open: Number(reading.porosity.toFixed(1)),
      permeability: Number(reading.permeability.toFixed(1)),
      dropPa: Number(reading.drop.toFixed(1)),
      turbulence: Number(reading.turbulence.toFixed(1)),
      jet: Number(reading.jet.toFixed(1)),
    })
  }, [reading, wind, dia, pitch, fabric, specified, reduced])

  /* The dial's arc: 290 degrees with the gap at the bottom, so its length is a fixed number the
     fill's dash offset is a fraction of. */
  const DIAL = 157

  return (
    <section className="tunnel" ref={section}>
      <div className="tunnel__frame">
        <h2 className="tunnel__title">{TITLE}</h2>

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

        {/* The channel. Full bleed and no radius, same as the old one: a rounded corner on a
            full-bleed element is a card pretending to be a window. */}
        <div className="tunnel__channel">
          <canvas className="tunnel__canvas" ref={flow} aria-hidden="true" />
          <canvas className="tunnel__canvas" ref={glyph} aria-hidden="true" />
          <p className="tunnel__hint" aria-hidden="true">
            drag inside the channel to disturb the flow
          </p>
        </div>

        {/* The controls, on one strip under the picture — the position the old pace slider earned
            by being the thing that connects the diagram to the figures. Collapsible because on a
            display this is furniture once somebody has set it. */}
        <div className="tunnel__controls" data-open={open}>
          <div className="tunnel__bar">
            <button
              type="button"
              className="tunnel__collapse"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? 'hide controls' : 'controls'}
            </button>
            <span className="tunnel__specimen">
              {current ? current.name.toLowerCase() : 'custom geometry'}
              <i>{porosity.toFixed(1)}% open</i>
            </span>
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
          </div>

          {open && (
            <div className="tunnel__panel">
              {/* The specimens, ordered by open area rather than by family — the order is the
                  argument, and family is a label on the row. */}
              <ul className="tunnel__rail">
                {FABRICS.map((spec, i) => (
                  <li key={spec.id}>
                    <button
                      type="button"
                      className="tunnel__fab"
                      aria-pressed={fabric === spec.id}
                      onClick={() => pick(spec.id)}
                    >
                      <span className="tunnel__fab-top">
                        <b>{spec.name.toLowerCase()}</b>
                        <em>{(specified[i] * 100).toFixed(1)}%</em>
                      </span>
                      <span className="tunnel__fab-note">{spec.note.toLowerCase()}</span>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="tunnel__dials">
                <label className="tunnel__dial-row">
                  <span>freestream</span>
                  <input
                    type="range"
                    min={WIND.min}
                    max={WIND.max}
                    step={WIND.step}
                    value={wind}
                    onChange={(e) => setWind(Number(e.currentTarget.value))}
                  />
                  <output>{wind.toFixed(1)} m/s</output>
                </label>
                <label className="tunnel__dial-row">
                  <span>perforation ø</span>
                  <input
                    type="range"
                    min={DIA.min}
                    max={DIA.max}
                    step={DIA.step}
                    value={dia}
                    onChange={(e) => onDia(Number(e.currentTarget.value))}
                  />
                  <output>{dia.toFixed(2)} mm</output>
                </label>
                <label className="tunnel__dial-row">
                  <span>hole pitch</span>
                  <input
                    type="range"
                    min={PITCH.min}
                    max={PITCH.max}
                    step={PITCH.step}
                    value={pitch}
                    onChange={(e) => onPitch(Number(e.currentTarget.value))}
                  />
                  <output>{pitch.toFixed(2)} mm</output>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* The figures. The dial is open area because that is the one number the reader is
            actually moving; the rest are what the field did about it. */}
        <footer className="tunnel__verdict" aria-hidden="true">
          <div className="tunnel__gauge">
            <svg viewBox="0 0 102 74">
              <path
                d="M 33.9 67.5 A 31 31 0 1 1 68.1 67.5"
                fill="none"
                stroke="rgba(226,220,212,0.16)"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d="M 33.9 67.5 A 31 31 0 1 1 68.1 67.5"
                fill="none"
                stroke="#ee3b33"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={DIAL}
                strokeDashoffset={DIAL * (1 - Math.min(1, porosity / 100))}
              />
            </svg>
            <b>
              {porosity.toFixed(1)}
              <i>%</i>
            </b>
            <span>open area</span>
          </div>
          <p className="tunnel__figure">
            <b>{reading ? reading.permeability.toFixed(1) : '—'}</b>
            <span>cfm/ft² permeability</span>
          </p>
          <p className="tunnel__figure">
            <b>{reading ? reading.drop.toFixed(1) : '—'}</b>
            <span>Pa pressure drop</span>
          </p>
          <p className="tunnel__figure">
            <b>{reading ? reading.jet.toFixed(1) : '—'}</b>
            <span>m/s peak jet</span>
          </p>
        </footer>

        {/* Everything on this screen that is a picture, said once in words. */}
        <p className="tunnel__sr">
          A cross-section of one knit in a wind tunnel, outside air on the left and skin on the
          right, with the fabric standing across the channel a third of the way in. The current
          specimen is {current ? current.name : 'a custom geometry'} at {dia.toFixed(2)} mm
          perforations on a {pitch.toFixed(2)} mm pitch, which solves to{' '}
          {porosity.toFixed(1)} per cent open area. At {wind.toFixed(1)} metres per second the
          model gives {reading ? reading.permeability.toFixed(0) : 'no'} cfm per square foot of air
          permeability, a {reading ? reading.drop.toFixed(0) : 'zero'} pascal pressure drop across
          the fabric, and jets reaching {reading ? reading.jet.toFixed(1) : 'zero'} metres per
          second where the air is squeezed through each hole. Every fabric and every figure here is
          placeholder, derived from the simulation rather than measured in a wind tunnel.
        </p>
      </div>
    </section>
  )
}
