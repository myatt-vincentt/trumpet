// Your note hand, read from the hand tracker every frame. It shows a sign;
// once the sign holds, that note is chosen (the strip lights its chip, the
// gold hand presses its valves) and the trumpet plays it on the next beat. A
// fist rests. A lost hand keeps its note; the beat stops when it has been
// gone a moment (AutoPlay.tsx). A hand coming back after that is read afresh:
// the beat starts once its sign has held, on that sign's note.
//
// One hand plays: your right hand (HAND), or your left when it is the only
// one in view. Both in view: the right plays. A hand takes over from the
// other only after a moment, so two hands crossing don't flick between them. The tracker names hands as
// they are on your body (left is your left), whichever way the camera shows
// them.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { XRModel } from "@vincentt-xr/sdk";
import {
  useXRModelNode,
  type XRModelNodeHandTracking,
} from "@vincentt-xr/sdk/low-level";

import { choiceOf, type Sign } from "./notes";
import { SignReader, type Joint } from "./signs";
import { choose, trumpet } from "./state";

export type Side = "left" | "right";
/** The hand that plays (the other plays only when it is alone in view). */
export const HAND: Side = "right";
/** A hand away longer than this (s) is read afresh when it comes back (as long as the beat waits). */
const AWAY = 0.5;
/** A hand takes over from the other after this long (s): no flicking between two hands. */
const SWITCH = 0.3;

/** What the beat, the corner camera and the development checks read about your hand. */
export const hands = {
  /** A hand is in view and playing. */
  tracked: false,
  /** …and its sign has been read (the corner camera's tag shows it). */
  reading: false,
  /** Which one (the corner camera draws it). */
  side: HAND as Side,
  /** The sign it shows right now (before the hold), and the one that counts. */
  rawSign: null as string | null,
  sign: null as Sign | null,
  /** performance.now() / 1000 when a hand with a sign was last in view (the beat runs on it). */
  seenAt: -1e9,
};

type Reading = {
  signs: SignReader;
  stamp: number;
  /** performance.now() / 1000: last seen, and seen without a break since. */
  last: number;
  since: number;
};
const reading = (): Reading => ({
  signs: new SignReader(),
  stamp: -1,
  last: -1e9,
  since: -1e9,
});

export const Hands = () => {
  const node = useXRModelNode<XRModelNodeHandTracking>(XRModel.HAND_TRACKER);
  const st = useRef({
    read: { left: reading(), right: reading() } as Record<Side, Reading>,
    side: HAND as Side,
  });

  useFrame(() => {
    const s = st.current;
    const now = performance.now() / 1000;
    const poses = trumpet.started ? node?.poses : null;

    // Each hand in view is read on its own (so a hand taking over already
    // has its sign).
    (["left", "right"] as const).forEach((side) => {
      const p = poses?.[side] ?? null;
      const r = s.read[side];
      if (!p || p.held) {
        r.signs.lost();
        return;
      }
      // Back after a while away: the sign is read afresh.
      if (now - r.last > AWAY) {
        r.signs = new SignReader();
        r.stamp = -1;
        r.since = now;
      }
      r.last = now;
      if (p.timestampMs !== r.stamp) {
        r.stamp = p.timestampMs;
        r.signs.push(p.timestampMs / 1000, p.world as Joint[]);
      }
    });

    // Which hand plays: the one playing keeps playing through a short gap;
    // the other takes over once it has been away a moment; the right hand
    // takes back over once it has stayed in view a moment.
    const visible = (side: Side) => s.read[side].last === now;
    const away = (side: Side) => now - s.read[side].last;
    const cur = s.side;
    const alt: Side = cur === "right" ? "left" : "right";
    if (
      (!visible(cur) && away(cur) > SWITCH && visible(alt)) ||
      (alt === HAND && visible(alt) && now - s.read[alt].since > SWITCH)
    )
      s.side = alt;

    const r = s.read[s.side];
    const was = hands.reading;
    hands.side = s.side;
    hands.tracked = visible(s.side);
    hands.rawSign = hands.tracked ? r.signs.raw : null;
    hands.sign = r.signs.sign;
    if (hands.tracked && hands.sign) {
      choose(choiceOf(hands.sign), "hands");
      hands.seenAt = now;
    }
    hands.reading = hands.tracked && !!hands.sign;
    if (was !== hands.reading) trumpet.changed();
  });

  return null;
};
