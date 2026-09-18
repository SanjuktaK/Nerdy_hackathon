// ============================================================
// §9.0 Provider resolution.
//
//   0. mlx     — http://localhost:8080, our own 4-bit Qwen on Apple silicon
//   1. ollama  — http://localhost:11434, dev and the recorded demo
//   2. hosted  — free-tier endpoint, the deployed build
//   3. none    — cache-only; UI hides the free-text interest field
//
// Availability is probed once and cached, because the child app asks on
// every miss and a dead localhost costs a TCP timeout each time.
// ============================================================

import { hostedProvider } from "./providers/hosted";
import { MLX_MODEL, mlxProvider } from "./providers/mlx";
import { noneProvider } from "./providers/none";
import { OLLAMA_MODEL, ollamaProvider } from "./providers/ollama";
import { HOSTED_MODEL } from "./providers/hosted";
import type { LLMProvider, ProviderId, ProviderStatus } from "./types";

const ORDER: LLMProvider[] = [mlxProvider, ollamaProvider, hostedProvider, noneProvider];

const PROBE_TTL_MS = 30_000;

let cached: { provider: LLMProvider; at: number } | null = null;

/** Force a specific provider. Used by the eval harness and by tests. */
export function overrideProvider(p: LLMProvider | null): void {
  cached = p ? { provider: p, at: Number.POSITIVE_INFINITY } : null;
}

export async function resolveProvider(force = false): Promise<LLMProvider> {
  if (!force && cached && Date.now() - cached.at < PROBE_TTL_MS) {
    return cached.provider;
  }
  const only = process.env.LLM_PROVIDER as ProviderId | undefined;
  const candidates = only ? ORDER.filter((p) => p.id === only) : ORDER;

  for (const p of candidates.length ? candidates : ORDER) {
    try {
      if (await p.available()) {
        cached = { provider: p, at: Date.now() };
        return p;
      }
    } catch {
      // A provider that throws while being probed is an unavailable provider.
    }
  }
  cached = { provider: noneProvider, at: Date.now() };
  return noneProvider;
}

export async function providerStatus(): Promise<ProviderStatus> {
  const p = await resolveProvider();
  return {
    id: p.id,
    label: p.label,
    available: p.id !== "none",
    model:
      p.id === "mlx"
        ? MLX_MODEL
        : p.id === "ollama"
          ? OLLAMA_MODEL
          : p.id === "hosted"
            ? HOSTED_MODEL
            : undefined,
    canGenerate: p.id !== "none",
  };
}
