import crypto from "crypto";
import jwt from "jsonwebtoken";
import { logger } from "./logger";

const JWT_SECRET = process.env.SESSION_SECRET ?? "dev-secret-change-in-production";
const JWT_EXPIRES_IN = "24h";

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const testHash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(testHash, "hex"));
}

export function signToken(payload: { userId: number; role: string; branchId?: number | null }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): { userId: number; role: string; branchId?: number | null } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; role: string; branchId?: number | null };
    return decoded;
  } catch (err) {
    logger.warn({ err }, "Invalid token");
    return null;
  }
}
