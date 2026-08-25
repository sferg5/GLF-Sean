import { ShowZeroHero } from '../showzero/ShowZeroHero'

/**
 * Show zero — now just the moisture bench test, one screen tall.
 *
 * The airflow tunnel that closed this page moved to its own route (`pages/AirFlowPage.tsx`): both
 * are display pieces meant to be stood in front of, and stacked in one scroll one of them was
 * always off screen. The knit prose went with the split — it was the only thing left making this
 * page scroll, and the page's job on a display is to be the hero. Its copy (`KNIT_PROSE`) is in
 * this file's history if it earns a home again.
 */

export default function ShowZeroPage() {
  return (
    <main className="showzero">
      <ShowZeroHero />

    </main>
  )
}
