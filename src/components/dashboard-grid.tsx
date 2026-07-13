"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Responsive, WidthProvider, type Layouts } from "react-grid-layout";
import type { ClientWidget, WidgetCatalogItem, WidgetLayout } from "@/widget-engine/contracts";
import { mergeBreakpointLayout, type GridLayoutItem } from "@/widget-engine/layout";
import WidgetFrame from "./widget-frame";

const ResponsiveGrid = WidthProvider(Responsive);

type Props = {
  widgets: ClientWidget[];
  catalog: WidgetCatalogItem[];
  editing: boolean;
  compact: boolean;
  onLayoutsChange(layouts: Record<string, WidgetLayout>): void;
  onEdit(widget: ClientWidget): void;
  onDelete(widget: ClientWidget): void;
};

const breakpointMap = { lg: "desktop", md: "tablet", sm: "mobile" } as const;
type GridBreakpoint = keyof typeof breakpointMap;

const columnsByBreakpoint: Record<GridBreakpoint, number> = { lg: 12, md: 8, sm: 1 };
const resizeHandles: Array<"s" | "e" | "w" | "se" | "sw"> = ["s", "e", "w", "se", "sw"];

function isGridBreakpoint(value: string): value is GridBreakpoint {
  return value in breakpointMap;
}

export default function DashboardGrid({ widgets, catalog, editing, compact, onLayoutsChange, onEdit, onDelete }: Props) {
  const catalogMap = useMemo(() => new Map(catalog.map((item) => [item.type, item])), [catalog]);
  const activeBreakpointRef = useRef<GridBreakpoint>("lg");
  const [activeBreakpoint, setActiveBreakpoint] = useState<GridBreakpoint>("lg");
  const layouts = useMemo<Layouts>(() => {
    const result: Layouts = { lg: [], md: [], sm: [] };
    for (const widget of widgets) {
      const definition = catalogMap.get(widget.type);
      if (!definition) continue;
      for (const [breakpoint, key] of Object.entries(breakpointMap) as Array<[keyof typeof breakpointMap, keyof WidgetLayout]>) {
        const position = widget.layout[key];
        const mobile = breakpoint === "sm";
        result[breakpoint]!.push({
          i: widget.id,
          ...position,
          minW: mobile ? 1 : definition.size.min.w,
          minH: definition.size.min.h,
          maxW: mobile ? 1 : definition.size.max?.w,
          maxH: definition.size.max?.h,
        });
      }
    }
    return result;
  }, [widgets, catalogMap]);

  function commit(currentLayout: GridLayoutItem[]) {
    onLayoutsChange(mergeBreakpointLayout(widgets, breakpointMap[activeBreakpointRef.current], currentLayout));
  }

  function changeBreakpoint(value: string) {
    if (!isGridBreakpoint(value)) return;
    activeBreakpointRef.current = value;
    setActiveBreakpoint(value);
  }

  function keyboardLayout(widget: ClientWidget, definition: WidgetCatalogItem, event: KeyboardEvent<HTMLButtonElement>) {
    const deltas: Record<string, { x: number; y: number }> = {
      ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
    };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    const nextLayout = structuredClone(widget.layout);
    const breakpoint = activeBreakpointRef.current;
    const key = breakpointMap[breakpoint];
    const columns = columnsByBreakpoint[breakpoint];
    const item = nextLayout[key];
    if (event.shiftKey) {
      const minW = key === "mobile" ? 1 : Math.min(definition.size.min.w, columns);
      const maxW = key === "mobile" ? 1 : Math.min(definition.size.max?.w ?? columns, columns);
      const maxH = definition.size.max?.h ?? 24;
      const nextWidth = Math.min(maxW, Math.max(minW, item.w + delta.x));
      item.x = Math.max(0, Math.min(item.x, columns - nextWidth));
      item.w = nextWidth;
      item.h = Math.min(maxH, Math.max(definition.size.min.h, item.h + delta.y));
    } else {
      item.x = Math.max(0, Math.min(columns - item.w, item.x + delta.x));
      item.y = Math.max(0, item.y + delta.y);
    }
    onLayoutsChange(Object.fromEntries(widgets.map((item) => [item.id, item.id === widget.id ? nextLayout : item.layout])));
  }

  if (widgets.length === 0) return <div className="empty-dashboard"><span>00</span><h3>Noch keine Signale</h3><p>Öffne den Widget-Katalog und stelle deinen ersten Control Room zusammen.</p></div>;

  return (
    <div className={`dashboard-grid ${editing ? "grid-editing" : ""}`} data-grid-breakpoint={activeBreakpoint}>
      <ResponsiveGrid
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 768, sm: 0 }}
        cols={{ lg: 12, md: 8, sm: 1 }}
        rowHeight={compact ? 72 : 80}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        isDraggable={editing}
        isResizable={editing}
        resizeHandles={resizeHandles}
        draggableHandle=".widget-drag-handle"
        onBreakpointChange={changeBreakpoint}
        onDragStop={(current) => commit(current)}
        onResizeStop={(current) => commit(current)}
        compactType="vertical"
        useCSSTransforms
      >
        {widgets.map((widget) => {
          const definition = catalogMap.get(widget.type);
          if (!definition) return <div key={widget.id} className="widget-missing">Unbekanntes Widget: {widget.type}</div>;
          return <div key={widget.id}><WidgetFrame widget={widget} definition={definition} editing={editing} onEdit={() => onEdit(widget)} onDelete={() => onDelete(widget)} onKeyboardLayout={(event) => keyboardLayout(widget, definition, event)} /></div>;
        })}
      </ResponsiveGrid>
    </div>
  );
}
