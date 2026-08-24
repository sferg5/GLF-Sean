import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  MeshStandardMaterial,
} from 'three'
import type { MotionValue } from 'motion/react'
import { SWATCH_H, buildSwatchGrid } from './geometry'
import { ClothSim, type Tuning } from './clothSim'
import { makeFabricMaterial } from './moistureMaterial'
import { useMotionUniform } from './useMotionUniform'
import { Mist } from './Mist'

/**
 * One specimen: a cut of the fabric hanging from the shared rail by two clips,
 * simulated as cloth.
 *
 * The mesh's position buffer *is* the sim's — stepping the sim and flagging the
 * attribute is the whole update. Normals are recomputed per step (smooth shading
 * over a deliberately low grid is what makes the folds read soft), and the sim's
 * cavity term rides along as a vertex attribute for the material's fold occlusion.
 *
 * A spray on the bus hits BOTH specimens identically: the same impulse into the
 * cloth, the same mist in front of it. What differs — the mark appearing or not —
 * is entirely the material's response, which is the experiment.
 *
 * Frozen (reduced motion, scrubs, `?breeze=0`), the sim is never stepped: the
 * vertices are byte-for-byte the baked pose, normals and cavity computed once —
 * a reproducible frame.
 */

const HH = SWATCH_H / 2

let hardware: MeshStandardMaterial | null = null
export const hardwareMaterial = () => {
  hardware ??= new MeshStandardMaterial({ color: '#232326', roughness: 0.5, metalness: 0.35 })
  return hardware
}

export function Swatch({
  x,
  markResponse,
  sheenWet,
  phase,
  moisture,
  frozen,
  register,
  bus,
  tuning,
  fabric: fabricHexProp,
  coarse,
}: {
  /** Station in the scene — specimen A at −x, B at +x. */
  x: number
  markResponse: number
  sheenWet: number
  /** The two samples share the air but not the phase. */
  phase: number
  /** Shared sweat input, 0..1 — the same value on both specimens, by design. */
  moisture: MotionValue<number>
  frozen: boolean
  /** Scene's breeze loop; returns the unsubscribe. */
  register: (step: (dt: number) => void) => () => void
  /** The spray trigger — one press, both specimens. */
  bus: { on: (fn: () => void) => () => void }
  /** Live dial values, read by the sim every substep. */
  tuning: Tuning
  /** The dye lot — a hex, identical on both samples. */
  fabric: string
  /** Clothesline, or gathered into folds. */
  coarse: boolean
}) {
  const { sim, geometry, cavity, grid } = useMemo(() => {
    const grid = buildSwatchGrid(coarse)
    const sim = new ClothSim(
      grid.cols,
      grid.rows,
      grid.pose,
      { gx: grid.gx, gy: grid.gy, below: grid.below },
      grid.stepX,
      grid.stepY,
      grid.pins,
      phase,
      tuning,
    )
    const geometry = new BufferGeometry()
    const position = new BufferAttribute(sim.positions, 3)
    position.setUsage(DynamicDrawUsage)
    geometry.setAttribute('position', position)
    geometry.setAttribute('uv', new BufferAttribute(grid.uvs, 2))
    const cavity = new BufferAttribute(new Float32Array(sim.count), 1)
    cavity.setUsage(DynamicDrawUsage)
    geometry.setAttribute('aCavity', cavity)
    geometry.setIndex(grid.indices)
    geometry.computeVertexNormals()
    sim.computeCavity(geometry.attributes.normal.array, cavity.array as Float32Array)
    return { sim, geometry, cavity, grid }
  }, [coarse, phase, tuning])

  const fabric = useMemo(
    () => makeFabricMaterial({ markResponse, sheenWet }),
    [markResponse, sheenWet],
  )

  useEffect(
    () => () => {
      geometry.dispose()
      fabric.material.dispose()
    },
    [geometry, fabric],
  )

  useMotionUniform(moisture, (v) => {
    fabric.uniforms.uMoisture.value = v
  })

  /* The dye lot: base colour straight in, sheen fibres carried most of the way to
     white (the holocloth rule) so the rim stays a highlight on any ground. */
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    fabric.material.color.set(fabricHexProp)
    fabric.material.sheenColor.set(fabricHexProp).lerp(new Color('#ffffff'), 0.65)
    invalidate()
  }, [fabricHexProp, fabric, invalidate])

  /* How much light a fold's valley swallows. It was 1.0 in the gathered staging, where the folds
     were the picture; on the line it's 0.85, and the gathered staging is gone. */
  useEffect(() => {
    fabric.uniforms.uCavity.value = 0.85
    invalidate()
  }, [fabric, invalidate])

  useEffect(() => {
    if (frozen) return
    /* The settle of having just been hung, then the breeze loop owns it. */
    sim.justHung()
    const offStep = register((dt) => {
      sim.step(dt)
      geometry.attributes.position.needsUpdate = true
      geometry.computeVertexNormals()
      sim.computeCavity(geometry.attributes.normal.array, cavity.array as Float32Array)
      cavity.needsUpdate = true
    })
    const offSpray = bus.on(() => sim.spray())
    return () => {
      offStep()
      offSpray()
    }
  }, [frozen, register, bus, sim, geometry, cavity])

  return (
    <group position={[x, 0, 0]}>
      {/* The sim swings the sheet through its own bounding box — culling by a stale
          sphere would blink the cloth out at the frame edge. */}
      <mesh geometry={geometry} material={fabric.material} frustumCulled={false} />

      <Mist bus={bus} register={register} frozen={frozen} surface={grid.surface} />

      {/* The clips, wherever this hang wants them. The rail they grip is shared
          with the other specimen — one line, one air; see Scene. */}
      {grid.clipXs.map((px) => (
        <mesh key={px} material={hardwareMaterial()} position={[px, HH + 0.02, 0.012]}>
          <boxGeometry args={[0.024, 0.07, 0.026]} />
        </mesh>
      ))}
    </group>
  )
}
