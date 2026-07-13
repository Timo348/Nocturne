import { z } from "zod";
import { recordActivity } from "@/lib/activity";
import { jsonError, readJsonBody, requireSameOrigin } from "@/lib/api";
import { requireRole, requireUser } from "@/lib/auth";
import { requireOwnedDashboard } from "@/lib/dashboard-data";
import { db } from "@/lib/db";
import { sealConfig } from "@/lib/secrets";
import { widgetRegistry } from "@/lib/widget-container";
import { createDefaultLayout } from "@/widget-engine/layout";

const inputSchema = z
  .object({
    type: z.string().min(1).max(64),
    title: z.string().trim().min(1).max(80),
    config: z.record(z.string(), z.unknown()),
  })
  .strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { id } = await params;
    const dashboard = await requireOwnedDashboard(id, user.id, true);
    const input = inputSchema.parse(await readJsonBody(request));
    const definition = widgetRegistry.require(input.type);
    requireRole(user.role, definition.manifest.allowedRoles);
    const sanitized = { ...input.config };
    delete sanitized.__configuredSecrets;
    const config = definition.configSchema.parse(sanitized) as Record<string, unknown>;
    const layout = createDefaultLayout(definition.manifest.size, dashboard.widgets.length);
    const widget = await db.$transaction(async (tx) => {
      const created = await tx.widgetInstance.create({
        data: { dashboardId: id, type: input.type, title: input.title, config: sealConfig(config, definition.secretFields) as never, layout },
      });
      await tx.dashboard.update({ where: { id }, data: { revision: { increment: 1 } } });
      await recordActivity({
        userId: user.id,
        action: "created",
        entityType: "widget",
        entityId: created.id,
        dashboardId: id,
        message: `Widget „${created.title}“ zu Dashboard „${dashboard.name}“ hinzugefügt.`,
        metadata: { title: created.title, widgetType: created.type },
      }, tx);
      return created;
    });
    return Response.json({ id: widget.id }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
