"use client";

import { useState } from "react";
import { Download, LayoutDashboard, LoaderCircle, LogOut, Palette, Save, Settings, ShieldCheck, SlidersHorizontal } from "lucide-react";
import type { ClientDashboard, SessionUser } from "@/widget-engine/contracts";
import { THEME_OPTIONS, type AppTheme } from "@/lib/themes";

type Props = {
  dashboard: ClientDashboard;
  user: SessionUser;
  compact: boolean;
  reducedMotion: boolean;
  onCompactChange(value: boolean): void;
  onReducedMotionChange(value: boolean): void;
  onThemeChange(value: AppTheme): Promise<void>;
  onSaved(): Promise<void> | void;
  onTransfer(): void;
  onLogout(): Promise<void> | void;
};

export default function SettingsView({ dashboard, user, compact, reducedMotion, onCompactChange, onReducedMotionChange, onThemeChange, onSaved, onTransfer, onLogout }: Props) {
  const [name, setName] = useState(dashboard.name);
  const [description, setDescription] = useState(dashboard.description);
  const [environment, setEnvironment] = useState(dashboard.environment);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [themeSaving, setThemeSaving] = useState<AppTheme | null>(null);
  const [themeError, setThemeError] = useState("");

  async function selectTheme(theme: AppTheme) {
    if (theme === user.theme || themeSaving) return;
    setThemeSaving(theme);
    setThemeError("");
    try {
      await onThemeChange(theme);
    } catch (reason) {
      setThemeError(reason instanceof Error ? reason.message : "Theme konnte nicht gespeichert werden.");
    } finally {
      setThemeSaving(null);
    }
  }

  async function saveDashboard() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/dashboards/${dashboard.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, description, environment }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Dashboard-Einstellungen konnten nicht gespeichert werden.");
      await onSaved();
      setMessage("Dashboard-Einstellungen gespeichert.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="workspace-view settings-view" aria-labelledby="settings-title">
      <header className="workspace-header"><div><span className="workspace-kicker"><Settings size={15} /> CONTROL ROOM SETTINGS</span><h1 id="settings-title">Settings</h1><p>Dashboard-Metadaten, Darstellung und Datentransfer verwalten.</p></div></header>
      <div className="settings-grid">
        <section className="settings-card settings-form-card"><header><span><LayoutDashboard size={18} /></span><div><h2>Aktives Dashboard</h2><p>Name, Beschreibung und Umgebung werden serverseitig gespeichert.</p></div></header><div className="settings-form"><label><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} /></label><label><span>Umgebung</span><input value={environment} onChange={(event) => setEnvironment(event.target.value)} maxLength={80} /></label><label className="settings-wide"><span>Beschreibung</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={280} /></label></div>{error && <div className="form-error" role="alert">{error}</div>}{message && <div className="form-success" role="status">{message}</div>}<footer><button className="primary-button" onClick={() => void saveDashboard()} disabled={saving || !name.trim()}>{saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />} {saving ? "Speichert …" : "Änderungen speichern"}</button></footer></section>

        <section className="settings-card settings-theme-card"><header><span><Palette size={18} /></span><div><h2>Persönliches Theme</h2><p>Deine Auswahl wird im Benutzerkonto gespeichert und gilt auf allen Geräten.</p></div></header><div className="theme-option-grid">{THEME_OPTIONS.map((theme) => <button type="button" className={`theme-option ${user.theme === theme.id ? "active" : ""}`} onClick={() => void selectTheme(theme.id)} disabled={Boolean(themeSaving)} aria-pressed={user.theme === theme.id} key={theme.id}><span className="theme-option-preview" style={{ background: `linear-gradient(145deg, ${theme.colors[1]}, ${theme.colors[2]})` }}><i style={{ background: theme.colors[0] }} /><i /><i /></span><span><strong>{theme.name}</strong><small>{theme.description}</small></span>{themeSaving === theme.id ? <LoaderCircle className="spin" size={16} /> : user.theme === theme.id ? <Checkmark /> : null}</button>)}</div>{themeError && <div className="form-error" role="alert">{themeError}</div>}</section>

        <section className="settings-card"><header><span><SlidersHorizontal size={18} /></span><div><h2>Darstellung</h2><p>Diese Optionen gelten lokal in diesem Browser.</p></div></header><div className="settings-options"><label className="settings-toggle"><span><strong>Kompakte Arbeitsfläche</strong><small>Reduziert Abstände und Widget-Zeilenhöhe.</small></span><input type="checkbox" checked={compact} onChange={(event) => onCompactChange(event.target.checked)} /><i /></label><label className="settings-toggle"><span><strong>Bewegung reduzieren</strong><small>Deaktiviert lange Übergänge und Animationen.</small></span><input type="checkbox" checked={reducedMotion} onChange={(event) => onReducedMotionChange(event.target.checked)} /><i /></label></div></section>

        <section className="settings-card"><header><span><ShieldCheck size={18} /></span><div><h2>Account</h2><p>Authentifizierte Sitzung und Rolleninformation.</p></div></header><dl className="account-details"><div><dt>Name</dt><dd>{user.name}</dd></div><div><dt>E-Mail</dt><dd>{user.email}</dd></div><div><dt>Rolle</dt><dd>{user.role}</dd></div></dl><footer><button className="secondary-button" onClick={() => void onLogout()}><LogOut size={16} /> Abmelden</button></footer></section>

        <section className="settings-card"><header><span><Download size={18} /></span><div><h2>Import & Export</h2><p>Konfiguration und Layout als versioniertes JSON sichern.</p></div></header><div className="settings-callout">Secrets werden beim Export durch sichere Platzhalter ersetzt.</div><footer><button className="secondary-button" onClick={onTransfer}><Download size={16} /> Datentransfer öffnen</button></footer></section>
      </div>
    </section>
  );
}

function Checkmark() {
  return <span className="theme-selected" aria-label="Ausgewählt">✓</span>;
}
