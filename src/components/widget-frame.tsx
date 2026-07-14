"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { GripHorizontal, MoreHorizontal, RefreshCw, Settings2, Trash2 } from "lucide-react";
import { generatedWidgetComponents } from "@/generated/widget-registry.client";
import type { ClientWidget, WidgetCatalogItem } from "@/widget-engine/contracts";
import { WidgetIcon } from "./icon-map";

type Props = {
  widget: ClientWidget;
  definition: WidgetCatalogItem;
  editing: boolean;
  dataUrl?: string;
  canManage?: boolean;
  autoRefresh?: boolean;
  onEdit(): void;
  onDelete(): void;
  onKeyboardLayout(event: KeyboardEvent<HTMLButtonElement>): void;
};

type DataState = { loading: boolean; data?: unknown; error?: string; updatedAt?: string; cached?: boolean };

function timeLabel(value?: string) {
  if (!value) return "Noch nicht aktualisiert";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Gerade aktualisiert";
  if (seconds < 3600) return `Vor ${Math.floor(seconds / 60)} Min. aktualisiert`;
  return `Vor ${Math.floor(seconds / 3600)} Std. aktualisiert`;
}

export default function WidgetFrame({ widget, definition, editing, dataUrl, canManage = true, autoRefresh = false, onEdit, onDelete, onKeyboardLayout }: Props) {
  const [state, setState] = useState<DataState>({ loading: Boolean(definition.cacheTtlSeconds || definition.type !== "links") });
  const [menu, setMenu] = useState(false);
  const View = generatedWidgetComponents[widget.type];

  async function load() {
    if (!definition.cacheTtlSeconds && widget.type === "links") {
      setState({ loading: false, data: null, updatedAt: widget.updatedAt });
      return;
    }
    setState((current) => ({ ...current, loading: true, error: undefined }));
    try {
      const response = await fetch(dataUrl ?? `/api/widgets/${widget.id}/data`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Widget data failed");
      setState({ loading: false, data: body.data, updatedAt: body.updatedAt, cached: body.cached });
    } catch (reason) {
      setState({ loading: false, error: reason instanceof Error ? reason.message : "Datenfehler" });
    }
  }

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [widget.id, widget.updatedAt, dataUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!autoRefresh || (!definition.cacheTtlSeconds && widget.type === "links")) return;
    const seconds = Math.max(15, definition.cacheTtlSeconds || 30);
    const timer = window.setInterval(() => void load(), seconds * 1000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, dataUrl, definition.cacheTtlSeconds, widget.id, widget.type]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <article className={`widget-frame ${editing ? "is-editing" : ""}`} data-widget-id={widget.id} data-widget-type={widget.type} data-widget-title={widget.title} style={{ "--widget-accent": definition.accent } as React.CSSProperties}>
      <div className="widget-accent" />
      <header className="widget-header">
        <div className="widget-identity">
          <span className="widget-icon"><WidgetIcon name={definition.icon} size={16} /></span>
          <span><strong>{widget.title}</strong><small>{definition.name}</small></span>
        </div>
        <div className="widget-actions">
          {editing && <button className="icon-button widget-drag-handle" title="Ziehen oder mit Pfeiltasten verschieben; Shift ändert die Größe" aria-label="Widget verschieben" onKeyDown={onKeyboardLayout}><GripHorizontal size={17} /></button>}
          <button className="icon-button" onClick={() => setMenu((value) => !value)} aria-label="Widget-Menü" title="Widget-Menü"><MoreHorizontal size={17} /></button>
          {menu && <div className="widget-menu"><button onClick={() => { setMenu(false); void load(); }}><RefreshCw size={14} /> Aktualisieren</button>{canManage && <button onClick={() => { setMenu(false); onEdit(); }}><Settings2 size={14} /> Konfigurieren</button>}{canManage && editing && <button className="danger-item" onClick={() => { setMenu(false); onDelete(); }}><Trash2 size={14} /> Entfernen</button>}</div>}
        </div>
      </header>
      <div className="widget-content">{View ? <View config={widget.config} data={state.data} loading={state.loading} error={state.error} /> : <div className="inline-error">Widget-Renderer fehlt.</div>}</div>
      <footer className="widget-footer"><span className={state.error ? "status-dot status-error" : "status-dot"} />{state.error ? "Verbindung gestört" : timeLabel(state.updatedAt)}{state.cached && <span className="cache-tag">CACHE</span>}</footer>
    </article>
  );
}
