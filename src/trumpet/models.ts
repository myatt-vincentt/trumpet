// The 3D models and bakes the scene loads (all under public/models/), and a
// loader that hands back null when a model isn't there.
import type { Object3D } from "three";
// eslint-disable-next-line import/extensions
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
// eslint-disable-next-line import/extensions
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

export const MODELS = {
  /** The trumpet (its three valves move on their own). */
  trumpet: "/models/trumpet.glb",
  /** The gold ghost hand (resting on the valves, and each finger pressing). */
  ghostHand: "/models/ghost-hand-trumpet.glb",
  /** The recording studio, its baked light and its light probe. */
  studio: "/models/studio.glb",
  lightmapDay: "/models/studio-lightmap-day.webp",
  lightmapNight: "/models/studio-lightmap-night.webp",
  /** Where the LED cove washes the walls (on the lightmaps' layout). */
  coveMask: "/models/studio-cove-mask.webp",
  envDay: "/models/studio-env-day.hdr",
};

type Loaded = { scene: Object3D } | null;

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map<string, { promise: Promise<void>; result?: Loaded }>();

/** Starts loading a model (or finds out it isn't there). */
export const preloadModel = (url: string) => {
  let entry = cache.get(url);
  if (!entry) {
    const e: { promise: Promise<void>; result?: Loaded } = {
      promise: Promise.resolve(),
    };
    e.promise = loader
      .loadAsync(url)
      .then((g) => {
        e.result = { scene: g.scene };
      })
      .catch(() => {
        e.result = null;
      });
    cache.set(url, e);
    entry = e;
  }
  return entry.promise;
};

/**
 * A model's scene, or null when the file isn't there (or isn't a model).
 * Suspends while it loads.
 */
export const useOptionalModel = (url: string): Object3D | null => {
  preloadModel(url);
  const entry = cache.get(url)!;
  // Suspense: React waits for the promise, then renders again.
  // eslint-disable-next-line @typescript-eslint/no-throw-literal
  if (entry.result === undefined) throw entry.promise;
  return entry.result?.scene ?? null;
};
