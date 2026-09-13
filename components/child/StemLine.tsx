"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Sprite } from "./Sprite";
import { speak, speechAvailable } from "@/lib/child/speech";
import type { Theme } from "@/lib/theme";

// Speech support is a property of the browser, so it cannot be known while
// rendering on the server. Reading it during render made the server emit no
// speaker button and the client emit one, which is a hydration mismatch on
// every task screen. useSyncExternalStore is the sanctioned way to say
// "this value is false on the server and whatever the browser says here".
const NEVER_CHANGES = () => () => {};

/**
 * The sentence, the sprite, and a speaker the child controls.
 * Narration never starts without the child asking for it beyond the first
 * read, and never at all at sound level 0.
 */
export function StemLine({
  stem,
  spriteKey,
  theme,
  autoRead = false,
}: {
  stem: string;
  spriteKey: string;
  theme: Theme;
  autoRead?: boolean;
}) {
  const canSpeak = useSyncExternalStore(
    NEVER_CHANGES,
    speechAvailable,
    () => false
  );

  useEffect(() => {
    if (autoRead) {
      speak(stem, { soundLevel: theme.soundLevel, narrationSpeed: theme.narrationSpeed });
    }
  }, [autoRead, stem, theme.soundLevel, theme.narrationSpeed]);

  return (
    <div className="flex items-start gap-4">
      <Sprite spriteKey={spriteKey} />
      <p className="flex-1 text-2xl leading-snug text-[var(--ink)]">{stem}</p>
      {canSpeak && theme.soundLevel > 0 && (
        <button
          type="button"
          aria-label="Read the sentence again"
          onClick={() =>
            speak(stem, {
              soundLevel: theme.soundLevel,
              narrationSpeed: theme.narrationSpeed,
            })
          }
          className="rounded-xl border-2 border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-xl"
        >
          ▸
        </button>
      )}
    </div>
  );
}
