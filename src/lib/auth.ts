import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

const SESSION_SECRET = process.env.SESSION_SECRET || "argons-daily-brief-local-secret-key-32-chars";
const ENCRYPTION_KEY = crypto.scryptSync(SESSION_SECRET, "salt", 32);
const IV_LENGTH = 12; // For AES-GCM

// Password Hashing
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return hash === verifyHash;
}

// Session Token Encryption
export function encryptSession(data: { id: string; email: string }): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${encrypted.toString("hex")}:${tag.toString("hex")}`;
}

export function decryptSession(token: string): { id: string; email: string } | null {
  try {
    const [ivHex, encryptedHex, tagHex] = token.split(":");
    if (!ivHex || !encryptedHex || !tagHex) return null;
    
    const iv = Buffer.from(ivHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    
    const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);
    
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8"));
  } catch (e) {
    return null;
  }
}

// Get user from request cookies
export function getSessionUser(req: NextRequest): { id: string; email: string } | null {
  const sessionCookie = req.cookies.get("session")?.value;
  if (!sessionCookie) return null;
  return decryptSession(sessionCookie);
}

// Set session cookie on response
export function setSessionCookie(res: NextResponse, user: { id: string; email: string }) {
  const token = encryptSession(user);
  res.cookies.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: "/",
  });
}

// Clear session cookie
export function clearSessionCookie(res: NextResponse) {
  res.cookies.set("session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}
