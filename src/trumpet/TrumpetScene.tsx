// Trumpet: a trumpet in a recording studio, played with one hand. Your right
// hand (or your left, alone) shows a sign for the note (one to four fingers, an open hand, the
// rock sign, thumb and pinky: Do … Ti; a fist rests) and the trumpet plays it
// on the beat by itself, in the pattern and tempo you choose. A gold ghost
// hand presses the real valves for each note, the bell glows and sends out
// gold sound rings, and the studio's LEDs pulse in the note's colour. The
// sign chips and the keys play too. Your camera sits small in the corner.
//
//   CameraRig.tsx     the views (front, player, close), fitted to the screen (layout.ts)
//   Studio.tsx        the room and its light, day and night; the LEDs (led.ts)
//   Trumpet.tsx       the trumpet, its valves, the bell's glow and the sound rings
//   GhostHand.tsx     the gold hand on the valves (ghost.ts)
//   Hands.tsx         your hand and its signs (signs.ts)
//   AutoPlay.tsx      the trumpet plays the beat by itself (beat.ts) while
//                     your hand is in view
//   PointerInput.tsx  the keys
//   CameraFrame.tsx   your camera in the corner
//   Hud.tsx           the bottom dock, the sign strip (SignStrip.tsx), how to play
//   audio.ts          the sound engine: recordings (sampler.ts) or the voice
//                     made in code (synth.ts)
//   notes.ts          the notes, their signs and their valves
//   Home.tsx          the home page (Start), shown over the scene while it loads
import { Suspense, useEffect } from "react";
import { HandTracker } from "@vincentt-xr/sdk/tracking";

import { AutoPlay } from "./AutoPlay";
import { CameraFrame } from "./CameraFrame";
import { CameraRig } from "./CameraRig";
import { GhostHand } from "./GhostHand";
import { Hands } from "./Hands";
import { Hud } from "./Hud";
import { PointerInput } from "./PointerInput";
import { trumpet, useTrumpetVersion } from "./state";
import { Studio } from "./Studio";
import { Trumpet } from "./Trumpet";

/** Hand readings per second. */
const HAND_FPS = 30;

/** Mounts once everything above it has loaded (the home page waits for it). */
const Loaded = () => {
  useEffect(() => {
    trumpet.loaded = true;
    trumpet.changed();
  }, []);
  return null;
};

export const TrumpetScene = () => {
  useTrumpetVersion();
  return (
    <>
      <CameraRig />
      <Suspense fallback={null}>
        <Studio />
        <Trumpet />
        <GhostHand />
        <Loaded />
      </Suspense>
      {trumpet.started ? <HandTracker targetFps={HAND_FPS} /> : null}
      <Hands />
      <AutoPlay />
      <CameraFrame />
      <PointerInput />
      <Hud />
    </>
  );
};
