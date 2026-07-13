import "server-only";
import { createHash } from "node:crypto";
import { db } from "./db";

export function cacheKey(type: string, instanceId: string, config: Record<string, unknown>) {
  const digest = createHash("sha256").update(JSON.stringify(config)).digest("hex").slice(0, 16);
  return `${type}:${instanceId}:${digest}`;
}

export async function loadCached<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<{ data: T; cached: boolean; updatedAt: string }> {
  if (ttlSeconds > 0) {
    const entry = await db.cacheEntry.findUnique({ where: { key } });
    if (entry && entry.expiresAt > new Date()) {
      return { data: entry.value as T, cached: true, updatedAt: entry.updatedAt.toISOString() };
    }
  }

  const data = await loader();
  const now = new Date();
  if (ttlSeconds > 0) {
    await db.cacheEntry.upsert({
      where: { key },
      create: { key, value: data as never, expiresAt: new Date(now.getTime() + ttlSeconds * 1000) },
      update: { value: data as never, expiresAt: new Date(now.getTime() + ttlSeconds * 1000) },
    });
  }
  return { data, cached: false, updatedAt: now.toISOString() };
}
