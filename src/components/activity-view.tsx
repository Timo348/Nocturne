"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, LayoutDashboard, LoaderCircle, RefreshCw, SlidersHorizontal, Sparkles } from "lucide-react";
import type { ClientDashboard } from "@/widget-engine/contracts";

type ActivityEvent = {
  id: string;
  action: "created" | "updated" | "deleted" | "imported" | "layout_updated" | string;
  entityType: string;
  entityId?: string;
  dashboardId?: string;
  message: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

type Props = { dashboards: ClientDashboard[] };

function relativeTime(value: string) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  return `vor ${days} ${days === 1 ? "Tag" : "Tagen"}`;
}

export default function ActivityView({ dashboards }: Props) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [dashboardId, setDashboardId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/activity", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Aktivitäten konnten nicht geladen werden.");
      setEvents(Array.isArray(body.events) ? body.events : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Aktivitäten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { const task = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(task); }, []);

  const names = useMemo(() => new Map(dashboards.map((dashboard) => [dashboard.id, dashboard.name])), [dashboards]);
  const visible = dashboardId === "all" ? events : events.filter((event) => event.dashboardId === dashboardId);

  return (
    <section className="workspace-view activity-view" aria-labelledby="activity-title">
      <header className="workspace-header"><div><span className="workspace-kicker"><Sparkles size={15} /> PERSISTENT EVENT LOG</span><h1 id="activity-title">Activity</h1><p>Nachvollziehbare Änderungen an Dashboards, Widgets und Layouts – nur für deinen Account.</p></div><button className="secondary-button" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "spin" : ""} size={16} /> Aktualisieren</button></header>
      <div className="activity-filter"><label><SlidersHorizontal size={16} /><span>Dashboard</span><select value={dashboardId} onChange={(event) => setDashboardId(event.target.value)}><option value="all">Alle Dashboards</option>{dashboards.map((dashboard) => <option value={dashboard.id} key={dashboard.id}>{dashboard.name}</option>)}</select></label><span>{visible.length} Ereignisse</span></div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="activity-timeline" aria-live="polite">
        {loading && events.length === 0 && <div className="workspace-empty"><LoaderCircle className="spin" size={25} /><strong>Aktivitäten werden geladen</strong></div>}
        {!loading && !error && visible.length === 0 && <div className="workspace-empty"><Activity size={25} /><strong>Noch keine Aktivitäten</strong><p>Neue Änderungen werden ab jetzt automatisch protokolliert.</p></div>}
        {visible.map((event) => {
          const Icon = event.action === "layout_updated" ? SlidersHorizontal : event.entityType === "dashboard" ? LayoutDashboard : Activity;
          return <article className={`activity-entry action-${event.action}`} key={event.id}><span className="activity-marker"><Icon size={17} /></span><div><strong>{event.message}</strong><p>{event.dashboardId ? names.get(event.dashboardId) ?? "Gelöschtes Dashboard" : "Account"} · {event.entityType}</p></div><time dateTime={event.createdAt} title={new Date(event.createdAt).toLocaleString("de-DE")}>{relativeTime(event.createdAt)}</time></article>;
        })}
      </div>
    </section>
  );
}
