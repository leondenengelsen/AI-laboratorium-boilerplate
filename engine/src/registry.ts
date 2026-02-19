import { ProviderAdapter } from "./types";
import { ClaudeAdapter } from "./providers/claude-adapter";
import { GeminiAdapter } from "./providers/gemini-adapter";
import { OpenaiAdapter } from "./providers/openai-adapter";
import { MistralAdapter } from "./providers/mistral-adapter";

const adapters: Map<string, ProviderAdapter> = new Map();

function register(adapter: ProviderAdapter): void {
  adapters.set(adapter.name, adapter);
}

export function getAdapter(providerName: string): ProviderAdapter | undefined {
  return adapters.get(providerName);
}

export function getRegisteredProviders(): ProviderAdapter[] {
  return Array.from(adapters.values());
}

// Register built-in adapters
register(new ClaudeAdapter());
register(new GeminiAdapter());
register(new OpenaiAdapter());
register(new MistralAdapter());
