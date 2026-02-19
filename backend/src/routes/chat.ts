import { Router, Request, Response, NextFunction } from "express";
import { complete, stream, EngineError } from "ai-engine";
import { chatRequestSchema } from "../validation";
import { getDecryptedKey } from "../key-store";
import { ZodError } from "zod";

const router = Router();

router.post("/chat/complete", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = chatRequestSchema.parse(req.body);

    const apiKey = getDecryptedKey(parsed.provider);
    if (!apiKey) {
      res.status(400).json({
        error: {
          code: "NO_API_KEY",
          message: `No API key configured for provider "${parsed.provider}". Add one in Settings.`,
        },
      });
      return;
    }

    const result = await complete({
      provider: parsed.provider,
      model: parsed.model,
      systemMessage: parsed.systemMessage,
      tone: parsed.tone,
      userMessage: parsed.userMessage,
      apiKey,
      config: parsed.config,
      messages: parsed.messages,
    });

    res.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
        },
      });
      return;
    }
    next(error);
  }
});

router.post("/chat/stream", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = chatRequestSchema.parse(req.body);

    const apiKey = getDecryptedKey(parsed.provider);
    if (!apiKey) {
      res.status(400).json({
        error: {
          code: "NO_API_KEY",
          message: `No API key configured for provider "${parsed.provider}". Add one in Settings.`,
        },
      });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    let closed = false;
    res.on("close", () => {
      closed = true;
    });

    const events = stream({
      provider: parsed.provider,
      model: parsed.model,
      systemMessage: parsed.systemMessage,
      tone: parsed.tone,
      userMessage: parsed.userMessage,
      apiKey,
      config: parsed.config,
      messages: parsed.messages,
    });

    for await (const event of events) {
      if (closed) break;
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    if (!closed) {
      res.end();
    }
  } catch (error) {
    if (error instanceof ZodError) {
      if (!res.headersSent) {
        res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
          },
        });
      }
      return;
    }

    if (res.headersSent) {
      const code = error instanceof EngineError ? error.code : "UNKNOWN";
      const message = error instanceof Error ? error.message : "Internal server error";
      const errorEvent = { type: "error", code, message };
      res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
      res.end();
      return;
    }

    next(error);
  }
});

export { router as chatRouter };
