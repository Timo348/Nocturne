import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "./db";
import { serializeDashboard } from "./dashboard-data";
import { widgetRegistry } from "./widget-container";

const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createShareToken() {
  return randomBytes(32).toString("base64url");
}

export function isShareToken(value: string) {
  return SHARE_TOKEN_PATTERN.test(value);
}

export function sharePath(token: string) {
  return `/shared/${token}`;
}

export async function getSharedDashboard(token: string) {
  if (!isShareToken(token)) return null;
  const dashboard = await db.dashboard.findUnique({
    where: { shareToken: token },
    include: {
      widgets: { orderBy: { createdAt: "asc" } },
      owner: { select: { role: true } },
    },
  });
  if (!dashboard) return null;
  return {
    dashboard: serializeDashboard(dashboard),
    catalog: widgetRegistry.catalog(dashboard.owner.role),
  };
}
