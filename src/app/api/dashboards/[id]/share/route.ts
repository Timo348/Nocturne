import { z } from "zod";
import { recordActivity } from "@/lib/activity";
import { jsonError, readJsonBody, requireSameOrigin } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { requireOwnedDashboard } from "@/lib/dashboard-data";
import { createShareToken, sharePath } from "@/lib/dashboard-sharing";
import { db } from "@/lib/db";
import { APP_THEMES, normalizeTheme } from "@/lib/themes";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["enable", "disable", "regenerate"]) }).strict(),
  z.object({ action: z.literal("set_theme"), theme: z.enum(APP_THEMES) }).strict(),
]);
type Context = { params: Promise<{ id: string }> };

function responseFor(token: string | null, theme: unknown) {
  return { enabled: Boolean(token), path: token ? sharePath(token) : null, theme: normalizeTheme(theme) };
}

export async function GET(_request: Request, { params }: Context) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const dashboard = await requireOwnedDashboard(id, user.id);
    return Response.json(responseFor(dashboard.shareToken, dashboard.shareTheme));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, { params }: Context) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { id } = await params;
    const dashboard = await requireOwnedDashboard(id, user.id);
    const body = actionSchema.parse(await readJsonBody(request));
    const { action } = body;

    if (action === "set_theme") {
      await db.$transaction(async (tx) => {
        await tx.dashboard.update({ where: { id }, data: { shareTheme: body.theme } });
        await recordActivity({
          userId: user.id,
          action: "updated",
          entityType: "dashboard",
          entityId: id,
          dashboardId: id,
          message: `Theme der Freigabe für Dashboard „${dashboard.name}“ geändert.`,
          metadata: { shareAction: action, theme: body.theme },
        }, tx);
      });
      return Response.json(responseFor(dashboard.shareToken, body.theme));
    }

    if (action === "enable" && dashboard.shareToken) {
      return Response.json(responseFor(dashboard.shareToken, dashboard.shareTheme));
    }

    const token = action === "disable" ? null : createShareToken();
    const verb = action === "disable" ? "deaktiviert" : action === "regenerate" ? "erneuert" : "aktiviert";
    await db.$transaction(async (tx) => {
      await tx.dashboard.update({
        where: { id },
        data: { shareToken: token, sharedAt: token ? new Date() : null },
      });
      await recordActivity({
        userId: user.id,
        action: "updated",
        entityType: "dashboard",
        entityId: id,
        dashboardId: id,
        message: `Freigabe für Dashboard „${dashboard.name}“ ${verb}.`,
        metadata: { shareAction: action, enabled: Boolean(token) },
      }, tx);
    });
    return Response.json(responseFor(token, dashboard.shareTheme));
  } catch (error) {
    return jsonError(error);
  }
}
