/**
 * offline-auth.ts
 * Stores and verifies user credentials locally so login works without network.
 * Uses PBKDF2 via Web Crypto API — the raw password is never stored.
 */
import { localDb } from "./local-db";

const ITERATIONS = 100_000;
const HASH_ALGO  = "SHA-256";

/* ── Crypto helpers ── */
async function deriveKey(password: string, salt: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: HASH_ALGO },
    keyMaterial,
    256,
  );
  return Array.from(new Uint8Array(bits))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

function saltFromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function saltToHex(salt: Uint8Array): string {
  return Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("");
}

/* ── Public API ── */

/**
 * Call this after a successful online login.
 * Stores a hashed credential so the user can log in offline later.
 */
export async function storeOfflineSession(
  username: string,
  password: string,
  sessionData: {
    token: string;
    user: unknown;
    company?: unknown;
  },
): Promise<void> {
  try {
    const salt       = randomSalt();
    const saltHex    = saltToHex(salt);
    const passwordHash = await deriveKey(password, salt);

    // Remove any existing session for this username
    const existing = await localDb.offlineSessions
      .where("username").equalsIgnoreCase(username.trim().toLowerCase())
      .toArray();
    if (existing.length) {
      await localDb.offlineSessions.bulkDelete(existing.map(s => s.id!));
    }

    await localDb.offlineSessions.add({
      username:  username.trim().toLowerCase(),
      passwordHash,
      salt:      saltHex,
      userData:  JSON.stringify(sessionData),
      savedAt:   Date.now(),
    });
  } catch {
    // Silently fail — offline login is a bonus, not a blocker
  }
}

/**
 * Attempt an offline login.
 * Returns parsed session data on success, or null on failure.
 */
export async function verifyOfflineLogin(
  username: string,
  password: string,
): Promise<{ token: string; user: unknown; company?: unknown } | null> {
  try {
    const sessions = await localDb.offlineSessions
      .where("username").equalsIgnoreCase(username.trim().toLowerCase())
      .toArray();

    if (!sessions.length) return null;

    // Use the most recent session
    const session = sessions.sort((a, b) => b.savedAt - a.savedAt)[0];
    const salt    = saltFromHex(session.salt);
    const hash    = await deriveKey(password, salt);

    if (hash !== session.passwordHash) return null;

    return JSON.parse(session.userData);
  } catch {
    return null;
  }
}

/**
 * Check whether an offline session exists for a username.
 */
export async function hasOfflineSession(username: string): Promise<boolean> {
  try {
    const count = await localDb.offlineSessions
      .where("username").equalsIgnoreCase(username.trim().toLowerCase())
      .count();
    return count > 0;
  } catch {
    return false;
  }
}

/**
 * Remove all offline sessions (on explicit logout).
 */
export async function clearOfflineSessions(): Promise<void> {
  try {
    await localDb.offlineSessions.clear();
  } catch { /* ignore */ }
}
