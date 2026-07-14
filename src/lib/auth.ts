import "server-only";
import { db } from "./db";
import { readSessionClaims } from "./session";
import type { SessionUser } from "@/widget-engine/contracts";
import { normalizeTheme } from "./themes";

export async function getCurrentUser(): Promise<SessionUser | null> {
  const claims = await readSessionClaims();
  if (!claims) return null;
  const user = await db.user.findUnique({ where: { id: claims.id } });
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role, theme: normalizeTheme(user.theme) };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Authentication required", 401);
  return user;
}

export class AuthError extends Error {
  constructor(message: string, public status = 403) {
    super(message);
  }
}

export function requireRole(role: SessionUser["role"], allowed: SessionUser["role"][]) {
  if (!allowed.includes(role)) throw new AuthError("This widget is not available for your role", 403);
}
