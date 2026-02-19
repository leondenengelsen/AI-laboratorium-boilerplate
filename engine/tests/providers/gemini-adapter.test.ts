import { describe, it, expect, vi, beforeEach } from "vitest";
import { EngineError } from "../../src/types";
import type { EngineRequest } from "../../src/types";

// ---------------------------------------------------------------------------
// Mock @google/generative-ai
//
// The GeminiAdapter calls:
//   new GoogleGenerativeAI(apiKey)
//   .getGenerativeModel({ model, ... })
//   .generateContent(userMessage)
//
// We expose mock functions via a module-level object to avoid hoisting
// issues with variables declared outside the vi.mock factory.
// ---------------------------------------------------------------------------

const geminiMocks = {
  generateContent: vi.fn(),
};

vi.mock("@google/generative-ai", () => {
  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
      getGenerativeModel: vi.fn(() => ({
        generateContent: geminiMocks.generateContent,
      })),
    })),
  };
});

import { GeminiAdapter } from "../../src/providers/gemini-adapter";

beforeEach(() => {
  geminiMocks.generateContent.mockReset();
});

const baseRequest: EngineRequest = {
  provider: "gemini",
  model: "gemini-2.0-flash",
  systemMessage: "You are a helpful assistant.",
  tone: "neutral",
  userMessage: "Hello, Gemini!",
  apiKey: "test-gemini-api-key-abc123",
};

describe("GeminiAdapter", () => {
  describe("static properties", () => {
    it("has the name 'gemini'", () => {
      const adapter = new GeminiAdapter();
      expect(adapter.name).toBe("gemini");
    });

    it("supportedModels contains the six expected Gemini models", () => {
      const adapter = new GeminiAdapter();
      expect(adapter.supportedModels).toContain("gemini-3-pro");
      expect(adapter.supportedModels).toContain("gemini-3-flash");
      expect(adapter.supportedModels).toContain("gemini-2.5-pro");
      expect(adapter.supportedModels).toContain("gemini-2.5-flash");
      expect(adapter.supportedModels).toContain("gemini-2.5-flash-lite");
      expect(adapter.supportedModels).toContain("gemini-2.0-flash");
      expect(adapter.supportedModels).toHaveLength(6);
    });
  });

  describe("complete", () => {
    it("throws EngineError with INVALID_MODEL when given an unsupported model", async () => {
      const adapter = new GeminiAdapter();
      const request: EngineRequest = { ...baseRequest, model: "gpt-4" };

      try {
        await adapter.complete(request);
        expect.fail("Expected complete() to throw");
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(EngineError);
        if (error instanceof EngineError) {
          expect(error.code).toBe("INVALID_MODEL");
          expect(error.provider).toBe("gemini");
        }
      }
    });

    it("returns the correct EngineResponse structure on a successful completion", async () => {
      const adapter = new GeminiAdapter();

      geminiMocks.generateContent.mockResolvedValueOnce({
        response: {
          text: () => "Hello from Gemini!",
          usageMetadata: {
            promptTokenCount: 40,
            candidatesTokenCount: 20,
          },
        },
      });

      const result = await adapter.complete(baseRequest);

      expect(result.text).toBe("Hello from Gemini!");
      expect(result.provider).toBe("gemini");
      expect(result.model).toBe(baseRequest.model);
      expect(result.usage.inputTokens).toBe(40);
      expect(result.usage.outputTokens).toBe(20);
      expect(result.usage.totalTokens).toBe(60);
      expect(result.costEstimate.currency).toBe("USD");
      expect(typeof result.latencyMs).toBe("number");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("defaults to zero tokens when usageMetadata is absent", async () => {
      const adapter = new GeminiAdapter();

      geminiMocks.generateContent.mockResolvedValueOnce({
        response: {
          text: () => "Some response",
          usageMetadata: undefined,
        },
      });

      const result = await adapter.complete(baseRequest);

      expect(result.usage.inputTokens).toBe(0);
      expect(result.usage.outputTokens).toBe(0);
      expect(result.usage.totalTokens).toBe(0);
    });

    it("maps API_KEY_INVALID error to EngineError with AUTH_FAILURE code", async () => {
      const adapter = new GeminiAdapter();
      geminiMocks.generateContent.mockRejectedValueOnce(
        new Error("Request failed: API_KEY_INVALID")
      );

      try {
        await adapter.complete(baseRequest);
        expect.fail("Expected complete() to throw");
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(EngineError);
        if (error instanceof EngineError) {
          expect(error.code).toBe("AUTH_FAILURE");
          expect(error.provider).toBe("gemini");
          expect(error.statusCode).toBe(401);
        }
      }
    });

    it("maps a message containing '401' to EngineError with AUTH_FAILURE code", async () => {
      const adapter = new GeminiAdapter();
      geminiMocks.generateContent.mockRejectedValueOnce(
        new Error("HTTP 401 Unauthorized")
      );

      try {
        await adapter.complete(baseRequest);
        expect.fail("Expected complete() to throw");
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(EngineError);
        if (error instanceof EngineError) {
          expect(error.code).toBe("AUTH_FAILURE");
          expect(error.provider).toBe("gemini");
        }
      }
    });

    it("maps a message containing '429' to EngineError with RATE_LIMIT code", async () => {
      const adapter = new GeminiAdapter();
      geminiMocks.generateContent.mockRejectedValueOnce(
        new Error("HTTP 429 Too Many Requests")
      );

      try {
        await adapter.complete(baseRequest);
        expect.fail("Expected complete() to throw");
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(EngineError);
        if (error instanceof EngineError) {
          expect(error.code).toBe("RATE_LIMIT");
          expect(error.provider).toBe("gemini");
          expect(error.statusCode).toBe(429);
        }
      }
    });

    it("maps a message containing 'RATE_LIMIT' to EngineError with RATE_LIMIT code", async () => {
      const adapter = new GeminiAdapter();
      geminiMocks.generateContent.mockRejectedValueOnce(
        new Error("RATE_LIMIT_EXCEEDED")
      );

      try {
        await adapter.complete(baseRequest);
        expect.fail("Expected complete() to throw");
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(EngineError);
        if (error instanceof EngineError) {
          expect(error.code).toBe("RATE_LIMIT");
          expect(error.provider).toBe("gemini");
        }
      }
    });

    it("maps generic errors to EngineError with PROVIDER_ERROR code", async () => {
      const adapter = new GeminiAdapter();
      geminiMocks.generateContent.mockRejectedValueOnce(
        new Error("Some unexpected provider error")
      );

      try {
        await adapter.complete(baseRequest);
        expect.fail("Expected complete() to throw");
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(EngineError);
        if (error instanceof EngineError) {
          expect(error.code).toBe("PROVIDER_ERROR");
          expect(error.provider).toBe("gemini");
        }
      }
    });
  });
});
