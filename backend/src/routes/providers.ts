import { Router, Request, Response } from "express";
import { getRegisteredProviders, getPricingData } from "ai-engine";

const pricingData = getPricingData();

const router = Router();

router.get("/providers", (_req: Request, res: Response) => {
  const adapters = getRegisteredProviders();

  const providers = adapters.map((adapter) => {
    const providerPricing = pricingData.providers[adapter.name];

    return {
      name: adapter.name,
      displayName: providerPricing?.displayName ?? adapter.name,
      models: adapter.supportedModels.map((modelId) => {
        const modelPricing = providerPricing?.models[modelId];

        return {
          id: modelId,
          displayName: modelPricing?.displayName ?? modelId,
          inputPerMillion: modelPricing?.inputPerMillion ?? 0,
          outputPerMillion: modelPricing?.outputPerMillion ?? 0,
          description: modelPricing?.description ?? "",
        };
      }),
    };
  });

  res.json({ providers });
});

export { router as providersRouter };
