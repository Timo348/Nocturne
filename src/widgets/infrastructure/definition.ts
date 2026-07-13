import { z } from "zod";
import { defineWidget } from "@/widget-engine/contracts";

const configSchema = z
  .object({
    collectorUrl: z.union([z.literal(""), z.string().trim().url().max(500).refine((value) => ["http:", "https:"].includes(new URL(value).protocol), "Only HTTP(S) collectors are allowed")]).default(""),
    collectorToken: z.string().max(1024).default(""),
    showNetwork: z.boolean().default(true),
  })
  .strict();

const collectorSchema = z.object({
  hostname: z.string().max(120),
  uptimeSeconds: z.number().nonnegative(),
  cpu: z.object({ cores: z.number().int().positive(), load: z.array(z.number()).max(3) }),
  memory: z.object({ total: z.number().nonnegative(), used: z.number().nonnegative(), percentage: z.number().min(0).max(100) }),
  network: z.array(z.object({ family: z.string(), address: z.string() })).max(64).default([]),
  containers: z.object({ running: z.number().int().nonnegative(), stopped: z.number().int().nonnegative() }).optional(),
  collectedAt: z.string(),
});

type Config = z.infer<typeof configSchema>;

export const definition = defineWidget<Config>({
  manifest: {
    type: "infrastructure",
    version: 1,
    name: "Infrastructure",
    description: "Host-Ressourcen und optional sichere Collector-Metriken für Docker und Netzwerk.",
    icon: "Activity",
    category: "Monitoring",
    accent: "#8b5cf6",
    allowedRoles: ["VIEWER", "DEVELOPER", "ADMIN"],
    size: { default: { w: 5, h: 4 }, min: { w: 4, h: 4 }, max: { w: 8, h: 7 } },
    cacheTtlSeconds: 15,
  },
  configSchema,
  fields: [
    { key: "collectorUrl", label: "Metrics Collector", type: "url", placeholder: "https://metrics.home/snapshot", help: "Optionaler, read-only Collector; der Web-Container erhält keinen Docker-Socket." },
    { key: "collectorToken", label: "Collector Token", type: "password", placeholder: "Bereits gesetztes Secret bleibt erhalten" },
    { key: "showNetwork", label: "Netzwerk anzeigen", type: "toggle" },
  ],
  secretFields: ["collectorToken"],
  createProvider: ({ http, getHostSnapshot }) => ({
    async load(config) {
      if (!config.collectorUrl) return getHostSnapshot();
      const payload = await http.getJson(config.collectorUrl, {
        headers: config.collectorToken ? { authorization: `Bearer ${config.collectorToken}` } : undefined,
      });
      return collectorSchema.parse(payload);
    },
  }),
});
