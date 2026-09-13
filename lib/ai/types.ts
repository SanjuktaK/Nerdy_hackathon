import type { GeneratedStem, GenerationRequest } from "./validate";

export type ProviderId = "ollama" | "hosted" | "none";

export interface CompletionRequest {
  system: string;
  user: string;
  /** JSON schema. When present the provider must ask for JSON and validate shape. */
  format?: object;
  maxTokens?: number;
  temperature?: number;
}

/**
 * §9.0 — Ollama runs on localhost. It does not exist on a deployed host.
 * This interface is what keeps the deployed build honest: every caller
 * programs against it, and `none` is a legal implementation.
 */
export interface LLMProvider {
  id: ProviderId;
  /** Human-readable, shown in the caregiver app. */
  label: string;
  available(): Promise<boolean>;
  generate(req: GenerationRequest, count: number): Promise<GeneratedStem[]>;
  /** Free text for surfaces B, C and D. */
  complete(req: CompletionRequest): Promise<string>;
}

export class ProviderUnavailable extends Error {
  constructor(public providerId: ProviderId, message: string) {
    super(message);
    this.name = "ProviderUnavailable";
  }
}

export interface ProviderStatus {
  id: ProviderId;
  label: string;
  available: boolean;
  model?: string;
  /** False means the UI hides the free-text interest field (§9.0). */
  canGenerate: boolean;
}
