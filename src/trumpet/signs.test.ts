import { Euler, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import type { Sign } from "./notes";
import { readSign, SIGN_HOLD, SignReader, type Joint } from "./signs";

/**
 * A synthetic right hand, palm to the camera (cm): wrist at the origin,
 * fingers up +y. `up` says which of index, middle, ring, pinky are up;
 * `thumb` whether the thumb is out.
 */
const hand = (
  up: boolean[],
  thumb: boolean,
  turn = new Euler(),
  left = false,
): Joint[] => {
  const j: Vector3[] = Array.from({ length: 21 }, () => new Vector3());
  // Thumb: out to the side, or folded across the palm.
  j[1].set(-2.5, 2, 0.5);
  j[2].set(-4, 4, 1);
  if (thumb) {
    j[3].set(-6, 6, 1.2);
    j[4].set(-7.5, 8, 1.2);
  } else {
    j[3].set(-2.5, 5.5, 2.2);
    j[4].set(-0.5, 6, 2.6);
  }
  const xs = [-2.4, -0.8, 0.8, 2.3];
  const len = [1, 1.08, 1, 0.8];
  [5, 9, 13, 17].forEach((mcp, f) => {
    const x = xs[f];
    const s = len[f];
    j[mcp].set(x, 8, 0);
    if (up[f]) {
      j[mcp + 1].set(x, 8 + 4 * s, 0);
      j[mcp + 2].set(x, 8 + 6.5 * s, 0);
      j[mcp + 3].set(x, 8 + 8.5 * s, 0);
    } else {
      // Curled down into the palm, towards the camera.
      j[mcp + 1].set(x, 8 + 2.4 * s, 2.2 * s);
      j[mcp + 2].set(x, 8 + 0.6 * s, 3.2 * s);
      j[mcp + 3].set(x, 7 - 0.6 * s, 2.4 * s);
    }
  });
  return j.map((v) => {
    const r = v.clone().applyEuler(turn);
    // A left hand is the right hand mirrored.
    return { x: left ? -r.x : r.x, y: r.y, z: r.z };
  });
};

const SIGNS: [Sign, boolean[], boolean][] = [
  ["fist", [false, false, false, false], false],
  ["one", [true, false, false, false], false],
  ["two", [true, true, false, false], false],
  ["three", [true, true, true, false], false],
  ["four", [true, true, true, true], false],
  ["open", [true, true, true, true], true],
  ["rock", [true, false, false, true], false],
  ["call", [false, false, false, true], true],
];
/** The signs that read the same whatever the thumb does (all but four and open). */
const THUMB_FREE: [Sign, boolean[]][] = SIGNS.filter(
  ([sign]) => sign !== "four" && sign !== "open",
).map(([sign, up]) => [sign, up]);

const TURNS = [
  new Euler(0, 0, 0),
  new Euler(0, 0.5, 0),
  new Euler(0, -0.45, 0),
  new Euler(0.35, 0, 0),
  new Euler(0, 0, 0.4),
  new Euler(-0.3, 0.3, -0.25),
];

describe("note-hand signs", () => {
  SIGNS.forEach(([sign, up, thumb]) => {
    it(`reads ${sign}, facing the camera and turned`, () => {
      TURNS.forEach((t) => expect(readSign(hand(up, thumb, t))).toBe(sign));
    });
  });

  it("reads every sign but four and open the same, thumb in or out", () => {
    THUMB_FREE.forEach(([sign, up]) =>
      [false, true].forEach((thumb) =>
        TURNS.forEach((t) => expect(readSign(hand(up, thumb, t))).toBe(sign)),
      ),
    );
  });

  it("reads a left hand the same as a right hand", () => {
    SIGNS.forEach(([sign, up, thumb]) =>
      TURNS.forEach((t) =>
        expect(readSign(hand(up, thumb, t, true))).toBe(sign),
      ),
    );
  });

  it("tells Ti (pinky only) from La (index and pinky) and Sol (open hand)", () => {
    expect(readSign(hand([false, false, false, true], true))).toBe("call");
    expect(readSign(hand([true, false, false, true], true))).toBe("rock");
    expect(readSign(hand([true, true, true, true], true))).toBe("open");
    expect(readSign(hand([false, false, false, true], false))).toBe("call");
  });

  it("tells rock (index and pinky) from two (index and middle)", () => {
    expect(readSign(hand([true, false, false, true], false))).toBe("rock");
    expect(readSign(hand([true, true, false, false], false))).toBe("two");
    // Any other two fingers are two.
    expect(readSign(hand([false, true, true, false], false))).toBe("two");
    expect(readSign(hand([true, false, true, false], false))).toBe("two");
  });

  it("counts any one or three fingers, whichever they are", () => {
    expect(readSign(hand([false, true, false, false], false))).toBe("one");
    expect(readSign(hand([false, true, true, true], false))).toBe("three");
  });

  it("only takes a sign that holds for a moment", () => {
    const r = new SignReader();
    const fist = hand([false, false, false, false], false);
    const two = hand([true, true, false, false], false);
    r.push(0, fist);
    expect(r.sign).toBeNull();
    r.push(SIGN_HOLD + 0.01, fist);
    expect(r.sign).toBe("fist");
    // A flicker to two and back changes nothing.
    r.push(0.3, two);
    r.push(0.33, fist);
    r.push(0.36, fist);
    expect(r.sign).toBe("fist");
    // Two held: it counts.
    for (let t = 0.4; t < 0.4 + SIGN_HOLD + 0.05; t += 1 / 30) r.push(t, two);
    expect(r.sign).toBe("two");
  });

  it("keeps the last sign while the hand is lost", () => {
    const r = new SignReader();
    const three = hand([true, true, true, false], false);
    for (let t = 0; t < 0.3; t += 1 / 30) r.push(t, three);
    r.lost();
    expect(r.sign).toBe("three");
  });
});
