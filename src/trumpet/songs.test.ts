import { describe, expect, it } from "vitest";

import { NOTE_IDS } from "./notes";
import { Session, starsFor, COUNT_IN_BARS, LEARN_HOLD } from "./session";
import { songBeats, SONGS, stepStarts } from "./songs";

describe("the songs", () => {
  it("start with When the Saints, and are five", () => {
    expect(SONGS[0].id).toBe("saints");
    expect(SONGS.map((s) => s.id)).toEqual([
      "saints",
      "ode",
      "twinkle",
      "birthday",
      "fanfare",
    ]);
  });

  it("keep to Do … Ti, and their backing lasts exactly as long as the tune", () => {
    SONGS.forEach((s) => {
      s.steps.forEach((x) => expect(NOTE_IDS).toContain(x.note));
      const chordBeats = s.chords.reduce((sum, [, b]) => sum + b, 0);
      expect(chordBeats).toBe(songBeats(s));
    });
  });

  it("end on a whole bar", () => {
    SONGS.forEach((s) => {
      const pickup = s.chords[0][0] === null ? s.chords[0][1] : 0;
      expect((songBeats(s) - pickup) % s.beatsPerBar).toBe(0);
    });
  });
});

describe("a session", () => {
  const song = SONGS[1];

  it("Learn waits for each sign, held a moment", () => {
    const s = new Session(song, "learn", 1, 0);
    let t = 0;
    s.update(t, "rest");
    // A wrong sign never moves on.
    for (; t < 3; t += 1 / 30) s.update(t, 4);
    expect(s.next).toBe(0);
    song.steps.forEach((step) => {
      const from = t;
      while (t - from < LEARN_HOLD + 0.05) {
        t += 1 / 30;
        s.update(t, step.note);
      }
    });
    expect(s.done).toBe(true);
  });

  it("Play gives 3 stars in time, 1 for nothing", () => {
    const run = (right: boolean) => {
      const s = new Session(song, "play", 1, 0);
      const starts = stepStarts(song);
      for (let t = 0; !s.done && t < 60; t += 1 / 60) {
        const b = s.beatAt(t);
        let i = starts.findIndex((st, k) => b < st + song.steps[k].beats);
        if (i < 0) i = starts.length - 1;
        // Show the note a little before it is due.
        const ahead = starts.findIndex((st) => st > b + 0.2) - 1;
        const k = ahead >= 0 ? ahead : i;
        s.update(t, right ? song.steps[Math.max(0, k)].note : "rest");
      }
      return s;
    };
    const good = run(true);
    expect(good.done).toBe(true);
    expect(good.stars).toBe(3);
    expect(run(false).stars).toBe(1);
    expect(COUNT_IN_BARS).toBe(1);
  });

  it("stars: 3 for most right, 2 for half, 1 below", () => {
    expect(starsFor(["perfect", "perfect", "good", "perfect"])).toBe(3);
    expect(starsFor(["perfect", "miss", "perfect", "good"])).toBe(2);
    expect(starsFor(["miss", "miss", "good", "miss"])).toBe(1);
  });
});
