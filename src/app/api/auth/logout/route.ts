import { jsonError, requireSameOrigin } from "@/lib/api";
import { clearSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await clearSession();
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
