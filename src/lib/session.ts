import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { SessionUser } from "@/widget-engine/contracts";

const COOKIE_NAME = "nocturne-session";
const MAX_AGE = 60 * 60 * 24 * 7;

function secureCookie() {
  if (process.env.SESSION_COOKIE_SECURE != null) return process.env.SESSION_COOKIE_SECURE === "true";
  return process.env.NODE_ENV === "production";
}

function sessionKey() {
  const secret = process.env.SESSION_SECRET ?? (process.env.NODE_ENV === "test" ? "test-session-secret-with-32-characters" : undefined);
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({ email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(sessionKey());
}

export async function setSession(user: SessionUser) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, await createSessionToken(user), {
    httpOnly: true,
    secure: secureCookie(),
    sameSite: "strict",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", { httpOnly: true, secure: secureCookie(), sameSite: "strict", path: "/", maxAge: 0 });
}

export async function readSessionClaims() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return { id: payload.sub };
  } catch {
    return null;
  }
}
