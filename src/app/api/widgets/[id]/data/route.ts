import { cacheKey, loadCached } from "@/lib/cache";
import { jsonError } from "@/lib/api";
import { requireRole, requireUser } from "@/lib/auth";
import { objectValue, requireOwnedWidget } from "@/lib/dashboard-data";
import { unsealConfig } from "@/lib/secrets";
import { widgetRegistry } from "@/lib/widget-container";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const widget = await requireOwnedWidget(id, user.id);
    const definition = widgetRegistry.require(widget.type);
    requireRole(user.role, definition.manifest.allowedRoles);
    const provider = widgetRegistry.provider(widget.type);
    if (!provider) return Response.json({ data: null, cached: false, updatedAt: widget.updatedAt.toISOString() });
    const config = definition.configSchema.parse(unsealConfig(objectValue(widget.config), definition.secretFields)) as Record<string, unknown>;
    const result = await loadCached(cacheKey(widget.type, widget.id, config), definition.manifest.cacheTtlSeconds, () => provider.load(config));
    return Response.json(result, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
