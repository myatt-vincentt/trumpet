// What the trumpet, the ghost hand, the chips and keys and the page UI share.
// Per-frame values are read and written in the frame loop (never React
// state); the few the page UI shows bump a version it subscribes to.
import { useSyncExternalStore } from "react";

import { sound } from "./audio";
import { TEMPO, type PatternId } from "./beat";
import { VIEWS, type View } from "./layout";
import { noteHue, type Choice, type NoteId, type Octave } from "./notes";

export type PlaySource = "hands" | "pointer" | "keys";

/** A note as it sounds, for the valves, the bell, the rings and the lights. */
export type NoteEvent = {
  seq: number;
  note: NoteId;
  midi: number;
  /** The lights' colour (a hue, 0..1). */
  hue: number;
  /** How hard it was tongued, 0..1. */
  strength: number;
  /** How long it sounds (s). */
  length: number;
  /** The first note of a bar. */
  downbeat: boolean;
  by: PlaySource;
  /** performance.now() / 1000 */
  at: number;
};

const listeners = new Set<() => void>();
let version = 0;

export const trumpet = {
  /** Screen width ÷ height. */
  aspect: 1,
  /** The note your hand (or a chip or key) holds, or the rest. */
  choice: 0 as Choice,
  /** Low C4–B4 or High C5–B5. */
  octave: "low" as Octave,

  // The beat (the trumpet plays by itself).
  /** The beat's pattern and tempo (beats per minute). */
  pattern: "4" as PatternId,
  bpm: TEMPO.start,
  /** Play was pressed (the beat runs without a hand in view). */
  autoPlay: false,
  /** The beat is running now. */
  beating: false,
  /** performance.now() / 1000 of the last beat, and whether it began a bar. */
  beatAt: -1e9,
  beatDownbeat: false,
  /** Counts the bars' first beats (the LED cove pulses on each). */
  downbeats: 0,
  /** The beat card (pattern and tempo) is open. */
  beatCard: false,

  /** The latest notes (the valves, the bell and the lights read the ones they haven't seen). */
  events: [] as NoteEvent[],
  seq: 0,
  /** The note sounding now (its valves are down), or null; and until when (performance.now() / 1000). */
  sounding: null as NoteId | null,
  soundingUntil: -1e9,
  /** performance.now() / 1000 of the last note. */
  playedAt: -1e9,
  /** What has been played (read by the development debug object). */
  log: [] as Array<{ t: number; what: string; by: PlaySource }>,

  // What the page UI shows.
  view: "front" as View,
  night: false,
  /** The corner camera is tucked away. */
  camHidden: false,
  /** The studio, the trumpet and the hand have loaded. */
  loaded: false,
  /** Start was tapped on the home page (the camera runs). */
  started: false,
  /** The home page has gone (the trumpet is in front of you). */
  entered: false,
  /** The "how to play" steps card is open. */
  howTo: false,
  /** It opened right after Start: it closes by itself (performance.now() ms). */
  howToUntil: null as number | null,
  /** After the first card: the dock's one pulse (performance.now() ms). */
  dockPulseAt: null as number | null,
  changed() {
    version += 1;
    listeners.forEach((l) => l());
  },
};

export const nextView = () => {
  trumpet.view = VIEWS[(VIEWS.indexOf(trumpet.view) + 1) % VIEWS.length];
  trumpet.changed();
};

export const setView = (v: View) => {
  trumpet.view = v;
  trumpet.changed();
};

export const setNight = (on: boolean) => {
  trumpet.night = on;
  trumpet.changed();
};

/** Start on the home page: the sound and the camera. */
export const start = () => {
  if (trumpet.started) return;
  sound.unlock();
  trumpet.started = true;
  trumpet.changed();
};

/** The home page has faded: the steps card shows for a few seconds. */
export const INTRO_CARD_MS = 6000;
export const enter = () => {
  if (trumpet.entered) return;
  trumpet.entered = true;
  trumpet.howTo = true;
  trumpet.howToUntil = performance.now() + INTRO_CARD_MS;
  trumpet.changed();
};

/** The steps card closes. After the first one the dock pulses once. */
export const closeHowTo = () => {
  if (!trumpet.howTo) return;
  const first = trumpet.howToUntil !== null;
  trumpet.howTo = false;
  trumpet.howToUntil = null;
  if (first) trumpet.dockPulseAt = performance.now();
  trumpet.changed();
};

export const toggleCam = () => {
  trumpet.camHidden = !trumpet.camHidden;
  trumpet.changed();
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** Re-renders the caller when the page UI's state changes. */
export const useTrumpetVersion = () =>
  useSyncExternalStore(subscribe, () => version);

const record = (what: string, by: PlaySource) => {
  trumpet.log.push({ t: Math.round(performance.now()), what, by });
  if (trumpet.log.length > 60) trumpet.log.shift();
};

/** Your hand (or a chip or key) chooses a note, or the rest. */
export const choose = (c: Choice, by: PlaySource = "hands") => {
  if (trumpet.choice === c) return;
  trumpet.choice = c;
  record(`choose ${c}`, by);
  trumpet.changed();
};

/**
 * Shows a note (the valves, the bell, the rings, the lights) without playing
 * it: the beat plays its notes ahead of time and shows each when it sounds.
 */
export const show = (
  note: NoteId,
  midi: number,
  strength: number,
  length: number,
  downbeat: boolean,
  by: PlaySource,
) => {
  const now = performance.now() / 1000;
  trumpet.seq += 1;
  trumpet.events.push({
    seq: trumpet.seq,
    note,
    midi,
    hue: noteHue(note),
    strength,
    length,
    downbeat,
    by,
    at: now,
  });
  if (trumpet.events.length > 32) trumpet.events.shift();
  trumpet.sounding = note;
  trumpet.soundingUntil = now + length;
  trumpet.playedAt = now;
  record(`note ${note} ${midi}`, by);
  // The first note played by hand closes the how-to card.
  if (trumpet.howTo && by === "hands") closeHowTo();
};

/** The note stops (a rest under a held note, or the beat stopping). */
export const silence = () => {
  trumpet.soundingUntil = Math.min(
    trumpet.soundingUntil,
    performance.now() / 1000,
  );
};

/** The notes since `seq` (oldest first). */
export const notesSince = (seq: number) =>
  trumpet.events.filter((e) => e.seq > seq);

/** Play or stop the beat (the play button, the P key). */
export const toggleAutoPlay = () => {
  sound.unlock();
  trumpet.autoPlay = !trumpet.autoPlay;
  trumpet.changed();
};

export const setPattern = (p: PatternId) => {
  trumpet.pattern = p;
  trumpet.changed();
};

export const setOctave = (o: Octave) => {
  trumpet.octave = o;
  trumpet.changed();
};

/** Tempo up or down a step (within its range). */
export const nudgeTempo = (dir: 1 | -1) => {
  trumpet.bpm = Math.min(
    TEMPO.most,
    Math.max(TEMPO.least, trumpet.bpm + dir * TEMPO.step),
  );
  trumpet.changed();
};
