import Anthropic from "@anthropic-ai/sdk";
import { ConversationMessage, EngineError, EngineRequest, EngineResponse, ProviderAdapter, StreamEvent } from "../types";
import { estimateCost } from "../cost";

export class ClaudeAdapter implements ProviderAdapter {
  readonly name = "claude";
  readonly supportedModels = [
    "claude-opus-4-6",
    "claude-sonnet-4-6",
    "claude-sonnet-4-5-20250929",
    "claude-haiku-4-5-20251001",
  ];

  private buildMessages(request: EngineRequest): Anthropic.MessageParam[] {
    if (request.messages && request.messages.length > 0) {
      return request.messages.map((m) => ({ role: m.role, content: m.content }));
    }
    return [{ role: "user" as const, content: request.userMessage }];
  }

  async complete(request: EngineRequest): Promise<EngineResponse> {
    if (!this.supportedModels.includes(request.model)) {
      throw new EngineError(
        "INVALID_MODEL",
        `Model "${request.model}" is not supported by Claude. Supported: ${this.supportedModels.join(", ")}`,
        this.name
      );
    }

    const client = new Anthropic({ apiKey: request.apiKey });

    const systemParts = [request.systemMessage, request.tone].filter(Boolean);
    const system = systemParts.length > 0 ? systemParts.join("\n\n") : undefined;

    const startTime = performance.now();

    try {
      const message = await client.messages.create({
        model: request.model,
        max_tokens: request.config?.maxTokens ?? 1024,
        ...(request.config?.temperature !== undefined && {
          temperature: request.config.temperature,
        }),
        system,
        messages: this.buildMessages(request),
      });

      const latencyMs = Math.round(performance.now() - startTime);

      const text = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");

      const inputTokens = message.usage.input_tokens;
      const outputTokens = message.usage.output_tokens;

      return {
        text,
        provider: this.name,
        model: request.model,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
        costEstimate: estimateCost(request.model, inputTokens, outputTokens),
        latencyMs,
      };
    } catch (error) {
      if (error instanceof EngineError) throw error;

      if (error instanceof Anthropic.AuthenticationError) {
        throw new EngineError("AUTH_FAILURE", "Invalid Claude API key", this.name, 401);
      }
      if (error instanceof Anthropic.RateLimitError) {
        throw new EngineError("RATE_LIMIT", "Claude API rate limit exceeded", this.name, 429);
      }
      if (error instanceof Anthropic.APIError) {
        throw new EngineError(
          "PROVIDER_ERROR",
          `Claude API error: ${error.message}`,
          this.name,
          error.status
        );
      }

      throw new EngineError(
        "UNKNOWN",
        `Unexpected error calling Claude: ${error instanceof Error ? error.message : String(error)}`,
        this.name
      );
    }
  }

  async *stream(request: EngineRequest): AsyncGenerator<StreamEvent> {
    if (!this.supportedModels.includes(request.model)) {
      throw new EngineError(
        "INVALID_MODEL",
        `Model "${request.model}" is not supported by Claude. Supported: ${this.supportedModels.join(", ")}`,
        this.name
      );
    }

    const client = new Anthropic({ apiKey: request.apiKey });

    const systemParts = [request.systemMessage, request.tone].filter(Boolean);
    const system = systemParts.length > 0 ? systemParts.join("\n\n") : undefined;

    const startTime = performance.now();

    try {
      const stream = client.messages.stream({
        model: request.model,
        max_tokens: request.config?.maxTokens ?? 1024,
        ...(request.config?.temperature !== undefined && {
          temperature: request.config.temperature,
        }),
        system,
        messages: this.buildMessages(request),
      });

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          yield { type: "delta", text: event.delta.text };
        }
      }

      const finalMessage = await stream.finalMessage();
      const latencyMs = Math.round(performance.now() - startTime);
      const inputTokens = finalMessage.usage.input_tokens;
      const outputTokens = finalMessage.usage.output_tokens;

      yield {
        type: "done",
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
        costEstimate: estimateCost(request.model, inputTokens, outputTokens),
        latencyMs,
      };
    } catch (error) {
      if (error instanceof EngineError) throw error;

      if (error instanceof Anthropic.AuthenticationError) {
        throw new EngineError("AUTH_FAILURE", "Invalid Claude API key", this.name, 401);
      }
      if (error instanceof Anthropic.RateLimitError) {
        throw new EngineError("RATE_LIMIT", "Claude API rate limit exceeded", this.name, 429);
      }
      if (error instanceof Anthropic.APIError) {
        throw new EngineError(
          "PROVIDER_ERROR",
          `Claude API error: ${error.message}`,
          this.name,
          error.status
        );
      }

      throw new EngineError(
        "UNKNOWN",
        `Unexpected error streaming Claude: ${error instanceof Error ? error.message : String(error)}`,
        this.name
      );
    }
  }
}
