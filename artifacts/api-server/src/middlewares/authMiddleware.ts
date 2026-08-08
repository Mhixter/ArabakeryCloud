import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/auth";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    role: string;
    branchId?: number | null;
    companyId: number;
  };
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  req.user = payload;
  next();
}

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimitByUser(windowMs = 60_000, maxRequests = 60) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const keyBase = req.user?.userId ? `user:${req.user.userId}` : `ip:${req.ip}`;
    const key = `${keyBase}:${req.path}`;
    const now = Date.now();
    const existing = rateLimitBuckets.get(key);

    if (!existing || existing.resetAt <= now) {
      rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (existing.count >= maxRequests) {
      res.status(429).json({ error: "Too many requests. Please try again shortly." });
      return;
    }

    existing.count += 1;
    rateLimitBuckets.set(key, existing);
    next();
  };
}
