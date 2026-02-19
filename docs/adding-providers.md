# Adding a New AI Provider

This guide walks through adding a new provider to AI Lab. You'll touch three files in the engine — that's it. The backend and frontend pick up your changes automatically.

---

## Overview

Adding a provider means:

1. Install the provider's SDK
2. Write an adapter (one file)
3. Add pricing data to `pricing.json`
4. Register the adapter in `registry.ts`
5. Test

No backend or frontend changes are needed. Display names come from `pricing.json`, key management works automatically, and the Settings UI picks up new providers from the API.

---

## Step 1: Install the provider's SDK

In the `engine/` directory:

```bash
cd engine
npm install @provider/sdk
```

---

## Step 2: Create the adapter

Create a new file at `engine/src/providers/<provider-name>-adapter.ts`.

Every adapter implements the `ProviderAdapter` interface:

```typescript
import { EngineError, EngineRequest, EngineResponse, ProviderAdapter } from "../types";
import { estimateCost } from "../cost";

export class ExampleAdapter implements ProviderAdapter {
  readonly name = "example";
  readonly supportedModels = [
    "example-model-large",
    "example-model-small",
  ];

  async complete(request: EngineRequest): Promise<EngineResponse> {
    // 1. Validate model
    if (!this.supportedModels.includes(request.model)) {
      throw new EngineError(
        "INVALID_MODEL",
        `Model "${request.model}" is not supported by Example. Supported: ${this.supportedModels.join(", ")}`,
        this.name
      );
    }

    // 2. Initialize the provider SDK with the API key
    // const client = new ExampleSDK({ apiKey: request.apiKey });

    // 3. Start timing
    const startTime = performance.now();

    try {
      // 4. Make the API call, translating our format to the provider's format
      // const result = await client.chat({
      //   model: request.model,
      //   system: request.systemMessage,
      //   messages: [{ role: "user", content: request.userMessage }],
      //   temperature: request.config?.temperature,
      //   max_tokens: request.config?.maxTokens,
      // });

      const latencyMs = Math.round(performance.now() - startTime);

      // 5. Extract token usage from the provider's response
      // const inputTokens = result.usage.input_tokens;
      // const outputTokens = result.usage.output_tokens;

      // 6. Return standardized response
      return {
        text: "", // result.content
        provider: this.name,
        model: request.model,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        },
        costEstimate: estimateCost(request.model, 0, 0),
        latencyMs,
      };
    } catch (error) {
      if (error instanceof EngineError) throw error;

      const message = error instanceof Error ? error.message : String(error);

      // 7. Map provider-specific errors to EngineError codes
      if (message.includes("401") || message.includes("invalid_api_key")) {
        throw new EngineError("AUTH_FAILURE", "Invalid Example API key", this.name, 401);
      }
      if (message.includes("429") || message.includes("rate_limit")) {
        throw new EngineError("RATE_LIMIT", "Example API rate limit exceeded", this.name, 429);
      }

      throw new EngineError("PROVIDER_ERROR", `Example API error: ${message}`, this.name);
    }
  }
}
```

The adapter's job:
- Validate the model is supported
- Initialize the SDK with `request.apiKey` (never from env)
- Translate `EngineRequest` into the provider's API format
- Measure latency with `performance.now()`
- Extract token counts from the provider's response
- Return an `EngineResponse` with all fields populated
- Map provider errors to `EngineError` codes

---

## Step 3: Add pricing and model metadata

In `engine/src/pricing.json`, add a new provider entry (or add models to an existing provider):

```json
{
  "providers": {
    "example": {
      "displayName": "Example AI",
      "models": {
        "example-model-large": {
          "displayName": "Example Large",
          "description": "Most powerful Example model. Complex reasoning.",
          "inputPerMillion": 5.0,
          "outputPerMillion": 15.0
        },
        "example-model-small": {
          "displayName": "Example Small",
          "description": "Fast, cost-efficient model.",
          "inputPerMillion": 0.5,
          "outputPerMillion": 1.5
        }
      }
    }
  }
}
```

Prices are in USD per million tokens. Check the provider's pricing page for current rates. You can cross-reference with [LiteLLM's pricing JSON](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json) (note: LiteLLM uses per-token, multiply by 1,000,000 to convert to per-million). Update the `lastVerified` date at the top of the file.

The `displayName` and `description` fields are what appear in the frontend. The backend reads them directly from this file — no separate config needed.

---

## Step 4: Register the adapter

In `engine/src/registry.ts`, import and register:

```typescript
import { ExampleAdapter } from "./providers/example-adapter";

// At the bottom, with the other register() calls:
register(new ExampleAdapter());
```

Once registered, the backend and frontend pick up the new provider automatically:
- The `/api/providers` endpoint merges adapter data with pricing data and serves it to the frontend
- The Settings UI builds its provider list from that endpoint — your provider will appear there
- Key lookup matches on the `name` property from your adapter, so saving a key through Settings just works

---

## Step 5: Test

1. Rebuild the engine: `cd engine && npm run build && cd ..`
2. Start the app: `npm run dev`
3. Open the Settings panel and paste your API key for the new provider
4. Select the new provider in the chat UI and send a test message
5. Verify the response includes correct token counts and cost estimate

---

## Checklist

- [ ] Adapter implements `ProviderAdapter` interface
- [ ] All supported models listed in `supportedModels`
- [ ] Pricing, display names, and descriptions added in `pricing.json`
- [ ] `lastVerified` date updated in `pricing.json`
- [ ] Adapter registered in `registry.ts`
- [ ] Tested with a real API key saved via the UI
