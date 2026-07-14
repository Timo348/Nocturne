import { z } from "zod";
import { defineWidget } from "@/widget-engine/contracts";

const configSchema = z
  .object({
    url: z.string().trim().url().max(500).refine((value) => ["http:", "https:"].includes(new URL(value).protocol), "Only HTTP(S) endpoints are allowed"),
    valuePath: z.string().trim().max(120).default("value"),
    label: z.string().trim().min(1).max(60).default("API value"),
    prefix: z.string().max(20).default(""),
    suffix: z.string().max(20).default(""),
    headerName: z.string().regex(/^[A-Za-z0-9-]*$/).max(80).default(""),
    headerValue: z.string().max(1024).default(""),
  })
  .strict();

type Config = z.infer<typeof configSchema>;

function getPath(input: unknown, path: string) {
  if (!path) return input;
  return path.split(".").reduce<unknown>((value, key) => {
    if (value && typeof value === "object" && key in value) return (value as Record<string, unknown>)[key];
    return undefined;
  }, input);
}

export const definition = defineWidget<Config>({
  manifest: {
    type: "rest",
    version: 1,
    name: "REST lens",
    description: "Einen gezielten Wert aus einer freigegebenen JSON-API darstellen.",
    icon: "Braces",
    category: "Custom",
    accent: "#f472b6",
    allowedRoles: ["DEVELOPER", "ADMIN"],
    size: { default: { w: 3, h: 3 }, min: { w: 3, h: 3 }, max: { w: 6, h: 6 } },
    cacheTtlSeconds: 60,
  },
  configSchema,
  fields: [
    { key: "url", label: "JSON-Endpunkt", type: "url", placeholder: "https://service.home/api/status", required: true, help: "Direkter HTTP(S)-Endpunkt; private und lokale Ziele sind erlaubt." },
    { key: "valuePath", label: "Wertpfad", type: "text", placeholder: "system.temperature" },
    { key: "label", label: "Bezeichnung", type: "text", placeholder: "Temperatur", required: true },
    { key: "prefix", label: "Präfix", type: "text", placeholder: "" },
    { key: "suffix", label: "Suffix", type: "text", placeholder: " ms" },
    { key: "headerName", label: "Auth-Header", type: "text", placeholder: "Authorization" },
    { key: "headerValue", label: "Header-Secret", type: "password", placeholder: "Bearer …" },
  ],
  secretFields: ["headerValue"],
  createProvider: ({ http }) => ({
    async load(config) {
      const payload = await http.getJson(config.url, {
        headers: config.headerName && config.headerValue ? { [config.headerName]: config.headerValue } : undefined,
      });
      const value = getPath(payload, config.valuePath);
      if (!["string", "number", "boolean"].includes(typeof value)) throw new Error("Configured REST value is missing or not scalar");
      return { value, label: config.label, prefix: config.prefix, suffix: config.suffix };
    },
  }),
});
