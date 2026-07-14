import "server-only";
import type { Prisma, WidgetInstance } from "@prisma/client";
import type { AppRole } from "@/widget-engine/contracts";
import { cacheKey, loadCached } from "./cache";
import { requireRole } from "./auth";
import { objectValue } from "./dashboard-data";
import { unsealConfig } from "./secrets";
import { widgetRegistry } from "./widget-container";

type DataWidget = Pick<WidgetInstance, "id" | "type" | "config" | "updatedAt"> & { config: Prisma.JsonValue };

export async function loadWidgetPayload(widget: DataWidget, role: AppRole) {
  const definition = widgetRegistry.require(widget.type);
  requireRole(role, definition.manifest.allowedRoles);
  const provider = widgetRegistry.provider(widget.type);
  if (!provider) return { data: null, cached: false, updatedAt: widget.updatedAt.toISOString() };
  const config = definition.configSchema.parse(unsealConfig(objectValue(widget.config), definition.secretFields)) as Record<string, unknown>;
  return loadCached(cacheKey(widget.type, widget.id, config), definition.manifest.cacheTtlSeconds, () => provider.load(config));
}
