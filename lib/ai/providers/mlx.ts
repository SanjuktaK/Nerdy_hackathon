// ============================================================
// Provider 0 — a model we quantized ourselves, served by MLX on this Mac.
//
//   npm run llm:quantize   # Qwen2.5-1.5B-Instruct bf16 → 4-bit, on-device
//   npm run llm:serve      # mlx_lm.server on http://localhost:8080
//
// The server speaks OpenAI /v1/chat/completions and keeps an LRU cache of
// prompt KV state, so the fixed system prompt is prefilled once and reused
// by every later request (see scripts/mlx/bench.py for the measured effect).
// Child data never leaves the machine (§11).
// ============================================================

import type { CompletionRequest, LLMProvider } from "../types";
import { ProviderUnavailable } from "../types";

const BASE = process.env.MLX_BASE_URL ?? "http://localhost:8080";
export const MLX_MODEL = process.env.MLX_MODEL ?? "qwen2.5-1.5b-instruct-4bit";

const TIMEOUT_MS = Number(process.env.MLX_TIMEOUT_MS ?? 20000);

async function chat(req: CompletionRequest): Promise<string> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: ac.signal,
      body: JSON.stringify({
        // mlx_lm.server serves whichever model it was started with.
        model: "default_model",
        temperature: req.temperature ?? 0.7,
        max_tokens: req.maxTokens ?? 400,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
      }),
    });
    if (!res.ok) {
      throw new ProviderUnavailable("mlx", `mlx ${res.status}`);
    }
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    // No schema-constrained decoding on this server: the prompt asks for
    // JSON and the caller validates every field (lib/learn/ai.ts).
    return body.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timer);
  }
}

export const mlxProvider: LLMProvider = {
  id: "mlx",
  label: `MLX (${MLX_MODEL}), on this machine`,

  async available() {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 1500);
      const res = await fetch(`${BASE}/health`, { signal: ac.signal });
      clearTimeout(t);
      return res.ok;
    } catch {
      return false;
    }
  },


  complete: chat,
};
