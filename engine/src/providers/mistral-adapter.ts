import { Mistral } from "@mistralai/mistralai";
import { EngineError, EngineRequest, EngineResponse, ProviderAdapter, StreamEvent } from "../types";
import { estimateCost } from "../cost";

export class MistralAdapter implements ProviderAdapter {
  readonly name = "mistral";
  readonly supportedModels = [
    "mistral-large-latest",
    "mistral-medium-latest",
    "mistral-small-latest",
    "magistral-medium-latest",
    "magistral-small-latest",
  ];

  private buildMessages(request: EngineRequest): Array<{ role: "system" | "user" | "assistant"; content: string }> {
    const systemParts = [request.systemMessage, request.tone].filter(Boolean);
    const systemContent = systemParts.length > 0 ? systemParts.join("\n\n") : undefined;

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
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
        `Model "${request.model}" is not supported by Mistral. Supported: ${this.supportedModels.join(", ")}`,
        this.name
      );
    }

    const client = new Mistral({ apiKey: request.apiKey });
    const messages = this.buildMessages(request);

    const startTime = performance.now();

    try {
      const result = await client.chat.complete({
        model: request.model,
        messages,
        ...(request.config?.temperature !== undefined && {
          temperature: request.config.temperature,
        }),
        ...(request.config?.maxTokens !== undefined && {
          maxTokens: request.config.maxTokens,
        }),
      });

      const latencyMs = Math.round(performance.now() - startTime);

      const rawContent = result.choices?.[0]?.message?.content;
      const text = typeof rawContent === "string" ? rawContent : "";
      const inputTokens = result.usage?.promptTokens ?? 0;
      const outputTokens = result.usage?.completionTokens ?? 0;

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

      const message = error instanceof Error ? error.message : String(error);

      if (message.includes("401") || message.includes("Unauthorized") || message.includes("authentication")) {
        throw new EngineError("AUTH_FAILURE", "Invalid Mistral API key", this.name, 401);
      }
      if (message.includes("429") || message.includes("rate limit") || message.includes("Rate limit")) {
        throw new EngineError("RATE_LIMIT", "Mistral API rate limit exceeded", this.name, 429);
      }

      throw new EngineError(
        "PROVIDER_ERROR",
        `Mistral API error: ${message}`,
        this.name
      );
    }
  }

  async *stream(request: EngineRequest): AsyncGenerator<StreamEvent> {
    if (!this.supportedModels.includes(request.model)) {
      throw new EngineError(
        "INVALID_MODEL",
        `Model "${request.model}" is not supported by Mistral. Supported: ${this.supportedModels.join(", ")}`,
        this.name
      );
    }

    const client = new Mistral({ apiKey: request.apiKey });
    const messages = this.buildMessages(request);

    const startTime = performance.now();

    try {
      const stream = await client.chat.stream({
        model: request.model,
        messages,
        ...(request.config?.temperature !== undefined && {
          temperature: request.config.temperature,
        }),
        ...(request.config?.maxTokens !== undefined && {
          maxTokens: request.config.maxTokens,
        }),
      });

      let inputTokens = 0;
      let outputTokens = 0;

      for await (const event of stream) {
        const content = event.data.choices[0]?.delta?.content;
        if (typeof content === "string" && content) {
          yield { type: "delta", text: content };
        }

        if (event.data.usage) {
          inputTokens = event.data.usage.promptTokens ?? 0;
          outputTokens = event.data.usage.completionTokens ?? 0;
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

      const message = error instanceof Error ? error.message : String(error);

      if (message.includes("401") || message.includes("Unauthorized") || message.includes("authentication")) {
        throw new EngineError("AUTH_FAILURE", "Invalid Mistral API key", this.name, 401);
      }
      if (message.includes("429") || message.includes("rate limit") || message.includes("Rate limit")) {
        throw new EngineError("RATE_LIMIT", "Mistral API rate limit exceeded", this.name, 429);
      }

      throw new EngineError(
        "PROVIDER_ERROR",
        `Mistral API error: ${message}`,
        this.name
      );
    }
  }
}
