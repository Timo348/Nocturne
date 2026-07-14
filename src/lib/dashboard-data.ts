import "server-only";
import type { Dashboard, Prisma, WidgetInstance } from "@prisma/client";
import { db } from "./db";
import { publicConfig } from "./secrets";
import { widgetRegistry } from "./widget-container";
import type { BootstrapData, ClientDashboard, SessionUser, WidgetLayout } from "@/widget-engine/contracts";
import { widgetLayoutSchema } from "@/widget-engine/layout";

type DashboardWithWidgets = Dashboard & { widgets: WidgetInstance[] };

function objectValue(value: Prisma.JsonValue) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

export function serializeDashboard(dashboard: DashboardWithWidgets): ClientDashboard {
  return {
    id: dashboard.id,
    name: dashboard.name,
    slug: dashboard.slug,
    description: dashboard.description,
    environment: dashboard.environment,
    isDefault: dashboard.isDefault,
    isShared: Boolean(dashboard.shareToken),
    revision: dashboard.revision,
    widgets: dashboard.widgets.map((widget) => {
      const definition = widgetRegistry.require(widget.type);
      const config = publicConfig(objectValue(widget.config), definition.secretFields);
      return {
        id: widget.id,
        type: widget.type,
        title: widget.title,
        config: widget.type === "prometheus" ? definition.configSchema.parse(config) as Record<string, unknown> : config,
        layout: widgetLayoutSchema.parse(widget.layout) as WidgetLayout,
        updatedAt: widget.updatedAt.toISOString(),
      };
    }),
  };
}

export async function getBootstrapData(user: SessionUser): Promise<BootstrapData> {
  const dashboards = await db.dashboard.findMany({
    where: { ownerId: user.id },
    include: { widgets: { orderBy: { createdAt: "asc" } } },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  return {
    user,
    dashboards: dashboards.map(serializeDashboard),
    catalog: widgetRegistry.catalog(user.role),
  };
}

export async function requireOwnedDashboard(id: string, ownerId: string, includeWidgets: true): Promise<DashboardWithWidgets>;
export async function requireOwnedDashboard(id: string, ownerId: string, includeWidgets?: false): Promise<Dashboard>;
export async function requireOwnedDashboard(id: string, ownerId: string, includeWidgets = false): Promise<Dashboard | DashboardWithWidgets> {
  const dashboard = await db.dashboard.findFirst({
    where: { id, ownerId },
    include: includeWidgets ? { widgets: true } : undefined,
  });
  if (!dashboard) throw new Error("Dashboard not found or not allowed");
  return dashboard as Dashboard | DashboardWithWidgets;
}

export async function requireOwnedWidget(id: string, ownerId: string) {
  const widget = await db.widgetInstance.findFirst({
    where: { id, dashboard: { ownerId } },
    include: { dashboard: true },
  });
  if (!widget) throw new Error("Widget not found or not allowed");
  return widget;
}

export { objectValue };
