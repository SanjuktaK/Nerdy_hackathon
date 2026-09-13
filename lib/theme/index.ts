// ============================================================
// §8 Personalization.
//
// Invariant, asserted in tests: a theme change alters sprites, nouns and
// palette. It never alters targetNumber, difficulty, or skill.
// ============================================================

export type PaletteId = "sage" | "clay" | "slate" | "sand";
export type CharacterId = "bo" | "mira" | "ade" | "nell";
export type SensoryLevel = 0 | 1 | 2;

export interface Theme {
  character: CharacterId;
  /** FREE TEXT — this is the point. Forces the generation path (§9.1). */
  interest: string;
  palette: PaletteId;
  soundLevel: SensoryLevel;
  motionLevel: SensoryLevel;
  /** Words per minute multiplier for narration. 0.6–1.2. */
  narrationSpeed: number;
}

/** Conservative defaults: sound 1, motion 1, muted palette (§8). */
export const DEFAULT_THEME: Theme = {
  character: "bo",
  interest: "trains",
  palette: "sage",
  soundLevel: 1,
  motionLevel: 1,
  narrationSpeed: 0.85,
};

export interface PaletteTokens {
  bg: string;
  surface: string;
  ink: string;
  inkSoft: string;
  line: string;
  accent: string;
  accentSoft: string;
  /**
   * The ones column. Place value is the claim that the two columns are
   * different kinds of thing, so drawing them in one colour throws away the
   * clearest signal the manipulative has. Both tones stay muted, and the
   * pair is warm/cool rather than red/green — a red/green pair is the one
   * combination to avoid.
   */
  accent2: string;
  accent2Soft: string;
  /** Used for the "settled / done" state. Never red, never alarming. */
  settled: string;
}

/**
 * Muted sets only. No saturated primaries, no high-contrast red/green pairs.
 * Every pair here clears 4.5:1 ink-on-surface.
 */
export const PALETTES: Record<PaletteId, { label: string; tokens: PaletteTokens }> = {
  sage: {
    label: "Sage",
    tokens: {
      bg: "#eef1ec",
      surface: "#f7f9f5",
      ink: "#28312a",
      inkSoft: "#5b6860",
      line: "#c9d3c6",
      accent: "#6d8f77",
      accent2: "#a8896a",
      accent2Soft: "#e4d8c9",
      accentSoft: "#cfdcd2",
      settled: "#7d9a85",
    },
  },
  clay: {
    label: "Clay",
    tokens: {
      bg: "#f2ece8",
      surface: "#fbf7f4",
      ink: "#332b26",
      inkSoft: "#6b5e56",
      line: "#dbccc2",
      accent: "#a07c66",
      accent2: "#7d8f7a",
      accent2Soft: "#d6e0d3",
      accentSoft: "#e5d6cb",
      settled: "#a8897a",
    },
  },
  slate: {
    label: "Slate",
    tokens: {
      bg: "#ebeef1",
      surface: "#f6f8fa",
      ink: "#262c33",
      inkSoft: "#57606b",
      line: "#c6cdd6",
      accent: "#6c829a",
      accent2: "#9a8a6c",
      accent2Soft: "#e3dccc",
      accentSoft: "#d3dce5",
      settled: "#7d92a8",
    },
  },
  sand: {
    label: "Sand",
    tokens: {
      bg: "#f1eee4",
      surface: "#faf8f2",
      ink: "#302c22",
      inkSoft: "#655f4f",
      line: "#d9d1bd",
      accent: "#94875f",
      accent2: "#6f8a8f",
      accent2Soft: "#d3e0e2",
      accentSoft: "#e2dcc8",
      settled: "#9c9068",
    },
  },
};

export const CHARACTERS: Record<CharacterId, { label: string; glyph: string }> = {
  bo: { label: "Bo", glyph: "circle" },
  mira: { label: "Mira", glyph: "square" },
  ade: { label: "Ade", glyph: "triangle" },
  nell: { label: "Nell", glyph: "hexagon" },
};

/** Seed interests the warm cache is pre-generated across (§7). */
export const SEED_INTERESTS = [
  "trains",
  "dinosaurs",
  "space",
  "cats",
  "buses",
  "fish",
  "rocks",
  "birds",
] as const;

export type SeedInterest = (typeof SEED_INTERESTS)[number];

export const isSeedInterest = (s: string): s is SeedInterest =>
  (SEED_INTERESTS as readonly string[]).includes(normaliseInterest(s));

export const normaliseInterest = (s: string): string =>
  s.trim().toLowerCase().replace(/\s+/g, " ");

/** Free-text interests are capped and stripped — they reach a prompt. */
export const sanitiseInterest = (s: string): string =>
  normaliseInterest(s)
    .replace(/[^a-z0-9 \-']/g, "")
    .slice(0, 40);

export const paletteCssVars = (id: PaletteId): Record<string, string> => {
  const t = PALETTES[id].tokens;
  return {
    "--bg": t.bg,
    "--surface": t.surface,
    "--ink": t.ink,
    "--ink-soft": t.inkSoft,
    "--line": t.line,
    "--accent": t.accent,
    "--accent-soft": t.accentSoft,
    "--accent-2": t.accent2,
    "--accent-2-soft": t.accent2Soft,
    "--settled": t.settled,
  };
};

/** Motion level → transition duration. Level 0 must be exactly zero. */
export const motionMs = (level: SensoryLevel): number =>
  level === 0 ? 0 : level === 1 ? 120 : 260;
