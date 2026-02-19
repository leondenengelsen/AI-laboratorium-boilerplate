import { describe, it, expect } from "vitest";
import { estimateCost } from "../src/cost";
import type { CostEstimate } from "../src/types";

describe("estimateCost", () => {
  it("returns correct cost for a known model with non-zero tokens", () => {
    // claude-sonnet-4-5-20250929: input $3.0/M, output $15.0/M
    const result: CostEstimate = estimateCost("claude-sonnet-4-5-20250929", 1000, 500);

    // inputCost = (1000 / 1_000_000) * 3.0 = 0.003
    expect(result.inputCost).toBe(0.003);
    // outputCost = (500 / 1_000_000) * 15.0 = 0.0075
    expect(result.outputCost).toBe(0.0075);
    // totalCost = 0.003 + 0.0075 = 0.0105
    expect(result.totalCost).toBe(0.0105);
  });

  it("returns zero costs for an unknown model", () => {
    const result: CostEstimate = estimateCost("unknown-model-xyz", 1000, 500);

    expect(result.inputCost).toBe(0);
    expect(result.outputCost).toBe(0);
    expect(result.totalCost).toBe(0);
  });

  it("returns zero costs when both token counts are zero", () => {
    const result: CostEstimate = estimateCost("claude-sonnet-4-5-20250929", 0, 0);

    expect(result.inputCost).toBe(0);
    expect(result.outputCost).toBe(0);
    expect(result.totalCost).toBe(0);
  });

  it("always returns USD as the currency", () => {
    const knownModel: CostEstimate = estimateCost("claude-sonnet-4-5-20250929", 100, 100);
    const unknownModel: CostEstimate = estimateCost("nonexistent-model", 100, 100);
    const zeroTokens: CostEstimate = estimateCost("claude-sonnet-4-5-20250929", 0, 0);

    expect(knownModel.currency).toBe("USD");
    expect(unknownModel.currency).toBe("USD");
    expect(zeroTokens.currency).toBe("USD");
  });

  it("rounds cost values to 6 decimal places", () => {
    // o4-mini: input $1.10/M, output $4.40/M
    // 7 input tokens: (7 / 1_000_000) * 1.10 = 0.0000077
    // 7 output tokens: (7 / 1_000_000) * 4.40 = 0.0000308
    const result: CostEstimate = estimateCost("o4-mini", 7, 7);

    const inputStr = result.inputCost.toString();
    const outputStr = result.outputCost.toString();
    const totalStr = result.totalCost.toString();

    // Verify the values are numbers (not NaN or Infinity)
    expect(typeof result.inputCost).toBe("number");
    expect(typeof result.outputCost).toBe("number");
    expect(typeof result.totalCost).toBe("number");
    expect(isFinite(result.inputCost)).toBe(true);
    expect(isFinite(result.outputCost)).toBe(true);
    expect(isFinite(result.totalCost)).toBe(true);

    // Verify decimal places are at most 6
    const decimalPlaces = (s: string): number => {
      const parts = s.split(".");
      return parts.length === 2 ? parts[1].length : 0;
    };
    expect(decimalPlaces(inputStr)).toBeLessThanOrEqual(6);
    expect(decimalPlaces(outputStr)).toBeLessThanOrEqual(6);
    expect(decimalPlaces(totalStr)).toBeLessThanOrEqual(6);
  });

  it("calculates correct cost for claude-haiku-4-5-20251001", () => {
    // input $1.0/M, output $5.0/M
    const result: CostEstimate = estimateCost("claude-haiku-4-5-20251001", 2000, 1000);

    // inputCost = (2000 / 1_000_000) * 1.0 = 0.002
    expect(result.inputCost).toBe(0.002);
    // outputCost = (1000 / 1_000_000) * 5.0 = 0.005
    expect(result.outputCost).toBe(0.005);
    // totalCost = 0.002 + 0.005 = 0.007
    expect(result.totalCost).toBe(0.007);
    expect(result.currency).toBe("USD");
  });
});
