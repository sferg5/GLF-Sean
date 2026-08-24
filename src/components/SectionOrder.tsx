import { useEffect, useState } from 'react'
import { Reorder, useReducedMotion } from 'motion/react'
import {
  DEFAULT_ORDER,
  SECTIONS,
  isDefaultOrder,
  sanitiseOrder,
  type SectionId,
} from '../lib/sections'

/**
 * Drag the page into a different order.
 *
 * Five rows, top to bottom in the order the sections appear, and dragging one moves the
 * section. Not the sections themselves: they're between one and seven viewports tall each, so
 * dragging the thing itself would mean dragging something you can't see the ends of. A list is
 * the smallest surface that shows the whole order at once, which is the thing being edited.
 *
 * It's part of the receding chrome rather than a panel that stays — the same trade the variant
 * switcher makes, and for the same reason. Re-ordering is something you do to the page before
 * reading it, and a control that stayed up would be a control over the content it's covering.
 */

const KEY = 'shoe-xray:sections'

/** `?order=reel,xray,prose,colorways,faq` — a whole page arrangement in one link. */
const fromUrl = () => {
  const raw = new URLSearchParams(window.location.search).get('order')
  return raw === null ? null : sanitiseOrder(raw)
}

export function useSectionOrder() {
  const [order, setOrder] = useState<SectionId[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_ORDER
    const url = fromUrl()
    if (url) return url
    try {
      const saved = localStorage.getItem(KEY)
      if (saved) return sanitiseOrder(JSON.parse(saved))
    } catch {
      // Blocked storage, or something else wrote nonsense here. The default is fine.
    }
    return DEFAULT_ORDER
  })

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(order))
    } catch {
      // Not worth surfacing: the order still applies for this session.
    }
  }, [order])

  return [order, setOrder] as const
}

export function SectionOrder({
  order,
  onChange,
}: {
  order: SectionId[]
  onChange: (order: SectionId[]) => void
}) {
  const reduced = !!useReducedMotion()

  /**
   * Arrow keys move the focused row, which is the whole feature without a pointer. Dragging is
   * the affordance; this is the one that works on a keyboard, and it's four lines.
   */
  const nudge = (id: SectionId, by: number) => {
    const from = order.indexOf(id)
    const to = from + by
    if (to < 0 || to >= order.length) return
    const next = [...order]
    next.splice(to, 0, ...next.splice(from, 1))
    onChange(next)
  }

  return (
    <>
      <h2>Sections</h2>

      <Reorder.Group
        axis="y"
        values={order}
        onReorder={onChange}
        className="sections__list"
        /* The list animates its own reflow; under reduced motion it should still *work*, so
           the drag stays and only the springing between rows goes. */
        layoutScroll={false}
      >
        {order.map((id) => {
          const section = SECTIONS.find((s) => s.id === id)
          if (!section) return null
          return (
            <Reorder.Item
              key={id}
              value={id}
              className="sections__row"
              tabIndex={0}
              /* The row is the handle, so the whole thing is grabbable rather than a 12px
                 glyph — but the glyph is still drawn, because a row that can be dragged and
                 doesn't say so is a row nobody drags. */
              aria-label={`${section.name} — ${section.note}. Drag, or use the arrow keys, to move it`}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp') nudge(id, -1)
                else if (e.key === 'ArrowDown') nudge(id, 1)
                else return
                e.preventDefault()
              }}
              transition={reduced ? { duration: 0 } : undefined}
            >
              <span className="sections__grip" aria-hidden="true" />
              <span className="sections__name">{section.name}</span>
              <span className="sections__note">{section.note}</span>
            </Reorder.Item>
          )
        })}
      </Reorder.Group>

      {/* Only when it would do something, so the panel is five rows at rest. */}
      {!isDefaultOrder(order) && (
        <div className="sections__actions">
          <button type="button" onClick={() => onChange(DEFAULT_ORDER)}>
            Reset order
          </button>
        </div>
      )}
    </>
  )
}
