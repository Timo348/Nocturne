import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "enc:v1";

function encryptionKey() {
  const raw = process.env.APP_ENCRYPTION_KEY ?? (process.env.NODE_ENV === "test" ? "test-encryption-key" : undefined);
  if (!raw) throw new Error("APP_ENCRYPTION_KEY is required");
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptSecret(value: string) {
  if (!value.startsWith(`${PREFIX}:`)) return value;
  const [, , ivRaw, tagRaw, encryptedRaw] = value.split(":");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64url")), decipher.final()]).toString("utf8");
}

export function sealConfig(config: Record<string, unknown>, secretFields: string[], existing?: Record<string, unknown>) {
  const output = structuredClone(config);
  for (const field of secretFields) {
    const incoming = output[field];
    if ((incoming === "" || incoming == null) && existing?.[field]) {
      output[field] = existing[field];
    } else if (typeof incoming === "string" && incoming.length > 0 && !incoming.startsWith(`${PREFIX}:`)) {
      output[field] = encryptSecret(incoming);
    }
  }
  return output;
}

export function unsealConfig(config: Record<string, unknown>, secretFields: string[]) {
  const output = structuredClone(config);
  for (const field of secretFields) {
    if (typeof output[field] === "string") output[field] = decryptSecret(output[field] as string);
  }
  return output;
}

export function publicConfig(config: Record<string, unknown>, secretFields: string[]): Record<string, unknown> & { __configuredSecrets: Record<string, boolean> } {
  const output = structuredClone(config);
  const configuredSecrets: Record<string, boolean> = {};
  for (const field of secretFields) {
    configuredSecrets[field] = typeof output[field] === "string" && (output[field] as string).length > 0;
    output[field] = "";
  }
  return { ...output, __configuredSecrets: configuredSecrets };
}

export function exportConfig(config: Record<string, unknown>, secretFields: string[]) {
  const output = structuredClone(config);
  for (const field of secretFields) {
    if (field in output) output[field] = { $secret: "required" };
  }
  return output;
}
