/**
 * The page's sections, and the order they're in.
 *
 * Six things stacked in one scroll, and which order they're stacked in is now data rather
 * than markup — see `components/SectionOrder.tsx` for the control and `App.tsx` for the
 * render. Each one owns its own scroll timeline and measures against its own section box, so
 * they compose in any order without knowing where they are: the x-ray's `p`, the reel's `s`
 * and the colourways' hover state are all local, and none of them reads the document.
 *
 * What isn't order-independent is the *reading*, which is why there's still a default: the cut
 * explains what the shoe is made of, the reel is what it's for, the prose is the part that
 * needs no pictures, the range answers "which one", the film is the closing look — it plays
 * itself, and the only thing scroll does there is close a frame around it — and questions come
 * last because they always do.
 */

export type SectionId = 'xray' | 'reel' | 'prose' | 'colorways' | 'clip' | 'faq'

export type Section = {
  id: SectionId
  /** Short enough for a draggable row, which is where these are read. */
  name: string
  /** What it is, in three or four words. */
  note: string
}

export const SECTIONS: Section[] = [
  { id: 'xray', name: 'X-ray', note: 'the cut' },
  { id: 'reel', name: 'Reel', note: 'the footage' },
  { id: 'prose', name: 'Prose', note: 'the words' },
  { id: 'colorways', name: 'Colours', note: 'the range' },
  { id: 'clip', name: 'Film', note: 'the clip' },
  { id: 'faq', name: 'FAQ', note: 'the questions' },
]

/**
 * The airflow section was briefly a seventh entry here and isn't one any more. It lives on the
 * show-zero page, which is the page about a fabric — a shoe-page section that argued about a
 * knit was in the wrong document, and the argument for putting it here (that the prose claims
 * the upper is open where the foot needs air, and this proves it) was an argument about
 * adjacency rather than about subject.
 */
export const DEFAULT_ORDER: SectionId[] = [
  'xray',
  'reel',
  'prose',
  'colorways',
  'clip',
  'faq',
]

const IDS = new Set<string>(DEFAULT_ORDER)

/**
 * Any list of ids in, a valid permutation out.
 *
 * Unknown ids are dropped and missing ones are appended in their default order, so a stale
 * `?order=` from before a section existed still resolves to a page with every section in it —
 * which matters more than honouring the link exactly. A saved order is a preference, not a
 * document.
 */
export const sanitiseOrder = (raw: unknown): SectionId[] => {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : []
  const seen = new Set<SectionId>()
  const out: SectionId[] = []

  for (const value of list) {
    const id = String(value).trim() as SectionId
    if (IDS.has(id) && !seen.has(id)) {
      seen.add(id)
      out.push(id)
    }
  }
  for (const id of DEFAULT_ORDER) if (!seen.has(id)) out.push(id)

  return out
}

export const isDefaultOrder = (order: SectionId[]) =>
  order.length === DEFAULT_ORDER.length && order.every((id, i) => id === DEFAULT_ORDER[i])
