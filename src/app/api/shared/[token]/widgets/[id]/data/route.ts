import { HttpError, jsonError } from "@/lib/api";
import { isShareToken } from "@/lib/dashboard-sharing";
import { db } from "@/lib/db";
import { loadWidgetPayload } from "@/lib/widget-data";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  try {
    const { token, id } = await params;
    if (!isShareToken(token)) throw new HttpError("Freigabe nicht gefunden.", 404);
    const widget = await db.widgetInstance.findFirst({
      where: { id, dashboard: { shareToken: token } },
      include: { dashboard: { include: { owner: { select: { role: true } } } } },
    });
    if (!widget) throw new HttpError("Widget nicht gefunden.", 404);
    const result = await loadWidgetPayload(widget, widget.dashboard.owner.role);
    return Response.json(result, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
