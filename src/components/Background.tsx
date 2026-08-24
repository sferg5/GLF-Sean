import { useEffect, useState } from 'react'

/**
 * The wall the product is photographed against.
 *
 * With the shoe cut out, the background *is* the photograph's background — there's no
 * studio backdrop baked into the pixels any more. So this isn't chrome, it's part of the
 * image, and changing it changes the shot.
 *
 * Which is exactly why it stops at the shot. This writes `--bg`, and two sections read it:
 * the x-ray and the prose. Everything below them — the reel, the colourway strip, the FAQ —
 * is on `--page`, a fixed wall, because none of those is the photograph and each had its own
 * composition to lose. See the note above `--bg` in global.css for what each one lost.
 *
 * Two groups, doing two different jobs.
 *
 * **Neutrals** are for judging the product honestly: one near-black and two at the
 * light end. The palette used to run a ramp of five warm browns between them, all
 * holding the hue of the shoe's own red at 9–18% saturation. They read as one wall
 * at five brightnesses, which is four more than a picker needs.
 *
 * **Pops** are six hues at 20% saturation and 80% lightness — tints rather than the
 * full-chroma set they started as. They hold the hues the old palette found by
 * permuting `#8e1adb`'s own channel values (~36°, 84°, 156°, 204°, 276°, 324°:
 * roughly even spacing, alternating 48° and 72°), and fixing S and L keeps a
 * structure worth having. Converting `hsl(h 20% 80%)` back to 8-bit lands on the
 * six permutations of `c2`, `ce` and `d6` — the same "one triple, six arrangements"
 * property the full-chroma version had, which is not a coincidence: holding two of
 * the three HSL terms fixed while stepping hue is what produces it.
 *
 * At this saturation they are near-neutral, which is the point. Full chroma behind a
 * coral shoe was a decision about the page; a tint is a decision about the wall. It
 * also flattens the luminance problem the old set had — green carried most of it, so
 * Acid and Jade sat far brighter than Iris — because now every one of them is at the
 * same lightness by construction.
 */
export const SWATCHES = [
  { name: 'Ember', value: '#1d1616' },
  { name: 'Bone', value: '#e3d9d9' },
  { name: 'Paper', value: '#f7f3f3' },

  // In spectrum order: amber, lime, spring, azure, violet, magenta.
  { name: 'Amber', value: '#d6cec2' },
  { name: 'Acid', value: '#ced6c2' },
  { name: 'Jade', value: '#c2d6ce' },
  { name: 'Azure', value: '#c2ced6' },
  { name: 'Iris', value: '#cec2d6' },
  { name: 'Fuchsia', value: '#d6c2ce' },
] as const

/**
 * Paper — the lightest swatch in the set.
 *
 * The trade runs the opposite way from Ember, the near-black this replaced. On a light
 * wall the near-black outsole and the dark plate separate cleanly, where against
 * #1d1616 the outsole disappeared into the page; what it costs is the white foam,
 * which no longer has anything to be white against. Both are one click away, and this
 * is the one the product is normally photographed on.
 *
 * It also flips the call-out ink to dark via `data-bg-light` below, which is what that
 * flag exists for. The flag describes *this* wall and not the page's, so only the two
 * sections that take this wall consult it.
 *
 * `--page` in global.css is kept at this value, so a page that has never been touched is
 * one colour end to end and the picker's first click is the first seam.
 */
export const DEFAULT_BG = '#f7f3f3'

const KEY = 'shoe-xray:bg'
const isHex = (v: string | null): v is string => !!v && /^#[0-9a-f]{6}$/i.test(v)

const fromUrl = () => {
  const raw = new URLSearchParams(window.location.search).get('bg')
  if (!raw) return null
  const hex = raw.startsWith('#') ? raw : `#${raw}`
  return isHex(hex) ? hex.toLowerCase() : null
}

/** Relative luminance, to decide whether chrome needs light or dark text over it. */
export const isLight = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const lin = c.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2] > 0.42
}

export function useBackground() {
  const [bg, setBg] = useState<string>(() => {
    // URL wins, so a screenshot or a shared link pins the colour regardless of
    // whatever was last chosen in this browser.
    const url = fromUrl()
    if (url) return url
    try {
      const saved = localStorage.getItem(KEY)
      if (isHex(saved)) return saved
    } catch {
      // Private mode or blocked storage — the default is fine.
    }
    return DEFAULT_BG
  })

  useEffect(() => {
    document.documentElement.style.setProperty('--bg', bg)
    document.documentElement.dataset.bgLight = String(isLight(bg))
    try {
      localStorage.setItem(KEY, bg)
    } catch {
      // Not worth surfacing: the colour still applies for this session.
    }
  }, [bg])

  return [bg, setBg] as const
}

export function BackgroundPicker({
  bg,
  onChange,
}: {
  bg: string
  onChange: (hex: string) => void
}) {
  return (
    <div className="bgpicker" role="group" aria-label="Background colour">
      {SWATCHES.map((s) => (
        <button
          key={s.value}
          type="button"
          className="swatch"
          style={{ background: s.value }}
          aria-label={s.name}
          aria-pressed={bg === s.value}
          title={s.name}
          onClick={() => onChange(s.value)}
        />
      ))}

      {/* Native colour input for anything not in the palette. It doubles as the
          indicator for a custom colour, since it always shows the current value. */}
      <label className="swatch swatch--custom" title="Custom colour">
        <input
          type="color"
          value={bg}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          aria-label="Custom background colour"
        />
      </label>
    </div>
  )
}
