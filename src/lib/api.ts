import { AuthError } from "./auth";

export class HttpError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export function jsonError(error: unknown) {
  if (error instanceof AuthError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof SyntaxError) return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  if (error && typeof error === "object" && "issues" in error) return Response.json({ error: "Validation failed", issues: (error as { issues: unknown }).issues }, { status: 400 });
  const message = error instanceof Error ? error.message : "Unexpected server error";
  const expected = /unknown widget|invalid|layout|target|allowed|exceed|required|smaller|permission/i.test(message);
  if (process.env.NODE_ENV !== "production") console.error(error);
  return Response.json({ error: expected ? message : "Unexpected server error" }, { status: expected ? 400 : 500 });
}

export function requireSameOrigin(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "none"].includes(fetchSite)) throw new AuthError("Cross-site request rejected", 403);
  const origin = request.headers.get("origin");
  if (!origin) return;
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const expected = forwardedHost ? `${forwardedProto}://${forwardedHost}` : new URL(request.url).origin;
  if (origin !== expected) throw new AuthError("Request origin rejected", 403);
}

export async function readJsonBody(request: Request, maxBytes = 1024 * 1024) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) throw new HttpError("Content-Type application/json is required", 415);
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) throw new Error("Request body exceeds 1 MiB");
  const parsed = JSON.parse(text) as unknown;
  let nodes = 0;
  const inspect = (value: unknown, depth: number) => {
    nodes += 1;
    if (nodes > 20_000) throw new HttpError("JSON structure contains too many values");
    if (depth > 20) throw new HttpError("JSON structure is nested too deeply");
    if (Array.isArray(value)) {
      for (const item of value) inspect(item, depth + 1);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (["__proto__", "constructor", "prototype"].includes(key)) throw new HttpError(`Forbidden JSON key: ${key}`);
      inspect(item, depth + 1);
    }
  };
  inspect(parsed, 0);
  return parsed;
}
