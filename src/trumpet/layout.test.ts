import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { frameRect, keepPoints, phoneness, PLACE, viewMargins } from "./layout";

describe("the layout", () => {
  it("reads a laptop as wide and a phone as tall", () => {
    expect(phoneness(16 / 9)).toBe(0);
    expect(phoneness(390 / 844)).toBe(1);
  });

  it("keeps the corner camera in the top-right corner", () => {
    const r = frameRect(1440, 900);
    expect(r.left + r.width).toBe(1440 - 16);
    expect(r.top).toBe(16);
  });

  it("keeps room for the dock and the sign strip below, and the corner camera above", () => {
    const m = viewMargins(390, 844);
    expect(m.bottom).toBeLessThan(0.7);
    expect(m.under).toBeLessThan(m.top);
  });

  it("keeps the trumpet at chest height in every view", () => {
    (["front", "player", "close"] as const).forEach((v) => {
      keepPoints(v).forEach((p) => {
        expect(p.y).toBeGreaterThan(1.1);
        expect(p.y).toBeLessThan(1.7);
      });
    });
  });

  it("points the bell to the right in Front and away from you in Player", () => {
    const bell = (v: "front" | "player") =>
      new Vector3(1, 0, 0).applyQuaternion(PLACE[v].quat);
    expect(bell("front").x).toBeGreaterThan(0.95);
    expect(bell("player").z).toBeLessThan(-0.9);
  });
});
