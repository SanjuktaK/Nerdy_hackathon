// ============================================================
// Provider 2 — a hosted OpenAI-compatible endpoint. The deployed build.
//
// Configured entirely by environment, so the repo carries no key and the
// deployed build degrades to `none` when the environment is empty rather
// than pretending a model is there.
// ============================================================

import type { CompletionRequest, LLMProvider } from "../types";
import { ProviderUnavailable } from "../types";

const BASE = process.env.HOSTED_LLM_BASE_URL ?? "";
const KEY = process.env.HOSTED_LLM_API_KEY ?? "";
export const HOSTED_MODEL = process.env.HOSTED_LLM_MODEL ?? "";

const configured = () => Boolean(BASE && KEY && HOSTED_MODEL);

async function chat(req: CompletionRequest): Promise<string> {
  if (!configured()) {
    throw new ProviderUnavailable("hosted", "hosted provider is not configured");
  }
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 25000);
  try {
    const res = await fetch(`${BASE.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${KEY}`,
      },
      signal: ac.signal,
      body: JSON.stringify({
        model: HOSTED_MODEL,
        temperature: req.temperature ?? 0.7,
        max_tokens: req.maxTokens ?? 400,
        ...(req.format ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
      }),
    });
    if (!res.ok) {
      throw new ProviderUnavailable("hosted", `hosted ${res.status}`);
    }
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return body.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(t);
  }
}

export const hostedProvider: LLMProvider = {
  id: "hosted",
  label: HOSTED_MODEL ? `Hosted (${HOSTED_MODEL})` : "Hosted (not configured)",

  async available() {
    return configured();
  },


  complete: chat,
};
