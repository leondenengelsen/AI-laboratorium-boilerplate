export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  provider: string;
  model: string;
  systemMessage: string;
  tone: string;
  userMessage: string;
  messages?: ConversationMessage[];
  config?: {
    temperature?: number;
    maxTokens?: number;
  };
}

export interface ChatResponse {
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
  currency: string;
}

export interface ProviderInfo {
  name: string;
  displayName: string;
  models: ModelInfo[];
}

export interface ModelInfo {
  id: string;
  displayName: string;
  inputPerMillion: number;
  outputPerMillion: number;
  description: string;
}

export interface ProvidersResponse {
  providers: ProviderInfo[];
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    provider?: string;
  };
}

export interface KeyReference {
  id: string;
  provider: string;
  label: string;
  hint: string;
  createdAt: string;
}

export interface KeySaveRequest {
  provider: string;
  label: string;
  key: string;
}

export interface KeysResponse {
  keys: KeyReference[];
}

export interface Preset {
  id: string;
  name: string;
  systemMessage: string;
  tone: string;
  context: string;
  createdAt: string;
}

export interface PresetRequest {
  name: string;
  systemMessage: string;
  tone: string;
  context: string;
}

export interface PresetsResponse {
  presets: Preset[];
}

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; usage: TokenUsage; costEstimate: CostEstimate; latencyMs: number }
  | { type: "error"; code: string; message: string };
