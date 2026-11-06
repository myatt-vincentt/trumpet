// The auto-play beat: the patterns, and a scheduler that works out when each
// note sounds. Plain code (no scene, no sound).
//
// Times are the audio clock's (seconds). The scheduler is asked, a little
// ahead of time, for the notes due soon, and each one is played at its exact
// time, so the beat stays steady whatever the frame rate.
//
//   - Starting begins a new bar a moment later.
//   - The note is read once per beat, when that beat is first scheduled: a
//     change of sign lands on the next beat, never mid-beat.
//   - Stopping lets the current beat finish; nothing after it plays.

/** A tongued note in a pattern: when (beats from the bar's start), how long (beats), how hard (0..1). */
export type PatternHit = { at: number; length: number; strength: number };

export type PatternId = "long" | "4" | "8" | "swing" | "fanfare";
export const PATTERNS: PatternId[] = ["long", "4", "8", "swing", "fanfare"];

export type Pattern = {
  label: string;
  /** Beats in a bar. */
  beats: number;
  hits: PatternHit[];
};

const H = (at: number, length: number, strength = 0.7): PatternHit => ({
  at,
  length,
  strength,
});

/**
 *   long     one held note a bar, tongued again at each bar
 *   4        four tongued notes a bar, the first a little harder (the default)
 *   8        eighths, short and bright
 *   swing    long-short eighths (two thirds and one third of a beat), the
 *            off-beats leaned on
 *   fanfare  ta-ta-ta TAA, ta-ta TAA: a triplet, a long note, two short
 */
export const PATTERN: Record<PatternId, Pattern> = {
  long: { label: "Long", beats: 4, hits: [H(0, 3.85, 0.8)] },
  "4": {
    label: "4",
    beats: 4,
    hits: [H(0, 0.8, 0.85), H(1, 0.8), H(2, 0.8, 0.75), H(3, 0.8)],
  },
  "8": {
    label: "8",
    beats: 4,
    hits: [0, 1, 2, 3].flatMap((b) => [
      H(b, 0.36, b === 0 ? 0.8 : 0.65),
      H(b + 0.5, 0.36, 0.5),
    ]),
  },
  swing: {
    label: "Swing",
    beats: 4,
    hits: [0, 1, 2, 3].flatMap((b) => [
      H(b, 0.55, b === 0 ? 0.65 : 0.5),
      H(b + 2 / 3, 0.28, 0.75),
    ]),
  },
  fanfare: {
    label: "Fanfare",
    beats: 4,
    hits: [
      H(0, 0.24, 0.75),
      H(1 / 3, 0.24, 0.7),
      H(2 / 3, 0.24, 0.75),
      H(1, 1.85, 0.95),
      H(3, 0.4, 0.7),
      H(3.5, 0.4, 0.8),
    ],
  },
};

/** Tempo (beats per minute): the default and the range. */
export const TEMPO = { start: 90, least: 60, most: 140, step: 5 };
/** Starting waits this long (s) before the first bar. */
export const START_DELAY = 0.08;

/** A note due to sound: its time, the pattern hit, the beat it belongs to, and that beat's value. */
export type DueHit<T> = {
  time: number;
  hit: PatternHit;
  /** Beats since the start (0 = the first bar's first beat). */
  beat: number;
  /** The first note of a bar. */
  downbeat: boolean;
  value: T;
};

/** A beat starting (for the beat light and a change under a held note), and its value. */
export type DueBeat<T> = {
  time: number;
  beat: number;
  downbeat: boolean;
  value: T;
};

export class BeatScheduler<T> {
  bpm = TEMPO.start;

  pattern: PatternId = "4";

  /** When the current run started (its first downbeat), or null when stopped. */
  private origin: number | null = null;

  /** Nothing at or after this time sounds (null: no stop pending). */
  private stopAt: number | null = null;

  /** Scheduled up to (but not including) this time. */
  private until = 0;

  /** Each beat's value, read when the beat was first scheduled. */
  private latched = new Map<number, T>();

  /** The beats already announced. */
  private lastBeat = -1;

  get running() {
    return this.origin !== null;
  }

  /** Seconds per beat. */
  get beatLength() {
    return 60 / this.bpm;
  }

  /** When the pending stop lands (audio time), or null. */
  get stopping() {
    return this.stopAt;
  }

  /** Starts a new bar shortly after `now` (does nothing if already running). */
  start(now: number) {
    if (this.origin !== null && this.stopAt === null) return;
    // Stopping but not yet stopped: carry on as if never asked to stop.
    if (this.origin !== null && this.stopAt !== null && now < this.stopAt) {
      this.stopAt = null;
      return;
    }
    this.origin = now + START_DELAY;
    this.stopAt = null;
    this.until = this.origin;
    this.latched.clear();
    this.lastBeat = -1;
  }

  /** Stops at once (nothing more is given). */
  reset() {
    this.origin = null;
    this.stopAt = null;
    this.latched.clear();
  }

  /** Stops after the beat that is playing at `now` (or at once if none has begun). */
  stop(now: number) {
    if (this.origin === null || this.stopAt !== null) return;
    const len = this.beatLength;
    const b = (now - this.origin) / len;
    this.stopAt = b < 0 ? this.origin : this.origin + Math.ceil(b) * len;
    if (this.stopAt <= now) this.stopAt = now;
  }

  /** The beat (0-based, since the start) at time `t`, or -1 before the start. */
  beatAt(t: number) {
    if (this.origin === null || t < this.origin) return -1;
    return Math.floor((t - this.origin) / this.beatLength);
  }

  /**
   * The notes (and beats) due from now until `now + ahead`, not yet given.
   * `value` is what a new beat plays (the current note, or the rest).
   */
  next(now: number, ahead: number, value: T) {
    const hits: DueHit<T>[] = [];
    const beats: DueBeat<T>[] = [];
    if (this.origin === null) return { hits, beats };
    const from = Math.max(this.until, now);
    let to = now + ahead;
    if (this.stopAt !== null) to = Math.min(to, this.stopAt);
    if (to > from) {
      const len = this.beatLength;
      const p = PATTERN[this.pattern];
      const barLen = p.beats * len;
      const firstBar = Math.floor((from - this.origin) / barLen);
      const lastBar = Math.floor((to - this.origin) / barLen);
      for (let bar = Math.max(0, firstBar); bar <= lastBar; bar += 1) {
        const barStart = this.origin + bar * barLen;
        for (let i = 0; i < p.beats; i += 1) {
          const time = barStart + i * len;
          const beat = bar * p.beats + i;
          if (time >= from && time < to && beat > this.lastBeat) {
            this.lastBeat = beat;
            // The beat's note is read as the beat comes up.
            this.latched.set(beat, value);
            beats.push({ time, beat, downbeat: i === 0, value });
          }
        }
        p.hits.forEach((hit) => {
          const time = barStart + hit.at * len;
          if (time < from || time >= to) return;
          const beat = bar * p.beats + Math.floor(hit.at);
          if (!this.latched.has(beat)) this.latched.set(beat, value);
          hits.push({
            time,
            hit,
            beat,
            downbeat: hit.at === 0,
            value: this.latched.get(beat) as T,
          });
        });
      }
      // Forget old beats' values.
      this.latched.forEach((_, b) => {
        if (b < this.beatAt(from) - 1) this.latched.delete(b);
      });
      this.until = to;
    }
    if (this.stopAt !== null && now >= this.stopAt) {
      this.origin = null;
      this.stopAt = null;
      this.latched.clear();
    }
    hits.sort((a, b) => a.time - b.time);
    return { hits, beats };
  }

  /** Changing the tempo or pattern restarts the grid from the next beat. */
  retime(now: number) {
    if (this.origin === null) return;
    const stopping = this.stopAt !== null;
    this.origin = null;
    this.start(now);
    if (stopping) this.stop(now);
  }
}
