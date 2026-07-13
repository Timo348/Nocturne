import { z } from "zod";
import { jsonError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const search = new URL(request.url).searchParams;
    const input = querySchema.parse(Object.fromEntries(search.entries()));
    const rows = await db.activityEvent.findMany({
      where: { userId: user.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        dashboardId: true,
        message: true,
        metadata: true,
        createdAt: true,
      },
    });
    const events = rows.map(({ entityId, dashboardId, metadata, createdAt, ...event }) => ({
      ...event,
      ...(entityId ? { entityId } : {}),
      ...(dashboardId ? { dashboardId } : {}),
      ...(metadata !== null ? { metadata } : {}),
      createdAt: createdAt.toISOString(),
    }));
    return Response.json({ events }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
