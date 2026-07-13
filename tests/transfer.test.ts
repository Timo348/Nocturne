import { describe, expect, it } from "vitest";
import { validateTransfer } from "@/lib/transfer";

type TransferFixture = {
  formatVersion: 1;
  dashboard: {
    name: string;
    description: string;
    environment: string;
    widgets: Array<{
      type: string;
      definitionVersion: number;
      title: string;
      config: Record<string, unknown>;
      layout: {
        desktop: { x: number; y: number; w: number; h: number };
        tablet: { x: number; y: number; w: number; h: number };
        mobile: { x: number; y: number; w: number; h: number };
      };
    }>;
  };
};

const baseTransfer: TransferFixture = {
  formatVersion: 1 as const,
  dashboard: {
    name: "Imported lab",
    description: "Portable setup",
    environment: "Test network",
    widgets: [
      {
        type: "weather",
        definitionVersion: 1,
        title: "Weather",
        config: { label: "Berlin", latitude: 52.52, longitude: 13.405, temperatureUnit: "celsius" },
        layout: {
          desktop: { x: 0, y: 0, w: 3, h: 4 },
          tablet: { x: 0, y: 0, w: 3, h: 4 },
          mobile: { x: 0, y: 0, w: 1, h: 4 },
        },
      },
    ],
  },
};

describe("dashboard transfer validation", () => {
  it("accepts a versioned dashboard that matches the discovered widget contract", () => {
    const parsed = validateTransfer(baseTransfer, "VIEWER");
    expect(parsed.dashboard.widgets).toHaveLength(1);
    expect(parsed.dashboard.widgets[0].type).toBe("weather");
  });

  it("rejects role-restricted widgets even when injected through an import", () => {
    const restTransfer = structuredClone(baseTransfer);
    restTransfer.dashboard.widgets[0] = {
      ...restTransfer.dashboard.widgets[0],
      type: "rest",
      title: "Restricted API",
      config: { url: "https://example.com/status", valuePath: "value", label: "Value", prefix: "", suffix: "", headerName: "", headerValue: "" },
      layout: {
        desktop: { x: 0, y: 0, w: 3, h: 3 },
        tablet: { x: 0, y: 0, w: 3, h: 3 },
        mobile: { x: 0, y: 0, w: 1, h: 3 },
      },
    };
    expect(() => validateTransfer(restTransfer, "VIEWER")).toThrow(/cannot import rest/i);
  });

  it("rejects layouts that exceed their breakpoint grid", () => {
    const invalid = structuredClone(baseTransfer);
    invalid.dashboard.widgets[0].layout.desktop = { x: 11, y: 0, w: 3, h: 4 };
    expect(() => validateTransfer(invalid, "ADMIN")).toThrow(/exceeds the grid/i);
  });
});
