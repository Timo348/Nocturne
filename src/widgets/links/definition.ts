import { z } from "zod";
import { defineWidget } from "@/widget-engine/contracts";

const httpUrl = z.string().trim().url().max(500).refine((value) => ["http:", "https:"].includes(new URL(value).protocol), "Only HTTP(S) links are allowed");

const configSchema = z
  .object({
    links: z
      .array(
        z.object({
          label: z.string().trim().min(1).max(40),
          url: httpUrl,
          icon: z.enum(["router", "database", "git", "play", "external"]).default("external"),
        }),
      )
      .min(1)
      .max(12),
  })
  .strict();

export const definition = defineWidget({
  manifest: {
    type: "links",
    version: 1,
    name: "Quick access",
    description: "Deine wichtigsten Homelab-Dienste als fokussierte Shortcuts.",
    icon: "Orbit",
    category: "Essentials",
    accent: "#a78bfa",
    allowedRoles: ["VIEWER", "DEVELOPER", "ADMIN"],
    size: { default: { w: 4, h: 4 }, min: { w: 2, h: 3 }, max: { w: 12, h: 8 } },
    cacheTtlSeconds: 0,
  },
  configSchema,
  fields: [{ key: "links", label: "Links", type: "links", help: "Bis zu zwölf Services mit URL und Icon." }],
  secretFields: [],
});
