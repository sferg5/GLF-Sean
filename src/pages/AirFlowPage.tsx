import { Perforation } from '../components/Perforation'

/**
 * The airflow bench test, as its own page.
 *
 * It lived at the foot of show zero and was split out for the same reason the reel and the film
 * are separate sections rather than one: each of these is a display piece meant to be stood in
 * front of, and two full experiences stacked in one scroll means one of them is always off screen.
 * Show zero keeps the moisture claim; this page is the cooling claim. Both are one screen tall on
 * an iPad, which is the display they are actually headed for — the section's own vertical budget
 * lives in its stylesheet, in `svh` units, so "one screen" is a property of the CSS rather than a
 * hope about the content.
 *
 * A plain export and a static import in `App.tsx`, unlike `ShowZeroPage` — that page is a `lazy()`
 * chunk because it pulls three.js through its hero, and this one is 2D canvas with no dependency
 * heavier than React. Splitting it would trade a render for a request.
 */
export default function AirFlowPage() {
  return (
    <main className="airflow">
      <Perforation />
    </main>
  )
}
