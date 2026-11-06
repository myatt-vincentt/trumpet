import { describe, expect, it } from "vitest";

import { layerBlend, nearestSample } from "./sampler";

/** The recordings' notes (measured pitches). */
const BANK = [60, 63, 65, 67, 70, 74, 77, 81, 84].map((midi) => ({ midi }));

describe("the recorded trumpet", () => {
  it("plays every note from C4 to B5 from a recording at most two semitones away", () => {
    for (let m = 60; m <= 83; m += 1)
      expect(Math.abs(nearestSample(BANK, m).shift)).toBeLessThanOrEqual(2);
  });

  it("blends soft into loud as a note is tongued harder (equal power)", () => {
    expect(layerBlend(0.3)).toEqual({ soft: 1, loud: 0 });
    const b = layerBlend(0.95);
    expect(b.loud).toBeCloseTo(1, 5);
    const mid = layerBlend(0.675);
    expect(mid.soft ** 2 + mid.loud ** 2).toBeCloseTo(1, 5);
    expect(layerBlend(0.85).loud).toBeGreaterThan(layerBlend(0.5).loud);
  });
});
