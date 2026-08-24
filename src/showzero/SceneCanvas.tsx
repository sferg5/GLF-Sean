import { Canvas } from '@react-three/fiber'
import { ACESFilmicToneMapping } from 'three'
import type { ComponentProps } from 'react'
import { Scene } from './Scene'

type SceneProps = ComponentProps<typeof Scene>

/**
 * The GL surface. `frameloop="demand"`: nothing in this scene reads the clock, so a
 * frame is only drawn when a MotionValue asks for one via `invalidate()` — idle cost
 * is zero, and a scrolled frame equals a scrubbed frame, which the verification
 * scripts turn into a check.
 *
 * Transparent over the page's wall (the specimens float, like the shoe does), ACES
 * tone mapping at a touch over unit exposure — the wet-darkening constants in the
 * material were tuned under exactly this curve.
 */
/**
 * Camera distance from viewport shape: both specimens (rig half-width ~1.3) must fit
 * inside the horizontal frustum whatever the aspect. On any landscape window the
 * floor of 4.55 wins and the framing is the designed one; a phone in portrait backs
 * the camera off until the comparison fits — the point is the pair.
 */
const fitZ = () => {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight)
  return Math.min(14, Math.max(4.8, 1.3 / (Math.tan(Math.PI / 12) * aspect)))
}

export function SceneCanvas({ onLost, ...scene }: SceneProps & { onLost: () => void }) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ fov: 30, position: [0, 0, fitZ()], near: 0.1, far: 20 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping
        gl.toneMappingExposure = 1.0
        /* If the context dies, the page swaps to the SVG-and-canvas fallback rather
           than leaving a black rectangle where the argument was. */
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault()
          onLost()
        })
      }}
    >
      <Scene {...scene} />
    </Canvas>
  )
}
