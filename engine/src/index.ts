import { EngineError, EngineRequest, EngineResponse, StreamEvent } from "./types";
import { getAdapter, getRegisteredProviders } from "./registry";

export { EngineError } from "./types";
export type {
  EngineRequest,
  EngineResponse,
  EngineConfig,
  EngineErrorCode,
  TokenUsage,
  CostEstimate,
  ProviderAdapter,
  StreamEvent,
  ConversationMessage,
} from "./types";

export { getRegisteredProviders } from "./registry";
export { getPricingData } from "./cost";
export type { PricingData } from "./cost";

export async function complete(request: EngineRequest): Promise<EngineResponse> {
  const adapter = getAdapter(request.provider);

  if (!adapter) {
    const available = getRegisteredProviders().map((a) => a.name);
    throw new EngineError(
      "INVALID_PROVIDER",
      `Provider "${request.provider}" is not registered. Available: ${available.join(", ")}`,
      request.provider
    );
  }

  return adapter.complete(request);
}

export async function* stream(request: EngineRequest): AsyncGenerator<StreamEvent> {
  const adapter = getAdapter(request.provider);

  if (!adapter) {
    const available = getRegisteredProviders().map((a) => a.name);
    throw new EngineError(
      "INVALID_PROVIDER",
      `Provider "${request.provider}" is not registered. Available: ${available.join(", ")}`,
      request.provider
    );
  }

  yield* adapter.stream(request);
}
