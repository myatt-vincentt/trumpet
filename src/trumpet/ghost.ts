// The ghost look: see-through gold, lit from within in its own colour, with
// a soft glowing rim where the surface turns away from you. The colour is
// kept mid-bright so the tone curve keeps it saturated instead of white.
import { Color, DoubleSide, MeshStandardMaterial } from "three";

/** How the ghost is made of its colour. */
const LOOK = { base: 0.35, body: 0.35, rim: 1.4, opacity: 0.88 };

export const ghostMaterial = (hex: string) => {
  const c = new Color(hex);
  const rim = c.clone().multiplyScalar(LOOK.rim);
  const m = new MeshStandardMaterial({
    color: c.clone().multiplyScalar(LOOK.base),
    roughness: 0.45,
    metalness: 0,
    transparent: true,
    opacity: LOOK.opacity,
    depthWrite: false,
    emissive: c.clone().multiplyScalar(LOOK.body),
    side: DoubleSide,
  });
  m.onBeforeCompile = (shader) => {
    // eslint-disable-next-line no-param-reassign
    shader.uniforms.uRim = { value: rim };
    // eslint-disable-next-line no-param-reassign
    shader.fragmentShader = `uniform vec3 uRim;\n${shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
      float ghostRim = 1.0 - abs(dot(normal, normalize(vViewPosition)));
      totalEmissiveRadiance += uRim * pow(ghostRim, 2.2);`,
    )}`;
  };
  m.customProgramCacheKey = () => "trumpet-ghost";
  return m;
};
