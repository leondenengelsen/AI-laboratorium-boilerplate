import { Content, GoogleGenerativeAI } from "@google/generative-ai";
import { EngineError, EngineRequest, EngineResponse, ProviderAdapter, StreamEvent } from "../types";
import { estimateCost } from "../cost";

export class GeminiAdapter implements ProviderAdapter {
  readonly name = "gemini";
  readonly supportedModels = [
    "gemini-3-pro",
    "gemini-3-flash",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
  ];

  async complete(request: EngineRequest): Promise<EngineResponse> {
    if (!this.supportedModels.includes(request.model)) {
      throw new EngineError(
        "INVALID_MODEL",
        `Model "${request.model}" is not supported by Gemini. Supported: ${this.supportedModels.join(", ")}`,
        this.name
      );
    }

    const genAI = new GoogleGenerativeAI(request.apiKey);
    const systemParts = [request.systemMessage, request.tone].filter(Boolean);
    const systemInstruction = systemParts.length > 0 ? systemParts.join("\n\n") : undefined;
    const model = genAI.getGenerativeModel({
      model: request.model,
      ...(systemInstruction && { systemInstruction }),
      generationConfig: {
        ...(request.config?.temperature !== undefined && {
          temperature: request.config.temperature,
        }),
        ...(request.config?.maxTokens !== undefined && {
          maxOutputTokens: request.config.maxTokens,
        }),
      },
    });

    const startTime = performance.now();

    try {
      let result;
      if (request.messages && request.messages.length > 1) {
        const history: Content[] = request.messages.slice(0, -1).map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));
        const lastMessage = request.messages[request.messages.length - 1].content;
        const chat = model.startChat({ history });
        result = await chat.sendMessage(lastMessage);
      } else {
        const userMsg = request.messages?.[0]?.content ?? request.userMessage;
        result = await model.generateContent(userMsg);
      }
      const latencyMs = Math.round(performance.now() - startTime);

      const response = result.response;
      const text = response.text();
      const usageMetadata = response.usageMetadata;

      const inputTokens = usageMetadata?.promptTokenCount ?? 0;
      const outputTokens = usageMetadata?.candidatesTokenCount ?? 0;

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

      if (message.includes("API_KEY_INVALID") || message.includes("401")) {
        throw new EngineError("AUTH_FAILURE", "Invalid Gemini API key", this.name, 401);
      }
      if (message.includes("429") || message.includes("RATE_LIMIT")) {
        throw new EngineError("RATE_LIMIT", "Gemini API rate limit exceeded", this.name, 429);
      }

      throw new EngineError(
        "PROVIDER_ERROR",
        `Gemini API error: ${message}`,
        this.name
      );
    }
  }

  async *stream(request: EngineRequest): AsyncGenerator<StreamEvent> {
    if (!this.supportedModels.includes(request.model)) {
      throw new EngineError(
        "INVALID_MODEL",
        `Model "${request.model}" is not supported by Gemini. Supported: ${this.supportedModels.join(", ")}`,
        this.name
      );
    }

    const genAI = new GoogleGenerativeAI(request.apiKey);
    const systemParts = [request.systemMessage, request.tone].filter(Boolean);
    const systemInstruction = systemParts.length > 0 ? systemParts.join("\n\n") : undefined;
    const model = genAI.getGenerativeModel({
      model: request.model,
      ...(systemInstruction && { systemInstruction }),
      generationConfig: {
        ...(request.config?.temperature !== undefined && {
          temperature: request.config.temperature,
        }),
        ...(request.config?.maxTokens !== undefined && {
          maxOutputTokens: request.config.maxTokens,
        }),
      },
    });

    const startTime = performance.now();

    try {
      let result;
      if (request.messages && request.messages.length > 1) {
        const history: Content[] = request.messages.slice(0, -1).map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));
        const lastMessage = request.messages[request.messages.length - 1].content;
        const chat = model.startChat({ history });
        result = await chat.sendMessageStream(lastMessage);
      } else {
        const userMsg = request.messages?.[0]?.content ?? request.userMessage;
        result = await model.generateContentStream(userMsg);
      }

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield { type: "delta", text };
        }
      }

      const response = await result.response;
      const latencyMs = Math.round(performance.now() - startTime);
      const usageMetadata = response.usageMetadata;
      const inputTokens = usageMetadata?.promptTokenCount ?? 0;
      const outputTokens = usageMetadata?.candidatesTokenCount ?? 0;

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

      if (message.includes("API_KEY_INVALID") || message.includes("401")) {
        throw new EngineError("AUTH_FAILURE", "Invalid Gemini API key", this.name, 401);
      }
      if (message.includes("429") || message.includes("RATE_LIMIT")) {
        throw new EngineError("RATE_LIMIT", "Gemini API rate limit exceeded", this.name, 429);
      }

      throw new EngineError(
        "PROVIDER_ERROR",
        `Gemini API error: ${message}`,
        this.name
      );
    }
  }
}
