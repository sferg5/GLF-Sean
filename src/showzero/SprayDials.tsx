import { useEffect, useState } from 'react'

/**
 * The dials for the spray hero — the ReelDials pattern pointed at air and water.
 *
 * Five numbers that can only be judged by watching the cloth take them: the steady
 * wind, how much it gusts, the shove when the spray lands, how much moisture one
 * press adds, and how long the jersey takes to dry back out.
 *
 * **The hang used to be one of them** — flat on the line under even bench light, or gathered to
 * half its width and dropped into deep folds under a warm raking key. Both stagings worked and
 * only one of them is the test: a sample gathered into folds is a sample whose marks are partly
 * hidden by its own shadows, which is the one thing a comparison about *showing* can't afford. It
 * and its lighting rig are gone rather than left switchable.
 *
 * URL params win over
 * the saved values over the defaults, field by field, so a dialled-in look can be
 * pinned into a link (`?wind=1.4&dry=6`) — which is also how the verification
 * script gets a fast-drying page to test against.
 */

export type Spray = {
  wind: number
  gust: number
  force: number
  amount: number
  dry: number
  fabric: string
}

/** The dye lots — one fabric, six colourways, both samples always in the same one. */
export const FABRICS = [
  { id: 'heather', hex: '#a8a39d' },
  { id: 'bone', hex: '#d6d0c6' },
  { id: 'sage', hex: '#9aa48e' },
  { id: 'navy', hex: '#33405a' },
  { id: 'poppy', hex: '#b0453a' },
  { id: 'charcoal', hex: '#403e44' },
]

export const fabricHex = (id: string) =>
  (FABRICS.find((f) => f.id === id) ?? FABRICS[0]).hex

export const SPRAY: Spray = {
  wind: 2,
  gust: 0,
  force: 0.75,
  amount: 0.4,
  dry: 5,
  fabric: 'heather',
}

const LIMITS: Record<Exclude<keyof Spray, 'fabric'>, readonly [number, number, number]> = {
  wind: [0, 2, 0.05],
  gust: [0, 2, 0.05],
  force: [0, 2, 0.05],
  amount: [0.2, 1, 0.05],
  dry: [2, 30, 1],
}

const KEY = 'showzero:spray'

const fromUrl = (): Partial<Spray> => {
  const q = new URLSearchParams(window.location.search)
  const read = (name: string) => {
    const raw = q.get(name)
    if (raw === null) return undefined
    const n = Number(raw)
    return Number.isFinite(n) ? n : undefined
  }
  return {
    wind: read('wind'),
    gust: read('gust'),
    force: read('force'),
    amount: read('amount'),
    dry: read('dry'),
    fabric: q.get('fabric') ?? undefined,
  }
}

const clampTo = (v: number, [lo, hi]: readonly [number, number, number]) =>
  Math.min(hi, Math.max(lo, v))

const sanitise = (s: Partial<Spray>): Spray => ({
  wind: clampTo(s.wind ?? SPRAY.wind, LIMITS.wind),
  gust: clampTo(s.gust ?? SPRAY.gust, LIMITS.gust),
  force: clampTo(s.force ?? SPRAY.force, LIMITS.force),
  amount: clampTo(s.amount ?? SPRAY.amount, LIMITS.amount),
  dry: clampTo(s.dry ?? SPRAY.dry, LIMITS.dry),
  fabric: FABRICS.some((f) => f.id === s.fabric) ? (s.fabric as string) : SPRAY.fabric,
})

export function useSprayDials() {
  const [dials, setDials] = useState<Spray>(() => {
    if (typeof window === 'undefined') return SPRAY
    let saved: Partial<Spray> = {}
    try {
      saved = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    } catch {
      // Blocked storage, or something else wrote nonsense here. The defaults are fine.
    }
    return sanitise({ ...saved, ...fromUrl() })
  })

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(dials))
    } catch {
      // Not worth surfacing: the setting still applies for this session.
    }
  }, [dials])

  return [dials, setDials] as const
}

export function SprayDials({
  open,
  dials,
  onChange,
}: {
  open: boolean
  dials: Spray
  onChange: (dials: Spray) => void
}) {
  const dialled = (Object.keys(SPRAY) as (keyof Spray)[]).some((k) => dials[k] !== SPRAY[k])

  return (
    /* `data-near` is what fades the shared `.dials` styles in — here it means
       "open" rather than "scrolled to", same visual behaviour. */
    <div className="panel dials szdials" data-near={open ? '' : undefined} aria-hidden={!open}>
      <h2>Air &amp; water</h2>

      <Dial name="Wind" hint="the steady breeze" k="wind" dials={dials} onChange={onChange} />
      <Dial name="Gust" hint="how much it breathes" k="gust" dials={dials} onChange={onChange} />
      <Dial name="Force" hint="shove when the spray lands" k="force" dials={dials} onChange={onChange} />
      <Dial name="Amount" hint="moisture per press" k="amount" dials={dials} onChange={onChange} />
      <Dial name="Dry" hint="seconds back to dry" k="dry" dials={dials} onChange={onChange} />

      {/* The dye lot — both samples always wear the same one; that's the premise. */}
      <div className="fabrics">
        <span className="fabrics__name">
          Fabric
          <i>{dials.fabric}</i>
        </span>
        <div className="fabrics__row" role="group" aria-label="Fabric colour">
          {FABRICS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-label={f.id}
              aria-pressed={dials.fabric === f.id}
              style={{ background: f.hex }}
              onClick={() => onChange({ ...dials, fabric: f.id })}
            />
          ))}
        </div>
      </div>

      {/* Only when it would do something, so the panel is five sliders at rest. */}
      {dialled && (
        <div className="dials__actions">
          <button type="button" onClick={() => onChange(SPRAY)}>
            Reset
          </button>
        </div>
      )}

      <p className="dials__note">?wind= ?gust= ?force= ?amount= ?dry= pin into a link</p>
    </div>
  )
}

function Dial({
  name,
  hint,
  k,
  dials,
  onChange,
}: {
  name: string
  hint: string
  k: Exclude<keyof Spray, 'fabric'>
  dials: Spray
  onChange: (dials: Spray) => void
}) {
  const [lo, hi, step] = LIMITS[k]
  const value = dials[k]
  return (
    <label>
      <span>
        {name}
        <i>{hint}</i>
      </span>
      <output>{step >= 1 ? value : value.toFixed(2)}</output>
      <input
        type="range"
        min={lo}
        max={hi}
        step={step}
        value={value}
        onChange={(e) => onChange({ ...dials, [k]: Number(e.target.value) })}
      />
    </label>
  )
}
