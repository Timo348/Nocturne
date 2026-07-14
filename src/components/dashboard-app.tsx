"use client";

import { useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import {
  Activity, Bell, Boxes, Check, ChevronDown, Clock3, CloudOff, Command, Download, Gauge,
  LayoutDashboard, LoaderCircle, LogOut, Menu, Network, PanelLeftClose, PanelLeftOpen, PencilLine,
  Plus, Search, Server, Settings, Share2, ShieldCheck, SlidersHorizontal, Sparkles, Upload, X, Zap,
} from "lucide-react";
import type { BootstrapData, ClientWidget, WidgetCatalogItem, WidgetLayout } from "@/widget-engine/contracts";
import DashboardGrid from "./dashboard-grid";
import ActivityView from "./activity-view";
import ServicesView from "./services-view";
import SettingsView from "./settings-view";
import WidgetCatalog from "./widget-catalog";
import WidgetConfigDrawer from "./widget-config-drawer";
import { NewDashboardDialog, TransferDialog } from "./dashboard-dialogs";
import ShareDashboardDialog from "./share-dashboard-dialog";

type SaveStatus = "saved" | "pending" | "saving" | "error" | "conflict";
type AppSection = "dashboards" | "services" | "activity" | "settings";

const roleLabels = { ADMIN: "Administrator", DEVELOPER: "Developer", VIEWER: "Viewer" };

function SaveIndicator({ status, onRetry }: { status: SaveStatus; onRetry(): void }) {
  if (status === "saving") return <span className="save-indicator saving"><LoaderCircle className="spin" size={13} /> Speichert …</span>;
  if (status === "pending") return <span className="save-indicator pending"><Clock3 size={13} /> Änderung vorgemerkt</span>;
  if (status === "error") return <button className="save-indicator error" onClick={onRetry}><CloudOff size={13} /> Fehler · erneut versuchen</button>;
  if (status === "conflict") return <button className="save-indicator error" onClick={() => window.location.reload()}><CloudOff size={13} /> Konflikt · neu laden</button>;
  return <span className="save-indicator"><Check size={13} /> Layout gespeichert</span>;
}

export default function DashboardApp({ initialData }: { initialData: BootstrapData }) {
  const [data, setDataState] = useState(initialData);
  const dataRef = useRef(initialData);
  const [activeId, setActiveId] = useState(initialData.dashboards[0]?.id ?? "");
  const activeIdRef = useRef(activeId);
  const [section, setSection] = useState<AppSection>("dashboards");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [compact, setCompact] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [configTarget, setConfigTarget] = useState<{ definition: WidgetCatalogItem; widget?: ClientWidget; dashboardId?: string } | null>(null);
  const [newDashboard, setNewDashboard] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInFlight = useRef(false);
  const saveQueued = useRef(false);

  function setData(update: SetStateAction<BootstrapData>) {
    setDataState((current) => {
      const next = typeof update === "function" ? update(current) : update;
      dataRef.current = next;
      return next;
    });
  }

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => {
    const stored = window.localStorage.getItem("nocturne-sidebar");
    if (stored === "collapsed") window.requestAnimationFrame(() => setSidebarCollapsed(true));
    if (window.localStorage.getItem("nocturne-density") === "compact") window.requestAnimationFrame(() => setCompact(true));
    if (window.localStorage.getItem("nocturne-motion") === "reduced") window.requestAnimationFrame(() => setReducedMotion(true));
    const clockFrame = window.requestAnimationFrame(() => setNow(new Date()));
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    const keyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandOpen(true); }
      if (event.key === "Escape") { setCommandOpen(false); setCatalogOpen(false); }
    };
    window.addEventListener("keydown", keyboard);
    return () => { window.cancelAnimationFrame(clockFrame); window.clearInterval(timer); window.removeEventListener("keydown", keyboard); if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, []);

  const active = useMemo(() => data.dashboards.find((dashboard) => dashboard.id === activeId) ?? data.dashboards[0], [data.dashboards, activeId]);

  async function refresh(preferredId?: string) {
    const response = await fetch("/api/bootstrap", { cache: "no-store" });
    if (!response.ok) throw new Error("Dashboard-Daten konnten nicht aktualisiert werden.");
    const next = await response.json() as BootstrapData;
    setData(next);
    const target = preferredId ?? activeIdRef.current;
    const nextId = next.dashboards.some((dashboard) => dashboard.id === target) ? target : next.dashboards[0]?.id ?? "";
    setActiveId(nextId);
    setSaveStatus("saved");
  }

  async function flushLayouts() {
    if (saveInFlight.current) { saveQueued.current = true; return; }
    const dashboard = dataRef.current.dashboards.find((item) => item.id === activeIdRef.current);
    if (!dashboard) return;
    saveInFlight.current = true;
    setSaveStatus("saving");
    try {
      const response = await fetch(`/api/dashboards/${dashboard.id}/layout`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ revision: dashboard.revision, layouts: dashboard.widgets.map((widget) => ({ id: widget.id, layout: widget.layout })) }),
      });
      const body = await response.json();
      if (response.status === 409) { setSaveStatus("conflict"); return; }
      if (!response.ok) throw new Error(body.error ?? "Layout konnte nicht gespeichert werden.");
      setData((current) => ({ ...current, dashboards: current.dashboards.map((item) => item.id === dashboard.id ? { ...item, revision: body.revision } : item) }));
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    } finally {
      saveInFlight.current = false;
      if (saveQueued.current) { saveQueued.current = false; saveTimer.current = setTimeout(() => void flushLayouts(), 250); }
    }
  }

  function updateLayouts(layouts: Record<string, WidgetLayout>) {
    if (!active) return;
    setData((current) => ({
      ...current,
      dashboards: current.dashboards.map((dashboard) => dashboard.id === active.id ? { ...dashboard, widgets: dashboard.widgets.map((widget) => ({ ...widget, layout: layouts[widget.id] ?? widget.layout })) } : dashboard),
    }));
    setSaveStatus("pending");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void flushLayouts(), 650);
  }

  async function deleteWidget(widget: ClientWidget) {
    if (!window.confirm(`„${widget.title}“ wirklich vom Dashboard entfernen?`)) return;
    const response = await fetch(`/api/widgets/${widget.id}`, { method: "DELETE" });
    const body = await response.json();
    if (!response.ok) { window.alert(body.error ?? "Widget konnte nicht entfernt werden."); return; }
    await refresh(active?.id);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      window.localStorage.setItem("nocturne-sidebar", current ? "expanded" : "collapsed");
      return !current;
    });
  }

  function openSection(next: AppSection) {
    setSection(next);
    setMobileNav(false);
    if (next !== "dashboards") setEditing(false);
  }

  function updateCompact(value: boolean) {
    setCompact(value);
    window.localStorage.setItem("nocturne-density", value ? "compact" : "comfortable");
  }

  function updateReducedMotion(value: boolean) {
    setReducedMotion(value);
    window.localStorage.setItem("nocturne-motion", value ? "reduced" : "full");
  }

  if (!active) return <main className="fatal-state"><h1>Kein Dashboard verfügbar</h1><p>Starte den Seed-Vorgang oder lege ein Dashboard über die API an.</p></main>;

  const commands = [
    { label: "Widget hinzufügen", hint: "A", icon: Plus, action: () => setCatalogOpen(true) },
    { label: editing ? "Bearbeitungsmodus beenden" : "Layout bearbeiten", hint: "E", icon: PencilLine, action: () => setEditing((value) => !value) },
    { label: "Dashboard importieren / exportieren", hint: "I", icon: Upload, action: () => setTransferOpen(true) },
    { label: "Dashboard teilen", hint: "", icon: Share2, action: () => setShareOpen(true) },
    { label: "Neues Dashboard", hint: "N", icon: LayoutDashboard, action: () => setNewDashboard(true) },
    { label: "Services öffnen", hint: "", icon: Server, action: () => openSection("services") },
    { label: "Activity öffnen", hint: "", icon: Activity, action: () => openSection("activity") },
    { label: "Settings öffnen", hint: "", icon: Settings, action: () => openSection("settings") },
    ...data.dashboards.map((dashboard) => ({ label: `Öffnen: ${dashboard.name}`, hint: "", icon: Gauge, action: () => { setActiveId(dashboard.id); openSection("dashboards"); } })),
  ].filter((command) => command.label.toLowerCase().includes(commandQuery.toLowerCase()));

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${compact ? "density-compact" : ""} ${reducedMotion ? "motion-reduced" : ""}`}>
      <aside className={`sidebar ${mobileNav ? "mobile-open" : ""}`}>
        <div className="sidebar-brand"><div className="brand-lockup"><span className="brand-mark"><i /><i /><i /></span><span>NOCTURNE<small>CONTROL ROOM</small></span></div><button className="icon-button collapse-button" onClick={toggleSidebar} aria-label="Navigation einklappen">{sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button></div>
        <nav className="main-nav" aria-label="Hauptnavigation">
          <button className={section === "dashboards" ? "active" : ""} aria-current={section === "dashboards" ? "page" : undefined} onClick={() => openSection("dashboards")}><LayoutDashboard size={18} /><span>Dashboards</span><em>{data.dashboards.length}</em></button>
          <button className={section === "services" ? "active" : ""} aria-current={section === "services" ? "page" : undefined} onClick={() => openSection("services")}><Server size={18} /><span>Services</span><em>{data.dashboards.reduce((count, dashboard) => count + dashboard.widgets.length, 0)}</em></button>
          <button className={section === "activity" ? "active" : ""} aria-current={section === "activity" ? "page" : undefined} onClick={() => openSection("activity")}><Activity size={18} /><span>Activity</span></button>
          <button className={section === "settings" ? "active" : ""} aria-current={section === "settings" ? "page" : undefined} onClick={() => openSection("settings")}><Settings size={18} /><span>Settings</span></button>
        </nav>
        <div className="sidebar-section">
          <div className="sidebar-section-label"><span>MY DASHBOARDS</span><button onClick={() => setNewDashboard(true)} title="Dashboard hinzufügen"><Plus size={14} /></button></div>
          <div className="dashboard-list">{data.dashboards.map((dashboard, index) => <button className={dashboard.id === active.id && section === "dashboards" ? "active" : ""} onClick={() => { setActiveId(dashboard.id); openSection("dashboards"); }} key={dashboard.id}><span className="dashboard-number">{String(index + 1).padStart(2, "0")}</span><span><strong>{dashboard.name}</strong><small>{dashboard.widgets.length} Widgets</small></span>{dashboard.id === active.id && section === "dashboards" && <i />}</button>)}</div>
        </div>
        <div className="sidebar-network"><div><span className="network-orbit"><i /><i /></span><span><strong>Home network</strong><small><i /> Sitzung verbunden</small></span></div><div className="network-stats"><span><LayoutDashboard size={13} /> {data.dashboards.length} Dashboards</span><span><Boxes size={13} /> {active.widgets.length} Widgets</span></div></div>
        <div className="sidebar-user"><span className="avatar">{data.user.name.slice(0, 2).toUpperCase()}</span><span><strong>{data.user.name}</strong><small>{roleLabels[data.user.role]}</small></span><button className="icon-button" onClick={() => void logout()} title="Abmelden" aria-label="Abmelden"><LogOut size={16} /></button></div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileNav((value) => !value)} aria-label={mobileNav ? "Navigation schließen" : "Navigation öffnen"}>{mobileNav ? <X size={19} /> : <Menu size={19} />}</button>
          <div className="topbar-location"><span className="topbar-node"><i /></span><span><small>CONNECTED TO</small><strong>nocturne.home</strong></span><ChevronDown size={13} /></div>
          <button className="command-trigger" onClick={() => setCommandOpen(true)} aria-label="Suche und Command Palette öffnen"><Search size={16} /><span>Search dashboards, widgets, actions …</span><kbd><Command size={11} /> K</kbd></button>
          <div className="topbar-right"><span className="topbar-time"><Clock3 size={14} /> {now ? now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "--:--"}</span><button className="icon-button notification-button" aria-label="Benachrichtigungen"><Bell size={17} /><i /></button><span className="role-chip"><ShieldCheck size={13} /> {data.user.role}</span></div>
        </header>

        <main className="dashboard-main">
          <div className="dashboard-aurora" aria-hidden="true" />
          {section === "dashboards" && <>
            <section className="dashboard-heading">
              <div>
                <div className="breadcrumbs"><span>CONTROL ROOM</span><i>/</i><span>{active.environment.toUpperCase()}</span><i>/</i><strong>{active.name.toUpperCase()}</strong></div>
                <div className="dashboard-title-row"><h1>{active.name}</h1><span className="operational-badge"><i /> AKTIV</span></div>
                <p>{active.description || "Ein persönlicher Blick auf deine wichtigsten Systeme."}</p>
              </div>
              <div className="dashboard-actions"><SaveIndicator status={saveStatus} onRetry={() => void flushLayouts()} /><button className={`secondary-button edit-button ${editing ? "active" : ""}`} onClick={() => setEditing((value) => !value)}><SlidersHorizontal size={16} /> {editing ? "Bearbeitung beenden" : "Layout bearbeiten"}</button><button className="primary-button" onClick={() => setCatalogOpen(true)}><Plus size={16} /> Widget hinzufügen</button><button className={`icon-button action-more ${active.isShared ? "active" : ""}`} onClick={() => setShareOpen(true)} title="Dashboard teilen" aria-label="Dashboard teilen"><Share2 size={17} /></button><button className="icon-button action-more" onClick={() => setTransferOpen(true)} title="Import & Export" aria-label="Import und Export"><Download size={17} /></button></div>
            </section>

            <section className="signal-strip" aria-label="Dashboard-Status">
              <div><span className="signal-icon violet"><Zap size={15} /></span><span><small>SIGNALS</small><strong>{String(active.widgets.length).padStart(2, "0")}</strong></span></div>
              <i />
              <div><span className="signal-icon blue"><Network size={15} /></span><span><small>ENVIRONMENT</small><strong>{active.environment}</strong></span></div>
              <i />
              <div><span className="signal-icon green"><ShieldCheck size={15} /></span><span><small>ACCESS</small><strong>{roleLabels[data.user.role]}</strong></span></div>
              <span className="signal-caption"><Sparkles size={13} /> AUTO-DISCOVERED WIDGET ENGINE</span>
            </section>

            {editing && <div className="edit-banner"><span><PencilLine size={15} /><strong>Layout-Modus</strong> Ziehe Widgets an den sichtbaren Kanten oder ändere ihre Größe mit Shift + Pfeiltasten.</span><button onClick={() => setEditing(false)}>Fertig <Check size={14} /></button></div>}

            <DashboardGrid widgets={active.widgets} catalog={data.catalog} editing={editing} compact={compact} onLayoutsChange={updateLayouts} onEdit={(widget) => { const definition = data.catalog.find((item) => item.type === widget.type); if (definition) setConfigTarget({ definition, widget, dashboardId: active.id }); }} onDelete={(widget) => void deleteWidget(widget)} />
          </>}
          {section === "services" && <ServicesView dashboards={data.dashboards} catalog={data.catalog} onOpenDashboard={(dashboardId) => { setActiveId(dashboardId); openSection("dashboards"); }} onConfigure={(dashboardId, widget, definition) => { setActiveId(dashboardId); setConfigTarget({ dashboardId, widget, definition }); }} />}
          {section === "activity" && <ActivityView dashboards={data.dashboards} />}
          {section === "settings" && <SettingsView key={active.id} dashboard={active} user={data.user} compact={compact} reducedMotion={reducedMotion} onCompactChange={updateCompact} onReducedMotionChange={updateReducedMotion} onSaved={() => refresh(active.id)} onTransfer={() => setTransferOpen(true)} onLogout={logout} />}
        </main>
      </div>

      {catalogOpen && <WidgetCatalog catalog={data.catalog} role={data.user.role} onClose={() => setCatalogOpen(false)} onSelect={(definition) => { setCatalogOpen(false); setConfigTarget({ definition, dashboardId: active.id }); }} />}
      {configTarget && <WidgetConfigDrawer dashboardId={configTarget.dashboardId ?? active.id} definition={configTarget.definition} widget={configTarget.widget} onClose={() => setConfigTarget(null)} onSaved={() => refresh(configTarget.dashboardId ?? active.id)} />}
      {newDashboard && <NewDashboardDialog onClose={() => setNewDashboard(false)} onCreated={(id) => refresh(id)} />}
      {transferOpen && <TransferDialog dashboard={active} onClose={() => setTransferOpen(false)} onImported={(id) => refresh(id)} />}
      {shareOpen && <ShareDashboardDialog dashboard={active} onClose={() => setShareOpen(false)} onChanged={() => refresh(active.id)} />}

      {commandOpen && <div className="command-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCommandOpen(false); }}><section className="command-palette" role="dialog" aria-modal="true" aria-label="Command Palette"><label><Search size={19} /><input value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} placeholder="Was möchtest du tun?" autoFocus /><kbd>ESC</kbd></label><div className="command-section-label">ACTIONS & DESTINATIONS</div><div className="command-results">{commands.map((item, index) => { const Icon = item.icon; return <button onClick={() => { item.action(); setCommandOpen(false); setCommandQuery(""); }} key={`${item.label}-${index}`}><span><Icon size={17} /></span><strong>{item.label}</strong>{item.hint && <kbd>{item.hint}</kbd>}</button>; })}{commands.length === 0 && <p>Keine passende Aktion gefunden.</p>}</div><footer><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Select</span><span>NOCTURNE COMMAND</span></footer></section></div>}
    </div>
  );
}
