import { describe, it, expect } from "vitest";
import { getAdapter, getRegisteredProviders } from "../src/registry";
import { ClaudeAdapter } from "../src/providers/claude-adapter";
import { GeminiAdapter } from "../src/providers/gemini-adapter";
import { OpenaiAdapter } from "../src/providers/openai-adapter";
import { MistralAdapter } from "../src/providers/mistral-adapter";
import type { ProviderAdapter } from "../src/types";

describe("getRegisteredProviders", () => {
  it("returns an array containing all four adapters", () => {
    const providers: ProviderAdapter[] = getRegisteredProviders();
    const names = providers.map((p) => p.name);

    expect(names).toContain("claude");
    expect(names).toContain("gemini");
    expect(names).toContain("openai");
    expect(names).toContain("mistral");
  });

  it("returns an array of ProviderAdapter objects", () => {
    const providers: ProviderAdapter[] = getRegisteredProviders();

    expect(Array.isArray(providers)).toBe(true);
    for (const provider of providers) {
      expect(typeof provider.name).toBe("string");
      expect(Array.isArray(provider.supportedModels)).toBe(true);
      expect(typeof provider.complete).toBe("function");
    }
  });
});

describe("getAdapter", () => {
  it("returns a ClaudeAdapter instance for 'claude'", () => {
    const adapter: ProviderAdapter | undefined = getAdapter("claude");

    expect(adapter).toBeDefined();
    expect(adapter).toBeInstanceOf(ClaudeAdapter);
  });

  it("returns a GeminiAdapter instance for 'gemini'", () => {
    const adapter: ProviderAdapter | undefined = getAdapter("gemini");

    expect(adapter).toBeDefined();
    expect(adapter).toBeInstanceOf(GeminiAdapter);
  });

  it("returns an OpenaiAdapter instance for 'openai'", () => {
    const adapter: ProviderAdapter | undefined = getAdapter("openai");

    expect(adapter).toBeDefined();
    expect(adapter).toBeInstanceOf(OpenaiAdapter);
  });

  it("returns a MistralAdapter instance for 'mistral'", () => {
    const adapter: ProviderAdapter | undefined = getAdapter("mistral");

    expect(adapter).toBeDefined();
    expect(adapter).toBeInstanceOf(MistralAdapter);
  });

  it("returns undefined for a nonexistent provider", () => {
    const adapter: ProviderAdapter | undefined = getAdapter("nonexistent");

    expect(adapter).toBeUndefined();
  });

  it("returns undefined for an empty string provider name", () => {
    const adapter: ProviderAdapter | undefined = getAdapter("");

    expect(adapter).toBeUndefined();
  });
});
