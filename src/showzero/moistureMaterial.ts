import { Color, DoubleSide, MeshPhysicalMaterial } from 'three'
import type { WebGLProgramParametersWithUniforms } from 'three'
import { GROW_SPAN, ZONES } from './sweatZones'
import { SWATCH_H, SWATCH_W } from './geometry'
import { knitNormalMap } from './knitTexture'

/**
 * The fabric, and what moisture does to it.
 *
 * One material, two responses. Both swatches receive the *same* `uMoisture` — the
 * premise is identical sweat — and differ only in `uMarkResponse` (does wetness
 * darken the cloth) and `uSheenWet` (how much of the wet specular lift shows).
 * ShowZero runs both at zero: the same water lands, and the cloth reports nothing
 * at all — which is the brief, literally.
 *
 * The cloth's movement lives in the Verlet sim (`clothSim.ts`), not here — this
 * material's vertex stage only forwards two things the fragment needs: the sweat
 * coordinate (from `uv`, so marks ride the cloth as it moves) and the per-vertex
 * **cavity** term the sim computes each frame. Cavity is holocloth's fold-occlusion
 * trick: valleys see less of the environment, so the folds shade themselves softly
 * — most of what makes simulated cloth read as plush rather than plastic.
 *
 * Built on `MeshPhysicalMaterial` via `onBeforeCompile` rather than a raw
 * `ShaderMaterial`, so the whole PBR pipeline — the environment light, the sheen
 * model, tone mapping — is inherited rather than re-implemented.
 *
 * The sweat map itself is a distance field grown from the zone seeds, wobbled by
 * three octaves of value noise so the front edge is blotchy the way wicking actually
 * is. Zones are baked into the GLSL as constants — they're facts about the sample,
 * not state.
 */

export type FabricHandle = {
  material: MeshPhysicalMaterial
  uniforms: { uMoisture: { value: number }; uCavity: { value: number } }
}

const f = (n: number) => n.toFixed(4)

const HW = f(SWATCH_W / 2)
const HH = f(SWATCH_H / 2)

const VERTEX_HEAD = /* glsl */ `
varying vec2 vGarment;
attribute float aCavity;
varying float vCavity;
`

const FRAGMENT_HEAD = /* glsl */ `
varying vec2 vGarment;
varying float vCavity;
uniform float uMoisture;
uniform float uMarkResponse;
uniform float uSheenWet;
uniform float uCavity;

float szHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float szNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 fr = fract(p);
  vec2 u = fr * fr * (3.0 - 2.0 * fr);
  return mix(
    mix(szHash(i), szHash(i + vec2(1.0, 0.0)), u.x),
    mix(szHash(i + vec2(0.0, 1.0)), szHash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float szFbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * szNoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

/* Signed "wetness field" for one zone: positive inside the mark. Area grows with
   sqrt(growth) on the radius, i.e. linearly in area — how wicking spreads. */
float szZone(vec2 p, vec2 c, float maxR, float onset) {
  float g = smoothstep(onset, onset + ${f(GROW_SPAN)}, uMoisture);
  if (g <= 0.001) return -1000.0;
  return maxR * sqrt(g) - length(p - c);
}
`

export function makeFabricMaterial({
  markResponse,
  sheenWet,
}: {
  /** 1: ordinary jersey, marks show. 0: ShowZero, they don't. */
  markResponse: number
  /** How much of the wet specular lift this fabric reports. */
  sheenWet: number
}): FabricHandle {
  const material = new MeshPhysicalMaterial({
    /* Heather grey, identical on both specimens — "same fabric" is the message. */
    color: new Color('#a8a39d'),
    roughness: 0.92,
    metalness: 0,
    sheen: 0.35,
    sheenRoughness: 0.7,
    sheenColor: new Color('#ffffff'),
    normalMap: knitNormalMap(),
    /* The billows show the sheet edge-on here and there. */
    side: DoubleSide,
  })
  material.normalScale.set(0.8, 0.8)

  const uniforms = {
    uMoisture: { value: 0 },
    uMarkResponse: { value: markResponse },
    uSheenWet: { value: sheenWet },
    /* Fold occlusion strength — how much the valleys swallow. */
    uCavity: { value: 0.85 },
  }

  const zoneLines = ZONES.map(
    (z) =>
      `  szField = max(szField, szZone(vGarment, vec2(${f(z.x)}, ${f(z.y)}), ${f(z.r)}, ${f(z.onset)}));`,
  ).join('\n')

  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms)

    shader.vertexShader =
      VERTEX_HEAD +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
  vGarment = vec2(mix(-${HW}, ${HW}, uv.x), mix(-${HH}, ${HH}, uv.y));
  vCavity = aCavity;`,
      )

    shader.fragmentShader = FRAGMENT_HEAD + shader.fragmentShader

    /* Albedo. Order matters and is deliberate: heather first (it belongs to the dry
       cloth), then the mark multiplies over it, then the wicking ring — a slightly
       darker rim just inside the front, where the salt edge dries. */
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      /* glsl */ `#include <map_fragment>
  float szField = -1000.0;
${zoneLines}
  float szEdge = szField + (szFbm(vGarment * 16.0) - 0.5) * 0.06;
  float szWet = smoothstep(0.0, 0.02, szEdge);
  float szRing = smoothstep(0.0, 0.012, szEdge) - smoothstep(0.012, 0.05, szEdge);
  float szMark = szWet * uMarkResponse;

  // Heather melange — both swatches, part of the dry fabric.
  diffuseColor.rgb *= 0.94 + 0.12 * szFbm(vGarment * 120.0);
  // The mark: wet cloth drops ~45% and warms very slightly.
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.55, 0.535, 0.525), szMark);
  diffuseColor.rgb *= 1.0 - 0.05 * szRing * uMarkResponse;`,
    )

    /* Roughness: sweat is a specular event before it is a colour one. Wet areas go
       glossier on BOTH swatches, scaled by each fabric's uSheenWet — on ShowZero the
       light shifts a little and the mark never comes. */
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      /* glsl */ `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.45, szWet * uSheenWet);`,
    )

    /* Fold occlusion, holocloth's recipe: the cavity term swallows the indirect
       light entirely and about half the direct diffuse — folds go soft, not black.
       Injected at the AO chunk, which sits right after the lighting loop. */
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <aomap_fragment>',
      /* glsl */ `#include <aomap_fragment>
  float szAO = 1.0 - uCavity * vCavity;
  reflectedLight.indirectDiffuse *= szAO;
  reflectedLight.indirectSpecular *= szAO;
  reflectedLight.directDiffuse *= mix(1.0, szAO, 0.45);
  #ifdef USE_SHEEN
  sheenSpecularIndirect *= szAO;
  #endif`,
    )
  }

  /* One injected program for both specimens (responses are uniforms). Without the
     key, three would try to share with the *stock* physical material and miss the
     injection. */
  material.customProgramCacheKey = () => 'showzero-swatch'

  return { material, uniforms }
}
