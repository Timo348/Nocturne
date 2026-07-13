import "server-only";
import { createWidgetRegistry } from "@/widget-engine/registry.server";
import { getHostSnapshot } from "./host-metrics";
import { safeHttpClient } from "./safe-http";

const globalForRegistry = globalThis as unknown as { widgetRegistry?: ReturnType<typeof createWidgetRegistry> };

export const widgetRegistry =
  globalForRegistry.widgetRegistry ??
  createWidgetRegistry({
    http: safeHttpClient,
    getHostSnapshot,
  });

if (process.env.NODE_ENV !== "production") globalForRegistry.widgetRegistry = widgetRegistry;
