import { useEffect, useState } from 'react'
import { toSource, type Phase, type Side } from '../lib/callouts'
import { useCalloutLayout } from './CalloutLayout'

/**
 * Placement controls for the x-ray's call-outs. `e`, or `?edit=1`.
 *
 * Two ways in, because they answer different questions. Dragging the rings on the stage
 * is how you find a position — you are looking at the shoe, not at numbers. The fields
 * are how you set one exactly, nudge by a tenth, or get there from the keyboard, which a
 * drag handle can't offer.
 *
 * **Both states are listed at once**, because the thing being refined is usually the
 * relationship between them: whether the two dots are far enough apart to read as
 * different parts of the shoe, whether the two shelves want to be at the same height.
 * Comparing that through a toggle means holding one set of numbers in your head. What
 * stays one-at-a-time is the *handles* — eight on the stage is a thicket, and the two
 * states are drawn at opposite ends of the reveal anyway, so selecting a state pins the
 * progress to the end it's fully drawn at and moves the handles there.
 *
 * The layout persists to `localStorage`, which is the right home for a value you are
 * still deciding. **Copy** is how it stops being local: it emits the `DEFAULT_PAIRS`
 * literal to paste over the one in `lib/callouts.ts`. Nothing here writes to disk, so
 * without that step a placement only exists in this browser.
 */

const PHASES: { key: Phase; name: string; p: number }[] = [
  { key: 'from', name: 'Before', p: 0 },
  { key: 'to', name: 'After', p: 1 },
]

/** `target` and `anchor` are what the geometry calls them; these are what they are. */
const POINTS = [
  { key: 'target', name: 'dot' },
  { key: 'anchor', name: 'text' },
] as const

const SIDES: Side[] = ['above', 'below']

export function CalloutEditor({
  pinned,
  onPin,
}: {
  /** Current pinned progress, or null when progress is following the scroll. */
  pinned: number | null
  onPin: (p: number) => void
}) {
  const { pairs, setSpot, reset, dirty, editing, phase, setPhase } = useCalloutLayout()
  const [copied, setCopied] = useState(false)
  const [showing, setShowing] = useState(false)

  /**
   * Opening the editor lines the two up, in whichever direction is already decided.
   *
   * A frame that was pinned deliberately — `?p=1&edit=1`, or the debug scrubber — wins,
   * and the state follows it. Only when nothing is pinned does opening the editor pin the
   * progress itself, which is what makes `e` useful mid-scroll: otherwise it would show
   * handles for marks that aren't drawn at that progress, draggable against nothing.
   */
  useEffect(() => {
    if (!editing) return
    if (pinned !== null) setPhase(pinned >= 0.5 ? 'to' : 'from')
    else onPin(phase === 'from' ? 0 : 1)
    // Only on open. Re-running on `phase` would fight the buttons, and on `pinned` it
    // would yank the state around every time the scrubber moved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  if (!editing) return null

  const source = toSource(pairs)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(source)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      // Clipboard access needs a secure context and can be refused outright. Falling back
      // to showing the text means the answer is never simply unavailable.
      setShowing(true)
    }
  }

  return (
    <div className="panel editor">
      <h2>Call-out placement</h2>

      {PHASES.map((option) => (
        <section
          key={option.key}
          className="editor__state"
          data-active={phase === option.key || undefined}
        >
          {/* The heading is the selector: there's nothing else it could usefully do, and
              a separate row of state buttons would sit further from what it governs. */}
          <button
            type="button"
            className="editor__state-head"
            aria-pressed={phase === option.key}
            onClick={() => {
              setPhase(option.key)
              onPin(option.p)
            }}
          >
            {option.name}
            <span>{phase === option.key ? 'dragging' : `pin p = ${option.p}`}</span>
          </button>

          {pairs.map((pair, index) => {
            const spot = pair[option.key]
            return (
              <fieldset key={index} className="editor__spot">
                <legend>{spot.label}</legend>

                {POINTS.map(({ key, name }) => (
                  <div className="editor__row" key={key}>
                    <span data-kind={key}>{name}</span>
                    {([0, 1] as const).map((axis) => (
                      <input
                        key={axis}
                        type="number"
                        step={0.1}
                        value={spot[key][axis]}
                        aria-label={`${spot.label} ${name} ${axis ? 'y' : 'x'}`}
                        onChange={(event) => {
                          const next = Number(event.target.value)
                          if (!Number.isFinite(next)) return
                          const at = [...spot[key]] as [number, number]
                          at[axis] = next
                          setSpot(index, option.key, { [key]: at })
                        }}
                      />
                    ))}
                  </div>
                ))}

                {/* Which side of the shelf the text sits on. Worth having next to the
                    positions: move a text past its own dot and the leader would otherwise
                    have to cross its own label to get there. */}
                <div className="editor__row editor__row--side">
                  <span>text side</span>
                  {SIDES.map((side) => (
                    <button
                      key={side}
                      type="button"
                      aria-pressed={spot.side === side}
                      onClick={() => setSpot(index, option.key, { side })}
                    >
                      {side}
                    </button>
                  ))}
                </div>
              </fieldset>
            )
          })}
        </section>
      ))}

      <div className="editor__actions">
        <button type="button" onClick={copy} title="Copy the DEFAULT_PAIRS literal">
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button type="button" onClick={() => setShowing((v) => !v)}>
          {showing ? 'Hide' : 'Show'}
        </button>
        <button type="button" onClick={reset} disabled={!dirty}>
          Reset
        </button>
      </div>

      {showing && <textarea className="editor__source" readOnly rows={12} value={source} />}

      <div className="keys">{dirty ? 'edited — copy to keep' : 'source defaults'}</div>
    </div>
  )
}
