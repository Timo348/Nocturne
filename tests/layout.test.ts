import { describe, expect, it } from "vitest";
import { createDefaultLayout, mergeBreakpointLayout, validateLayoutForSize, widgetLayoutSchema } from "@/widget-engine/layout";

const size = { default: { w: 4, h: 4 }, min: { w: 3, h: 3 }, max: { w: 8, h: 8 } };

describe("responsive widget layouts", () => {
  it("creates a valid desktop, tablet and one-column mobile placement", () => {
    const layout = createDefaultLayout(size, 1);
    expect(widgetLayoutSchema.parse(layout)).toEqual(layout);
    expect(layout.mobile).toMatchObject({ x: 0, w: 1 });
    expect(() => validateLayoutForSize(layout, size)).not.toThrow();
  });

  it("rejects placements outside the breakpoint grid", () => {
    const layout = createDefaultLayout(size);
    layout.desktop = { x: 10, y: 0, w: 4, h: 4 };
    expect(() => validateLayoutForSize(layout, size)).toThrow(/exceeds the grid/i);
  });

  it("rejects desktop sizes below the widget contract", () => {
    const layout = createDefaultLayout(size);
    layout.desktop = { x: 0, y: 0, w: 2, h: 2 };
    expect(() => validateLayoutForSize(layout, size)).toThrow(/smaller/i);
  });

  it("merges the stopped grid layout into the active breakpoint only", () => {
    const first = createDefaultLayout(size);
    const second = createDefaultLayout(size, 1);
    const widgets = [
      { id: "first", layout: first },
      { id: "second", layout: second },
    ];

    const merged = mergeBreakpointLayout(widgets, "tablet", [
      { i: "first", x: 4, y: 2, w: 4, h: 5 },
      { i: "second", x: 0, y: 7, w: 4, h: 4 },
    ]);

    expect(merged.first.tablet).toEqual({ x: 4, y: 2, w: 4, h: 5 });
    expect(merged.second.tablet).toEqual({ x: 0, y: 7, w: 4, h: 4 });
    expect(merged.first.desktop).toEqual(first.desktop);
    expect(merged.first.mobile).toEqual(first.mobile);
  });

  it("enforces widget height limits on the fixed one-column mobile layout", () => {
    const tooShort = createDefaultLayout(size);
    tooShort.mobile.h = size.min.h - 1;
    expect(() => validateLayoutForSize(tooShort, size)).toThrow(/smaller/i);

    const tooTall = createDefaultLayout(size);
    tooTall.mobile.h = size.max.h + 1;
    expect(() => validateLayoutForSize(tooTall, size)).toThrow(/maximum/i);

    const tooWide = createDefaultLayout(size);
    tooWide.mobile.w = 2;
    expect(() => validateLayoutForSize(tooWide, size)).toThrow(/single mobile column/i);
  });
});
