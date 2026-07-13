import { z } from "zod";
import type { GridPosition, WidgetLayout, WidgetSize } from "./contracts";

type WidgetWithLayout = {
  id: string;
  layout: WidgetLayout;
};

export type GridLayoutItem = GridPosition & {
  i: string;
};

export const gridPositionSchema = z
  .object({
    x: z.number().int().min(0).max(12),
    y: z.number().int().min(0).max(10_000),
    w: z.number().int().min(1).max(12),
    h: z.number().int().min(1).max(24),
  })
  .strict();

export const widgetLayoutSchema = z
  .object({
    desktop: gridPositionSchema,
    tablet: gridPositionSchema,
    mobile: gridPositionSchema,
  })
  .strict();

export function createDefaultLayout(size: WidgetSize, index = 0): WidgetLayout {
  const y = Math.floor(index / 2) * size.default.h;
  return {
    desktop: { x: (index * size.default.w) % 12, y, ...size.default },
    tablet: { x: (index * Math.min(size.default.w, 4)) % 8, y, w: Math.min(size.default.w, 8), h: size.default.h },
    mobile: { x: 0, y: index * size.default.h, w: 1, h: size.default.h },
  };
}

export function mergeBreakpointLayout(
  widgets: WidgetWithLayout[],
  breakpoint: keyof WidgetLayout,
  currentLayout: GridLayoutItem[],
) {
  const positions = new Map(
    currentLayout.map((item) => [item.i, { x: item.x, y: item.y, w: item.w, h: item.h }]),
  );

  return Object.fromEntries(
    widgets.map((widget) => [
      widget.id,
      {
        ...widget.layout,
        [breakpoint]: positions.get(widget.id) ?? widget.layout[breakpoint],
      },
    ]),
  ) as Record<string, WidgetLayout>;
}

export function validateLayoutForSize(layout: WidgetLayout, size: WidgetSize) {
  const parsed = widgetLayoutSchema.parse(layout);
  const entries = Object.entries(parsed) as Array<[keyof WidgetLayout, WidgetLayout[keyof WidgetLayout]]>;
  for (const [breakpoint, item] of entries) {
    const isMobile = breakpoint === "mobile";
    if (isMobile && (item.x !== 0 || item.w !== 1)) {
      throw new Error(`${breakpoint} layout must use the single mobile column`);
    }
    if ((!isMobile && item.w < size.min.w) || item.h < size.min.h) {
      throw new Error(`${breakpoint} layout is smaller than the widget minimum`);
    }
    if (size.max && ((!isMobile && item.w > size.max.w) || item.h > size.max.h)) {
      throw new Error(`${breakpoint} layout exceeds the widget maximum`);
    }
    const columns = breakpoint === "desktop" ? 12 : breakpoint === "tablet" ? 8 : 1;
    if (item.x + item.w > columns) throw new Error(`${breakpoint} layout exceeds the grid`);
  }
  return parsed;
}
