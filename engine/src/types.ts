export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface EngineRequest {
  provider: string;
  model: string;
  systemMessage: string;
  tone: string;
  userMessage: string;
  apiKey: string;
  config?: EngineConfig;
  messages?: ConversationMessage[];
}

export interface EngineConfig {
  temperature?: number;
  maxTokens?: number;
}

export interface EngineResponse {
  text: string;
  provider: string;
  model: string;
  usage: TokenUsage;
  costEstimate: CostEstimate;
  latencyMs: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface CostEstimate {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: "USD";
}

export type EngineErrorCode =
  | "INVALID_PROVIDER"
  | "INVALID_MODEL"
  | "AUTH_FAILURE"
  | "RATE_LIMIT"
  | "PROVIDER_ERROR"
  | "UNKNOWN";

export class EngineError extends Error {
  public readonly code: EngineErrorCode;
  public readonly provider?: string;
  public readonly statusCode?: number;

  constructor(
    code: EngineErrorCode,
    message: string,
    provider?: string,
    statusCode?: number
  ) {
    super(message);
    this.name = "EngineError";
    this.code = code;
    this.provider = provider;
    this.statusCode = statusCode;
  }
}

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; usage: TokenUsage; costEstimate: CostEstimate; latencyMs: number }
  | { type: "error"; code: EngineErrorCode; message: string };

export interface ProviderAdapter {
  readonly name: string;
  readonly supportedModels: string[];
  complete(request: EngineRequest): Promise<EngineResponse>;
  stream(request: EngineRequest): AsyncGenerator<StreamEvent>;
}
