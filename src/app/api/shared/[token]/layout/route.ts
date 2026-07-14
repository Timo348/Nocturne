import { z } from "zod";
import { recordActivity } from "@/lib/activity";
import { HttpError, jsonError, readJsonBody, requireSameOrigin } from "@/lib/api";
import { isShareToken } from "@/lib/dashboard-sharing";
import { db } from "@/lib/db";
import { widgetRegistry } from "@/lib/widget-container";
import { validateLayoutForSize, widgetLayoutSchema } from "@/widget-engine/layout";

const inputSchema = z.object({
  revision: z.number().int().positive(),
  layouts: z.array(z.object({ id: z.string().cuid(), layout: widgetLayoutSchema }).strict()).max(100),
}).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    requireSameOrigin(request);
    const { token } = await params;
    if (!isShareToken(token)) throw new HttpError("Freigabe nicht gefunden.", 404);
    const dashboard = await db.dashboard.findUnique({
      where: { shareToken: token },
      include: { widgets: true, owner: { select: { id: true } } },
    });
    if (!dashboard) throw new HttpError("Freigabe nicht gefunden.", 404);
    const input = inputSchema.parse(await readJsonBody(request));
    if (dashboard.revision !== input.revision) throw new HttpError("Das Dashboard wurde parallel geändert. Bitte neu laden.", 409);

    const widgets = new Map(dashboard.widgets.map((widget) => [widget.id, widget]));
    const layouts = input.layouts.map((item) => {
      const widget = widgets.get(item.id);
      if (!widget) throw new HttpError("Ein Layout verweist auf ein fremdes Widget.", 403);
      const definition = widgetRegistry.require(widget.type);
      return { id: item.id, layout: validateLayoutForSize(item.layout, definition.manifest.size) };
    });

    const revision = await db.$transaction(async (tx) => {
      const claimed = await tx.dashboard.updateMany({
        where: { id: dashboard.id, shareToken: token, revision: input.revision },
        data: { revision: { increment: 1 } },
      });
      if (claimed.count !== 1) throw new HttpError("Das Dashboard wurde parallel geändert. Bitte neu laden.", 409);
      await Promise.all(layouts.map((item) => tx.widgetInstance.update({ where: { id: item.id }, data: { layout: item.layout } })));
      await recordActivity({
        userId: dashboard.owner.id,
        action: "layout_updated",
        entityType: "layout",
        entityId: dashboard.id,
        dashboardId: dashboard.id,
        message: `Layout für Dashboard „${dashboard.name}“ über die geteilte Ansicht gespeichert.`,
        metadata: { widgetCount: layouts.length, revision: input.revision + 1, shared: true },
      }, tx);
      return input.revision + 1;
    });
    return Response.json({ revision, savedAt: new Date().toISOString() });
  } catch (error) {
    return jsonError(error);
  }
}
