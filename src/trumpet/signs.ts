// The note hand's signs, read from the tracker's 21 hand joints. Plain code
// (no scene).
//
// Each finger is up or folded, judged in 3D from the hand's own shape (so a
// palm facing the camera, turned a little or tipped, reads the same): a
// finger is up when its tip is well beyond its middle joint as seen from the
// wrist and the finger is fairly straight; folded when its tip has come back
// towards the palm. In between, it keeps what it was (no flicker at the edge).
// The thumb only tells four (thumb folded across the palm) from an open hand;
// everywhere else it can be in or out.
//
//   one … three up             one … three → Do, Re, Mi (any fingers but the
//                                            pinky alone)
//   four up, thumb in          four   → Fa
//   four up, thumb out         open   → Sol
//   index and pinky only       rock   → La
//   pinky only                 call   → Ti (thumb and pinky out, "call me";
//                                            the thumb is not read)
//   no fingers up              fist   → rest
//
// A sign counts once it has held for a moment; a lost hand keeps its sign.
import type { Sign } from "./notes";

export type Joint = { x: number; y: number; z: number };

/** The four fingers' joints: knuckle, middle joint, top joint, tip. */
const FINGER_JOINTS = [
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [17, 18, 19, 20],
];
const WRIST = 0;
const THUMB_TIP = 4;
const THUMB_IP = 3;
const INDEX_MCP = 5;
const MIDDLE_MCP = 9;
const PINKY_MCP = 17;

/**
 * Up: the tip is this much further from the wrist than the middle joint, and
 * the finger bends less than this at its middle joint (cosine of the angle
 * between the knuckle→middle and middle→tip directions). Folded: the tip
 * is no further out than this, or the finger bends past this.
 */
export const FINGER = {
  upReach: 1.18,
  upStraight: 0.45,
  downReach: 1.04,
  downStraight: 0.05,
};
/** The thumb is out when its tip is this far from the middle knuckle (palm widths), in when nearer than this. */
export const THUMB = { out: 1.05, in: 0.85 };
/** A sign counts once it has held this long (s). */
export const SIGN_HOLD = 0.15;

const dist = (a: Joint, b: Joint) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

const sub = (a: Joint, b: Joint) => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});
const cosBetween = (a: Joint, b: Joint) => {
  const la = Math.hypot(a.x, a.y, a.z);
  const lb = Math.hypot(b.x, b.y, b.z);
  if (la < 1e-9 || lb < 1e-9) return 1;
  return (a.x * b.x + a.y * b.y + a.z * b.z) / (la * lb);
};

/** One finger's reach (tip ÷ middle joint, from the wrist) and straightness (cosine). */
export const fingerShape = (j: readonly Joint[], finger: number) => {
  const [mcp, pip, , tip] = FINGER_JOINTS[finger].map((i) => j[i]);
  const reach = dist(j[WRIST], tip) / Math.max(1e-6, dist(j[WRIST], pip));
  const straight = cosBetween(sub(pip, mcp), sub(tip, pip));
  return { reach, straight };
};

/**
 * Which fingers are up (index, middle, ring, pinky), given what they were
 * (`was`, for the in-between zone; null reads in-between as folded).
 */
export const fingersUp = (
  j: readonly Joint[],
  was: readonly boolean[] | null = null,
): boolean[] =>
  [0, 1, 2, 3].map((f) => {
    const { reach, straight } = fingerShape(j, f);
    if (reach >= FINGER.upReach && straight >= FINGER.upStraight) return true;
    if (reach <= FINGER.downReach || straight <= FINGER.downStraight)
      return false;
    return was ? was[f] : false;
  });

/** Is the thumb out to the side (true) or folded in (false)? */
export const thumbOut = (j: readonly Joint[], was: boolean | null = null) => {
  const palm = Math.max(1e-6, dist(j[INDEX_MCP], j[PINKY_MCP]));
  // The tip, or the joint before it if that is further (a bent thumb still points out).
  const d =
    Math.max(
      dist(j[THUMB_TIP], j[MIDDLE_MCP]),
      dist(j[THUMB_IP], j[MIDDLE_MCP]) * 0.9,
    ) / palm;
  if (d >= THUMB.out) return true;
  if (d <= THUMB.in) return false;
  return was ?? false;
};

/** The sign the fingers make. */
export const signFrom = (up: readonly boolean[], thumb: boolean): Sign => {
  const [i, m, r, p] = up;
  const n = up.filter(Boolean).length;
  if (n === 0) return "fist";
  if (n === 2 && i && p && !m && !r) return "rock";
  if (n === 1 && p) return "call";
  if (n === 1) return "one";
  if (n === 2) return "two";
  if (n === 3) return "three";
  return thumb ? "open" : "four";
};

/** The sign a hand makes now (no memory). */
export const readSign = (j: readonly Joint[]): Sign =>
  signFrom(fingersUp(j), thumbOut(j));

/**
 * Follows one hand's sign over time: a new sign counts once it has held for
 * SIGN_HOLD; a lost hand keeps the last sign.
 */
export class SignReader {
  /** The sign that counts (null until the first one has held). */
  sign: Sign | null = null;

  /** What the hand shows right now (before the hold). */
  raw: Sign | null = null;

  private up: boolean[] | null = null;

  private thumb: boolean | null = null;

  private since = 0;

  /** A reading at `t` (s); returns the sign that counts. */
  push(t: number, j: readonly Joint[]): Sign | null {
    this.up = fingersUp(j, this.up);
    this.thumb = thumbOut(j, this.thumb);
    const now = signFrom(this.up, this.thumb);
    if (now !== this.raw) {
      this.raw = now;
      this.since = t;
    }
    if (now !== this.sign && t - this.since >= SIGN_HOLD) this.sign = now;
    return this.sign;
  }

  /** The hand is lost: its fingers start afresh, the sign stays. */
  lost() {
    this.up = null;
    this.thumb = null;
    this.raw = null;
  }
}
