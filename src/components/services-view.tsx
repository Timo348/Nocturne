"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, CheckCircle2, CircleHelp, ExternalLink, LayoutDashboard, RefreshCw,
  Search, Settings2, TriangleAlert,
} from "lucide-react";
import type { ClientDashboard, ClientWidget, WidgetCatalogItem } from "@/widget-engine/contracts";
import { WidgetIcon } from "./icon-map";

type ServiceState = "checking" | "online" | "degraded" | "unmonitored";

type ServiceEntry = {
  dashboard: ClientDashboard;
  widget: ClientWidget;
  definition: WidgetCatalogItem;
  endpoint: string;
};

type Props = {
  dashboards: ClientDashboard[];
  catalog: WidgetCatalogItem[];
  onOpenDashboard(dashboardId: string): void;
  onConfigure(dashboardId: string, widget: ClientWidget, definition: WidgetCatalogItem): void;
};

const statusLabels: Record<ServiceState, string> = {
  checking: "Wird geprüft",
  online: "Erreichbar",
  degraded: "Gestört",
  unmonitored: "Nicht überwacht",
};

function endpointLabel(widget: ClientWidget) {
  const config = widget.config;
  const candidate = config.baseUrl || config.url || config.collectorUrl;
  if (typeof candidate === "string" && candidate) {
    try {
      return new URL(candidate).host;
    } catch {
      return candidate;
    }
  }
  if (widget.type === "links") {
    const count = Array.isArray(config.links) ? config.links.length : 0;
    return `${count} ${count === 1 ? "Weiterleitung" : "Weiterleitungen"}`;
  }
  if (widget.type === "weather") return "Open-Meteo";
  if (widget.type === "infrastructure") return "Lokaler Host";
  return "Interne Datenquelle";
}

export default function ServicesView({ dashboards, catalog, onOpenDashboard, onConfigure }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | ServiceState>("all");
  const [states, setStates] = useState<Record<string, ServiceState>>({});
  const [checking, setChecking] = useState(false);
  const runId = useRef(0);

  const services = useMemo<ServiceEntry[]>(() => {
    const definitions = new Map(catalog.map((item) => [item.type, item]));
    return dashboards.flatMap((dashboard) => dashboard.widgets.flatMap((widget) => {
      const definition = definitions.get(widget.type);
      return definition ? [{ dashboard, widget, definition, endpoint: endpointLabel(widget) }] : [];
    }));
  }, [dashboards, catalog]);

  async function checkServices() {
    const currentRun = ++runId.current;
    setChecking(true);
    setStates(Object.fromEntries(services.map(({ widget }) => [widget.id, widget.type === "links" ? "unmonitored" : "checking"])));
    const results = await Promise.all(services.map(async ({ widget }) => {
      if (widget.type === "links") return [widget.id, "unmonitored"] as const;
      try {
        const response = await fetch(`/api/widgets/${widget.id}/data`, { cache: "no-store" });
        return [widget.id, response.ok ? "online" : "degraded"] as const;
      } catch {
        return [widget.id, "degraded"] as const;
      }
    }));
    if (currentRun !== runId.current) return;
    setStates(Object.fromEntries(results));
    setChecking(false);
  }

  useEffect(() => {
    const task = window.setTimeout(() => void checkServices(), 0);
    return () => {
      window.clearTimeout(task);
      runId.current += 1;
    };
    // A new service list should always trigger a fresh, server-side provider check.
  }, [services]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = services.filter(({ widget, dashboard, definition, endpoint }) => {
    const needle = query.trim().toLowerCase();
    const matchesQuery = !needle || [widget.title, dashboard.name, definition.name, definition.category, endpoint].some((value) => value.toLowerCase().includes(needle));
    const state = states[widget.id] ?? (widget.type === "links" ? "unmonitored" : "checking");
    return matchesQuery && (filter === "all" || state === filter);
  });
  const online = services.filter(({ widget }) => states[widget.id] === "online").length;
  const degraded = services.filter(({ widget }) => states[widget.id] === "degraded").length;

  return (
    <section className="workspace-view services-view" aria-labelledby="services-title">
      <header className="workspace-header">
        <div><span className="workspace-kicker"><Activity size={15} /> LIVE SERVICE CHECK</span><h1 id="services-title">Services</h1><p>Alle konfigurierten Integrationen und Weiterleitungen deiner Dashboards an einem Ort.</p></div>
        <button className="secondary-button" onClick={() => void checkServices()} disabled={checking}><RefreshCw className={checking ? "spin" : ""} size={16} /> {checking ? "Prüft …" : "Neu prüfen"}</button>
      </header>

      <div className="workspace-summary" aria-label="Service-Übersicht">
        <article><small>GESAMT</small><strong>{services.length}</strong><span>konfigurierte Services</span></article>
        <article className="summary-online"><small>ERREICHBAR</small><strong>{online}</strong><span>Provider antworten</span></article>
        <article className={degraded ? "summary-error" : ""}><small>GESTÖRT</small><strong>{degraded}</strong><span>Prüfung fehlgeschlagen</span></article>
      </div>

      <div className="workspace-toolbar">
        <label className="workspace-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Services, Dashboards oder Endpunkte durchsuchen" /></label>
        <div className="filter-tabs" aria-label="Status filtern">
          {(["all", "online", "degraded", "unmonitored"] as const).map((value) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "all" ? "Alle" : statusLabels[value]}</button>)}
        </div>
      </div>

      <div className="service-list">
        {visible.map(({ dashboard, widget, definition, endpoint }) => {
          const state = states[widget.id] ?? (widget.type === "links" ? "unmonitored" : "checking");
          const StatusIcon = state === "online" ? CheckCircle2 : state === "degraded" ? TriangleAlert : state === "checking" ? RefreshCw : CircleHelp;
          return <article className="service-row" key={widget.id}>
            <span className="service-icon" style={{ "--service-accent": definition.accent } as React.CSSProperties}><WidgetIcon name={definition.icon} size={20} /></span>
            <div className="service-copy"><div><strong>{widget.title}</strong><span>{definition.category}</span></div><p>{endpoint}</p><small>{dashboard.name} · {definition.name}</small></div>
            <span className={`service-status status-${state}`}><StatusIcon className={state === "checking" ? "spin" : ""} size={15} /> {statusLabels[state]}</span>
            <div className="service-actions"><button className="icon-button" onClick={() => onConfigure(dashboard.id, widget, definition)} title="Service konfigurieren" aria-label={`${widget.title} konfigurieren`}><Settings2 size={17} /></button><button className="secondary-button compact-button" onClick={() => onOpenDashboard(dashboard.id)}><LayoutDashboard size={15} /> Dashboard</button>{typeof widget.config.url === "string" && widget.config.url && <a className="icon-button" href={widget.config.url} target="_blank" rel="noreferrer" title="Endpunkt öffnen" aria-label={`${widget.title} öffnen`}><ExternalLink size={16} /></a>}</div>
          </article>;
        })}
        {visible.length === 0 && <div className="workspace-empty"><Search size={24} /><strong>Keine passenden Services</strong><p>Ändere den Suchbegriff oder den Statusfilter.</p></div>}
      </div>
    </section>
  );
}
