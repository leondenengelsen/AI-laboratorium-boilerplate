import { Router, Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { presetRequestSchema } from "../validation";
import { getPresets, savePreset, updatePreset, deletePreset } from "../preset-store";

const router = Router();

// GET /api/presets — List all presets
router.get("/presets", (_req: Request, res: Response, next: NextFunction) => {
  try {
    const presets = getPresets();
    res.json({ presets });
  } catch (error) {
    next(error);
  }
});

// POST /api/presets — Save a new preset
router.post("/presets", (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = presetRequestSchema.parse(req.body);
    const preset = savePreset(parsed);
    res.status(201).json(preset);
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

// PUT /api/presets/:id — Update a preset
router.put("/presets/:id", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params["id"];
    if (!id || typeof id !== "string") {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Preset ID is required",
        },
      });
      return;
    }
    const parsed = presetRequestSchema.parse(req.body);
    const updated = updatePreset(id, parsed);
    if (!updated) {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: `Preset with ID "${id}" not found`,
        },
      });
      return;
    }
    res.json(updated);
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

// DELETE /api/presets/:id — Delete a preset
router.delete("/presets/:id", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params["id"];
    if (!id || typeof id !== "string") {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Preset ID is required",
        },
      });
      return;
    }
    const deleted = deletePreset(id);
    if (!deleted) {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: `Preset with ID "${id}" not found`,
        },
      });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export { router as presetsRouter };
