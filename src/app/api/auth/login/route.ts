import { compare } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError, readJsonBody, requireSameOrigin } from "@/lib/api";
import { setSession } from "@/lib/session";
import { normalizeTheme } from "@/lib/themes";

const loginSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) }).strict();

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = loginSchema.parse(await readJsonBody(request, 16 * 1024));
    const user = await db.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user || !(await compare(body.password, user.passwordHash))) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return Response.json({ error: "E-Mail oder Passwort ist nicht korrekt." }, { status: 401 });
    }
    await setSession({ id: user.id, email: user.email, name: user.name, role: user.role, theme: normalizeTheme(user.theme) });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
