// ============================================================
// Provider 1 — Ollama on localhost. Dev and the recorded demo.
// A 3B model is ample for 14-word sentences and keeps child data
// on-device end to end (§11).
// ============================================================

import type { CompletionRequest, LLMProvider } from "../types";
import { ProviderUnavailable } from "../types";

const BASE = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2:3b";

const TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS ?? 20000);

async function post(path: string, body: unknown, timeoutMs = TIMEOUT_MS) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    if (!res.ok) {
      throw new ProviderUnavailable("ollama", `ollama ${path} → ${res.status}`);
    }
    return (await res.json()) as { message?: { content?: string }; response?: string };
  } finally {
    clearTimeout(timer);
  }
}

async function chat(req: CompletionRequest): Promise<string> {
  const body: Record<string, unknown> = {
    model: OLLAMA_MODEL,
    stream: false,
    messages: [
      { role: "system", content: req.system },
      { role: "user", content: req.user },
    ],
    options: {
      temperature: req.temperature ?? 0.7,
      num_predict: req.maxTokens ?? 400,
    },
  };
  // Ollama's `format` takes a JSON schema. Ask for JSON, and validate the
  // result regardless — never trust the shape (§9.0).
  if (req.format) body.format = req.format;
  const json = await post("/api/chat", body);
  return json.message?.content ?? json.response ?? "";
}

export const ollamaProvider: LLMProvider = {
  id: "ollama",
  label: `Ollama (${OLLAMA_MODEL}), on this machine`,

  async available() {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 1500);
      const res = await fetch(`${BASE}/api/tags`, { signal: ac.signal });
      clearTimeout(t);
      if (!res.ok) return false;
      const body = (await res.json()) as { models?: { name?: string }[] };
      const names = (body.models ?? []).map((m) => m.name ?? "");
      // A reachable daemon with no model pulled cannot serve a child.
      return names.some((n) => n.startsWith(OLLAMA_MODEL.split(":")[0]));
    } catch {
      return false;
    }
  },


  complete: chat,
};
