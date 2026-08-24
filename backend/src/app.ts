import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { auditsRouter } from "./routes/audits.js";
import { billingRouter } from "./routes/billing.js";
import { URLValidationError } from "./services/crawler/urlValidator.js";

export const app = express();

app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", app: "AI Website Auditor", environment: process.env.NODE_ENV || "development" });
});

app.use("/api/auth", authRouter);
app.use("/api/audits", auditsRouter);
app.use("/api/billing", billingRouter);

app.use((req: Request, res: Response) => {
  res.status(404).json({ detail: "Not found." });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof URLValidationError) {
    res.status(422).json({ detail: err.safeMessage });
    return;
  }
  const anyErr = err as { message?: string; status?: number };
  console.error("Unhandled API error:", err);
  res.status(anyErr?.status || 500).json({ detail: anyErr?.message || "Something went wrong. Please try again." });
});
