// ============================================================
// L5 — the warm cache.
//
//   request(skill, difficulty, taskType, interest)
//     ├─ cache hit   → return instantly, 0 ms, 0 cost
//     └─ cache miss  → L9 generation (§7 / lib/content/server.ts)
//
// Two tiers. The static bank is stems.json, committed. The runtime bank
// holds whatever generation has produced since; on the server it is a Map
// for the process lifetime, in the browser it is mirrored to localStorage
// so a novel interest stays instant after the first session.
// ============================================================

import bank from "./stems.json";
import { entryKey, stemKey, type StemBank, type StemEntry } from "./schema";
import { LEXICON, stableHash } from "./lexicon";
import { SEED_INTERESTS, normaliseInterest } from "../theme";
import type { Difficulty } from "../core/types";

const STATIC: StemBank = bank as StemBank;

const staticIndex = new Map<string, StemEntry[]>();
for (const e of STATIC.entries) {
  const k = entryKey(e);
  const list = staticIndex.get(k);
  if (list) list.push(e);
  else staticIndex.set(k, [e]);
}

export const bankMeta = () => ({
  version: STATIC.version,
  generatedAt: STATIC.generatedAt,
  producedBy: STATIC.producedBy,
  size: STATIC.entries.length,
  interests: SEED_INTERESTS.length,
});

// ---------- runtime tier ----------

const runtime = new Map<string, StemEntry[]>();

export const RUNTIME_CACHE_STORAGE_KEY = "bf.stemcache.v1";
const RUNTIME_CACHE_LIMIT = 400;

/** Browsers only. Called once on mount; a failure here is never fatal. */
export function hydrateRuntimeCache(raw: string | null): void {
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as StemEntry[];
    if (!Array.isArray(parsed)) return;
    for (const e of parsed) addRuntime(e, false);
  } catch {
    // A corrupt cache is a cold cache, nothing worse.
  }
}

export function serialiseRuntimeCache(): string {
  const all: StemEntry[] = [];
  for (const list of runtime.values()) all.push(...list);
  return JSON.stringify(all.slice(-RUNTIME_CACHE_LIMIT));
}

let onWrite: (() => void) | null = null;
export const onRuntimeCacheWrite = (fn: (() => void) | null) => {
  onWrite = fn;
};

function addRuntime(e: StemEntry, notify = true): void {
  const k = entryKey(e);
  const list = runtime.get(k) ?? [];
  if (list.some((x) => x.stem === e.stem)) return;
  list.push(e);
  runtime.set(k, list);
  if (notify) onWrite?.();
}

export const writeStems = (entries: readonly StemEntry[]): void => {
  for (const e of entries) addRuntime(e);
};

// ---------- lookup ----------

export interface LookupQuery {
  skillId: string;
  taskType: string;
  difficulty: Difficulty;
  targetNumber: number;
  interest: string;
  /** Rotates which of several cached stems is returned. Deterministic. */
  rotation?: number;
}

export interface Hit {
  entry: StemEntry;
  /** "cache" = the interest asked for. "fallback" = nearest cached theme. */
  kind: "cache" | "fallback";
}

function pick(list: StemEntry[] | undefined, rotation: number): StemEntry | null {
  if (!list || list.length === 0) return null;
  return list[Math.abs(rotation) % list.length];
}

export function lookup(q: LookupQuery): Hit | null {
  const interest = normaliseInterest(q.interest);
  const key = stemKey(q.skillId, q.taskType, q.difficulty, q.targetNumber, interest);
  const rotation = q.rotation ?? 0;

  const fromRuntime = pick(runtime.get(key), rotation);
  if (fromRuntime) return { entry: fromRuntime, kind: "cache" };

  const fromStatic = pick(staticIndex.get(key), rotation);
  if (fromStatic) return { entry: fromStatic, kind: "cache" };

  return null;
}

/**
 * §7 — "pass ×2 fail or provider down: nearest cached theme, silently".
 *
 * Nearest is deterministic, not random: the same novel interest always
 * lands on the same seed interest, so a child who asks for the same thing
 * twice sees a consistent world rather than a shuffled one.
 */
export function nearestTheme(q: LookupQuery): Hit | null {
  const interest = normaliseInterest(q.interest);
  const order = [...SEED_INTERESTS].sort((a, b) => {
    const ha = stableHash(interest + a);
    const hb = stableHash(interest + b);
    return ha - hb;
  });

  for (const seed of order) {
    const key = stemKey(q.skillId, q.taskType, q.difficulty, q.targetNumber, seed);
    const entry = pick(staticIndex.get(key), q.rotation ?? 0);
    if (entry) return { entry, kind: "fallback" };
  }
  return null;
}

/** Never returns null for a shipping skill: the seed bank is exhaustive. */
export function lookupOrNearest(q: LookupQuery): Hit | null {
  return lookup(q) ?? nearestTheme(q);
}

/** Is this interest fully covered without touching a model? */
export function isCovered(skillId: string, taskType: string, difficulty: Difficulty, targets: readonly number[], interest: string): boolean {
  return targets.every((t) =>
    Boolean(lookup({ skillId, taskType, difficulty, targetNumber: t, interest }))
  );
}

export { LEXICON };
