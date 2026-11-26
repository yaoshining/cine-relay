import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export function parsePoolKey(encoded: string | undefined) {
  if (!encoded || !/^[A-Za-z0-9+/]{43}=$/.test(encoded)) return null;
  const decoded = Buffer.from(encoded, "base64");
  return decoded.length === 32 && decoded.toString("base64") === encoded ? decoded : null;
}

export function sealCredential(key: Buffer, id: string, token: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from("cinerelay:tmdb:v1:" + id));
  const body = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), body]).toString("base64");
}

export function openCredential(key: Buffer, id: string, encrypted: string) {
  const parts = Buffer.from(encrypted, "base64");
  if (parts.length <= 28) throw Error("Invalid credential ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", key, parts.subarray(0, 12));
  decipher.setAAD(Buffer.from("cinerelay:tmdb:v1:" + id));
  decipher.setAuthTag(parts.subarray(12, 28));
  return Buffer.concat([decipher.update(parts.subarray(28)), decipher.final()]).toString("utf8");
}
