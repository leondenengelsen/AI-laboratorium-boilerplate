import { Router, Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { saveKeySchema } from "../validation";
import { saveKey, getKeys, deleteKey } from "../key-store";

const router = Router();

// POST /api/keys — Save a new encrypted API key
router.post("/keys", (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = saveKeySchema.parse(req.body);
    const keyRef = saveKey(parsed.provider, parsed.label, parsed.key);
    res.status(201).json(keyRef);
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

// GET /api/keys — List saved key references (no raw or encrypted keys)
router.get("/keys", (_req: Request, res: Response, next: NextFunction) => {
  try {
    const keys = getKeys();
    res.json({ keys });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/keys/:id — Delete a saved key
router.delete("/keys/:id", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params["id"];
    if (!id || typeof id !== "string") {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Key ID is required",
        },
      });
      return;
    }
    const deleted = deleteKey(id);
    if (!deleted) {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: `Key with ID "${id}" not found`,
        },
      });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export { router as keysRouter };
