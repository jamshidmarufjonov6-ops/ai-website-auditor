import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { config } from "./config.js";

const PBKDF2_ITERATIONS = 390_000;
const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const digest = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, "sha256").toString("hex");
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${salt}$${digest}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [, iterations, salt, expected] = stored.split("$");
    const digest = crypto
      .pbkdf2Sync(password, salt, Number(iterations), KEY_LENGTH, "sha256")
      .toString("hex");
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(expected));
  } catch {
    return false;
  }
}

export interface TokenPayload {
  sub: string;
  type: "access";
}

export function createAccessToken(userId: string): string {
  return jwt.sign(
    {
      sub: userId,
      type: "access",
    },
    config.jwtSecret,
    {
      algorithm: "HS256",
      expiresIn: `${config.accessTokenExpireMinutes}m`,
    }
  );
}

export function decodeAccessToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] }) as TokenPayload;
    if (payload.type !== "access" || !payload.sub) return null;
    return payload.sub;
  } catch {
    return null;
  }
}
