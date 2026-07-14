import { jsonError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { requireOwnedWidget } from "@/lib/dashboard-data";
import { loadWidgetPayload } from "@/lib/widget-data";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const widget = await requireOwnedWidget(id, user.id);
    const result = await loadWidgetPayload(widget, user.role);
    return Response.json(result, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
