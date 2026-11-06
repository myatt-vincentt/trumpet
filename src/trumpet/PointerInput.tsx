// Playing with the computer keyboard, no hands needed: keys 1–7 choose Do …
// Ti, 0 rests, P plays or stops the beat. (The sign chips choose too, and
// the dock's play button starts the beat.)
import { useEffect } from "react";

import { keyChoice } from "./notes";
import { choose, toggleAutoPlay, trumpet } from "./state";

export const PointerInput = () => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.repeat ||
        !trumpet.entered ||
        // (a chip or dock button keeps the keys: only typing fields take them)
        !!(e.target as HTMLElement | null)?.closest?.("input, textarea, select")
      )
        return;
      if (e.code === "KeyP") {
        e.preventDefault();
        toggleAutoPlay();
        return;
      }
      const c = keyChoice(e.code);
      if (c !== null) {
        e.preventDefault();
        choose(c, "keys");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
};
