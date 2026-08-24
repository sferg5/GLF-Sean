import { Suspense, lazy } from 'react'
import { SiteNav } from './components/SiteNav'
import { ShoesPage } from './pages/ShoesPage'
import { GuestJourneyPage } from './pages/GuestJourneyPage'
import { usePage } from './lib/page'

/**
 * The shell, and only the shell.
 *
 * Everything that was ever in here is in `pages/ShoesPage.tsx` — the section order, the variant
 * registry's `dataset.variants`, the callout editor, all of it. What's left is the two things that
 * are true of every page: the nav is always up, and exactly one page is rendered.
 *
 * **The page comes from a store, not a router** (`lib/page.ts`). Three runtime dependencies and a
 * URL convention that already carries every linkable choice as a query param — a page rides the
 * same way, `?page=show-zero`, and the store owns the `popstate` listener next to the value it
 * updates.
 *
 * **Show zero is `lazy()` and the other two are not.** It's the only page that pulls three.js and
 * `@react-three/fiber`, which is most of the bundle; the shoe page is what a bare load of the root
 * resolves to and must not wait behind a chunk it never uses. The other two are small enough that
 * splitting them would trade a render for a request.
 */
const ShowZeroPage = lazy(() => import('./pages/ShowZeroPage'))

/**
 * What sits in the boundary while the show-zero chunk arrives.
 *
 * Deliberately not a spinner. The page it's standing in for opens on a near-black instrument, so
 * anything lighter than that is a flash of the wrong document — and a spinner over a chunk that
 * resolves in a few hundred milliseconds on a warm cache is motion nobody asked for. It's the
 * wall, at the height of a screen, and then the page is there.
 */
function PageFallback() {
  return <div className="page-wait" aria-hidden="true" />
}

export function App() {
  const page = usePage()

  return (
    <>
      <SiteNav />
      {page === 'show-zero' ? (
        <Suspense fallback={<PageFallback />}>
          <ShowZeroPage />
        </Suspense>
      ) : page === 'guest-journey' ? (
        <GuestJourneyPage />
      ) : (
        <ShoesPage />
      )}
    </>
  )
}
