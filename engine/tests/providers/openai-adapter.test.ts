import { describe, it, expect, vi, beforeEach } from "vitest";
import { EngineError } from "../../src/types";
import type { EngineRequest } from "../../src/types";

const { openaiMocks, MockAPIError, MockAuthenticationError, MockRateLimitError } = vi.hoisted(
  () => {
    class _MockAPIError extends Error {
      status: number;
      constructor(message: string, status: number) {
        super(message);
        this.name = "APIError";
        this.status = status;
      }
    }

    class _MockAuthenticationError extends _MockAPIError {
      constructor(message: string) {
        super(message, 401);
        this.name = "AuthenticationError";
      }
    }

    class _MockRateLimitError extends _MockAPIError {
      constructor(message: string) {
        super(message, 429);
        this.name = "RateLimitError";
      }
    }

    return {
      openaiMocks: { completionsCreate: vi.fn() },
      MockAPIError: _MockAPIError,
      MockAuthenticationError: _MockAuthenticationError,
      MockRateLimitError: _MockRateLimitError,
    };
  }
);

vi.mock("openai", () => {
  const OpenAIConstructor = vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: openaiMocks.completionsCreate,
      },
    },
  }));

  OpenAIConstructor.AuthenticationError = MockAuthenticationError;
  OpenAIConstructor.RateLimitError = MockRateLimitError;
  OpenAIConstructor.APIError = MockAPIError;

  return { default: OpenAIConstructor };
});

import { OpenaiAdapter } from "../../src/providers/openai-adapter";

beforeEach(() => {
  openaiMocks.completionsCreate.mockReset();
});

const baseRequest: EngineRequest = {
  provider: "openai",
  model: "gpt-4.1",
  systemMessage: "You are a helpful assistant.",
  tone: "neutral",
  userMessage: "Hello, OpenAI!",
  apiKey: "test-api-key-sk-123",
};

describe("OpenaiAdapter", () => {
  describe("static properties", () => {
    it("has the name 'openai'", () => {
      const adapter = new OpenaiAdapter();
      expect(adapter.name).toBe("openai");
    });

    it("supportedModels contains the eight expected OpenAI models", () => {
      const adapter = new OpenaiAdapter();
      expect(adapter.supportedModels).toContain("gpt-5.2");
      expect(adapter.supportedModels).toContain("gpt-5-mini");
      expect(adapter.supportedModels).toContain("gpt-4.1");
      expect(adapter.supportedModels).toContain("gpt-4.1-mini");
      expect(adapter.supportedModels).toContain("gpt-4.1-nano");
      expect(adapter.supportedModels).toContain("gpt-4o");
      expect(adapter.supportedModels).toContain("o3");
      expect(adapter.supportedModels).toContain("o4-mini");
      expect(adapter.supportedModels).toHaveLength(8);
    });
  });

  describe("complete", () => {
    it("throws EngineError with INVALID_MODEL when given an unsupported model", async () => {
      const adapter = new OpenaiAdapter();
      const request: EngineRequest = { ...baseRequest, model: "claude-opus-4-6" };

      try {
        await adapter.complete(request);
        expect.fail("Expected complete() to throw");
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(EngineError);
        if (error instanceof EngineError) {
          expect(error.code).toBe("INVALID_MODEL");
          expect(error.provider).toBe("openai");
        }
      }
    });

    it("returns the correct EngineResponse structure on a successful completion", async () => {
      const adapter = new OpenaiAdapter();

      openaiMocks.completionsCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "Hello from OpenAI!" } }],
        usage: { prompt_tokens: 40, completion_tokens: 20 },
      });

      const result = await adapter.complete(baseRequest);

      expect(result.text).toBe("Hello from OpenAI!");
      expect(result.provider).toBe("openai");
      expect(result.model).toBe(baseRequest.model);
      expect(result.usage.inputTokens).toBe(40);
      expect(result.usage.outputTokens).toBe(20);
      expect(result.usage.totalTokens).toBe(60);
      expect(result.costEstimate.currency).toBe("USD");
      expect(typeof result.latencyMs).toBe("number");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("handles empty choices gracefully", async () => {
      const adapter = new OpenaiAdapter();

      openaiMocks.completionsCreate.mockResolvedValueOnce({
        choices: [],
        usage: { prompt_tokens: 10, completion_tokens: 0 },
      });

      const result = await adapter.complete(baseRequest);
      expect(result.text).toBe("");
    });

    it("does not send temperature for reasoning models (o3)", async () => {
      const adapter = new OpenaiAdapter();

      openaiMocks.completionsCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "Reasoning response" } }],
        usage: { prompt_tokens: 30, completion_tokens: 15 },
      });

      const request: EngineRequest = {
        ...baseRequest,
        model: "o3",
        config: { temperature: 0.7 },
      };
      await adapter.complete(request);

      const callArgs = openaiMocks.completionsCreate.mock.calls[0][0];
      expect(callArgs.temperature).toBeUndefined();
    });

    it("uses max_completion_tokens for reasoning models instead of max_tokens", async () => {
      const adapter = new OpenaiAdapter();

      openaiMocks.completionsCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "Response" } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });

      const request: EngineRequest = {
        ...baseRequest,
        model: "o4-mini",
        config: { maxTokens: 2048 },
      };
      await adapter.complete(request);

      const callArgs = openaiMocks.completionsCreate.mock.calls[0][0];
      expect(callArgs.max_completion_tokens).toBe(2048);
      expect(callArgs.max_tokens).toBeUndefined();
    });

    it("maps AuthenticationError to EngineError with AUTH_FAILURE code", async () => {
      const adapter = new OpenaiAdapter();
      openaiMocks.completionsCreate.mockRejectedValueOnce(
        new MockAuthenticationError("Invalid API key")
      );

      try {
        await adapter.complete(baseRequest);
        expect.fail("Expected complete() to throw");
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(EngineError);
        if (error instanceof EngineError) {
          expect(error.code).toBe("AUTH_FAILURE");
          expect(error.provider).toBe("openai");
          expect(error.statusCode).toBe(401);
        }
      }
    });

    it("maps RateLimitError to EngineError with RATE_LIMIT code", async () => {
      const adapter = new OpenaiAdapter();
      openaiMocks.completionsCreate.mockRejectedValueOnce(
        new MockRateLimitError("Rate limit exceeded")
      );

      try {
        await adapter.complete(baseRequest);
        expect.fail("Expected complete() to throw");
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(EngineError);
        if (error instanceof EngineError) {
          expect(error.code).toBe("RATE_LIMIT");
          expect(error.provider).toBe("openai");
          expect(error.statusCode).toBe(429);
        }
      }
    });

    it("maps generic APIError to EngineError with PROVIDER_ERROR code", async () => {
      const adapter = new OpenaiAdapter();
      openaiMocks.completionsCreate.mockRejectedValueOnce(
        new MockAPIError("Internal server error", 500)
      );

      try {
        await adapter.complete(baseRequest);
        expect.fail("Expected complete() to throw");
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(EngineError);
        if (error instanceof EngineError) {
          expect(error.code).toBe("PROVIDER_ERROR");
          expect(error.provider).toBe("openai");
          expect(error.statusCode).toBe(500);
        }
      }
    });

    it("maps unexpected non-API errors to EngineError with UNKNOWN code", async () => {
      const adapter = new OpenaiAdapter();
      openaiMocks.completionsCreate.mockRejectedValueOnce(new Error("Network failure"));

      try {
        await adapter.complete(baseRequest);
        expect.fail("Expected complete() to throw");
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(EngineError);
        if (error instanceof EngineError) {
          expect(error.code).toBe("UNKNOWN");
          expect(error.provider).toBe("openai");
        }
      }
    });
  });
});
