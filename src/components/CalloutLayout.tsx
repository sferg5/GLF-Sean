import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  DEFAULT_PAIRS,
  applyLayout,
  isLayout,
  round,
  toLayout,
  type Pair,
  type Phase,
  type Pt,
  type Spot,
} from '../lib/callouts'

/**
 * The editable call-out layout, shared by the panel and the stage.
 *
 * A context rather than props because the two halves sit at opposite ends of the tree:
 * the panel is a sibling of the topbar, and the drag handles are inside the variant,
 * three components down. Threading a layout plus a setter through `VariantShell` and
 * `VariantProps` would put an authoring tool into the contract every variant
 * implements, which is the wrong place for it — the switch state is genuinely part of
 * what a variant renders, this is not.
 */

const KEY = 'shoe-xray:callout-layout'

/** What the editor is allowed to change: where a mark's two points sit, and which side
    of its shelf the text sits on. The label itself is source. */
type SpotPatch = Partial<Pick<Spot, 'target' | 'anchor' | 'side'>>

type Store = {
  pairs: Pair[]
  /** Change one spot. Points are percentages of the stage box, and get rounded here. */
  setSpot: (pair: number, phase: Phase, patch: SpotPatch) => void
  reset: () => void
  /** Whether the layout differs from the source defaults. */
  dirty: boolean
  editing: boolean
  setEditing: (on: boolean) => void
  /** Which phase the handles and the number fields are addressing. */
  phase: Phase
  setPhase: (phase: Phase) => void
}

const Ctx = createContext<Store | null>(null)

/**
 * Coordinates from storage, labels from source.
 *
 * Returning `DEFAULT_PAIRS` itself when there's nothing stored is what makes the identity
 * check behind `dirty` work — a stored layout always produces a fresh array.
 */
const load = (): Pair[] => {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isLayout(parsed)) return applyLayout(parsed)
    }
  } catch {
    // Blocked storage or a shape we don't recognise — the defaults are fine.
  }
  return DEFAULT_PAIRS
}

export function CalloutLayoutProvider({ children }: { children: ReactNode }) {
  const [pairs, setPairs] = useState<Pair[]>(load)
  const [editing, setEditing] = useState(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).get('edit') === '1'
  })
  const [phase, setPhase] = useState<Phase>('from')

  useEffect(() => {
    try {
      if (pairs === DEFAULT_PAIRS) localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, JSON.stringify(toLayout(pairs)))
    } catch {
      // Not worth surfacing: the layout still applies for this session.
    }
  }, [pairs])

  // `e` opens the editor, alongside `d`/`x`/`g` for debug and `c` for the layer.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const el = event.target as HTMLElement | null
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      if (event.key.toLowerCase() === 'e') setEditing((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const setSpot = useCallback<Store['setSpot']>((index, ph, patch) => {
    const at = (p: Pt): Pt => [round(p[0]), round(p[1])]
    setPairs((current) =>
      current.map((pair, i) => {
        if (i !== index) return pair
        const next: Spot = { ...pair[ph], ...patch }
        // Rounding here rather than at the call sites, so a drag and a typed value can't
        // end up at different precisions.
        if (patch.target) next.target = at(patch.target)
        if (patch.anchor) next.anchor = at(patch.anchor)
        return { ...pair, [ph]: next }
      }),
    )
  }, [])

  const reset = useCallback(() => setPairs(DEFAULT_PAIRS), [])

  const value = useMemo<Store>(
    () => ({
      pairs,
      setSpot,
      reset,
      dirty: pairs !== DEFAULT_PAIRS,
      editing,
      setEditing,
      phase,
      setPhase,
    }),
    [pairs, setSpot, reset, editing, phase],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCalloutLayout() {
  const store = useContext(Ctx)
  if (!store) throw new Error('useCalloutLayout needs CalloutLayoutProvider above it')
  return store
}
