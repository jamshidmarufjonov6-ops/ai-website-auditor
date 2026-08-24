import type { NextFunction, Request, Response } from "express";
import { ObjectId } from "mongodb";
import { collections } from "../db.js";
import { decodeAccessToken } from "../security.js";
import type { UserDoc } from "../db.js";

export interface AuthRequest extends Request {
  user?: UserDoc | null;
  userId?: string;
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  return null;
}

export async function getOptionalUser(req: AuthRequest): Promise<UserDoc | null> {
  const token = extractToken(req);
  if (!token) return null;
  const userId = decodeAccessToken(token);
  if (!userId) return null;
  try {
    return await collections().users.findOne({ _id: new ObjectId(userId) });
  } catch {
    return null;
  }
}

export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    req.user = await getOptionalUser(req);
    req.userId = req.user?._id.toString();
    next();
  } catch (err) {
    next(err);
  }
}

export function requiredAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ detail: "Please log in to continue." });
    return;
  }
  next();
}

export function asyncHandler(
  fn: (req: AuthRequest, res: Response, next: NextFunction) => Promise<unknown> | unknown
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as AuthRequest, res, next)).catch(next);
  };
}
