// ============================================================
// Sensory settings, in one place: calm single-colour tones, motion, voice.
// All caregiver-controlled, all previewed before they take effect.
// ============================================================

import type { ChildProfile, MonoTone, ReadAloud } from "./types";

export const MONO_TONES: { id: MonoTone; label: string; filter: string; swatch: string }[] = [
  { id: "grey", label: "Grey", filter: "grayscale(1)", swatch: "#9a9a9a" },
  { id: "warm", label: "Warm sand", filter: "grayscale(1) sepia(0.45)", swatch: "#b8a488" },
  { id: "blue", label: "Soft blue", filter: "grayscale(1) sepia(0.5) hue-rotate(170deg) saturate(1.4)", swatch: "#8aa8bf" },
  { id: "green", label: "Sage green", filter: "grayscale(1) sepia(0.5) hue-rotate(55deg) saturate(1.2)", swatch: "#9bb18f" },
  { id: "lavender", label: "Lavender", filter: "grayscale(1) sepia(0.45) hue-rotate(215deg) saturate(1.3)", swatch: "#a79bc4" },
];

/** The CSS filter for the whole child screen, or none. */
export function sensoryFilter(p: Pick<ChildProfile, "colourSensitive" | "monoTone">): string | undefined {
  if (!p.colourSensitive) return undefined;
  return (MONO_TONES.find((t) => t.id === p.monoTone) ?? MONO_TONES[0]).filter;
}

/** Text size as a share of the normal size; applied to the whole page so every size scales. */
export const TEXT_SCALE = { normal: "100%", large: "112.5%", xlarge: "125%" } as const;

/** Classes for the reading-comfort settings. */
export function readingClasses(p: Pick<ChildProfile, "wideSpacing" | "readableFont">): string {
  return `${p.wideSpacing ? "wide-spacing" : ""} ${p.readableFont ? "readable-font" : ""}`.trim();
}

/** Old profiles have no read-aloud setting: young or non-speaking children get it on. */
export function readAloudOf(p: ChildProfile): ReadAloud {
  if (p.readAloud) return p.readAloud;
  if (p.soundSensitive) return "tap";
  return p.age <= 6 || p.communication === "few-words" ? "auto" : "tap";
}

export const READ_ALOUD_OPTIONS: { id: ReadAloud; title: string; blurb: string }[] = [
  { id: "auto", title: "Read everything aloud", blurb: "Stories, questions and the demo are spoken automatically." },
  { id: "tap", title: "Only when tapped", blurb: "A speaker button reads the puzzle when your child taps it." },
  { id: "off", title: "No voice", blurb: "Everything stays on screen, silent." },
];

/** Story length follows how the child communicates. */
export function storyWordsFor(p: ChildProfile): { max: number; sentences: 1 | 2 } {
  return p.communication === "sentences"
    ? { max: 28, sentences: 2 }
    : p.communication === "phrases"
      ? { max: 14, sentences: 1 }
      : { max: 9, sentences: 1 };
}

/** Volume and effects from the profile; a sound-sensitive child starts at half. */
export function soundSettings(p: ChildProfile): { volume: number; effects: boolean } {
  return { volume: p.volume ?? (p.soundSensitive ? 0.5 : 0.9), effects: p.soundEffects !== false };
}

/** No-movement always freezes the scene; otherwise the caregiver's choice, moving by default. */
export function backgroundOf(p: ChildProfile): "moving" | "still" | "plain" {
  const b = p.background ?? "moving";
  return p.reduceMotion && b === "moving" ? "still" : b;
}

/** Puzzles before the break. Five unless the grown-up chose three or eight. */
export const sessionLengthOf = (p: ChildProfile): number => (p.sessionLength && [3, 5, 8].includes(p.sessionLength) ? p.sessionLength : 5);

/**
 * The friend's voice. One voice — a cheerful child's — for every character:
 * the voice model then never has to design a voice per line, which is what
 * made speech lag. (The parameters stay for the browser-voice fallback.)
 */
export function voiceStyleOf(): "child" {
  return "child";
}
