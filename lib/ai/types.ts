export type ProviderId = "mlx" | "ollama" | "hosted" | "none";

export interface CompletionRequest {
  system: string;
  user: string;
  /** JSON schema, or any object to ask for JSON. The caller validates the shape regardless. */
  format?: object;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Every model call goes through this interface, and `none` is a legal
 * implementation: with no model reachable, the app answers with its rules.
 */
export interface LLMProvider {
  id: ProviderId;
  /** Human-readable, shown on the grown-ups page. */
  label: string;
  available(): Promise<boolean>;
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
}
