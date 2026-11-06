// The seven notes (Do … Ti in C major), the rest, the signs your right hand
// shows for them, and the valves each note presses. Plain code (no scene).
//
//   one finger Do · two Re · three Mi · four Fa · open hand Sol · rock (index
//   and pinky) La · thumb and pinky out Ti · fist: rest (the beat goes on,
//   silent)
//
// The fingering is the trumpet's own (valve 1 nearest the mouthpiece):
//   C open · D 1+3 · E 1+2 · F 1 · G open · A 1+2 · B 2
// The same in both octaves.

export type NoteId = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const NOTE_IDS: NoteId[] = [0, 1, 2, 3, 4, 5, 6];
/** A note, or the rest. */
export type Choice = NoteId | "rest";
/** The chips, in order: the seven notes, then the rest. */
export const CHOICES: Choice[] = [...NOTE_IDS, "rest"];

/** Each note's sol-fa name and letter. */
export const SOLFA = ["Do", "Re", "Mi", "Fa", "Sol", "La", "Ti"] as const;
export const LETTER = ["C", "D", "E", "F", "G", "A", "B"] as const;

/** Semitones above C. */
const STEP = [0, 2, 4, 5, 7, 9, 11];

/** The octave: Low C4–B4 (the default) or High C5–B5. */
export type Octave = "low" | "high";
export const OCTAVE_C: Record<Octave, number> = { low: 60, high: 72 };

/** A note's pitch (MIDI) in an octave. */
export const noteMidi = (n: NoteId, octave: Octave = "low") =>
  OCTAVE_C[octave] + STEP[n];

/** The valves a note presses (1, 2, 3). */
export const FINGERING: Record<NoteId, readonly (1 | 2 | 3)[]> = {
  0: [],
  1: [1, 3],
  2: [1, 2],
  3: [1],
  4: [],
  5: [1, 2],
  6: [2],
};

/** Is each valve down for this note (or the rest: all up)? */
export const valvesDown = (c: Choice): [boolean, boolean, boolean] => {
  if (c === "rest") return [false, false, false];
  const f = FINGERING[c];
  return [f.includes(1), f.includes(2), f.includes(3)];
};

/** Low = red … high = violet: a note's colour as a hue (0..1). */
export const noteHue = (n: NoteId) => (0.78 * n) / 6;

/** Your right hand's signs, in chip order. */
export type Sign =
  | "one"
  | "two"
  | "three"
  | "four"
  | "open"
  | "rock"
  | "call"
  | "fist";
export const SIGNS: Sign[] = [
  "one",
  "two",
  "three",
  "four",
  "open",
  "rock",
  "call",
  "fist",
];
export const signOf = (c: Choice): Sign => SIGNS[CHOICES.indexOf(c)];
export const choiceOf = (s: Sign): Choice => CHOICES[SIGNS.indexOf(s)];

/** A chip's name. */
export const label = (c: Choice) => (c === "rest" ? "Rest" : SOLFA[c]);

/** The choice a computer key makes: 1–7 the notes, 0 the rest. */
export const keyChoice = (code: string): Choice | null => {
  const m = /^(?:Digit|Numpad)([0-7])$/.exec(code);
  if (!m) return null;
  const d = Number(m[1]);
  return d === 0 ? "rest" : ((d - 1) as NoteId);
};
