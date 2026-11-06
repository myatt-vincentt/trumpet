// The three views, switched with the view button in the dock:
//   front   from the room, the trumpet side-on at chest height (the default)
//   player  from over your shoulder, looking down the trumpet at your lips
//   close   in over the valves and the gold fingers on them
// Each view blends between its laptop and phone framing by the screen's
// shape, widens just enough to keep the trumpet on screen, and tips just
// enough to keep it clear of the corner camera and the dock. Switching glides the camera to the new view (strict ease-out).
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { PerspectiveCamera, Vector3 } from "three";

import {
  keepPoints,
  viewMargins,
  viewPose,
  VIEWS,
  type CameraPose,
  type View,
} from "./layout";
import { trumpet } from "./state";

/** A view switch takes this long (s). */
export const GLIDE = 0.9;

export const ease = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

const newPose = (): CameraPose => ({
  pos: new Vector3(),
  target: new Vector3(),
  fov: 50,
});

/** Development only: a fixed camera instead of the views (null = the views). */
export const cameraOverride: { pose: CameraPose | null } = { pose: null };

const KEEP = Object.fromEntries(VIEWS.map((v) => [v, keepPoints(v)])) as Record<
  View,
  Vector3[]
>;

const probe = new PerspectiveCamera();
const local = new Vector3();
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** One step of the fit: the field of view's tangent, and the camera tipped (mutates `out`). */
const fitStep = (
  view: View,
  aspect: number,
  m: ReturnType<typeof viewMargins>,
  tanBefore: number,
  base: number,
  out: CameraPose,
) => {
  probe.position.copy(out.pos);
  probe.lookAt(out.target);
  probe.updateMatrixWorld(true);
  // Each point up the screen (as a tangent), and how high it may go: under
  // the corner camera where the corner camera is above it.
  const pts = KEEP[view].map((p) => {
    local.copy(p).applyMatrix4(probe.matrixWorldInverse);
    const depth = Math.max(0.05, -local.z);
    const x = local.x / depth;
    const right = x / (tanBefore * aspect) > m.frameLeft;
    return { x, y: local.y / depth, lim: right ? m.under : m.top };
  });
  let t = Math.max(base, ...pts.map((p) => Math.abs(p.x) / (m.side * aspect)));
  pts.forEach((p) =>
    pts.forEach((q) => {
      t = Math.max(t, (p.y - q.y) / (p.lim + m.bottom));
    }),
  );
  const tanHalf = t;
  // eslint-disable-next-line no-param-reassign
  out.fov = Math.min(110, deg(2 * Math.atan(tanHalf)));
  // Tip the camera only as far as it takes to keep the content off the
  // corner camera and the dock (the view's own framing otherwise).
  const over = Math.max(...pts.map((p) => p.y - p.lim * tanHalf));
  const under = Math.min(...pts.map((p) => p.y + m.bottom * tanHalf));
  let shift = 0;
  if (over > 0) shift = Math.min(over, under);
  else if (under < 0) shift = Math.max(under, over);
  const dist = out.pos.distanceTo(out.target);
  // eslint-disable-next-line no-param-reassign
  out.target.y += shift * dist;
  return tanHalf;
};

/**
 * A view's pose for this screen: widened to fit what it keeps, and tipped
 * up or down just enough to keep that between the corner camera and the dock.
 */
const fittedPose = (
  view: View,
  width: number,
  height: number,
  out: CameraPose,
) => {
  const aspect = width / Math.max(1, height);
  viewPose(view, aspect, out);
  const m = viewMargins(width, height);
  const base = Math.tan(rad(out.fov) / 2);
  let tanHalf = base;
  for (let pass = 0; pass < 3; pass += 1)
    tanHalf = fitStep(view, aspect, m, tanHalf, base, out);
  return out;
};

export const CameraRig = () => {
  const from = useMemo(newPose, []);
  const live = useMemo(newPose, []);
  const cur = useMemo(newPose, []);
  const sw = useRef({ view: trumpet.view, at: -10, started: false });

  useFrame(({ camera, size }) => {
    const cam = camera as PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    trumpet.aspect = aspect;
    const s = sw.current;
    const now = performance.now() / 1000;
    if (s.view !== trumpet.view) {
      from.pos.copy(cur.pos);
      from.target.copy(cur.target);
      from.fov = cur.fov;
      s.view = trumpet.view;
      s.at = now;
    }
    fittedPose(trumpet.view, size.width, size.height, live);
    if (!s.started) {
      cur.pos.copy(live.pos);
      cur.target.copy(live.target);
      cur.fov = live.fov;
      s.started = true;
    }
    const k = ease((now - s.at) / GLIDE);
    cur.pos.copy(from.pos).lerp(live.pos, k);
    cur.target.copy(from.target).lerp(live.target, k);
    cur.fov = from.fov + (live.fov - from.fov) * k;
    if (k >= 1) {
      from.pos.copy(live.pos);
      from.target.copy(live.target);
      from.fov = live.fov;
    }
    const shown = cameraOverride.pose ?? cur;
    cam.position.copy(shown.pos);
    cam.lookAt(shown.target);
    if (
      Math.abs(cam.fov - shown.fov) > 0.01 ||
      cam.near !== 0.05 ||
      Math.abs(cam.aspect - aspect) > 1e-4
    ) {
      cam.fov = shown.fov;
      cam.near = 0.05;
      cam.far = 60;
      cam.aspect = aspect;
      cam.updateProjectionMatrix();
    }
  }, -1);
  return null;
};
