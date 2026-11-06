// The gold ghost hand on the trumpet: a right hand with its thumb under the
// leadpipe and its first three fingers on the valve buttons. Each finger
// presses its valve with the valve (the real fingering of the note that
// sounds), and lifts with it.
//
// The model holds the hand resting and with each finger pressed (the same
// vertices); they become one mesh whose shape blends each finger on its own.
import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Vector3,
  type Object3D,
} from "three";

import { ghostMaterial } from "./ghost";
import { MODELS, useOptionalModel } from "./models";
import { rig } from "./Trumpet";

/** The ghost hand's gold (also your hand on the corner camera, and the chips). */
export const GHOST_COLOR = "#F2B21C";

const BASE = "TrumpetHand_Rest";
const PRESSED = [
  "TrumpetHand_Press1",
  "TrumpetHand_Press2",
  "TrumpetHand_Press3",
] as const;

/**
 * A pose's vertices (and normals) in the base pose's own frame: each pose
 * mesh is placed (and quantised) differently, so the vertices are brought
 * through the room and back into the base mesh's frame.
 */
const inBaseFrame = (pose: Mesh, base: Mesh) => {
  pose.updateWorldMatrix(true, false);
  base.updateWorldMatrix(true, false);
  const toBase = new Matrix4()
    .copy(base.matrixWorld)
    .invert()
    .multiply(pose.matrixWorld);
  const g = pose.geometry;
  const pos = g.getAttribute("position");
  const nor = g.getAttribute("normal");
  const p = new Float32Array(pos.count * 3);
  const n = new Float32Array(pos.count * 3);
  const v = new Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i).applyMatrix4(toBase);
    p.set([v.x, v.y, v.z], i * 3);
    if (nor) {
      v.fromBufferAttribute(nor, i).transformDirection(toBase);
      n.set([v.x, v.y, v.z], i * 3);
    }
  }
  return { p, n };
};

/** One blendable hand mesh, placed in the trumpet's frame. */
const blendHand = (src: Object3D) => {
  const root = src.getObjectByName("GhostHand_Trumpet") ?? src;
  const base = root.getObjectByName(BASE) as Mesh | undefined;
  if (!base?.isMesh) return null;
  root.updateWorldMatrix(true, true);
  const rootInv = new Matrix4().copy(root.matrixWorld).invert();
  const own = inBaseFrame(base, base);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(own.p, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(own.n, 3));
  if (base.geometry.index) geometry.setIndex(base.geometry.index.clone());
  const targets = PRESSED.map((name) => {
    const pose = root.getObjectByName(name) as Mesh | undefined;
    return pose?.isMesh ? inBaseFrame(pose, base) : own;
  });
  // Morph targets hold the difference from the resting hand.
  geometry.morphTargetsRelative = true;
  geometry.morphAttributes.position = targets.map(
    (t) =>
      new Float32BufferAttribute(
        t.p.map((x, i) => x - own.p[i]),
        3,
      ),
  );
  geometry.morphAttributes.normal = targets.map(
    (t) =>
      new Float32BufferAttribute(
        t.n.map((x, i) => x - own.n[i]),
        3,
      ),
  );
  geometry.computeBoundingSphere();
  // The base mesh's placement in the trumpet's frame (the model's root is that frame).
  const placeInTrumpet = new Matrix4().copy(rootInv).multiply(base.matrixWorld);
  return { geometry, placeInTrumpet };
};

const depthOnly = new MeshBasicMaterial({
  colorWrite: false,
  side: DoubleSide,
});

export const GhostHand = () => {
  const src = useOptionalModel(MODELS.ghostHand);

  const hand = useMemo(() => {
    if (!src) return null;
    const made = blendHand(src);
    if (!made) return null;
    const mesh = new Mesh(made.geometry, ghostMaterial(GHOST_COLOR));
    mesh.applyMatrix4(made.placeInTrumpet);
    mesh.morphTargetInfluences = [0, 0, 0];
    mesh.renderOrder = 5;
    // A depth-only copy drawn first: only the hand's outer surface shows.
    const depth = new Mesh(made.geometry, depthOnly);
    depth.morphTargetInfluences = mesh.morphTargetInfluences;
    depth.renderOrder = 4;
    mesh.add(depth);
    rig.trumpet.add(mesh);
    return mesh;
  }, [src]);

  useFrame(() => {
    const inf = hand?.morphTargetInfluences;
    if (!inf) return;
    // Each finger goes down and up with its valve.
    for (let i = 0; i < 3; i += 1) inf[i] = rig.press[i];
  });

  return null;
};
