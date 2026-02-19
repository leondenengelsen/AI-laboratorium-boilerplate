import { describe, it, expect, vi, beforeEach } from "vitest";
import { EngineError } from "../../src/types";
import type { EngineRequest } from "../../src/types";

const mistralMocks = {
  chatComplete: vi.fn(),
};

vi.mock("@mistralai/mistralai", () => {
  return {
    Mistral: vi.fn().mockImplementation(() => ({
      chat: {
        complete: mistralMocks.chatComplete,
      },
    })),
  };
});

import { MistralAdapter } from "../../src/providers/mistral-adapter";

beforeEach(() => {
  mistralMocks.chatComplete.mockReset();
});

const baseRequest: EngineRequest = {
  provider: "mistral",
  model: "mistral-large-latest",
  systemMessage: "You are a helpful assistant.",
  tone: "neutral",
  userMessage: "Hello, Mistral!",
  apiKey: "test-mistral-api-key",
};

describe("MistralAdapter", () => {
  describe("static properties", () => {
    it("has the name 'mistral'", () => {
      const adapter = new MistralAdapter();
      expect(adapter.name).toBe("mistral");
    });

    it("supportedModels contains the five expected Mistral models", () => {
      const adapter = new MistralAdapter();
      expect(adapter.supportedModels).toContain("mistral-large-latest");
      expect(adapter.supportedModels).toContain("mistral-medium-latest");
      expect(adapter.supportedModels).toContain("mistral-small-latest");
      expect(adapter.supportedModels).toContain("magistral-medium-latest");
      expect(adapter.supportedModels).toContain("magistral-small-latest");
      expect(adapter.supportedModels).toHaveLength(5);
    });
  });

  describe("complete", () => {
    it("throws EngineError with INVALID_MODEL when given an unsupported model", async () => {
      const adapter = new MistralAdapter();
      const request: EngineRequest = { ...baseRequest, model: "gpt-4" };

      try {
        await adapter.complete(request);
        expect.fail("Expected complete() to throw");
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(EngineError);
        if (error instanceof EngineError) {
          expect(error.code).toBe("INVALID_MODEL");
          expect(error.provider).toBe("mistral");
        }
      }
    });

    it("returns the correct EngineResponse structure on a successful completion", async () => {
      const adapter = new MistralAdapter();

      mistralMocks.chatComplete.mockResolvedValueOnce({
        choices: [{ message: { content: "Hello from Mistral!" } }],
        usage: { promptTokens: 35, completionTokens: 18 },
      });

      const result = await adapter.complete(baseRequest);

      expect(result.text).toBe("Hello from Mistral!");
      expect(result.provider).toBe("mistral");
      expect(result.model).toBe(baseRequest.model);
      expect(result.usage.inputTokens).toBe(35);
      expect(result.usage.outputTokens).toBe(18);
      expect(result.usage.totalTokens).toBe(53);
      expect(result.costEstimate.currency).toBe("USD");
      expect(typeof result.latencyMs).toBe("number");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("defaults to zero tokens when usage is absent", async () => {
      const adapter = new MistralAdapter();

      mistralMocks.chatComplete.mockResolvedValueOnce({
        choices: [{ message: { content: "Response" } }],
        usage: undefined,
      });

      const result = await adapter.complete(baseRequest);

      expect(result.usage.inputTokens).toBe(0);
      expect(result.usage.outputTokens).toBe(0);
      expect(result.usage.totalTokens).toBe(0);
    });

    it("handles non-string content gracefully", async () => {
      const adapter = new MistralAdapter();

      mistralMocks.chatComplete.mockResolvedValueOnce({
        choices: [{ message: { content: [{ type: "text", text: "chunk" }] } }],
        usage: { promptTokens: 10, completionTokens: 5 },
      });

      const result = await adapter.complete(baseRequest);
      expect(result.text).toBe("");
    });

    it("maps 401/Unauthorized error to EngineError with AUTH_FAILURE code", async () => {
      const adapter = new MistralAdapter();
      mistralMocks.chatComplete.mockRejectedValueOnce(
        new Error("HTTP 401 Unauthorized")
      );

      try {
        await adapter.complete(baseRequest);
        expect.fail("Expected complete() to throw");
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(EngineError);
        if (error instanceof EngineError) {
          expect(error.code).toBe("AUTH_FAILURE");
          expect(error.provider).toBe("mistral");
          expect(error.statusCode).toBe(401);
        }
      }
    });

    it("maps a message containing '429' to EngineError with RATE_LIMIT code", async () => {
      const adapter = new MistralAdapter();
      mistralMocks.chatComplete.mockRejectedValueOnce(
        new Error("HTTP 429 Too Many Requests")
      );

      try {
        await adapter.complete(baseRequest);
        expect.fail("Expected complete() to throw");
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(EngineError);
        if (error instanceof EngineError) {
          expect(error.code).toBe("RATE_LIMIT");
          expect(error.provider).toBe("mistral");
          expect(error.statusCode).toBe(429);
        }
      }
    });

    it("maps generic errors to EngineError with PROVIDER_ERROR code", async () => {
      const adapter = new MistralAdapter();
      mistralMocks.chatComplete.mockRejectedValueOnce(
        new Error("Some unexpected provider error")
      );

      try {
        await adapter.complete(baseRequest);
        expect.fail("Expected complete() to throw");
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(EngineError);
        if (error instanceof EngineError) {
          expect(error.code).toBe("PROVIDER_ERROR");
          expect(error.provider).toBe("mistral");
        }
      }
    });
  });
});
