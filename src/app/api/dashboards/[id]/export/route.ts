import { jsonError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { objectValue, requireOwnedDashboard } from "@/lib/dashboard-data";
import { exportConfig } from "@/lib/secrets";
import { widgetRegistry } from "@/lib/widget-container";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const dashboard = await requireOwnedDashboard(id, user.id, true);
    const payload = {
      formatVersion: 1 as const,
      exportedAt: new Date().toISOString(),
      dashboard: {
        name: dashboard.name,
        description: dashboard.description,
        environment: dashboard.environment,
        widgets: dashboard.widgets.map((widget) => {
          const definition = widgetRegistry.require(widget.type);
          return {
            type: widget.type,
            definitionVersion: definition.manifest.version,
            title: widget.title,
            config: exportConfig(objectValue(widget.config), definition.secretFields),
            layout: widget.layout,
          };
        }),
      },
    };
    const filename = `${dashboard.slug}-nocturne.json`;
    return new Response(JSON.stringify(payload, null, 2), {
      headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="${filename}"`, "cache-control": "private, no-store" },
    });
  } catch (error) {
    return jsonError(error);
  }
}
