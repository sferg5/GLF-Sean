import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/global.css'

/**
 * The entry. Three lines of work and one decision.
 *
 * **The stylesheet is imported here rather than linked from `index.html`**, which is what makes it
 * part of the module graph: Vite hashes it, inlines the critical path in the built `<head>`, and a
 * token renamed in `global.css` fails the build instead of failing silently in a browser.
 *
 * **`StrictMode` stays on.** Every canvas in this app runs a `requestAnimationFrame` loop out of a
 * `useEffect`, and StrictMode's double-invoke in development is the cheapest test there is that
 * each one actually cancels itself on cleanup — a loop that survives its own teardown shows up
 * immediately as two fields stepping at twice the rate.
 */
const host = document.getElementById('root')
if (!host) throw new Error('#root is missing from index.html')

createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
