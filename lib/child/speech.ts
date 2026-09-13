"use client";

// ============================================================
// Narration. Web Speech API only — no recording, no microphone,
// nothing leaves the device (§11).
// ============================================================

import type { SensoryLevel } from "../theme";

export const speechAvailable = (): boolean =>
  typeof window !== "undefined" && "speechSynthesis" in window;

export function cancelSpeech(): void {
  if (!speechAvailable()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Some browsers throw when cancelling with nothing queued.
  }
}

export interface SpeakOptions {
  soundLevel: SensoryLevel;
  narrationSpeed: number;
}

/** Silent at sound level 0. Never plays over itself. */
export function speak(text: string, opts: SpeakOptions): void {
  if (!speechAvailable() || opts.soundLevel === 0 || !text.trim()) return;
  cancelSpeech();
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = Math.max(0.5, Math.min(1.5, opts.narrationSpeed));
    u.pitch = 1;
    u.volume = opts.soundLevel === 1 ? 0.7 : 1;
    window.speechSynthesis.speak(u);
  } catch {
    // Narration is an enhancement; the sentence is on screen regardless.
  }
}
