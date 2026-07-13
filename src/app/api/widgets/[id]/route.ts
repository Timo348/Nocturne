import { z } from "zod";
import { recordActivity } from "@/lib/activity";
import { jsonError, readJsonBody, requireSameOrigin } from "@/lib/api";
import { requireRole, requireUser } from "@/lib/auth";
import { objectValue, requireOwnedWidget } from "@/lib/dashboard-data";
import { db } from "@/lib/db";
import { sealConfig } from "@/lib/secrets";
import { widgetRegistry } from "@/lib/widget-container";

const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(80).optional(),
    config: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { id } = await params;
    const widget = await requireOwnedWidget(id, user.id);
    const definition = widgetRegistry.require(widget.type);
    requireRole(user.role, definition.manifest.allowedRoles);
    const input = updateSchema.parse(await readJsonBody(request));
    let config: Record<string, unknown> | undefined;
    if (input.config) {
      const sanitized = { ...input.config };
      delete sanitized.__configuredSecrets;
      const parsed = definition.configSchema.parse(sanitized) as Record<string, unknown>;
      config = sealConfig(parsed, definition.secretFields, objectValue(widget.config));
    }
    const changedFields = [
      ...(input.title !== undefined && input.title !== widget.title ? ["title"] : []),
      ...(input.config !== undefined ? ["config"] : []),
    ];
    if (changedFields.length === 0) return Response.json({ ok: true });
    const nextTitle = input.title ?? widget.title;
    await db.$transaction(async (tx) => {
      await tx.widgetInstance.update({ where: { id }, data: { ...(input.title ? { title: input.title } : {}), ...(config ? { config: config as never } : {}) } });
      await tx.dashboard.update({ where: { id: widget.dashboardId }, data: { revision: { increment: 1 } } });
      await tx.cacheEntry.deleteMany({ where: { key: { startsWith: `${widget.type}:${widget.id}:` } } });
      await recordActivity({
        userId: user.id,
        action: "updated",
        entityType: "widget",
        entityId: id,
        dashboardId: widget.dashboardId,
        message: `Widget „${nextTitle}“ in Dashboard „${widget.dashboard.name}“ aktualisiert.`,
        metadata: { title: nextTitle, widgetType: widget.type, fields: changedFields },
      }, tx);
    });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { id } = await params;
    const widget = await requireOwnedWidget(id, user.id);
    await db.$transaction(async (tx) => {
      await tx.widgetInstance.delete({ where: { id } });
      await tx.dashboard.update({ where: { id: widget.dashboardId }, data: { revision: { increment: 1 } } });
      await tx.cacheEntry.deleteMany({ where: { key: { startsWith: `${widget.type}:${widget.id}:` } } });
      await recordActivity({
        userId: user.id,
        action: "deleted",
        entityType: "widget",
        entityId: id,
        dashboardId: widget.dashboardId,
        message: `Widget „${widget.title}“ aus Dashboard „${widget.dashboard.name}“ entfernt.`,
        metadata: { title: widget.title, widgetType: widget.type },
      }, tx);
    });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
