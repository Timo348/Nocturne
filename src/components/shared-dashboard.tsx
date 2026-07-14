"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CloudOff, LoaderCircle, SlidersHorizontal } from "lucide-react";
import type { ClientDashboard, WidgetCatalogItem, WidgetLayout } from "@/widget-engine/contracts";
import DashboardGrid from "./dashboard-grid";

type SaveStatus = "saved" | "pending" | "saving" | "error" | "conflict";

function statusLabel(status: SaveStatus) {
  if (status === "saving") return "Speichert …";
  if (status === "pending") return "Änderung vorgemerkt";
  if (status === "conflict") return "Geändert · neu laden";
  if (status === "error") return "Speichern fehlgeschlagen";
  return "Layout gespeichert";
}

export default function SharedDashboard({ token, initialDashboard, catalog }: { token: string; initialDashboard: ClientDashboard; catalog: WidgetCatalogItem[] }) {
  const [dashboard, setDashboardState] = useState(initialDashboard);
  const dashboardRef = useRef(initialDashboard);
  const [editing, setEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef(false);
  const queued = useRef(false);

  function setDashboard(update: ClientDashboard | ((current: ClientDashboard) => ClientDashboard)) {
    setDashboardState((current) => {
      const next = typeof update === "function" ? update(current) : update;
      dashboardRef.current = next;
      return next;
    });
  }

  useEffect(() => () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
  }, []);

  async function flushLayouts() {
    if (saving.current) { queued.current = true; return; }
    const current = dashboardRef.current;
    saving.current = true;
    setSaveStatus("saving");
    try {
      const response = await fetch(`/api/shared/${token}/layout`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ revision: current.revision, layouts: current.widgets.map((widget) => ({ id: widget.id, layout: widget.layout })) }),
      });
      const body = await response.json();
      if (response.status === 409) { setSaveStatus("conflict"); return; }
      if (!response.ok) throw new Error(body.error ?? "Layout konnte nicht gespeichert werden.");
      setDashboard((latest) => ({ ...latest, revision: body.revision }));
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    } finally {
      saving.current = false;
      if (queued.current) {
        queued.current = false;
        saveTimer.current = setTimeout(() => void flushLayouts(), 250);
      }
    }
  }

  function updateLayouts(layouts: Record<string, WidgetLayout>) {
    setDashboard((current) => ({
      ...current,
      widgets: current.widgets.map((widget) => ({ ...widget, layout: layouts[widget.id] ?? widget.layout })),
    }));
    setSaveStatus("pending");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void flushLayouts(), 650);
  }

  function toggleEditing() {
    if (saveStatus === "conflict") { window.location.reload(); return; }
    if (editing && saveStatus === "pending") {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
      void flushLayouts();
    }
    setEditing((value) => !value);
  }

  const StatusIcon = saveStatus === "saving" ? LoaderCircle : saveStatus === "error" || saveStatus === "conflict" ? CloudOff : Check;

  return (
    <main data-theme={dashboard.shareTheme} className={`shared-dashboard-shell ${editing ? "is-editing" : ""}`} aria-label={`Geteiltes Dashboard ${dashboard.name}`}>
      <div className="shared-dashboard-aurora" aria-hidden="true" />
      <h1 className="sr-only">{dashboard.name}</h1>
      <DashboardGrid
        widgets={dashboard.widgets}
        catalog={catalog}
        editing={editing}
        compact={false}
        manageWidgets={false}
        autoRefresh
        widgetDataBasePath={`/api/shared/${token}/widgets`}
        onLayoutsChange={updateLayouts}
      />
      <div className={`shared-layout-dock ${editing ? "active" : ""}`}>
        {editing && <span className={`shared-save-status ${saveStatus}`} aria-live="polite"><StatusIcon className={saveStatus === "saving" ? "spin" : undefined} size={12} /> {statusLabel(saveStatus)}</span>}
        <button
          type="button"
          className="shared-layout-toggle"
          onClick={toggleEditing}
          title={editing ? "Layout-Modus beenden" : "Widgets verschieben"}
          aria-label={editing ? "Layout-Modus beenden" : "Widgets verschieben"}
          aria-pressed={editing}
        >
          {editing ? <Check size={15} /> : <SlidersHorizontal size={14} />}
          {editing && <span>Fertig</span>}
        </button>
      </div>
    </main>
  );
}
