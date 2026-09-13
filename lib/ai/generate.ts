// ============================================================
// Surface A core (§9.1) — generate, validate, retry once, give up.
//
//   "washing machines" + targetNumber 34 + difficulty 3
//      → 5 candidate stems
//      → validateStem(): numeral present, in band, ≤14 words,
//        zero banned patterns
//      → cached, served
//
// The numbers and difficulty are ours. Only the language changes.
// ============================================================

import { resolveProvider } from "./provider";
import { NAIVE_SYSTEM, STEM_SYSTEM, naiveUserPrompt, repairPrompt } from "./prompts";
import { parseStemBatch } from "./providers/ollama";
import type { LLMProvider, ProviderId } from "./types";
import {
  STEM_BATCH_SCHEMA,
  validateStem,
  type GeneratedStem,
  type GenerationRequest,
} from "./validate";

export interface Rejection {
  stem: string;
  failures: string[];
}

export interface GenerationOutcome {
  accepted: GeneratedStem[];
  rejected: Rejection[];
  attempts: number;
  latencyMs: number;
  providerId: ProviderId;
  /** True when the pipeline gave up and the caller must fall back (§7). */
  exhausted: boolean;
  error?: string;
}

export const BATCH_SIZE = 5;
export const MAX_ATTEMPTS = 2;

export interface GenerateOptions {
  count?: number;
  provider?: LLMProvider;
  /** §10 baseline: the naive prompt, one shot, no repair pass. */
  naive?: boolean;
}

export async function generateValidated(
  req: GenerationRequest,
  opts: GenerateOptions = {}
): Promise<GenerationOutcome> {
  const count = opts.count ?? BATCH_SIZE;
  const provider = opts.provider ?? (await resolveProvider());
  const started = Date.now();

  const accepted: GeneratedStem[] = [];
  const rejected: Rejection[] = [];
  let attempts = 0;
  let error: string | undefined;

  const maxAttempts = opts.naive ? 1 : MAX_ATTEMPTS;

  while (attempts < maxAttempts && accepted.length === 0) {
    attempts += 1;
    try {
      const batch = opts.naive
        ? parseStemBatch(
            await provider.complete({
              system: NAIVE_SYSTEM,
              user: naiveUserPrompt(req, count),
              format: STEM_BATCH_SCHEMA,
              temperature: 0.8,
            })
          )
        : attempts === 1
          ? await provider.generate(req, count)
          : parseStemBatch(
              await provider.complete({
                system: STEM_SYSTEM,
                user: repairPrompt(req, rejected.slice(-count), count),
                format: STEM_BATCH_SCHEMA,
                temperature: 0.5,
              })
            );

      if (batch.length === 0) {
        rejected.push({ stem: "", failures: ["schema: no parseable stems"] });
        continue;
      }

      for (const candidate of batch) {
        const v = validateStem(candidate, req);
        if (v.ok) accepted.push(candidate);
        else rejected.push({ stem: candidate.stem, failures: v.failures });
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      break;
    }
  }

  return {
    accepted,
    rejected,
    attempts,
    latencyMs: Date.now() - started,
    providerId: provider.id,
    exhausted: accepted.length === 0,
    error,
  };
}
