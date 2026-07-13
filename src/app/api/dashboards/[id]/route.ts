import { z } from "zod";
import { recordActivity } from "@/lib/activity";
import { jsonError, HttpError, readJsonBody, requireSameOrigin } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { requireOwnedDashboard } from "@/lib/dashboard-data";
import { db } from "@/lib/db";
import { slugify } from "@/lib/slug";

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(280).optional(),
    environment: z.string().trim().max(80).optional(),
  })
  .strict();

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { id } = await context.params;
    const dashboard = await requireOwnedDashboard(id, user.id);
    const input = updateSchema.parse(await readJsonBody(request));
    const changedFields = (["name", "description", "environment"] as const).filter((field) => input[field] !== undefined && input[field] !== dashboard[field]);
    if (changedFields.length === 0) return Response.json({ ok: true });
    const data = { ...input, ...(input.name && input.name !== dashboard.name ? { slug: `${slugify(input.name)}-${id.slice(-5)}` } : {}) };
    const nextName = input.name ?? dashboard.name;
    await db.$transaction(async (tx) => {
      await tx.dashboard.update({ where: { id }, data });
      await recordActivity({
        userId: user.id,
        action: "updated",
        entityType: "dashboard",
        entityId: id,
        dashboardId: id,
        message: `Dashboard „${nextName}“ aktualisiert.`,
        metadata: { fields: changedFields },
      }, tx);
    });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { id } = await context.params;
    const dashboard = await requireOwnedDashboard(id, user.id);
    const count = await db.dashboard.count({ where: { ownerId: user.id } });
    if (count <= 1) throw new HttpError("Das letzte Dashboard kann nicht gelöscht werden.", 409);
    await db.$transaction(async (tx) => {
      await tx.dashboard.delete({ where: { id } });
      await recordActivity({
        userId: user.id,
        action: "deleted",
        entityType: "dashboard",
        entityId: id,
        dashboardId: id,
        message: `Dashboard „${dashboard.name}“ gelöscht.`,
        metadata: { name: dashboard.name },
      }, tx);
    });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
