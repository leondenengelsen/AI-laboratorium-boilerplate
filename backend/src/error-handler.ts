import { Request, Response, NextFunction } from "express";
import { EngineError } from "ai-engine";

function mapEngineErrorToStatus(code: string): number {
  switch (code) {
    case "INVALID_PROVIDER":
    case "INVALID_MODEL":
      return 400;
    case "AUTH_FAILURE":
      return 502;
    case "RATE_LIMIT":
      return 429;
    case "PROVIDER_ERROR":
      return 502;
    default:
      return 500;
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof EngineError) {
    const status = mapEngineErrorToStatus(err.code);
    res.status(status).json({
      error: {
        code: err.code,
        message: err.message,
        provider: err.provider,
      },
    });
    return;
  }

  console.error("Unhandled error:", err.message);
  res.status(500).json({
    error: {
      code: "UNKNOWN",
      message: "Internal server error",
    },
  });
}
