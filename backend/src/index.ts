import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { healthRouter } from "./routes/health";
import { providersRouter } from "./routes/providers";
import { chatRouter } from "./routes/chat";
import { keysRouter } from "./routes/keys";
import { presetsRouter } from "./routes/presets";
import { errorHandler } from "./error-handler";
import { validateEncryptionKey } from "./crypto";
import { loadKeys } from "./key-store";

// Validate configuration on startup — fail fast if ENCRYPTION_KEY is missing or malformed
validateEncryptionKey();

// Load and decrypt all stored API keys into memory
loadKeys();

const app = express();
const port = process.env["PORT"] ?? 3000;
const host = process.env["HOST"] ?? "127.0.0.1";
const frontendOrigin = process.env["FRONTEND_ORIGIN"] ?? "http://localhost:4200";

app.use(cors({ origin: frontendOrigin }));
app.use(express.json({ limit: "100kb" }));

// Global rate limit: 100 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
app.use("/api", globalLimiter);

// Stricter limit for chat endpoint: 20 requests per minute per IP
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many chat requests, please slow down." },
});
app.use("/api/chat", chatLimiter);

app.use("/api", healthRouter);
app.use("/api", providersRouter);
app.use("/api", chatRouter);
app.use("/api", keysRouter);
app.use("/api", presetsRouter);

app.use(errorHandler);

app.listen(Number(port), host, () => {
  console.log(`AI Lab backend running on http://${host}:${port}`);
});
