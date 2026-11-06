import { describe, expect, it } from "vitest";

import { BeatScheduler, PATTERN, PATTERNS, START_DELAY, TEMPO } from "./beat";

/** Runs the scheduler like the frame loop: every 1/60 s, 0.1 s ahead. */
const run = <T>(
  s: BeatScheduler<T>,
  from: number,
  to: number,
  value: (t: number) => T,
  each?: (t: number) => void,
) => {
  const hits: Array<{ time: number; length: number; value: T }> = [];
  const beats: Array<{ time: number; value: T }> = [];
  for (let t = from; t < to; t += 1 / 60) {
    each?.(t);
    const n = s.next(t, 0.1, value(t));
    n.hits.forEach((h) =>
      hits.push({ time: h.time, length: h.hit.length, value: h.value }),
    );
    n.beats.forEach((b) => beats.push({ time: b.time, value: b.value }));
  }
  return { hits, beats };
};

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const len = 60 / TEMPO.start;

describe("the beat", () => {
  it("plays each pattern's notes at their times, every one inside its bar", () => {
    PATTERNS.forEach((id) => {
      const s = new BeatScheduler<number>();
      s.pattern = id;
      s.start(0);
      const p = PATTERN[id];
      const barLen = p.beats * len;
      const { hits } = run(s, 0, START_DELAY + barLen * 2 - 0.11, () => 0);
      expect(hits.length).toBe(p.hits.length * 2);
      hits.slice(0, p.hits.length).forEach((h, i) => {
        expect(near(h.time, START_DELAY + p.hits[i].at * len)).toBe(true);
      });
      p.hits.forEach((h) => expect(h.at + h.length).toBeLessThanOrEqual(4));
    });
  });

  it("starts on 4 at 90 BPM by default, and Long holds one note a bar", () => {
    const s = new BeatScheduler<number>();
    expect(s.pattern).toBe("4");
    expect(s.bpm).toBe(90);
    expect(PATTERN.long.hits).toHaveLength(1);
    expect(PATTERN.long.hits[0].length).toBeGreaterThan(3.5);
  });

  it("swing is long-short: the off-beat two thirds into the beat", () => {
    const offs = PATTERN.swing.hits.filter((h) => h.at % 1 !== 0);
    offs.forEach((h) => expect(h.at % 1).toBeCloseTo(2 / 3, 5));
  });

  it("changes the note on the next beat, never mid-beat", () => {
    const s = new BeatScheduler<number>();
    s.pattern = "8";
    s.start(0);
    const change = START_DELAY + 1.2 * len;
    const { hits } = run(s, 0, START_DELAY + 4 * len - 0.11, (t) =>
      t < change ? 0 : 4,
    );
    hits.forEach((h) => {
      const beat = Math.floor((h.time - START_DELAY + 1e-6) / len);
      expect(h.value).toBe(beat < 2 ? 0 : 4);
    });
  });

  it("tells each beat's note, so a held note can change under it", () => {
    const s = new BeatScheduler<number | "rest">();
    s.pattern = "long";
    s.start(0);
    const change = START_DELAY + 1.5 * len;
    const { hits, beats } = run(s, 0, START_DELAY + 4 * len - 0.11, (t) =>
      t < change ? 2 : "rest",
    );
    expect(hits).toHaveLength(1);
    expect(beats.map((b) => b.value)).toEqual([2, 2, "rest", "rest"]);
  });

  it("stops after the current beat", () => {
    const s = new BeatScheduler<number>();
    s.start(0);
    const stopAt = START_DELAY + 1.3 * len;
    const { hits } = run(
      s,
      0,
      START_DELAY + 4 * len,
      () => 0,
      (t) => {
        if (t >= stopAt) s.stop(t);
      },
    );
    expect(hits).toHaveLength(2);
    expect(s.running).toBe(false);
  });
});
