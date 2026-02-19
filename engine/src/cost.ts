import { CostEstimate } from "./types";
import pricingJson from "./pricing.json";

interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

interface ModelEntry {
  displayName: string;
  description: string;
  inputPerMillion: number;
  outputPerMillion: number;
}

interface ProviderEntry {
  displayName: string;
  models: Record<string, ModelEntry>;
}

export interface PricingData {
  lastVerified: string;
  reference: string;
  providers: Record<string, ProviderEntry>;
}

// Build flat lookup table from the central pricing JSON
const PRICING_TABLE: Record<string, ModelPricing> = {};
for (const provider of Object.values(pricingJson.providers)) {
  for (const [modelId, model] of Object.entries(provider.models)) {
    PRICING_TABLE[modelId] = {
      inputPerMillion: model.inputPerMillion,
      outputPerMillion: model.outputPerMillion,
    };
  }
}

export function getPricingData(): PricingData {
  return pricingJson as PricingData;
}

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): CostEstimate {
  const pricing = PRICING_TABLE[model];

  if (!pricing) {
    console.warn(`[cost] No pricing data for model "${model}". Cost estimate will be $0.00.`);
    return {
      inputCost: 0,
      outputCost: 0,
      totalCost: 0,
      currency: "USD",
    };
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;

  return {
    inputCost: parseFloat(inputCost.toFixed(6)),
    outputCost: parseFloat(outputCost.toFixed(6)),
    totalCost: parseFloat((inputCost + outputCost).toFixed(6)),
    currency: "USD",
  };
}
