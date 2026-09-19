// ============================================================
// Provider 3 — none.
//
// A first-class implementation, not an error path. With `none` resolved the
// app still teaches: every model call falls back to its rules and templates.
// ============================================================

import type { LLMProvider } from "../types";
import { ProviderUnavailable } from "../types";

export const noneProvider: LLMProvider = {
  id: "none",
  label: "No model — rules and templates only",
  async available() {
    return true;
  },
  async complete() {
    throw new ProviderUnavailable("none", "no model is available");
  },
};
