import { recordActivity } from "@/lib/activity";
import { jsonError, readJsonBody, requireSameOrigin } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sealConfig } from "@/lib/secrets";
import { slugify } from "@/lib/slug";
import { validateTransfer } from "@/lib/transfer";
import { widgetRegistry } from "@/lib/widget-container";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const transfer = validateTransfer(await readJsonBody(request), user.role);
    const slugBase = slugify(transfer.dashboard.name);
    const slug = `${slugBase}-import-${Date.now().toString(36)}`;
    const importedName = `${transfer.dashboard.name} · Import`;
    const dashboard = await db.$transaction(async (tx) => {
      const created = await tx.dashboard.create({
        data: {
          ownerId: user.id,
          name: importedName,
          slug,
          description: transfer.dashboard.description,
          environment: transfer.dashboard.environment,
          widgets: {
            create: transfer.dashboard.widgets.map((widget) => {
              const definition = widgetRegistry.require(widget.type);
              return {
                type: widget.type,
                title: widget.title,
                config: sealConfig(widget.config as Record<string, unknown>, definition.secretFields) as never,
                layout: widget.layout,
              };
            }),
          },
        },
      });
      await recordActivity({
        userId: user.id,
        action: "imported",
        entityType: "dashboard",
        entityId: created.id,
        dashboardId: created.id,
        message: `Dashboard „${created.name}“ mit ${transfer.dashboard.widgets.length} Widgets importiert.`,
        metadata: { sourceName: transfer.dashboard.name, widgetCount: transfer.dashboard.widgets.length },
      }, tx);
      return created;
    });
    return Response.json({ id: dashboard.id }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
