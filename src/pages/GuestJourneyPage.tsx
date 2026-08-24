/**
 * The guest journey — a page that exists so the nav tells the truth, holding the
 * route while it's designed. Same composition the prose section and the FAQ use:
 * a mono annotation, a statement, and a quiet paragraph on the grid.
 */
export function GuestJourneyPage() {
  return (
    <main className="journey">
      <p className="journey__note">guest journey · in design</p>
      <h1 className="journey__lead">every step from first look to first run.</h1>
      <p className="journey__body">
        discovery, trial, fit, purchase and the run after — the path a guest takes
        through the line, mapped as one page. this holds the route while it&rsquo;s drawn.
      </p>
    </main>
  )
}
