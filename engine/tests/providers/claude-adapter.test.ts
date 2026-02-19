import { describe, it, expect, vi, beforeEach } from "vitest";
import { EngineError } from "../../src/types";
import type { EngineRequest } from "../../src/types";

// ---------------------------------------------------------------------------
// Mock @anthropic-ai/sdk
//
// vi.mock() is hoisted by vitest. We use vi.hoisted() to co-hoist the mock
// classes and functions so they are available when the factory executes.
// ---------------------------------------------------------------------------

const { anthropicMocks, MockAPIError, MockAuthenticationError, MockRateLimitError } = vi.hoisted(() => {
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
    anthropicMocks: { messagesCreate: vi.fn() },
    MockAPIError: _MockAPIError,
    MockAuthenticationError: _MockAuthenticationError,
    MockRateLimitError: _MockRateLimitError,
  };
});

vi.mock("@anthropic-ai/sdk", () => {
  const AnthropicConstructor = vi.fn().mockImplementation(() => ({
    messages: {
      create: anthropicMocks.messagesCreate,
    },
  }));

  AnthropicConstructor.AuthenticationError = MockAuthenticationError;
  AnthropicConstructor.RateLimitError = MockRateLimitError;
  AnthropicConstructor.APIError = MockAPIError;

  return { default: AnthropicConstructor };
});

import { ClaudeAdapter } from "../../src/providers/claude-adapter";

beforeEach(() => {
  anthropicMocks.messagesCreate.mockReset();
});

const baseRequest: EngineRequest = {
  provider: "claude",
  model: "claude-sonnet-4-5-20250929",
  systemMessage: "You are a helpful assistant.",
  tone: "neutral",
  userMessage: "Hello, Claude!",
  apiKey: "test-api-key-sk-ant-123",
};

describe("ClaudeAdapter", () => {
  describe("static properties", () => {
    it("has the name 'claude'", () => {
      const adapter = new ClaudeAdapter();
      expect(adapter.name).toBe("claude");
    });

    it("supportedModels contains the four expected Claude models", () => {
      const adapter = new ClaudeAdapter();
      expect(adapter.supportedModels).toContain("claude-opus-4-6");
      expect(adapter.supportedModels).toContain("claude-sonnet-4-6");
      expect(adapter.supportedModels).toContain("claude-sonnet-4-5-20250929");
      expect(adapter.supportedModels).toContain("claude-haiku-4-5-20251001");
      expect(adapter.supportedModels).toHaveLength(4);
    });
  });

  describe("complete", () => {
    it("throws EngineError with INVALID_MODEL when given an unsupported model", async () => {
      const adapter = new ClaudeAdapter();
      const request: EngineRequest = { ...baseRequest, model: "gpt-4" };

      try {
        await adapter.complete(request);
        expect.fail("Expected complete() to throw");
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(EngineError);
        if (error instanceof EngineError) {
          expect(error.code).toBe("INVALID_MODEL");
          expect(error.provider).toBe("claude");
        }
      }
    });

    it("returns the correct EngineResponse structure on a successful completion", async () => {
      const adapter = new ClaudeAdapter();

      anthropicMocks.messagesCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: "Hello! How can I help?" }],
        usage: {
          input_tokens: 50,
          output_tokens: 25,
        },
      });

      const result = await adapter.complete(baseRequest);

      expect(result.text).toBe("Hello! How can I help?");
      expect(result.provider).toBe("claude");
      expect(result.model).toBe(baseRequest.model);
      expect(result.usage.inputTokens).toBe(50);
      expect(result.usage.outputTokens).toBe(25);
      expect(result.usage.totalTokens).toBe(75);
      expect(result.costEstimate.currency).toBe("USD");
      expect(typeof result.latencyMs).toBe("number");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("concatenates multiple text blocks in the response", async () => {
      const adapter = new ClaudeAdapter();

      anthropicMocks.messagesCreate.mockResolvedValueOnce({
        content: [
          { type: "text", text: "Part one. " },
          { type: "text", text: "Part two." },
        ],
        usage: {
          input_tokens: 10,
          output_tokens: 5,
        },
      });

      const result = await adapter.complete(baseRequest);
      expect(result.text).toBe("Part one. Part two.");
    });

    it("maps AuthenticationError to EngineError with AUTH_FAILURE code", async () => {
      const adapter = new ClaudeAdapter();
      anthropicMocks.messagesCreate.mockRejectedValueOnce(
        new MockAuthenticationError("Invalid API key")
      );

      try {
        await adapter.complete(baseRequest);
        expect.fail("Expected complete() to throw");
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(EngineError);
        if (error instanceof EngineError) {
          expect(error.code).toBe("AUTH_FAILURE");
          expect(error.provider).toBe("claude");
          expect(error.statusCode).toBe(401);
        }
      }
    });

    it("maps RateLimitError to EngineError with RATE_LIMIT code", async () => {
      const adapter = new ClaudeAdapter();
      anthropicMocks.messagesCreate.mockRejectedValueOnce(
        new MockRateLimitError("Rate limit exceeded")
      );

      try {
        await adapter.complete(baseRequest);
        expect.fail("Expected complete() to throw");
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(EngineError);
        if (error instanceof EngineError) {
          expect(error.code).toBe("RATE_LIMIT");
          expect(error.provider).toBe("claude");
          expect(error.statusCode).toBe(429);
        }
      }
    });

    it("maps generic APIError to EngineError with PROVIDER_ERROR code", async () => {
      const adapter = new ClaudeAdapter();
      anthropicMocks.messagesCreate.mockRejectedValueOnce(
        new MockAPIError("Internal server error", 500)
      );

      try {
        await adapter.complete(baseRequest);
        expect.fail("Expected complete() to throw");
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(EngineError);
        if (error instanceof EngineError) {
          expect(error.code).toBe("PROVIDER_ERROR");
          expect(error.provider).toBe("claude");
          expect(error.statusCode).toBe(500);
        }
      }
    });

    it("maps unexpected non-API errors to EngineError with UNKNOWN code", async () => {
      const adapter = new ClaudeAdapter();
      anthropicMocks.messagesCreate.mockRejectedValueOnce(new Error("Network failure"));

      try {
        await adapter.complete(baseRequest);
        expect.fail("Expected complete() to throw");
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(EngineError);
        if (error instanceof EngineError) {
          expect(error.code).toBe("UNKNOWN");
          expect(error.provider).toBe("claude");
        }
      }
    });
  });
});
