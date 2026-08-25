import { useSyncExternalStore } from 'react'

/**
 * Which page this is. Three of them: the shoe (everything this prototype was until now),
 * show zero (the fabric), and the guest journey (a route that's still being drawn).
 *
 * **A store rather than a router.** The app has three runtime dependencies and a URL
 * convention that already carries every linkable choice as a query param — `?v=`,
 * `?order=`, `?sheet=`. A page is the same kind of fact, so it rides the same way:
 * `?page=show-zero`, absent means shoes, junk means shoes. What it doesn't share with
 * those params is the verb. A variant switch is a segmented control, so it writes
 * `replaceState`; a page is *navigation*, so it earns a history entry and a `popstate`
 * listener — Back should walk pages, and should never walk colour choices.
 *
 * Same shape as `sheet.ts` and for the same reason: two components at opposite ends of
 * the tree read it (the nav for its active row, `App` for what to render), and the
 * `popstate` listener wants to exist exactly once, next to the value it updates.
 *
 * **Never persisted.** Unlike the sheet, the page is not a preference — the URL is the
 * document. This is also what keeps every verification script honest: a bare load of
 * the root is the shoe page, always.
 */

export type PageId = 'shoes' | 'show-zero' | 'air-flow' | 'guest-journey'

/** The nav's items, in its order. Labels are display copy; ids are URL slugs. */
export const PAGES: { id: PageId; label: string; title: string }[] = [
  { id: 'shoes', label: 'shoes', title: 'Shoe X-Ray — scroll transitions' },
  { id: 'show-zero', label: 'show zero', title: 'ShowZero — the fabric that shows nothing' },
  { id: 'air-flow', label: 'air flow', title: 'ShowZero — the faster you go, the cooler the feel' },
  { id: 'guest-journey', label: 'guest journey', title: 'Guest Journey' },
]

const isPage = (v: unknown): v is PageId => PAGES.some((p) => p.id === v)

/** `?page=show-zero`; absent or junk resolves to shoes — the `sanitiseOrder` philosophy. */
const fromUrl = (): PageId => {
  if (typeof window === 'undefined') return 'shoes'
  const raw = new URLSearchParams(window.location.search).get('page')
  return isPage(raw) ? raw : 'shoes'
}

let page: PageId = fromUrl()
const listeners = new Set<() => void>()

/**
 * Title and root attribute, published as the module evaluates — a deep link to
 * `?page=show-zero` should have the right tab title before React's first render,
 * the same argument `sheet.ts` makes for `data-sheet`.
 */
const publish = () => {
  if (typeof document === 'undefined') return
  document.title = PAGES.find((p) => p.id === page)!.title
  document.documentElement.dataset.page = page
}

publish()

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

const snapshot = () => page

export function navigate(next: PageId) {
  if (next === page) return
  page = next
  const url = new URL(window.location.href)
  /* The root stays the canonical shoes URL — a param that says "the default" is a param
     someone will paste into a doc. Everything else on the URL is preserved: `?v=` and
     friends are inert on the other pages and pick back up on return, and stripping them
     would make a nav click disagree with the Back button, whose entries keep them. */
  if (next === 'shoes') url.searchParams.delete('page')
  else url.searchParams.set('page', next)
  window.history.pushState(null, '', url)
  /* A new page starts at its top. `popstate` is left alone below, so Back returns to
     where you were — every section measures its own box and holds at any offset. */
  window.scrollTo({ top: 0, behavior: 'instant' })
  publish()
  for (const fn of listeners) fn()
}

/* Back/forward. Guarded by equality: `popstate` also fires for the logo's `#top` hash
   entries, and those shouldn't re-render or scroll anything. */
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    const next = fromUrl()
    if (next === page) return
    page = next
    publish()
    for (const fn of listeners) fn()
  })
}

export function usePage() {
  return useSyncExternalStore(subscribe, snapshot, () => 'shoes' as PageId)
}

/** Real hrefs for the nav, so a cmd-click and a copied link both mean what they say. */
export const hrefFor = (id: PageId) => (id === 'shoes' ? '/' : `/?page=${id}`)
