import { useEffect, useState } from 'react'

/**
 * Whether the x-ray's annotation layer is showing.
 *
 * Lives on the page rather than inside the variant so the choice survives switching
 * variants and reloading, and so the switch can sit in the topbar with the rest of
 * the chrome instead of floating over the photograph.
 *
 * On by default. The layer is the feature, and the switch is visible next to the
 * variant control — a viewer who wants the bare photograph is one click from it,
 * where a viewer who never finds the switch would never know the annotations exist.
 */

const KEY = 'shoe-xray:callouts'

/** `?c=0` / `?c=1`, and it wins — a link or a screenshot has to pin what it shows. */
const fromUrl = () => {
  const raw = new URLSearchParams(window.location.search).get('c')
  if (raw === null) return null
  return raw === '1' || raw === 'true'
}

export function useCallouts() {
  const [on, setOn] = useState(() => {
    if (typeof window === 'undefined') return true
    const url = fromUrl()
    if (url !== null) return url
    try {
      const saved = localStorage.getItem(KEY)
      if (saved !== null) return saved === '1'
    } catch {
      // Private mode or blocked storage — the default is fine.
    }
    return true
  })

  useEffect(() => {
    try {
      localStorage.setItem(KEY, on ? '1' : '0')
    } catch {
      // Not worth surfacing: the choice still applies for this session.
    }
  }, [on])

  /**
   * `c` toggles it, alongside `d`/`x`/`g` for debug and the number keys for variants.
   *
   * Not a convenience: all the chrome recedes as soon as you scroll, so the switch
   * itself is gone by the time the callouts are doing anything interesting. The key
   * is how you compare annotated against bare at a frame you are actually looking at.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      if (e.key.toLowerCase() === 'c') setOn((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return [on, setOn] as const
}

/**
 * A `button` with `role="switch"` rather than a checkbox: it carries its own state
 * instead of submitting anything, and it gets Space and Enter and the focus ring for
 * free. The track is styled off `aria-checked`, so the visible state can't drift from
 * the announced one.
 */
export function CalloutSwitch({
  on,
  onChange,
}: {
  on: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <button
      type="button"
      className="toggle"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      title="Call-outs (c)"
    >
      <span className="toggle__name">Call-outs</span>
      <span className="toggle__track">
        <span className="toggle__knob" />
      </span>
    </button>
  )
}
