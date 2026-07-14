import { z } from "zod";
import { jsonError, readJsonBody, requireSameOrigin } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { APP_THEMES } from "@/lib/themes";

const preferencesSchema = z.object({ theme: z.enum(APP_THEMES) }).strict();

export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const preferences = preferencesSchema.parse(await readJsonBody(request, 16 * 1024));
    const updated = await db.user.update({
      where: { id: user.id },
      data: { theme: preferences.theme },
      select: { theme: true },
    });
    return Response.json(updated);
  } catch (error) {
    return jsonError(error);
  }
}
