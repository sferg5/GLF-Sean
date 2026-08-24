import { useEffect, useState } from 'react'
import { SHOE } from '../lib/shoe'
import { EndPhoto, StartPhoto } from './Photo'

export type DebugState = {
  on: boolean
  diff: boolean
  gain: number
  grid: boolean
  scrubbing: boolean
  scrub: number
  nudgeX: number
  nudgeY: number
}

const INITIAL: DebugState = {
  on: false,
  diff: false,
  gain: 3,
  grid: false,
  scrubbing: false,
  scrub: 0.5,
  nudgeX: 0,
  nudgeY: 0,
}

/**
 * `?v=3&p=0.45&diff=1&grid=1&gain=4` — pins a variant to an exact frame.
 *
 * Makes any state of any variant a shareable URL, and lets a screenshot script
 * capture a specific frame without having to simulate a scroll position.
 */
function fromUrl(): DebugState {
  if (typeof window === 'undefined') return INITIAL
  const q = new URLSearchParams(window.location.search)
  const num = (key: string, fallback: number) => {
    const v = Number(q.get(key))
    return q.has(key) && Number.isFinite(v) ? v : fallback
  }
  const flag = (key: string) => q.get(key) === '1' || q.get(key) === 'true'

  const hasP = q.has('p')
  return {
    ...INITIAL,
    // `p` alone pins a frame without opening the panel, so screenshots aren't
    // covered by it. Ask for the panel explicitly with `debug=1`.
    on: flag('debug') || flag('diff') || flag('grid'),
    diff: flag('diff'),
    grid: flag('grid'),
    gain: num('gain', INITIAL.gain),
    scrubbing: hasP,
    scrub: Math.min(1, Math.max(0, num('p', INITIAL.scrub))),
    nudgeX: num('nx', 0),
    nudgeY: num('ny', 0),
  }
}

/** `?v=1..5`, 1-indexed. */
export function variantFromUrl(count: number) {
  if (typeof window === 'undefined') return 0
  const v = Number(new URLSearchParams(window.location.search).get('v'))
  return Number.isInteger(v) && v >= 1 && v <= count ? v - 1 : 0
}

/**
 * d — panel · x — difference blend · g — geometry overlay
 *
 * Keys are ignored while a form control has focus, so dragging a slider with the
 * arrow keys doesn't also fire shortcuts.
 */
export function useDebug() {
  const [state, setState] = useState(fromUrl)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return

      const key = e.key.toLowerCase()
      if (key === 'd') setState((s) => ({ ...s, on: !s.on }))
      if (key === 'x') setState((s) => ({ ...s, on: true, diff: !s.diff }))
      if (key === 'g') setState((s) => ({ ...s, on: true, grid: !s.grid }))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const patch = (next: Partial<DebugState>) => setState((s) => ({ ...s, ...next }))

  return { debug: state, patch }
}

/**
 * |start - end|, brightened.
 *
 * The direct check that the two photographs are registered: everything that
 * lights up is either a real content difference (the interior, which should
 * light up) or a misalignment (an outline glowing as a thin bright edge, which
 * should not). The backdrop, outsole and toe stay near-black.
 */
export const DiffPair = ({ gain }: { gain: number }) => (
  <div className="diff" style={{ filter: `brightness(${gain})` }}>
    <StartPhoto />
    <div className="layer" style={{ mixBlendMode: 'difference' }}>
      <EndPhoto />
    </div>
  </div>
)

/** Draws the measured constants over the photo so they can be checked by eye. */
export const GridOverlay = () => {
  const path = SHOE.spine.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ')
  return (
    <svg
      className="grid-overlay"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect
        x={SHOE.toeX}
        y={SHOE.topY}
        width={SHOE.heelX - SHOE.toeX}
        height={SHOE.soleY - SHOE.topY}
        fill="none"
        stroke="#7dd3fc"
        strokeWidth={0.15}
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={path}
        fill="none"
        stroke="#fbbf24"
        strokeWidth={0.3}
        vectorEffect="non-scaling-stroke"
      />
      <g stroke="#f472b6" strokeWidth={0.15} vectorEffect="non-scaling-stroke">
        <line x1={SHOE.focus.x} y1={0} x2={SHOE.focus.x} y2={100} />
        <line x1={0} y1={SHOE.focus.y} x2={100} y2={SHOE.focus.y} />
      </g>
    </svg>
  )
}

export function DebugPanel({
  debug,
  patch,
  variantName,
}: {
  debug: DebugState
  patch: (next: Partial<DebugState>) => void
  variantName: string
}) {
  if (!debug.on) return null

  return (
    <div className="panel debug">
      <h2>{variantName}</h2>

      <label>
        <span>Scrub</span>
        <input
          type="checkbox"
          checked={debug.scrubbing}
          onChange={(e) => patch({ scrubbing: e.target.checked })}
        />
      </label>
      <input
        type="range"
        min={0}
        max={1}
        step={0.005}
        value={debug.scrub}
        disabled={!debug.scrubbing}
        onChange={(e) => patch({ scrub: Number(e.target.value), scrubbing: true })}
      />
      <label>
        <span>progress</span>
        <output>{debug.scrubbing ? debug.scrub.toFixed(3) : 'scroll'}</output>
      </label>

      <label>
        <span>Difference blend</span>
        <input
          type="checkbox"
          checked={debug.diff}
          onChange={(e) => patch({ diff: e.target.checked })}
        />
      </label>
      {debug.diff && (
        <>
          <input
            type="range"
            min={1}
            max={8}
            step={0.1}
            value={debug.gain}
            onChange={(e) => patch({ gain: Number(e.target.value) })}
          />
          <label>
            <span>gain</span>
            <output>{debug.gain.toFixed(1)}×</output>
          </label>
        </>
      )}

      <label>
        <span>Geometry</span>
        <input
          type="checkbox"
          checked={debug.grid}
          onChange={(e) => patch({ grid: e.target.checked })}
        />
      </label>

      {/* Measured best-fit shift was (0, +1)px at a 0.2% improvement — noise.
          These exist to confirm that by eye, not because a correction is expected. */}
      <label>
        <span>nudge end layer</span>
        <output>
          {debug.nudgeX}, {debug.nudgeY}px
        </output>
      </label>
      <div className="row">
        <input
          type="range"
          min={-3}
          max={3}
          step={1}
          value={debug.nudgeX}
          onChange={(e) => patch({ nudgeX: Number(e.target.value) })}
        />
        <input
          type="range"
          min={-3}
          max={3}
          step={1}
          value={debug.nudgeY}
          onChange={(e) => patch({ nudgeY: Number(e.target.value) })}
        />
      </div>

      <div className="keys">d panel · x difference · g geometry · c call-outs · e placement</div>
    </div>
  )
}
