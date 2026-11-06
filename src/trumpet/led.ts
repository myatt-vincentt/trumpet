// The studio's LED strips flash in colour when you play: the colour is the
// note's (Do red … Ti violet). A note lights it at once (as hard as it was
// tongued) and it eases away over about half a second. Notes close together
// mix their colours, and while you keep playing the colours slowly sway a
// little either side so it never sits still. Plain code (no scene).
import { Color } from "three";

/** A flash fades with this time constant (s): about 5% is left after 0.5 s. */
export const LED_DECAY = 0.17;
/** While you play the colours sway this far either side (hue turns)… */
export const LED_SWAY = 0.06;
/** …once every this long (s of playing). */
export const LED_SWAY_PERIOD = 40;
/** A colourless flash (no hue) is this much as bright. */
const MUTE_SHARE = 0.35;
/** No channel holds more than this (many hits at once stay a colour). */
const CAP = 1.5;

export class LedFlash {
  /** The flash's light (linear RGB; 0 when dark). */
  readonly color = new Color(0, 0, 0);

  /** How lit the strips are by the flash, 0..1. */
  amount = 0;

  /** The colours' sway now (hue turns, ± LED_SWAY). */
  drift = 0;

  private phase = 0;

  private readonly c = new Color();

  /** Played in this colour (a hue, 0..1; null: a soft warm white), `velocity` 0..1. */
  hit(hue: number | null, velocity: number) {
    let v = Math.min(1, Math.max(0.15, velocity)) ** 0.8;
    if (hue === null) {
      v *= MUTE_SHARE;
      this.c.setHSL(0.1, 0.35, 0.6);
    } else this.c.setHSL((hue + this.drift + 1) % 1, 1, 0.5);
    this.color.r = Math.min(CAP, this.color.r + this.c.r * v);
    this.color.g = Math.min(CAP, this.color.g + this.c.g * v);
    this.color.b = Math.min(CAP, this.color.b + this.c.b * v);
    this.amount = Math.min(
      1,
      Math.max(this.color.r, this.color.g, this.color.b),
    );
  }

  /** Moves the flash on by `dt` (s). */
  update(dt: number) {
    this.color.multiplyScalar(Math.exp(-dt / LED_DECAY));
    if (Math.max(this.color.r, this.color.g, this.color.b) > 0.05) {
      this.phase += (dt * 2 * Math.PI) / LED_SWAY_PERIOD;
      this.drift = LED_SWAY * Math.sin(this.phase);
    }
    this.amount = Math.min(
      1,
      Math.max(this.color.r, this.color.g, this.color.b),
    );
  }
}
