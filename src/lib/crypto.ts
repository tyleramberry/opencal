import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function authSecret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("Set AUTH_SECRET (at least 16 characters) in your environment.");
  return s;
}

export const sign = (value: string) => createHmac("sha256", authSecret()).update(value).digest("base64url");

/** "value.signature" -> value, or null if the signature doesn't match. */
export function verifySigned(signed: string | undefined): string | null {
  if (!signed) return null;
  const i = signed.lastIndexOf(".");
  if (i < 1) return null;
  const value = signed.slice(0, i);
  const a = Buffer.from(signed.slice(i + 1));
  const b = Buffer.from(sign(value));
  return a.length === b.length && timingSafeEqual(a, b) ? value : null;
}

const key = () => createHash("sha256").update(`opencal:enc:${authSecret()}`).digest();

/** AES-256-GCM, for tokens stored in the database. */
export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(packed: string) {
  const [iv, tag, body] = packed.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}

export const randomToken = (bytes = 24) => randomBytes(bytes).toString("base64url");
