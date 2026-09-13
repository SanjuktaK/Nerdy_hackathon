// ============================================================
// Provider 3 — none. Cache-only.
//
// This is a first-class implementation, not an error path. With `none`
// resolved, the app still teaches: every seed interest is fully covered
// by the warm cache. The UI hides the free-text interest field (§9.0).
// ============================================================

import type { LLMProvider } from "../types";
import { ProviderUnavailable } from "../types";

export const noneProvider: LLMProvider = {
  id: "none",
  label: "No model — cached lessons only",
  async available() {
    return true;
  },
  async generate() {
    throw new ProviderUnavailable("none", "no model is available");
  },
  async complete() {
    throw new ProviderUnavailable("none", "no model is available");
  },
};
