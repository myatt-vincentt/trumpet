import { Color } from "three";
import { describe, expect, it } from "vitest";

import { noteHue, NOTE_IDS } from "./notes";
import { LedFlash } from "./led";

const run = (f: LedFlash, seconds: number) => {
  const dt = 1 / 60;
  for (let i = 0; i < Math.round(seconds / dt); i += 1) f.update(dt);
};

const hueOf = (c: Color) => c.getHSL({ h: 0, s: 0, l: 0 }).h;

describe("LED flash", () => {
  it("is dark until something is played", () => {
    const f = new LedFlash();
    run(f, 1);
    expect(f.amount).toBe(0);
  });

  it("lights at once, as hard as the note, and eases away in about half a second", () => {
    const loud = new LedFlash();
    loud.hit(noteHue(3), 1);
    expect(loud.amount).toBeCloseTo(1, 5);
    const soft = new LedFlash();
    soft.hit(noteHue(3), 0.3);
    expect(soft.amount).toBeLessThan(0.5);
    run(loud, 0.6);
    expect(loud.amount).toBeLessThan(0.05);
  });

  it("is red for Do and violet for Ti, and soft without a colour", () => {
    const c = new LedFlash();
    c.hit(noteHue(0), 1);
    const ti = new LedFlash();
    ti.hit(noteHue(6), 1);
    const h = hueOf(c.color);
    expect(h < 0.03 || h > 0.97).toBe(true);
    expect(hueOf(ti.color)).toBeGreaterThan(0.72);
    expect(hueOf(ti.color)).toBeLessThan(0.84);
    const plain = new LedFlash();
    plain.hit(null, 1);
    expect(plain.amount).toBeLessThan(0.5);
  });

  it("never runs away when many notes come at once", () => {
    const f = new LedFlash();
    for (let i = 0; i < 20; i += 1) f.hit(noteHue(NOTE_IDS[i % 7]), 1);
    expect(Math.max(f.color.r, f.color.g, f.color.b)).toBeLessThanOrEqual(1.5);
  });
});
