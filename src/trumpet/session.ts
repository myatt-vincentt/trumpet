// A song being learnt or played (pure: times in seconds on the audio clock).
//
// Each moment the caller says which note your hand (or a chip, or a key)
// shows, or the rest.
//
// Learn waits for you: the next note counts once your sign has shown it for
// a moment (a repeated note: keep it, it counts again); the trumpet plays it
// then. A wrong sign held a while brings a gentle hint; nothing can be failed.
//
// Play keeps time after a one-bar count-in, the trumpet playing each note on
// its time with the note your sign shows. Each note is judged by when your
// sign showed it: right by its start is perfect, a little late is good, later
// is missed. One to three stars at the end.
import type { Choice } from "./notes";
import { secondsPerBeat, songBeats, stepStarts, type Song } from "./songs";

export type Mode = "learn" | "play";
export type Judgement = "perfect" | "good" | "miss";

export type SessionEvent = {
  kind: Judgement | "hint";
  index: number;
  at: number;
};

/** Learn: a note counts once shown this long (s). */
export const LEARN_HOLD = 0.3;
/** Learn: a wrong sign held this long (s) brings a hint, at most this often (s). */
export const HINT = { after: 0.6, every: 1.6 };
/**
 * Play: a note's window opens this early (s) before it is due; right by
 * `perfect` after it is perfect, by `late` good.
 */
export const WINDOW = { early: 0.3, perfect: 0.1, late: 0.3 };
/** The count-in before the first note (bars). */
export const COUNT_IN_BARS = 1;

const POINTS: Record<Judgement, number> = { perfect: 1, good: 0.6, miss: 0 };

/** Stars for a finished song (1–3), from how well its notes were played. */
export const starsFor = (results: readonly (Judgement | null)[]) => {
  const total = results.length || 1;
  const score =
    results.reduce((sum, r) => sum + (r ? POINTS[r] : 0), 0) / total;
  if (score >= 0.8) return 3;
  if (score >= 0.5) return 2;
  return 1;
};

export class Session {
  readonly song: Song;

  readonly mode: Mode;

  readonly speed: number;

  /** Each note's result (Learn: "good" once done). */
  readonly results: (Judgement | null)[];

  /** Learn: the next note to do. Play: the earliest note not yet judged. */
  next = 0;

  done = false;

  /** Events not yet shown (the caller drains them). */
  events: SessionEvent[] = [];

  /** Each note's start (beats). */
  readonly starts: number[];

  /** The audio time of the song's first note (Play; Learn: when started). */
  readonly t0: number;

  /** Play: when each note first became right (audio time), or null. */
  private readonly rightAt: (number | null)[];

  private readonly spb: number;

  private last: number;

  private held = 0;

  private wrong = 0;

  private hintAt = -Infinity;

  constructor(song: Song, mode: Mode, speed: number, now: number) {
    this.song = song;
    this.mode = mode;
    this.speed = mode === "learn" ? 1 : speed;
    this.spb = secondsPerBeat(song, this.speed);
    this.results = song.steps.map(() => null);
    this.rightAt = song.steps.map(() => null);
    this.starts = stepStarts(song);
    this.t0 =
      mode === "play" ? now + COUNT_IN_BARS * song.beatsPerBar * this.spb : now;
    this.last = now;
  }

  /** Seconds per beat. */
  get secondsPerBeat() {
    return this.spb;
  }

  /** The audio time of a beat (Play). */
  timeOf(beat: number) {
    return this.t0 + beat * this.spb;
  }

  /** Play: the song's position (beats from the first note; < 0 in the count-in). */
  beatAt(now: number) {
    return (now - this.t0) / this.spb;
  }

  /** The note to do now (Learn: the next; Play: the one under the beat). */
  current(now: number): number {
    if (this.mode === "learn") return this.next;
    const b = this.beatAt(now);
    for (let i = 0; i < this.starts.length; i += 1)
      if (b < this.starts[i] + this.song.steps[i].beats) return i;
    return this.starts.length;
  }

  /** How far through the song (0..1). */
  progress(now: number) {
    if (this.mode === "learn") return this.next / this.song.steps.length;
    return Math.min(1, Math.max(0, this.beatAt(now) / songBeats(this.song)));
  }

  get stars() {
    return starsFor(this.results);
  }

  /** Moves on to `now`, your sign showing `choice`. */
  update(now: number, choice: Choice) {
    const dt = Math.max(0, Math.min(0.5, now - this.last));
    this.last = now;
    if (this.done) return;
    if (this.mode === "play") this.play(now, choice);
    else this.learn(now, dt, choice);
  }

  private learn(now: number, dt: number, choice: Choice) {
    const { steps } = this.song;
    const step = steps[this.next];
    if (!step) {
      this.done = true;
      return;
    }
    const right = choice === step.note;
    if (right) this.held += dt;
    else this.held = 0;
    if (!right) {
      this.wrong += dt;
      if (this.wrong >= HINT.after && now - this.hintAt >= HINT.every) {
        this.hintAt = now;
        this.events.push({ kind: "hint", index: this.next, at: now });
      }
      return;
    }
    this.wrong = 0;
    if (this.held < LEARN_HOLD) return;
    this.results[this.next] = "good";
    this.events.push({ kind: "good", index: this.next, at: now });
    this.next += 1;
    this.held = 0;
    if (this.next >= steps.length) this.done = true;
  }

  /** A note's window (audio times): opens, due, perfect by, good by. */
  private window(i: number) {
    const due = this.timeOf(this.starts[i]);
    return {
      open: due - WINDOW.early,
      due,
      perfect: due + WINDOW.perfect,
      late: due + WINDOW.late,
    };
  }

  private play(now: number, choice: Choice) {
    const { steps } = this.song;
    // Each open window notes when it first became right.
    for (let i = this.next; i < steps.length; i += 1) {
      const w = this.window(i);
      if (w.open > now) break;
      if (this.rightAt[i] === null && choice === steps[i].note && now <= w.late)
        this.rightAt[i] = Math.max(now, w.open);
    }
    // Notes whose window has closed (or that are right and due) are judged.
    while (this.next < steps.length) {
      const i = this.next;
      const w = this.window(i);
      const at = this.rightAt[i];
      if (at === null && now <= w.late) break;
      if (at !== null && now < w.due) break;
      let result: Judgement = "miss";
      if (at !== null) result = at <= w.perfect ? "perfect" : "good";
      this.results[i] = result;
      this.events.push({ kind: result, index: i, at: now });
      this.next += 1;
    }
    // The song ends with its last note.
    if (this.next >= steps.length && now >= this.timeOf(songBeats(this.song)))
      this.done = true;
  }
}
