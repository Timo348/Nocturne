import { z } from "zod";
import { recordActivity } from "@/lib/activity";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, readJsonBody, requireSameOrigin } from "@/lib/api";
import { slugify } from "@/lib/slug";

const createSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(280).default(""),
    environment: z.string().trim().max(80).default("Home network"),
  })
  .strict();

async function uniqueSlug(ownerId: string, name: string) {
  const base = slugify(name);
  const matches = await db.dashboard.findMany({ where: { ownerId, slug: { startsWith: base } }, select: { slug: true } });
  const taken = new Set(matches.map((item) => item.slug));
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const input = createSchema.parse(await readJsonBody(request));
    const slug = await uniqueSlug(user.id, input.name);
    const dashboard = await db.$transaction(async (tx) => {
      const created = await tx.dashboard.create({ data: { ...input, ownerId: user.id, slug } });
      await recordActivity({
        userId: user.id,
        action: "created",
        entityType: "dashboard",
        entityId: created.id,
        dashboardId: created.id,
        message: `Dashboard „${created.name}“ erstellt.`,
        metadata: { name: created.name, environment: created.environment },
      }, tx);
      return created;
    });
    return Response.json({ id: dashboard.id }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
