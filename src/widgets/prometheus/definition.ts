import { z } from "zod";
import { defineWidget } from "@/widget-engine/contracts";
import { legacyMetricsUrl, normalizeMetricsUrl, parsePrometheusMetrics } from "./transform";

const httpUrl = z.preprocess(
  (value) => typeof value === "string" ? normalizeMetricsUrl(value) : value,
  z.string().trim().url().max(500).refine((value) => ["http:", "https:"].includes(new URL(value).protocol), "Only HTTP(S) metrics URLs are allowed"),
);

const configSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const input = value as Record<string, unknown>;
  const metricsUrl = typeof input.metricsUrl === "string" && input.metricsUrl.trim()
    ? input.metricsUrl
    : typeof input.baseUrl === "string" && input.baseUrl.trim()
      ? legacyMetricsUrl(input.baseUrl)
      : input.metricsUrl;
  return { metricsUrl };
}, z.object({ metricsUrl: httpUrl }).strict());

type Config = z.infer<typeof configSchema>;

export const definition = defineWidget<Config>({
  manifest: {
    type: "prometheus",
    version: 2,
    name: "Prometheus metrics",
    description: "Liest alle sichtbaren Metriken direkt von einem Prometheus-/metrics-Endpunkt.",
    icon: "Gauge",
    category: "Monitoring",
    accent: "#f97316",
    allowedRoles: ["DEVELOPER", "ADMIN"],
    size: { default: { w: 5, h: 5 }, min: { w: 3, h: 3 }, max: { w: 12, h: 12 } },
    cacheTtlSeconds: 30,
  },
  configSchema,
  fields: [
    {
      key: "metricsUrl",
      label: "Metrics-Link",
      type: "text",
      placeholder: "monitoring.homelab.de/metrics",
      required: true,
      help: "Direkter Link zum /metrics-Endpunkt. Ohne http:// oder https:// wird automatisch HTTPS verwendet. Private Ziele müssen in FETCH_ALLOWED_HOSTS stehen.",
    },
  ],
  secretFields: [],
  createProvider: ({ http }) => ({
    async load(config) {
      const text = await http.getText(config.metricsUrl, {
        timeoutMs: 10_000,
        maxBytes: 2 * 1024 * 1024,
      });
      return {
        ...parsePrometheusMetrics(text),
        source: new URL(config.metricsUrl).host,
      };
    },
  }),
});
