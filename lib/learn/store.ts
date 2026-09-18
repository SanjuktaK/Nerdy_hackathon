// ============================================================
// Device-local storage for the story flow. One subscribable snapshot so
// React reads it with useSyncExternalStore and never flashes empty → full.
// Nothing here leaves the device except as the JSON posted to our own
// route handlers, which forward it to the on-device model.
// ============================================================

import type { Character, ChildProfile, LearnerModel, SessionRecord } from "./types";

const KEY = "learn.v1";

export interface LearnState {
  profile: ChildProfile | null;
  character: Character | null;
  model: LearnerModel | null;
  sessions: SessionRecord[];
  /** Grown-up notes already opened, so the badge only counts new ones. */
  seenNotes?: string[];
}

const EMPTY: LearnState = { profile: null, character: null, model: null, sessions: [], seenNotes: [] };

let cache: LearnState | undefined;
const listeners = new Set<() => void>();

function load(): LearnState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as LearnState) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function subscribeLearn(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getLearn(): LearnState {
  if (cache === undefined) cache = load();
  return cache;
}

export const getLearnServer = (): LearnState | null => null;

export function updateLearn(patch: Partial<LearnState>) {
  cache = { ...getLearn(), ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Private mode or quota: the session carries on in memory.
  }
  for (const fn of listeners) fn();
}

export function resetLearn() {
  cache = EMPTY;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Already unreadable.
  }
  for (const fn of listeners) fn();
}
