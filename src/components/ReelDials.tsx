import { useEffect, useState } from 'react'
import { COLUMNS, LIMITS, SCROLL_VH, TIMING, arrival, type Timing } from '../lib/reel'

/**
 * Two sliders for the two numbers in the reel that can only be judged by scrolling it: when
 * the opening happens, and when the room stops being black.
 *
 * Both are in `svh` of scroll — the same unit the whole section is written in (`lib/reel.ts`) —
 * so the readout beside each slider is directly comparable to the storyboard there: the tiles
 * arrive from 140, the last one leaves around 435, and the room starts leaving at 530. The
 * footnote at the bottom of the panel carries the two of those it can derive.
 *
 * It's a visible panel rather than a key-toggled one like the debug overlay, because it isn't
 * an instrument for inspecting the build — it's a control for deciding what the build should
 * be, and one you have to be *inside* the section to use. The chrome above it recedes on the
 * first scroll; this can't.
 */

const KEY = 'shoe-xray:reel-timing'

/**
 * Whether the reel is on screen enough to be worth showing the panel for.
 *
 * The panel is fixed, so without this it would sit over the shoe for the whole first act —
 * three viewports of clutter over the one photograph the page opens on.
 *
 * The margin is *negative*, which is the correction: it was a viewport of positive margin, so
 * the panel appeared before the section did. That's fine to look at and wrong twice over. It
 * put a fixed panel over the stage at the end of the x-ray's own scroll — where `verify.sh`
 * photographs `p = 1` — and under reduced motion, where the stage's section is 150vh rather
 * than 300, it put it over the shoe at the top of the page. Both showed up as ~4.0 mean
 * difference against the reference frames the moment that check stopped passing `reel=0`,
 * which is the argument for having stopped.
 *
 * Shrinking the root instead means the panel arrives once the section is genuinely 15% of a
 * viewport in, and leaves again when the colourways take over.
 *
 * It finds the section by selector rather than through a ref: this component is only mounted
 * when the reel is, they're siblings, and threading a ref up through `App` to hand a panel a
 * node it can ask for directly would be plumbing for its own sake.
 */
function useNearReel() {
  const [near, setNear] = useState(false)

  useEffect(() => {
    const section = document.querySelector('.reel')
    if (!section) return
    const io = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), {
      rootMargin: '-15% 0px -15% 0px',
    })
    io.observe(section)
    return () => io.disconnect()
  }, [])

  return near
}

/** `?ro=` and `?ri=` win, so a setting can be pinned into a link or a screenshot. */
const fromUrl = (): Partial<Timing> => {
  const q = new URLSearchParams(window.location.search)
  const read = (name: string) => {
    const raw = q.get(name)
    if (raw === null) return undefined
    const n = Number(raw)
    return Number.isFinite(n) ? n : undefined
  }
  return { open: read('ro'), invert: read('ri') }
}

const clamp = (v: number, [lo, hi]: readonly [number, number]) =>
  Math.min(hi, Math.max(lo, Math.round(v)))

const sanitise = (t: Partial<Timing>): Timing => ({
  open: clamp(t.open ?? TIMING.open, LIMITS.open),
  invert: clamp(t.invert ?? TIMING.invert, LIMITS.invert),
})

export function useReelTiming() {
  const [timing, setTiming] = useState<Timing>(() => {
    if (typeof window === 'undefined') return TIMING
    const url = fromUrl()
    let saved: Partial<Timing> = {}
    try {
      saved = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    } catch {
      // Blocked storage, or something else wrote nonsense here. The defaults are fine.
    }
    // URL over storage over default, field by field, so `?ri=` alone doesn't discard a
    // dialled-in `open`.
    return sanitise({ ...saved, ...url })
  })

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(timing))
    } catch {
      // Not worth surfacing: the setting still applies for this session.
    }
  }, [timing])

  return [timing, setTiming] as const
}

export function ReelDials({
  timing,
  onChange,
}: {
  timing: Timing
  onChange: (timing: Timing) => void
}) {
  const dialled = timing.open !== TIMING.open || timing.invert !== TIMING.invert
  const near = useNearReel()

  return (
    <div className="panel dials" data-near={near ? '' : undefined} aria-hidden={!near}>
      <h2>Reel timing</h2>

      <Dial
        name="Opening"
        hint="rules and headline"
        value={timing.open}
        limits={LIMITS.open}
        onChange={(open) => onChange({ ...timing, open })}
      />
      <Dial
        name="Invert"
        hint="room and type"
        value={timing.invert}
        limits={LIMITS.invert}
        onChange={(invert) => onChange({ ...timing, invert })}
      />

      {/* Only when it would do something, so the panel is two sliders at rest. */}
      {dialled && (
        <div className="dials__actions">
          <button type="button" onClick={() => onChange(TIMING)}>
            Reset
          </button>
        </div>
      )}

      {/* Derived, so the footnote can't drift from the timeline it's describing. The last
          exit isn't in it: that one depends on how tall a tile is at the current column
          width, which is the browser's business rather than this panel's. */}
      <p className="dials__note">
        svh of scroll · tiles in {Math.round(Math.min(...COLUMNS.map(arrival)))}–
        {Math.round(Math.max(...COLUMNS.map(arrival)))} · pin ends {SCROLL_VH}
      </p>
    </div>
  )
}

/**
 * `step={5}` rather than 1: these are beats in a 660svh section, and a slider that resolves to a
 * single `svh` invites tuning at a precision the eye can't see — 5 is about a quarter of a wheel
 * tick.
 */
function Dial({
  name,
  hint,
  value,
  limits,
  onChange,
}: {
  name: string
  hint: string
  value: number
  limits: readonly [number, number]
  onChange: (value: number) => void
}) {
  return (
    <label>
      <span>
        {name}
        <i>{hint}</i>
      </span>
      <output>{value}</output>
      <input
        type="range"
        min={limits[0]}
        max={limits[1]}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}
