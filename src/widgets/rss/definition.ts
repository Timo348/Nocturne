import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import { defineWidget } from "@/widget-engine/contracts";

const configSchema = z
  .object({
    url: z.string().trim().url().max(500).refine((value) => ["http:", "https:"].includes(new URL(value).protocol), "Only HTTP(S) feeds are allowed"),
    limit: z.coerce.number().int().min(2).max(10).default(5),
  })
  .strict();

type Config = z.infer<typeof configSchema>;
type XmlNode = Record<string, unknown>;

function node(value: unknown): XmlNode {
  return value && typeof value === "object" && !Array.isArray(value) ? value as XmlNode : {};
}

function text(value: unknown) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function safeLink(value: unknown, base: string) {
  try {
    const url = new URL(String(value ?? ""), base);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

export const definition = defineWidget<Config>({
  manifest: {
    type: "rss",
    version: 1,
    name: "Signal feed",
    description: "RSS- und Atom-Feeds als ruhiger, scanbarer Nachrichtenstrom.",
    icon: "Rss",
    category: "Feeds",
    accent: "#f59e0b",
    allowedRoles: ["VIEWER", "DEVELOPER", "ADMIN"],
    size: { default: { w: 5, h: 5 }, min: { w: 4, h: 4 }, max: { w: 8, h: 8 } },
    cacheTtlSeconds: 900,
  },
  configSchema,
  fields: [
    { key: "url", label: "Feed-URL", type: "url", placeholder: "https://example.com/feed.xml", required: true, help: "Öffentliche, private und lokale HTTP(S)-Ziele sind erlaubt." },
    { key: "limit", label: "Einträge", type: "number", min: 2, max: 10, step: 1 },
  ],
  secretFields: [],
  createProvider: ({ http }) => ({
    async load(config) {
      const xml = await http.getText(config.url);
      const parsed = node(new XMLParser({ ignoreAttributes: false }).parse(xml));
      const channel = node(node(parsed.rss).channel);
      const atom = node(parsed.feed);
      const rawItems = channel.item ?? atom.entry ?? [];
      const items = (Array.isArray(rawItems) ? rawItems : [rawItems]).slice(0, config.limit).map((value) => {
        const item = node(value);
        const title = node(item.title);
        const link = node(item.link);
        return {
          title: text(title["#text"] ?? item.title),
          url: safeLink(link["@_href"] ?? item.link, config.url),
          summary: text(item.description ?? item.summary ?? item.content).slice(0, 180),
          publishedAt: String(item.pubDate ?? item.published ?? item.updated ?? ""),
        };
      }).filter((item) => item.url.length > 0);
      const atomTitle = node(atom.title);
      return { title: text(channel.title ?? atomTitle["#text"] ?? atom.title ?? "Feed"), items };
    },
  }),
});
