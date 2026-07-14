import { z } from "zod";
import { defineWidget } from "@/widget-engine/contracts";

const configSchema = z
  .object({
    baseUrl: z.string().trim().url().max(500).refine((value) => ["http:", "https:"].includes(new URL(value).protocol), "Only HTTP(S) Gitea URLs are allowed"),
    token: z.string().max(512).default(""),
    limit: z.coerce.number().int().min(2).max(12).default(6),
  })
  .strict();

type Config = z.infer<typeof configSchema>;

function safeRepositoryUrl(value: unknown, base: string) {
  try {
    const url = new URL(String(value ?? ""), base);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : base;
  } catch {
    return base;
  }
}

export const definition = defineWidget<Config>({
  manifest: {
    type: "gitea",
    version: 1,
    name: "Gitea pulse",
    description: "Aktive Repositories, Sprachen und Änderungsstatus aus deiner Gitea-Instanz.",
    icon: "GitBranch",
    category: "Developer",
    accent: "#34d399",
    allowedRoles: ["DEVELOPER", "ADMIN"],
    size: { default: { w: 5, h: 5 }, min: { w: 4, h: 4 }, max: { w: 8, h: 8 } },
    cacheTtlSeconds: 300,
  },
  configSchema,
  fields: [
    { key: "baseUrl", label: "Gitea-URL", type: "url", placeholder: "https://gitea.home", required: true, help: "Öffentliche, private und lokale HTTP(S)-Ziele sind erlaubt." },
    { key: "token", label: "Access Token", type: "password", placeholder: "Bereits gesetztes Secret bleibt erhalten", help: "Wird verschlüsselt gespeichert und nie an den Browser zurückgegeben." },
    { key: "limit", label: "Repositories", type: "number", min: 2, max: 12, step: 1 },
  ],
  secretFields: ["token"],
  createProvider: ({ http }) => ({
    async load(config) {
      const base = config.baseUrl.replace(/\/$/, "");
      const authenticated = Boolean(config.token);
      const endpoint = authenticated ? `${base}/api/v1/user/repos?limit=${config.limit}&sort=updated` : `${base}/api/v1/repos/search?limit=${config.limit}&sort=updated`;
      const response = await http.getJson<unknown>(endpoint, {
        headers: config.token ? { authorization: `token ${config.token}` } : undefined,
      });
      const resultObject = response && typeof response === "object" ? response as Record<string, unknown> : {};
      const repositories = Array.isArray(response) ? response : Array.isArray(resultObject.data) ? resultObject.data : [];
      return {
        repositories: repositories.slice(0, config.limit).map((value) => {
          const repo = value && typeof value === "object" ? value as Record<string, unknown> : {};
          return {
            id: String(repo.id ?? ""),
            name: String(repo.full_name ?? repo.name ?? "Repository"),
            url: safeRepositoryUrl(repo.html_url ?? `${base}/${repo.full_name ?? ""}`, base),
            language: String(repo.language ?? "Other"),
            stars: Number(repo.stars_count ?? 0),
            forks: Number(repo.forks_count ?? 0),
            updatedAt: String(repo.updated_at ?? ""),
            private: Boolean(repo.private),
          };
        }),
      };
    },
  }),
});
