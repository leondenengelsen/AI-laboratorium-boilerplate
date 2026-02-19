import OpenAI from "openai";
import { EngineError, EngineRequest, EngineResponse, ProviderAdapter, StreamEvent } from "../types";
import { estimateCost } from "../cost";

const REASONING_MODELS = new Set(["o3", "o4-mini"]);

export class OpenaiAdapter implements ProviderAdapter {
  readonly name = "openai";
  readonly supportedModels = [
    "gpt-5.2",
    "gpt-5-mini",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
    "gpt-4o",
    "o3",
    "o4-mini",
  ];

  private buildMessages(request: EngineRequest): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const systemParts = [request.systemMessage, request.tone].filter(Boolean);
    const systemContent = systemParts.length > 0 ? systemParts.join("\n\n") : undefined;

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    if (systemContent) {
      messages.push({ role: "system", content: systemContent });
    }

    if (request.messages && request.messages.length > 0) {
      for (const m of request.messages) {
        messages.push({ role: m.role, content: m.content });
      }
    } else {
      messages.push({ role: "user", content: request.userMessage });
    }

    return messages;
  }

  async complete(request: EngineRequest): Promise<EngineResponse> {
    if (!this.supportedModels.includes(request.model)) {
      throw new EngineError(
        "INVALID_MODEL",
        `Model "${request.model}" is not supported by OpenAI. Supported: ${this.supportedModels.join(", ")}`,
        this.name
      );
    }

    const client = new OpenAI({ apiKey: request.apiKey });
    const messages = this.buildMessages(request);
    const isReasoning = REASONING_MODELS.has(request.model);

    const startTime = performance.now();

    try {
      const completion = await client.chat.completions.create({
        model: request.model,
        messages,
        ...(!isReasoning && request.config?.temperature !== undefined && {
          temperature: request.config.temperature,
        }),
        ...(request.config?.maxTokens !== undefined && {
          [isReasoning ? "max_completion_tokens" : "max_tokens"]:
            request.config.maxTokens,
        }),
        ...(!request.config?.maxTokens && !isReasoning && {
          max_tokens: 1024,
        }),
      });

      const latencyMs = Math.round(performance.now() - startTime);

      const text = completion.choices[0]?.message?.content ?? "";
      const inputTokens = completion.usage?.prompt_tokens ?? 0;
      const outputTokens = completion.usage?.completion_tokens ?? 0;

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

      if (error instanceof OpenAI.AuthenticationError) {
        throw new EngineError("AUTH_FAILURE", "Invalid OpenAI API key", this.name, 401);
      }
      if (error instanceof OpenAI.RateLimitError) {
        throw new EngineError("RATE_LIMIT", "OpenAI API rate limit exceeded", this.name, 429);
      }
      if (error instanceof OpenAI.APIError) {
        throw new EngineError(
          "PROVIDER_ERROR",
          `OpenAI API error: ${error.message}`,
          this.name,
          error.status
        );
      }

      throw new EngineError(
        "UNKNOWN",
        `Unexpected error calling OpenAI: ${error instanceof Error ? error.message : String(error)}`,
        this.name
      );
    }
  }

  async *stream(request: EngineRequest): AsyncGenerator<StreamEvent> {
    if (!this.supportedModels.includes(request.model)) {
      throw new EngineError(
        "INVALID_MODEL",
        `Model "${request.model}" is not supported by OpenAI. Supported: ${this.supportedModels.join(", ")}`,
        this.name
      );
    }

    const client = new OpenAI({ apiKey: request.apiKey });
    const messages = this.buildMessages(request);
    const isReasoning = REASONING_MODELS.has(request.model);

    const startTime = performance.now();

    try {
      const stream = await client.chat.completions.create({
        model: request.model,
        messages,
        stream: true,
        stream_options: { include_usage: true },
        ...(!isReasoning && request.config?.temperature !== undefined && {
          temperature: request.config.temperature,
        }),
        ...(request.config?.maxTokens !== undefined && {
          [isReasoning ? "max_completion_tokens" : "max_tokens"]:
            request.config.maxTokens,
        }),
        ...(!request.config?.maxTokens && !isReasoning && {
          max_tokens: 1024,
        }),
      });

      let inputTokens = 0;
      let outputTokens = 0;

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield { type: "delta", text: content };
        }

        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens ?? 0;
          outputTokens = chunk.usage.completion_tokens ?? 0;
        }
      }

      const latencyMs = Math.round(performance.now() - startTime);

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

      if (error instanceof OpenAI.AuthenticationError) {
        throw new EngineError("AUTH_FAILURE", "Invalid OpenAI API key", this.name, 401);
      }
      if (error instanceof OpenAI.RateLimitError) {
        throw new EngineError("RATE_LIMIT", "OpenAI API rate limit exceeded", this.name, 429);
      }
      if (error instanceof OpenAI.APIError) {
        throw new EngineError(
          "PROVIDER_ERROR",
          `OpenAI API error: ${error.message}`,
          this.name,
          error.status
        );
      }

      throw new EngineError(
        "UNKNOWN",
        `Unexpected error streaming OpenAI: ${error instanceof Error ? error.message : String(error)}`,
        this.name
      );
    }
  }
}
