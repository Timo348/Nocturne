import { z } from "zod";
import { defineWidget } from "@/widget-engine/contracts";
import { prometheusUnits, reducePrometheusValues, type PrometheusReduction } from "./transform";

const httpUrl = z.string().trim().url().max(500).refine((value) => ["http:", "https:"].includes(new URL(value).protocol), "Only HTTP(S) Prometheus URLs are allowed");

const configSchema = z.object({
  baseUrl: httpUrl,
  query: z.string().trim().min(1).max(2_000),
  label: z.string().trim().min(1).max(80).default("Prometheus metric"),
  reduction: z.enum(["first", "sum", "average", "min", "max"]).default("sum"),
  unit: z.enum(prometheusUnits).default("number"),
  decimals: z.coerce.number().int().min(0).max(4).default(2),
  headerName: z.string().trim().regex(/^[A-Za-z0-9-]*$/).max(80).default(""),
  headerValue: z.string().max(2_048).default(""),
}).strict();

type Config = z.infer<typeof configSchema>;

const envelopeSchema = z.object({
  status: z.literal("success"),
  data: z.object({ resultType: z.string(), result: z.unknown() }),
});

function numericSample(value: unknown) {
  if (!Array.isArray(value) || value.length < 2) return undefined;
  const sample = Number(value[1]);
  return Number.isFinite(sample) ? sample : undefined;
}

function extractValues(resultType: string, result: unknown) {
  if (resultType === "scalar") {
    const value = numericSample(result);
    return value === undefined ? [] : [value];
  }
  if (resultType !== "vector" || !Array.isArray(result)) throw new Error(`Unsupported Prometheus result type: ${resultType}`);
  return result.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const value = numericSample((entry as Record<string, unknown>).value);
    return value === undefined ? [] : [value];
  });
}

export const definition = defineWidget<Config>({
  manifest: {
    type: "prometheus",
    version: 1,
    name: "Prometheus metric",
    description: "PromQL-Instant-Abfragen als skalare Metrik mit Reduktion und wählbarer Einheit.",
    icon: "Gauge",
    category: "Monitoring",
    accent: "#f97316",
    allowedRoles: ["DEVELOPER", "ADMIN"],
    size: { default: { w: 4, h: 4 }, min: { w: 3, h: 3 }, max: { w: 8, h: 7 } },
    cacheTtlSeconds: 30,
  },
  configSchema,
  fields: [
    { key: "baseUrl", label: "Prometheus-URL", type: "url", placeholder: "https://prometheus.home", required: true, help: "Basis-URL ohne /api/v1/query. Private Hosts müssen in FETCH_ALLOWED_HOSTS stehen." },
    { key: "query", label: "PromQL Query", type: "textarea", placeholder: "sum(rate(node_network_receive_bytes_total[5m]))", required: true, help: "Die Instant Query darf einen Scalar oder Vector liefern." },
    { key: "label", label: "Metrik-Bezeichnung", type: "text", defaultValue: "Prometheus metric", required: true },
    { key: "reduction", label: "Mehrere Zeitreihen", type: "select", defaultValue: "sum", options: [
      { label: "Summieren", value: "sum" },
      { label: "Durchschnitt", value: "average" },
      { label: "Minimum", value: "min" },
      { label: "Maximum", value: "max" },
      { label: "Ersten Wert verwenden", value: "first" },
    ] },
    { key: "unit", label: "Anzeigeeinheit", type: "select", defaultValue: "number", help: "Bytes-Formate erwarten Bytes; Zeitformate erwarten Sekunden als Quellwert.", options: [
      { label: "Zahl · keine Einheit", value: "number" },
      { label: "Prozent · Wert ist 0–100", value: "percent" },
      { label: "Prozent · Ratio 0–1 umrechnen", value: "ratio_percent" },
      { label: "Bytes · automatisch B bis TB", value: "bytes_auto" },
      { label: "Byte · aus Bytes", value: "bytes" },
      { label: "Kilobyte · aus Bytes", value: "kilobytes" },
      { label: "Megabyte · aus Bytes", value: "megabytes" },
      { label: "Gigabyte · aus Bytes", value: "gigabytes" },
      { label: "Zeit · automatisch aus Sekunden", value: "duration_auto" },
      { label: "Millisekunden · aus Sekunden", value: "milliseconds" },
      { label: "Sekunden", value: "seconds" },
      { label: "Minuten · aus Sekunden", value: "minutes" },
      { label: "Stunden · aus Sekunden", value: "hours" },
    ] },
    { key: "decimals", label: "Nachkommastellen", type: "number", defaultValue: 2, min: 0, max: 4, step: 1 },
    { key: "headerName", label: "Optionaler Auth-Header", type: "text", placeholder: "Authorization", help: "Zum Beispiel Authorization oder X-Scope-OrgID." },
    { key: "headerValue", label: "Header-Secret", type: "password", placeholder: "Bearer …", help: "Wird verschlüsselt gespeichert und nie an den Browser zurückgegeben." },
  ],
  secretFields: ["headerValue"],
  createProvider: ({ http }) => ({
    async load(config) {
      const base = config.baseUrl.replace(/\/+$/, "");
      const endpoint = new URL(`${base}/api/v1/query`);
      endpoint.searchParams.set("query", config.query);
      const payload = await http.getJson(endpoint.toString(), {
        headers: config.headerName && config.headerValue ? { [config.headerName]: config.headerValue } : undefined,
        timeoutMs: 8_000,
        maxBytes: 512 * 1024,
      });
      const envelope = envelopeSchema.parse(payload);
      const values = extractValues(envelope.data.resultType, envelope.data.result);
      return {
        value: reducePrometheusValues(values, config.reduction as PrometheusReduction),
        seriesCount: values.length,
        source: new URL(config.baseUrl).host,
      };
    },
  }),
});
