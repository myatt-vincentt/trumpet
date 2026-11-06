// The screen layout: where the trumpet is in each view, where the camera
// looks from, how much it shows, and where the corner camera sits.
//
// Coordinates are the room's (metres, y up). Front looks towards −z at the
// trumpet floating side-on at chest height, its bell to the right; Player
// looks down along it from over your shoulder, held at your lips; Close comes
// in over the valves and the gold hand.
//
// The trumpet's own frame: +x along it to the bell (the mouthpiece tip at
// x = 0), +y up through the valve buttons, +z to the player's right.
import { Quaternion, Vector3 } from "three";

export type View = "front" | "player" | "close";
export const VIEWS: View[] = ["front", "player", "close"];

/** Screen shape → 0 (laptop, wide) … 1 (phone, tall). */
export const phoneness = (aspect: number) =>
  Math.min(1, Math.max(0, (1.5 - aspect) / (1.5 - 0.56)));

export type CameraPose = {
  pos: Vector3;
  target: Vector3;
  /** Vertical field of view (degrees). */
  fov: number;
};

const deg = (r: number) => (r * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;
/** The vertical field of view that gives this horizontal one. */
export const vfovFromH = (hfov: number, aspect: number) =>
  deg(2 * Math.atan(Math.tan(rad(hfov) / 2) / Math.max(0.1, aspect)));
/** The horizontal field of view of this vertical one. */
export const hfovFromV = (vfov: number, aspect: number) =>
  deg(2 * Math.atan(Math.tan(rad(vfov) / 2) * aspect));

// ---------------------------------------------------------------- the trumpet

export type Placement = { pos: Vector3; quat: Quaternion };
const place = (p: number[], q: number[]): Placement => ({
  pos: new Vector3(p[0], p[1], p[2]),
  quat: new Quaternion(q[0], q[1], q[2], q[3]).normalize(),
});

/**
 * Where the trumpet is in each view:
 *   front   side-on at chest height, the bell to the right, turned a little
 *           towards you
 *   player  held at your lips, the bell away from you and a little to the left
 *   close   as in Player (the camera comes in close)
 */
export const PLACE: Record<View, Placement> = {
  front: place([-0.2348, 1.28, -0.2999], [0, -0.10453, 0, 0.99452]),
  player: place([-0.0172, 1.492, 0.753], [0, 0.76604, 0, 0.64279]),
  close: place([-0.0172, 1.492, 0.753], [0, 0.76604, 0, 0.64279]),
};

/** The views where the trumpet floats side-on (the others hold it as you play). */
export const sideOn = (view: View) => view === "front";

/** The trumpet's parts (its own frame, m). */
export const TRUMPET = {
  /** The centre of the bell's rim, the bell's opening along +x, and its radius. */
  bellMouth: new Vector3(0.4775, 0, -0.0175),
  bellRadius: 0.0636,
  /** The valves' pistons: how far a press moves them down (m). */
  pressTravel: 0.016,
  /** The valve buttons' tops. */
  valveTops: [0.17, 0.195, 0.22].map((x) => new Vector3(x, 0.0362, 0)),
  /** The mouthpiece's tip. */
  mouthpiece: new Vector3(0, -0.042, 0.0175),
};

// ---------------------------------------------------------------- the views

// Each view's camera: on a laptop (16:9) the vertical field of view, on a
// phone (9:16) the horizontal one it gives.
const P = 9 / 16;
const FRONT = {
  laptop: { pos: [0.08, 1.32, 0.87], target: [0.08, 1.25, -0.25], vfov: 22.04 },
  phone: {
    pos: [0.06, 1.32, 0.9],
    target: [0.06, 1.22, -0.25],
    hfov: hfovFromV(65.47, P),
  },
};
const PLAYER = {
  laptop: {
    pos: [0.25, 1.8, 1.13],
    target: [-0.0624, 1.462, 0.497],
    vfov: 33.17,
  },
  phone: {
    pos: [0.22, 1.8, 1.12],
    target: [-0.0589, 1.452, 0.5167],
    hfov: hfovFromV(69.39, P),
  },
};
const CLOSE = {
  laptop: {
    pos: [0.0639, 1.682, 0.2919],
    target: [-0.0331, 1.512, 0.5477],
    vfov: 25.36,
  },
  phone: {
    pos: [0.0576, 1.702, 0.3134],
    target: [-0.0331, 1.497, 0.5477],
    hfov: hfovFromV(50.69, P),
  },
};
const VIEW_POSES = { front: FRONT, player: PLAYER, close: CLOSE };

/* eslint-disable no-param-reassign */
/** A view's camera for this screen shape (before the fit). */
export const viewPose = (view: View, aspect: number, out: CameraPose) => {
  const v = VIEW_POSES[view];
  const k = phoneness(aspect);
  const [lx, ly, lz] = v.laptop.pos;
  const [px, py, pz] = v.phone.pos;
  out.pos.set(lx + (px - lx) * k, ly + (py - ly) * k, lz + (pz - lz) * k);
  const [ltx, lty, ltz] = v.laptop.target;
  const [ptx, pty, ptz] = v.phone.target;
  out.target.set(
    ltx + (ptx - ltx) * k,
    lty + (pty - lty) * k,
    ltz + (ptz - ltz) * k,
  );
  const phoneV = vfovFromH(v.phone.hfov, aspect);
  out.fov = v.laptop.vfov + (phoneV - v.laptop.vfov) * k;
  return out;
};
/* eslint-enable no-param-reassign */

const at = (p: Placement, x: number, y: number, z: number) =>
  new Vector3(x, y, z).applyQuaternion(p.quat).add(p.pos);

/**
 * The points a view keeps on screen. Front: the whole trumpet, from the
 * mouthpiece to the bell, and the first sound rings past it. Player: the
 * valves and the bell. Close: the valve buttons and the gold fingers on them.
 */
export const keepPoints = (view: View): Vector3[] => {
  const p = PLACE[view];
  if (view === "close")
    return [
      at(p, 0.155, 0.045, 0.02),
      at(p, 0.235, 0.045, 0.02),
      at(p, 0.17, -0.02, 0),
      at(p, 0.22, -0.02, 0),
    ];
  if (view === "player")
    return [
      at(p, 0.15, 0.04, 0),
      at(p, 0.24, 0.04, 0),
      at(p, 0.48, 0.064, -0.0175),
      at(p, 0.48, -0.064, -0.0175),
    ];
  return [
    at(p, 0, -0.042, 0.0175),
    at(p, 0.6, 0.085, -0.0175),
    at(p, 0.6, -0.085, -0.0175),
    at(p, 0.195, 0.045, 0),
    at(p, 0.3, -0.1, 0),
  ];
};

// ---------------------------------------------------------------- page UI

/** The page gutter (CSS px). */
export const GUTTER = 16;
/** The corner camera's corner radius (CSS px). */
export const FRAME_RADIUS = 16;
/** The dock's distance from the bottom edge, and its height (CSS px). */
export const DOCK_BOTTOM = 22;
export const DOCK_HEIGHT = 58;
/** The sign strip sits this far above the dock, and is this tall (CSS px). */
export const STRIP_GAP = 10;
export const STRIP_HEIGHT = 58;

/** Where the corner camera sits (CSS px): top right. */
export const frameRect = (width: number, height: number) => {
  // Portrait-ish on a phone, landscape-ish on a laptop, never extreme.
  const aspect = Math.min(1.33, Math.max(0.75, width / Math.max(1, height)));
  const h = Math.min(220, Math.max(110, height * 0.24));
  const w = Math.round(h * aspect);
  return {
    left: width - GUTTER - w,
    top: GUTTER,
    width: w,
    height: Math.round(h),
  };
};

/**
 * The screen's edges the view keeps clear (NDC, 1 = the edge): the top, and
 * under the corner camera right of its left edge (`frameLeft`); the dock and
 * the sign strip below.
 */
export const viewMargins = (width: number, height: number) => {
  const h = Math.max(1, height);
  const w = Math.max(1, width);
  const frame = frameRect(width, height);
  const bottomPx = DOCK_BOTTOM + DOCK_HEIGHT + STRIP_GAP + STRIP_HEIGHT + 12;
  return {
    side: 0.96,
    top: 1 - (2 * 24) / h,
    under: Math.max(0.2, 1 - (2 * (frame.top + frame.height + 12)) / h),
    frameLeft: (2 * (frame.left - 8)) / w - 1,
    bottom: Math.max(0.3, 1 - (2 * bottomPx) / h),
  };
};

/**
 * For drei's `<Html fullscreen>`: pin the page UI to the screen. By default
 * it follows the scene's origin, which moves on screen with the camera.
 */
export const pinToScreen = (
  _el: unknown,
  _camera: unknown,
  size: { width: number; height: number },
) => [size.width / 2, size.height / 2];
