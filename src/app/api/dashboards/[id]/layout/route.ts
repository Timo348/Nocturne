import { z } from "zod";
import { recordActivity } from "@/lib/activity";
import { HttpError, jsonError, readJsonBody, requireSameOrigin } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { requireOwnedDashboard } from "@/lib/dashboard-data";
import { db } from "@/lib/db";
import { widgetLayoutSchema, validateLayoutForSize } from "@/widget-engine/layout";
import { widgetRegistry } from "@/lib/widget-container";

const inputSchema = z
  .object({
    revision: z.number().int().positive(),
    layouts: z.array(z.object({ id: z.string().cuid(), layout: widgetLayoutSchema }).strict()).max(100),
  })
  .strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { id } = await params;
    const dashboard = await requireOwnedDashboard(id, user.id, true);
    const input = inputSchema.parse(await readJsonBody(request));
    if (dashboard.revision !== input.revision) throw new HttpError("Das Dashboard wurde parallel geändert. Bitte neu laden.", 409);

    const widgets = new Map(dashboard.widgets.map((widget) => [widget.id, widget]));
    const layouts = input.layouts.map((item) => {
      const widget = widgets.get(item.id);
      if (!widget) throw new HttpError("Ein Layout verweist auf ein fremdes Widget.", 403);
      const definition = widgetRegistry.require(widget.type);
      return { id: item.id, layout: validateLayoutForSize(item.layout, definition.manifest.size) };
    });

    const nextRevision = await db.$transaction(async (tx) => {
      const claimed = await tx.dashboard.updateMany({
        where: { id, ownerId: user.id, revision: input.revision },
        data: { revision: { increment: 1 } },
      });
      if (claimed.count !== 1) throw new HttpError("Das Dashboard wurde parallel geändert. Bitte neu laden.", 409);
      await Promise.all(layouts.map((item) => tx.widgetInstance.update({ where: { id: item.id }, data: { layout: item.layout } })));
      await recordActivity({
        userId: user.id,
        action: "layout_updated",
        entityType: "layout",
        entityId: id,
        dashboardId: id,
        message: `Layout für Dashboard „${dashboard.name}“ gespeichert.`,
        metadata: { widgetCount: layouts.length, revision: input.revision + 1 },
      }, tx);
      return input.revision + 1;
    });

    return Response.json({ revision: nextRevision, savedAt: new Date().toISOString() });
  } catch (error) {
    return jsonError(error);
  }
}
