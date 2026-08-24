import { Router } from "express";
import { ObjectId } from "mongodb";
import { config } from "../config.js";
import { collections } from "../db.js";
import { clientKey } from "../rateLimit.js";
import { authPerMinute } from "../rateLimit.js";
import { createAccessToken, hashPassword, verifyPassword } from "../security.js";
import { asyncHandler, optionalAuth, requiredAuth, type AuthRequest } from "../middleware/auth.js";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function serializeUser(user: { _id: unknown; email: string; createdAt: Date; credits?: number | null }) {
  return {
    id: String(user._id),
    email: user.email,
    created_at: user.createdAt,
    credits: user.credits ?? config.freeCredits,
    is_admin: Boolean(config.adminEmail) && user.email.toLowerCase() === config.adminEmail,
  };
}

function validateEmail(value: string): string | null {
  const email = (value || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 320) return "Please enter a valid email address.";
  return email;
}

export const authRouter = Router();

authRouter.use(optionalAuth);

authRouter.post(
  "/register",
  asyncHandler(async (req: AuthRequest, res) => {
    if (!authPerMinute.allow(clientKey(req))) {
      res.status(429).json({ detail: "Too many attempts. Please wait a minute and try again." });
      return;
    }
    const { email: rawEmail, password } = req.body || {};
    const email = validateEmail(rawEmail);
    if (!email) {
      res.status(422).json({ detail: "Please enter a valid email address." });
      return;
    }
    if (typeof password !== "string" || password.length < 8 || password.length > 128) {
      res.status(422).json({ detail: "Password must be between 8 and 128 characters." });
      return;
    }

    const existing = await collections().users.findOne({ email });
    if (existing) {
      res.status(409).json({ detail: "An account with this email already exists." });
      return;
    }

    const user = {
      _id: new ObjectId(),
      email,
      passwordHash: hashPassword(password),
      createdAt: new Date(),
      credits: config.freeCredits,
    };
    const result = await collections().users.insertOne(user);
    const token = createAccessToken(result.insertedId.toString());
    res.status(201).json({
      user: serializeUser({ _id: result.insertedId, email, createdAt: user.createdAt, credits: user.credits }),
      token,
    });
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req: AuthRequest, res) => {
    if (!authPerMinute.allow(clientKey(req))) {
      res.status(429).json({ detail: "Too many attempts. Please wait a minute and try again." });
      return;
    }
    const { email: rawEmail, password } = req.body || {};
    const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
    const user = await collections().users.findOne({ email });
    if (!user || !verifyPassword(String(password || ""), user.passwordHash)) {
      res.status(401).json({ detail: "Incorrect email or password." });
      return;
    }
    const token = createAccessToken(user._id.toString());
    res.json({ user: serializeUser(user), token });
  })
);

authRouter.post("/logout", (_req, res) => {
  res.json({ ok: true });
});

authRouter.get(
  "/me",
  requiredAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(serializeUser(req.user!));
  })
);
