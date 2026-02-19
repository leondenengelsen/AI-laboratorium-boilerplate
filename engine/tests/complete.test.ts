import { describe, it, expect, vi, beforeEach } from "vitest";
import { EngineError } from "../src/types";
import type { EngineRequest, EngineResponse, ProviderAdapter } from "../src/types";

// ---------------------------------------------------------------------------
// Mock the registry module before importing index.ts.
// vi.mock is hoisted by vitest to run before imports.
// ---------------------------------------------------------------------------

const mockComplete = vi.fn<(request: EngineRequest) => Promise<EngineResponse>>();

const mockAdapter: ProviderAdapter = {
  name: "mock-provider",
  supportedModels: ["mock-model"],
  complete: mockComplete,
};

vi.mock("../src/registry", () => ({
  getAdapter: vi.fn((name: string): ProviderAdapter | undefined => {
    if (name === "mock-provider") return mockAdapter;
    return undefined;
  }),
  getRegisteredProviders: vi.fn((): ProviderAdapter[] => [mockAdapter]),
}));

// Import after mock is established
import { complete } from "../src/index";
import { getAdapter, getRegisteredProviders } from "../src/registry";

beforeEach(() => {
  vi.clearAllMocks();

  // Re-establish mock implementations after clearAllMocks resets them
  vi.mocked(getAdapter).mockImplementation((name: string): ProviderAdapter | undefined => {
    if (name === "mock-provider") return mockAdapter;
    return undefined;
  });

  vi.mocked(getRegisteredProviders).mockReturnValue([mockAdapter]);
});

const baseRequest: EngineRequest = {
  provider: "mock-provider",
  model: "mock-model",
  systemMessage: "You are a helpful assistant.",
  tone: "neutral",
  userMessage: "Hello",
  apiKey: "test-api-key",
};

describe("complete", () => {
  it("throws EngineError with INVALID_PROVIDER code when provider is not registered", async () => {
    const invalidRequest: EngineRequest = {
      ...baseRequest,
      provider: "does-not-exist",
    };

    try {
      await complete(invalidRequest);
      expect.fail("Expected complete() to throw");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(EngineError);
      if (error instanceof EngineError) {
        expect(error.code).toBe("INVALID_PROVIDER");
      }
    }
  });

  it("includes available providers in the error message for invalid provider", async () => {
    const invalidRequest: EngineRequest = {
      ...baseRequest,
      provider: "does-not-exist",
    };

    try {
      await complete(invalidRequest);
      expect.fail("Expected complete() to throw");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(EngineError);
      if (error instanceof EngineError) {
        expect(error.message).toContain("mock-provider");
      }
    }
  });

  it("delegates to the correct adapter when the provider is registered", async () => {
    const expectedResponse: EngineResponse = {
      text: "Hello from mock adapter",
      provider: "mock-provider",
      model: "mock-model",
      usage: {
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
      },
      costEstimate: {
        inputCost: 0,
        outputCost: 0,
        totalCost: 0,
        currency: "USD",
      },
      latencyMs: 100,
    };

    mockComplete.mockResolvedValueOnce(expectedResponse);

    const result = await complete(baseRequest);

    expect(mockComplete).toHaveBeenCalledOnce();
    expect(mockComplete).toHaveBeenCalledWith(baseRequest);
    expect(result).toEqual(expectedResponse);
  });

  it("propagates EngineErrors thrown by the adapter", async () => {
    const adapterError = new EngineError("RATE_LIMIT", "Rate limit exceeded", "mock-provider", 429);
    mockComplete.mockRejectedValueOnce(adapterError);

    try {
      await complete(baseRequest);
      expect.fail("Expected complete() to throw");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(EngineError);
      if (error instanceof EngineError) {
        expect(error.code).toBe("RATE_LIMIT");
        expect(error.statusCode).toBe(429);
      }
    }
  });
});
