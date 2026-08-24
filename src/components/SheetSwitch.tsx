import { motion, useReducedMotion } from 'motion/react'
import { SHEETS, type Sheet } from '../lib/sheet'

/**
 * Blueprint against paper, for the Sketch variant — see `lib/sheet.ts` for what the two
 * documents are claiming.
 *
 * The same segmented control as the variant switcher, sharing its classes and its
 * sliding indicator, because it's the same kind of choice: two treatments of one thing,
 * held next to each other. It reads as a second row of the same instrument rather than
 * as a different control that happens to be nearby.
 *
 * Its own `layoutId` — two shared-layout indicators under one name would animate the
 * selection *between the two controls* the first time you touched either.
 *
 * Only rendered on the variant that has a sheet, off `hasSheet` in the registry, so the
 * chrome never has to match on an id. The `s` key still works everywhere; see
 * `useSheetKey`.
 */
export function SheetSwitch({
  sheet,
  onSelect,
}: {
  sheet: Sheet
  onSelect: (sheet: Sheet) => void
}) {
  const reduced = useReducedMotion()

  return (
    <div className="switcher" role="group" aria-label="Sheet">
      {SHEETS.map((s) => (
        <button
          key={s.id}
          type="button"
          className="switcher__pill"
          aria-pressed={s.id === sheet}
          onClick={() => onSelect(s.id)}
          title="Sheet (s)"
        >
          {s.id === sheet && (
            <motion.span
              className="switcher__on"
              layoutId="sheet-on"
              transition={
                reduced ? { duration: 0 } : { duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }
              }
            />
          )}
          <span>{s.name}</span>
        </button>
      ))}
    </div>
  )
}
