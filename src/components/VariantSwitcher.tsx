import { motion, useReducedMotion } from 'motion/react'
import { VARIANTS } from '../variants'

/**
 * Segmented control for the registry.
 *
 * There was a switcher here once and it was taken out; the verification scripts
 * used to count its pills, which is why they now read
 * `document.documentElement.dataset.variants` instead. That indirection is what
 * lets this come back without touching them.
 *
 * It's driven straight off `VARIANTS`, labels included, so adding a variant to the
 * registry puts it in the switcher and nothing here needs to know how many there
 * are. The number keys still work and go through the same handler.
 *
 * Like the rest of the page chrome it recedes as soon as you scroll. Switching
 * returns to the top anyway — the two variants pin over different scroll distances,
 * so there's no shared position to preserve — which means nothing is lost by the
 * control being unavailable mid-transition, and the finished plate stays clean.
 */
export function VariantSwitcher({
  active,
  onSelect,
}: {
  active: number
  onSelect: (index: number) => void
}) {
  const reduced = useReducedMotion()

  if (VARIANTS.length < 2) return null

  return (
    <div className="switcher" role="group" aria-label="Transition">
      {VARIANTS.map((v, i) => (
        <button
          key={v.id}
          type="button"
          className="switcher__pill"
          aria-pressed={i === active}
          onClick={() => onSelect(i)}
        >
          {/* One element shared between the pills, so the selection slides across
              instead of blinking from one to the other. Only ever animates on a
              click, so it costs nothing during a scroll. */}
          {i === active && (
            <motion.span
              className="switcher__on"
              layoutId="switcher-on"
              transition={
                reduced ? { duration: 0 } : { duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }
              }
            />
          )}
          <span>{v.name}</span>
        </button>
      ))}
    </div>
  )
}
