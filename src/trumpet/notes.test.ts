import { describe, expect, it } from "vitest";

import {
  CHOICES,
  choiceOf,
  keyChoice,
  noteMidi,
  signOf,
  SIGNS,
  valvesDown,
} from "./notes";

describe("the notes", () => {
  it("are C4–B4 low and C5–B5 high, in C major", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((n) => noteMidi(n as 0))).toEqual([
      60, 62, 64, 65, 67, 69, 71,
    ]);
    expect(noteMidi(0, "high")).toBe(72);
    expect(noteMidi(6, "high")).toBe(83);
  });

  it("press the trumpet's real valves", () => {
    expect(valvesDown(0)).toEqual([false, false, false]); // C
    expect(valvesDown(1)).toEqual([true, false, true]); // D 1+3
    expect(valvesDown(2)).toEqual([true, true, false]); // E 1+2
    expect(valvesDown(3)).toEqual([true, false, false]); // F 1
    expect(valvesDown(4)).toEqual([false, false, false]); // G
    expect(valvesDown(5)).toEqual([true, true, false]); // A 1+2
    expect(valvesDown(6)).toEqual([false, true, false]); // B 2
    expect(valvesDown("rest")).toEqual([false, false, false]);
  });

  it("each have their own sign, and a fist rests", () => {
    expect(new Set(SIGNS).size).toBe(CHOICES.length);
    CHOICES.forEach((c) => expect(choiceOf(signOf(c))).toBe(c));
    expect(signOf("rest")).toBe("fist");
    expect(signOf(0)).toBe("one");
    expect(signOf(5)).toBe("rock");
  });

  it("keys 1–7 choose Do … Ti, 0 rests", () => {
    expect(keyChoice("Digit1")).toBe(0);
    expect(keyChoice("Numpad7")).toBe(6);
    expect(keyChoice("Digit0")).toBe("rest");
    expect(keyChoice("Digit8")).toBeNull();
    expect(keyChoice("KeyP")).toBeNull();
  });
});
