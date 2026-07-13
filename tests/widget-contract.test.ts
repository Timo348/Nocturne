import { describe, expect, it } from "vitest";
import { generatedWidgetDefinitions } from "@/generated/widget-registry.server";
import { canUseWidget } from "@/widget-engine/contracts";

describe("generated widget registry", () => {
  it("auto-discovers all seven widgets with unique IDs", () => {
    const types = generatedWidgetDefinitions.map((definition) => definition.manifest.type);
    expect(types).toEqual(["gitea", "infrastructure", "links", "prometheus", "rest", "rss", "weather"]);
    expect(new Set(types).size).toBe(types.length);
  });

  it("provides a complete strict contract for every widget", () => {
    for (const definition of generatedWidgetDefinitions) {
      expect(definition.manifest.name.length).toBeGreaterThan(0);
      expect(definition.manifest.icon.length).toBeGreaterThan(0);
      expect(definition.manifest.allowedRoles.length).toBeGreaterThan(0);
      expect(definition.configSchema).toBeDefined();
      expect(definition.fields).toBeInstanceOf(Array);
      expect(definition.secretFields).toBeInstanceOf(Array);
    }
  });

  it("keeps developer integrations out of the viewer role", () => {
    const gitea = generatedWidgetDefinitions.find((item) => item.manifest.type === "gitea")!;
    const prometheus = generatedWidgetDefinitions.find((item) => item.manifest.type === "prometheus")!;
    const rest = generatedWidgetDefinitions.find((item) => item.manifest.type === "rest")!;
    const weather = generatedWidgetDefinitions.find((item) => item.manifest.type === "weather")!;
    expect(canUseWidget("VIEWER", gitea)).toBe(false);
    expect(canUseWidget("VIEWER", prometheus)).toBe(false);
    expect(canUseWidget("VIEWER", rest)).toBe(false);
    expect(canUseWidget("VIEWER", weather)).toBe(true);
    expect(canUseWidget("DEVELOPER", gitea)).toBe(true);
  });

  it("validates Prometheus URLs and metric display settings", () => {
    const prometheus = generatedWidgetDefinitions.find((item) => item.manifest.type === "prometheus")!;
    const valid = { baseUrl: "https://prometheus.home", query: "up", label: "Targets", reduction: "sum", unit: "percent", decimals: 1, headerName: "", headerValue: "" };
    expect(() => prometheus.configSchema.parse(valid)).not.toThrow();
    expect(() => prometheus.configSchema.parse({ ...valid, baseUrl: "ftp://prometheus.home" })).toThrow();
    expect(() => prometheus.configSchema.parse({ ...valid, decimals: 8 })).toThrow();
  });

  it("rejects non-HTTP shortcut protocols", () => {
    const links = generatedWidgetDefinitions.find((item) => item.manifest.type === "links")!;
    expect(() => links.configSchema.parse({ links: [{ label: "Unsafe", url: "javascript:alert(1)", icon: "external" }] })).toThrow();
    expect(() => links.configSchema.parse({ links: [{ label: "Safe", url: "https://router.home", icon: "router" }] })).not.toThrow();
  });
});
