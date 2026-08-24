import { useEffect, useSyncExternalStore } from 'react'

/**
 * Which document the Sketch variant is drawn as.
 *
 * Two answers to the same geometry, and the difference is the argument each one makes.
 * A **blueprint** is a reproduction of a finished drawing, made to be built from: deep
 * blue field, near-white ink, every mark printed by an instrument. A **section on toned
 * paper** is someone working out what the thing is: warm stock with its own tooth,
 * graphite, 45° hatching on the cut face, and marks a hand made. Same timing, same
 * measurement frame, opposite ends of the process — so this is worth being able to hold
 * side by side rather than choosing once in the stylesheet.
 *
 * **A store rather than a `useState` in `App`.** Every other switch on this page is page
 * state that only the chrome and one subtree read, so a hook that owns a `useState` is
 * the right shape for them. This one is read by `lab/ParticleField`, which is four
 * levels down inside the variant and picks its ink and its compositing operation from
 * it — and threading a prop through the shell, the variant and the plate to reach a
 * canvas would be plumbing that exists only because the value was stored in the wrong
 * place. `useSyncExternalStore` lets the canvas subscribe to it directly.
 *
 * The stylesheet reads it off `data-sheet` on the root, which is published below rather
 * than from an effect in `App`: it's set as this module is evaluated, so the attribute
 * is on the element before React's first render and there's no frame drawn against the
 * wrong tokens.
 */

export type Sheet = 'blueprint' | 'paper'

/** The switch's options, in its order. */
export const SHEETS: { id: Sheet; name: string }[] = [
  { id: 'blueprint', name: 'Blueprint' },
  { id: 'paper', name: 'Paper' },
]

const KEY = 'shoe-xray:sheet'

/**
 * Paper. The blueprint came first and it was the wrong document — see the note above —
 * and it stays registered as the control, the way the plain dissolve stays registered
 * next to the section plate.
 */
const FALLBACK: Sheet = 'paper'

const isSheet = (v: unknown): v is Sheet => v === 'blueprint' || v === 'paper'

/** `?sheet=paper` / `?sheet=blueprint` wins, then the saved choice — same order as `?c=` and `?v=`. */
const initial = (): Sheet => {
  if (typeof window === 'undefined') return FALLBACK
  const url = new URLSearchParams(window.location.search).get('sheet')
  if (isSheet(url)) return url
  try {
    const saved = localStorage.getItem(KEY)
    if (isSheet(saved)) return saved
  } catch {
    // Private mode or blocked storage — the default is fine.
  }
  return FALLBACK
}

let sheet: Sheet = initial()
const listeners = new Set<() => void>()

/** Publishes to the stylesheet, and to the verification scripts, which read the same attribute. */
const publish = () => {
  if (typeof document !== 'undefined') document.documentElement.dataset.sheet = sheet
}

publish()

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

const snapshot = () => sheet

export function setSheet(next: Sheet) {
  if (next === sheet) return
  sheet = next
  publish()
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // Not worth surfacing: the choice still applies for this session.
  }
  for (const fn of listeners) fn()
}

export function useSheet() {
  return [useSyncExternalStore(subscribe, snapshot, () => FALLBACK), setSheet] as const
}

/**
 * `s` swaps the sheet, alongside `c` for call-outs and the number keys for variants.
 *
 * The same argument the call-out key makes, and a stronger one: the chrome recedes on
 * the first scroll, and the sheet is a claim about what kind of picture this is — which
 * is a thing you can only judge with the drawing actually up, three viewports past
 * where the switch that sets it still exists.
 *
 * Called once, from `App`. In the store rather than in the switch component so the key
 * keeps working on the variant where the switch isn't rendered.
 */
export function useSheetKey() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      if (e.key.toLowerCase() !== 's') return
      setSheet(sheet === 'paper' ? 'blueprint' : 'paper')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
