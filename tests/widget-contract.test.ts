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

  it("validates and normalizes Prometheus metrics links", () => {
    const prometheus = generatedWidgetDefinitions.find((item) => item.manifest.type === "prometheus")!;
    expect(prometheus.configSchema.parse({ metricsUrl: "prometheus.home/metrics" })).toEqual({ metricsUrl: "https://prometheus.home/metrics" });
    expect(() => prometheus.configSchema.parse({ metricsUrl: "ftp://prometheus.home/metrics" })).toThrow();
    expect(() => prometheus.configSchema.parse({ metricsUrl: "" })).toThrow();
  });

  it("rejects non-HTTP shortcut protocols", () => {
    const links = generatedWidgetDefinitions.find((item) => item.manifest.type === "links")!;
    expect(() => links.configSchema.parse({ links: [{ label: "Unsafe", url: "javascript:alert(1)", icon: "external" }] })).toThrow();
    expect(() => links.configSchema.parse({ links: [{ label: "Safe", url: "https://router.home", icon: "router" }] })).not.toThrow();
  });
});
