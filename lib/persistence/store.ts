// ============================================================
// L6 — device-local persistence (§11).
//
// No account, no server, no telemetry. Deliberately absent: camera,
// microphone, affect inference, analytics SDKs, third-party identifiers.
// ============================================================

import type { LearnerEvent } from "../core/types";
import type { Cursor } from "../policy/select";
import { replayMastery, type MasteryState } from "../policy/mastery";
import { DEFAULT_THEME, type Theme } from "../theme";

export const STORAGE_VERSION = 1;
export const PROFILE_KEY = "bf.profile.v1";
export const EVENTS_KEY = "bf.events.v1";
export const MASTERY_KEY = "bf.mastery.v1";
export const CURSOR_KEY = "bf.cursor.v1";

export interface Profile {
  id: string;
  /** A first name or nickname. Never leaves the device. */
  name: string;
  createdAt: number;
  theme: Theme;
  /** skillId → the caregiver's IEP goal text (§12). */
  iepGoals: Record<string, string>;
  /** Tasks per block before a break (§4 PREVIEW). */
  tasksPerBlock: number;
  blocksPerSession: number;
}

export const newProfile = (name = ""): Profile => ({
  id: `p_${Date.now().toString(36)}`,
  name,
  createdAt: Date.now(),
  theme: { ...DEFAULT_THEME },
  iepGoals: {},
  tasksPerBlock: 3,
  blocksPerSession: 2,
});

const hasWindow = () => typeof window !== "undefined";

function read<T>(key: string, fallback: T): T {
  if (!hasWindow()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // Corrupt or unavailable storage is an empty profile, never a crash.
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or private mode. The session continues in memory.
  }
}

// ---------- profile ----------

export const loadProfile = (): Profile | null => read<Profile | null>(PROFILE_KEY, null);

let profileCache: Profile | null | undefined;
const profileListeners = new Set<() => void>();

export function subscribeProfile(fn: () => void): () => void {
  profileListeners.add(fn);
  return () => profileListeners.delete(fn);
}

export function getProfileSnapshot(): Profile | null {
  if (profileCache === undefined) profileCache = loadProfile();
  return profileCache;
}

export const getProfileServerSnapshot = (): Profile | null => null;

export function saveProfile(p: Profile): void {
  profileCache = p;
  write(PROFILE_KEY, p);
  for (const fn of profileListeners) fn();
}

export const loadTheme = (): Theme => loadProfile()?.theme ?? DEFAULT_THEME;

// ---------- events ----------
//
// Exposed as a subscribable store rather than a plain read, so React can
// take it with useSyncExternalStore. That matters for more than tidiness:
// a plain read in an effect would hydrate empty and then swap, which is a
// visible flash on the one screen that is supposed to never surprise anyone.

export const EVENT_LIMIT = 2000;

export const loadEvents = (): LearnerEvent[] => read<LearnerEvent[]>(EVENTS_KEY, []);

const EMPTY_EVENTS: LearnerEvent[] = [];
const listeners = new Set<() => void>();
let eventCache: LearnerEvent[] | null = null;

const notify = () => {
  for (const fn of listeners) fn();
};

export function subscribeEvents(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Cached so repeated renders get a stable reference, as the hook requires. */
export function getEventsSnapshot(): LearnerEvent[] {
  if (eventCache === null) eventCache = loadEvents();
  return eventCache;
}

/** Server render has no device storage; a stable empty array avoids a mismatch. */
export const getEventsServerSnapshot = (): LearnerEvent[] => EMPTY_EVENTS;

export function appendEvent(ev: LearnerEvent): LearnerEvent[] {
  const next = [...getEventsSnapshot(), ev].slice(-EVENT_LIMIT);
  eventCache = next;
  write(EVENTS_KEY, next);
  write(MASTERY_KEY, replayMastery(next));
  notify();
  return next;
}

// ---------- mastery ----------

/**
 * Persisted as a cache, but the event log is the source of truth: a
 * mismatch is resolved by replaying, so a stale or hand-edited mastery
 * blob can never push a child onto the wrong rung.
 */
export function loadMastery(events?: readonly LearnerEvent[]): MasteryState {
  const log = events ?? loadEvents();
  const cached = read<MasteryState>(MASTERY_KEY, {});
  const replayed = replayMastery(log);
  return Object.keys(cached).length === Object.keys(replayed).length
    ? replayed
    : replayed;
}

// ---------- cursor ----------

export const loadCursor = (): Cursor | null => read<Cursor | null>(CURSOR_KEY, null);
export const saveCursor = (c: Cursor): void => write(CURSOR_KEY, c);

// ---------- export / delete (§12) ----------

export interface ExportBundle {
  app: "beadframe";
  version: number;
  exportedAt: string;
  profile: Profile | null;
  events: LearnerEvent[];
}

export const exportBundle = (): ExportBundle => ({
  app: "beadframe",
  version: STORAGE_VERSION,
  exportedAt: new Date().toISOString(),
  profile: loadProfile(),
  events: loadEvents(),
});

/** Irreversible, and the caregiver app says so before calling it. */
export function deleteEverything(): void {
  if (!hasWindow()) return;
  eventCache = EMPTY_EVENTS;
  profileCache = null;
  for (const key of [PROFILE_KEY, EVENTS_KEY, MASTERY_KEY, CURSOR_KEY, "bf.stemcache.v1"]) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing more to do; the keys are already unreadable.
    }
  }
  notify();
  for (const fn of profileListeners) fn();
}
