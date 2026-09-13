"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type { LearnerEvent, Representation, ScoringPhase } from "../core/types";
import { fetchStem, initStemCache, toTask } from "../content/client";
import { getCell, replayMastery, recordResult, type MasteryState } from "../policy/mastery";
import { nextMove, selectSpec, startingCursor, type Cursor, type Move } from "../policy/select";
import {
  appendEvent,
  getEventsServerSnapshot,
  getEventsSnapshot,
  loadCursor,
  saveCursor,
  subscribeEvents,
  type Profile,
} from "../persistence/store";
import { getSkill } from "../skills/registry";
import { countWords } from "../ai/validate";
import {
  initialSession,
  planTotal,
  sessionReducer,
  type SessionPlan,
  type SessionState,
} from "./machine";

const FIRST_FOCUS = "same skill, new surface";

export interface SessionApi {
  state: SessionState;
  events: LearnerEvent[];
  mastery: MasteryState;
  lastMove: Move | null;
  total: number;
  setWork: (work: unknown) => void;
  startTasks: () => void;
  modelNext: () => void;
  modelDone: () => void;
  openPrompt: () => void;
  /** Lets the child ask for the walkthrough from GUIDED. */
  showModel: () => void;
  submitGuided: () => void;
  acceptGuided: () => void;
  submitIndependent: () => void;
  abandon: () => void;
  feedbackDone: () => void;
  endBreak: () => void;
  /** The word count of the stem the child is on — feeds the §6.3 language bar. */
  stemWords: number;
}

export function useSession(profile: Profile): SessionApi {
  const plan: SessionPlan = useMemo(
    () => ({ tasksPerBlock: profile.tasksPerBlock, blocks: profile.blocksPerSession }),
    [profile.tasksPerBlock, profile.blocksPerSession]
  );

  // The event log is an external store: localStorage, shared with the
  // caregiver view, and written from callbacks rather than from render.
  const events = useSyncExternalStore(
    subscribeEvents,
    getEventsSnapshot,
    getEventsServerSnapshot
  );

  const [state, dispatch] = useReducer(
    sessionReducer,
    undefined,
    () => initialSession(plan, startingCursor())
  );
  const [lastMove, setLastMove] = useState<Move | null>(null);

  const focusRef = useRef<string>(FIRST_FOCUS);
  const loadToken = useRef(0);

  const mastery = useMemo(() => replayMastery(events), [events]);

  /** Mastery as of *now*, for callbacks that must not read a render-time copy. */
  const currentMastery = useCallback(() => replayMastery(getEventsSnapshot()), []);

  // Restore the cursor. The child app never asks for a name or a login —
  // the profile already exists or the caregiver app makes one.
  useEffect(() => {
    initStemCache();
    const saved = loadCursor();
    if (saved) dispatch({ type: "SET_CURSOR", cursor: saved });
  }, []);

  // ---------- content loading; PREVIEW covers the wait (§9.5) ----------

  const load = useCallback(
    async (cursor: Cursor, focus: string, rotation: number, recent: number[]) => {
      const token = ++loadToken.current;
      dispatch({ type: "TASK_LOADING" });

      const skill = getSkill(cursor.skillId);
      const spec = selectSpec(cursor, focus, rotation, recent);
      const result = await fetchStem(spec, profile.theme.interest, rotation);
      if (token !== loadToken.current) return;

      const task = toTask(spec, result, profile.theme.interest, cursor.representation, rotation);

      // New ground gets the walkthrough; ground the child has already worked
      // independently does not. `seen` counts independent answers in this
      // exact (skill, difficulty, representation) cell.
      const cell = getCell(currentMastery(), cursor.skillId, cursor.difficulty, cursor.representation);
      const showModel = cell.seen === 0;

      dispatch({ type: "TASK_READY", task, work: skill.initialState(task), cursor, showModel });

      // Task N+1 is warmed while the child works on task N. Both plausible
      // next cursors are fetched; whichever the policy picks is already warm.
      void prefetchLikelyNext(cursor, currentMastery(), profile.theme.interest, rotation + 1, recent);
    },
    [profile.theme.interest, currentMastery]
  );

  const needsTask =
    state.loading && (state.phase === "PREVIEW" || state.phase === "BREAK");

  useEffect(() => {
    if (!needsTask) return;
    void load(state.cursor, focusRef.current, state.rotation, state.recentTargets);
    // `load` is stable per interest; cursor/rotation are the real triggers.
  }, [needsTask, state.cursor, state.rotation, state.recentTargets, load]);

  // ---------- actions ----------

  const skill = getSkill(state.cursor.skillId);

  const setWork = useCallback(
    (work: unknown) => dispatch({ type: "WORK_CHANGED", work }),
    []
  );

  const logEvent = useCallback(
    (phase: ScoringPhase, code: string, abandoned: boolean) => {
      const task = state.task;
      if (!task) return;
      const ev: LearnerEvent = {
        ts: Date.now(),
        skillId: task.skillId,
        taskId: task.id,
        taskType: task.type,
        targetNumber: task.targetNumber,
        phase,
        difficulty: task.difficulty,
        representation: task.representation as Representation,
        result: code,
        latencyMs: Math.max(0, Date.now() - state.attemptStartedAt),
        promptUsed: state.promptUsed,
        abandoned,
        interest: task.interest,
        stemSource: task.stemSource,
      };
      appendEvent(ev);
      return ev;
    },
    [state.task, state.attemptStartedAt, state.promptUsed]
  );

  const submitGuided = useCallback(() => {
    if (!state.task) return;
    const code = skill.classify(state.work, state.task) as string;
    logEvent("GUIDED", code, false);
    dispatch({
      type: "GUIDED_SUBMIT",
      code,
      hint: skill.hintFor(state.work, state.task, code),
    });
  }, [skill, state.work, state.task, logEvent]);

  const acceptGuided = useCallback(() => {
    if (!state.task) return;
    dispatch({ type: "GUIDED_ACCEPT", work: skill.initialState(state.task) });
  }, [skill, state.task]);

  const submitIndependent = useCallback(() => {
    if (!state.task) return;
    const code = skill.classify(state.work, state.task) as string;
    const ev = logEvent("INDEPENDENT", code, false);
    dispatch({ type: "INDEPENDENT_SUBMIT", code });

    // The policy reads the mastery state that *includes* this result.
    const base = currentMastery();
    const nextMastery = ev ? recordResult(base, ev) : base;
    const move = nextMove(state.cursor, code, nextMastery);
    setLastMove(move);
    focusRef.current = move.focus;
    saveCursor(move.cursor);
  }, [skill, state.work, state.task, state.cursor, logEvent, currentMastery]);

  const abandon = useCallback(() => {
    logEvent("INDEPENDENT", "UNCLASSIFIED", true);
    dispatch({ type: "ABANDON" });
    const move = nextMove(state.cursor, "UNCLASSIFIED", currentMastery());
    setLastMove(move);
    focusRef.current = move.focus;
    saveCursor(move.cursor);
  }, [state.cursor, logEvent, currentMastery]);

  const feedbackDone = useCallback(() => {
    // FEEDBACK after the guided pass leads back into the same task, unaided.
    if (state.independentCode === null) {
      acceptGuided();
      return;
    }
    dispatch({ type: "FEEDBACK_DONE" });
    if (lastMove) dispatch({ type: "SET_CURSOR", cursor: lastMove.cursor });
  }, [state.independentCode, acceptGuided, lastMove]);

  return {
    state,
    events,
    mastery,
    lastMove,
    total: planTotal(plan),
    setWork,
    startTasks: () => dispatch({ type: "PREVIEW_DONE" }),
    modelNext: () => dispatch({ type: "MODEL_NEXT" }),
    modelDone: () => dispatch({ type: "MODEL_DONE" }),
    openPrompt: () => dispatch({ type: "PROMPT_OPENED" }),
    showModel: () => dispatch({ type: "SHOW_MODEL" }),
    submitGuided,
    acceptGuided,
    submitIndependent,
    abandon,
    feedbackDone,
    endBreak: () => dispatch({ type: "BREAK_DONE" }),
    stemWords: state.task ? countWords(state.task.stem) : 0,
  };
}

/**
 * §9.5 — warm the two plausible next cursors. Fire and forget: results
 * land in the runtime cache, and nothing downstream waits on them.
 */
async function prefetchLikelyNext(
  cursor: Cursor,
  mastery: MasteryState,
  interest: string,
  rotation: number,
  recent: number[]
): Promise<void> {
  const skill = getSkill(cursor.skillId);
  const candidates = new Set<string>();
  const moves: Move[] = [
    nextMove(cursor, "CORRECT", mastery),
    nextMove(cursor, skill.codes.find((c) => c !== "CORRECT") ?? "UNCLASSIFIED", mastery),
  ];

  for (const move of moves) {
    const key = `${move.cursor.skillId}|${move.cursor.difficulty}|${move.focus}`;
    if (candidates.has(key)) continue;
    candidates.add(key);
    try {
      const spec = selectSpec(move.cursor, move.focus, rotation, recent);
      await fetchStem(spec, interest, rotation);
    } catch {
      // Prefetch is best-effort by definition.
    }
  }
}
