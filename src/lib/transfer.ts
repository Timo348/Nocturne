import "server-only";
import { z } from "zod";
import { APP_ROLES } from "@/widget-engine/contracts";
import { widgetLayoutSchema, validateLayoutForSize } from "@/widget-engine/layout";
import { widgetRegistry } from "./widget-container";

const configSchema = z.record(z.string(), z.unknown());

export const dashboardTransferSchema = z
  .object({
    formatVersion: z.literal(1),
    exportedAt: z.string().optional(),
    dashboard: z
      .object({
        name: z.string().trim().min(1).max(80),
        description: z.string().max(280).default(""),
        environment: z.string().max(80).default("Home network"),
        widgets: z
          .array(
            z
              .object({
                type: z.string().min(1).max(64),
                definitionVersion: z.number().int().positive(),
                title: z.string().trim().min(1).max(80),
                config: configSchema,
                layout: widgetLayoutSchema,
              })
              .strict(),
          )
          .max(100),
      })
      .strict(),
  })
  .strict();

function normalizeSecretPlaceholders(config: Record<string, unknown>, secretFields: string[]) {
  const output = structuredClone(config);
  for (const field of secretFields) {
    const value = output[field];
    if (value && typeof value === "object" && (value as { $secret?: unknown }).$secret === "required") output[field] = "";
  }
  return output;
}

export function validateTransfer(input: unknown, role: (typeof APP_ROLES)[number]) {
  const transfer = dashboardTransferSchema.parse(input);
  return {
    ...transfer,
    dashboard: {
      ...transfer.dashboard,
      widgets: transfer.dashboard.widgets.map((widget) => {
        const definition = widgetRegistry.require(widget.type);
        if (!definition.manifest.allowedRoles.includes(role)) throw new Error(`Role ${role} cannot import ${widget.type}`);
        if (widget.definitionVersion > definition.manifest.version) throw new Error(`Widget ${widget.type} requires a newer definition`);
        const config = definition.configSchema.parse(normalizeSecretPlaceholders(widget.config, definition.secretFields));
        const layout = validateLayoutForSize(widget.layout, definition.manifest.size);
        return { ...widget, config, layout };
      }),
    },
  };
}
