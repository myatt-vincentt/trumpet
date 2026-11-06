// The songs to learn and play: public-domain tunes and one fanfare made for
// this app, each kept to the seven notes Do … Ti of one octave (the song sets
// the octave, the tempo and the beat while it runs). Each song is a list of
// notes, and the chords a soft backing plays under it. Plain code (no scene).
import type { PatternId } from "./beat";
import type { NoteId, Octave } from "./notes";

export type Step = {
  /** The note. */
  note: NoteId;
  /** How long it lasts (beats). */
  beats: number;
};

/** The backing's chords (in C). */
export type Chord = "C" | "Dm" | "Em" | "F" | "G" | "Am";
export const CHORD_MIDI: Record<Chord, number[]> = {
  C: [48, 55, 60, 64],
  Dm: [50, 57, 62, 65],
  Em: [52, 59, 64, 67],
  F: [53, 57, 60, 65],
  G: [43, 55, 59, 62],
  Am: [45, 57, 60, 64],
};

export type Song = {
  id: string;
  title: string;
  bpm: number;
  beatsPerBar: number;
  octave: Octave;
  /** The beat card shows this while the song runs (the song plays its own rhythm). */
  pattern: PatternId;
  steps: Step[];
  /** The backing: [chord, beats] from the first note (null: nothing, a pickup). */
  chords: Array<[Chord | null, number]>;
};

const DO = 0;
const RE = 1;
const MI = 2;
const FA = 3;
const SOL = 4;
const LA = 5;

/** Notes written as [note, beats] pairs. */
const n = (...pairs: Array<[NoteId, number]>): Step[] =>
  pairs.map(([note, beats]) => ({ note, beats }));
/** Whole bars of chords. */
const bars = (beats: number, ...chords: Chord[]): Array<[Chord, number]> =>
  chords.map((c) => [c, beats]);

const twinkleA = n(
  [DO, 1],
  [DO, 1],
  [SOL, 1],
  [SOL, 1],
  [LA, 1],
  [LA, 1],
  [SOL, 2],
  [FA, 1],
  [FA, 1],
  [MI, 1],
  [MI, 1],
  [RE, 1],
  [RE, 1],
  [DO, 2],
);
const twinkleAChords: Array<[Chord, number]> = [
  ["C", 4],
  ["F", 2],
  ["C", 2],
  ["F", 2],
  ["C", 2],
  ["G", 2],
  ["C", 2],
];
const twinkleB = n(
  [SOL, 1],
  [SOL, 1],
  [FA, 1],
  [FA, 1],
  [MI, 1],
  [MI, 1],
  [RE, 2],
);
const twinkleBChords: Array<[Chord, number]> = [
  ["C", 2],
  ["F", 2],
  ["C", 2],
  ["G", 2],
];

const odeLine = (end: Array<[NoteId, number]>) =>
  n(
    [MI, 1],
    [MI, 1],
    [FA, 1],
    [SOL, 1],
    [SOL, 1],
    [FA, 1],
    [MI, 1],
    [RE, 1],
    [DO, 1],
    [DO, 1],
    [RE, 1],
    [MI, 1],
    ...end,
  );

export const SONGS: Song[] = [
  {
    // In C, from its three-note pickup ("Oh when the …"); a rest is part of
    // the note before it.
    id: "saints",
    title: "When the Saints",
    bpm: 112,
    beatsPerBar: 4,
    octave: "low",
    pattern: "4",
    steps: n(
      [DO, 1],
      [MI, 1],
      [FA, 1],
      [SOL, 5],
      [DO, 1],
      [MI, 1],
      [FA, 1],
      [SOL, 5],
      [DO, 1],
      [MI, 1],
      [FA, 1],
      [SOL, 2],
      [MI, 2],
      [DO, 2],
      [MI, 2],
      [RE, 5],
      [MI, 1],
      [MI, 1],
      [RE, 1],
      [DO, 3],
      [DO, 1],
      [MI, 2],
      [SOL, 2],
      [SOL, 2],
      [FA, 3],
      [MI, 1],
      [FA, 1],
      [SOL, 1],
      [MI, 2],
      [DO, 2],
      [RE, 4],
      [DO, 4],
    ),
    chords: [
      [null, 3],
      ...bars(4, "C", "C", "C", "C", "C", "C", "G", "G"),
      ...bars(4, "C", "C", "F", "C", "C", "G", "C"),
    ],
  },
  {
    id: "ode",
    title: "Ode to Joy",
    bpm: 100,
    beatsPerBar: 4,
    octave: "low",
    pattern: "4",
    steps: [
      ...odeLine([
        [MI, 1.5],
        [RE, 0.5],
        [RE, 2],
      ]),
      ...odeLine([
        [RE, 1.5],
        [DO, 0.5],
        [DO, 2],
      ]),
    ],
    chords: [
      ...bars(4, "C", "G", "C", "G"),
      ...bars(4, "C", "G", "C"),
      ["G", 2],
      ["C", 2],
    ],
  },
  {
    id: "twinkle",
    title: "Twinkle Twinkle",
    bpm: 96,
    beatsPerBar: 4,
    octave: "low",
    pattern: "4",
    steps: [...twinkleA, ...twinkleB, ...twinkleB, ...twinkleA],
    chords: [
      ...twinkleAChords,
      ...twinkleBChords,
      ...twinkleBChords,
      ...twinkleAChords,
    ],
  },
  {
    // Simplified to fit one octave: the high note of the third line comes
    // down to La, and the last line stays on the notes Do … Ti.
    id: "birthday",
    title: "Happy Birthday",
    bpm: 96,
    beatsPerBar: 3,
    octave: "low",
    pattern: "4",
    steps: n(
      [DO, 1],
      [DO, 1],
      [RE, 1],
      [DO, 1],
      [FA, 1],
      [MI, 1],
      [DO, 1],
      [DO, 1],
      [RE, 1],
      [DO, 1],
      [SOL, 1],
      [FA, 1],
      [DO, 1],
      [DO, 1],
      [LA, 1],
      [FA, 1],
      [MI, 1],
      [RE, 1],
      [LA, 1],
      [LA, 1],
      [FA, 1],
      [SOL, 1],
      [FA, 2],
    ),
    chords: bars(3, "C", "G", "G", "C", "C", "F", "G", "C"),
  },
  {
    // Made for this app: a bugle call on Do, Mi and Sol, up high.
    id: "fanfare",
    title: "Bugle Fanfare",
    bpm: 108,
    beatsPerBar: 4,
    octave: "high",
    pattern: "fanfare",
    steps: n(
      [SOL, 0.5],
      [SOL, 0.5],
      [DO, 1],
      [MI, 1],
      [SOL, 1],
      [MI, 0.5],
      [SOL, 0.5],
      [MI, 1],
      [DO, 2],
      [SOL, 0.5],
      [SOL, 0.5],
      [DO, 1],
      [MI, 1],
      [SOL, 1],
      [SOL, 1],
      [MI, 1],
      [DO, 2],
    ),
    chords: bars(4, "C", "C", "C", "C"),
  },
];

export const songById = (id: string) => SONGS.find((s) => s.id === id) ?? null;

/** The song after this one (round to the first). */
export const nextSongId = (id: string) =>
  SONGS[(SONGS.findIndex((s) => s.id === id) + 1) % SONGS.length].id;

/** Seconds per beat at `speed` (1 = the song's tempo). */
export const secondsPerBeat = (song: Song, speed = 1) =>
  60 / (song.bpm * speed);

/** Each step's start (beats from the first note). */
export const stepStarts = (song: Song) => {
  let at = 0;
  return song.steps.map((x) => {
    const s = at;
    at += x.beats;
    return s;
  });
};

/** The song's length (beats). */
export const songBeats = (song: Song) =>
  song.steps.reduce((sum, x) => sum + x.beats, 0);
