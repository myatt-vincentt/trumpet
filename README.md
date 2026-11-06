# Trumpet

A trumpet in a recording studio, played with one hand. Your hand shows a sign for the note and
the trumpet plays it on the beat by itself. A gold ghost hand presses the real valves for each
note, the bell glows and sends out gold sound rings, and the studio's LED strips pulse in the
note's colour. Your camera sits small in the top right corner.

- **Start:** the home page shows while the studio, the trumpet and the sounds load; Start turns
  the sound on and asks for the camera. Without a camera the studio opens anyway and you play
  with the sign strip, the Play button or the keyboard.
- **One hand, the sign:** your right hand, or your left when it is alone in view. Hold a sign
  for a moment: 1 finger Do, 2 Re, 3 Mi, 4 Fa, open hand Sol, rock (index and pinky) La, thumb
  and pinky out Ti, fist rest. A small tag over your camera shows the sign it reads.
- **The beat:** a hand coming into view starts the beat; change the sign to change the note on
  the next beat; take your hand away to stop. Long, 4, 8, Swing or Fanfare, at 60 to 140 beats
  a minute.
- **Octave:** Low (C4–B4) or High (C5–B5).
- **Songs:** the music-note button opens the songs (When the Saints, Ode to Joy, Twinkle
  Twinkle, Happy Birthday, Bugle Fanfare). Each sets its own octave and tempo while it runs.
  **Learn** waits for each note: its chip glows gold, the tag over your camera asks for the
  sign and the gold hand waits on its valves; hold the sign and the trumpet plays it. **Play**
  keeps time with a soft pad and bass and gives 1 to 3 stars for notes in time; **Slower**
  plays at three-quarter speed.
- **Without hands:** tap a chip in the sign strip or press 1–7 (0 rests); Play or P runs the
  beat.
- **The dock:** Songs, Play, Beat, Octave, View (Front, Player, Close), Day / Night, How to
  play.

## Files

```
src/trumpet/
  TrumpetScene.tsx   the scene, loaded after the home page shows
  Home.tsx           the home page
  Hud.tsx            the dock, the sign strip (SignStrip.tsx) and the how-to-play card
  CameraRig.tsx      the views, fitted to the screen (layout.ts)
  Studio.tsx         the room, its baked day / night light and the LEDs (led.ts)
  Trumpet.tsx        the trumpet, its valves, the bell's glow and the sound rings
  GhostHand.tsx      the gold hand on the valves (ghost.ts)
  Hands.tsx          hand tracking: the playing hand and its signs (signs.ts)
  AutoPlay.tsx       the beat (beat.ts)
  SongUI.tsx, SongPlayer.tsx, session.ts, songs.ts, backing.ts   Learn and Play
  audio.ts           the sound: recorded trumpet (sampler.ts), a voice made in code (synth.ts)
  notes.ts           the notes, their signs and their valves
  PointerInput.tsx   the keys
  CameraFrame.tsx    your camera in the corner
public/models/       the studio and its bakes, the trumpet and the gold hand
public/sounds/       the trumpet samples (trumpet.json lists them)
```

Credits are in `CREDITS.md`.
