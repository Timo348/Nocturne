"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, Download, FileJson, LoaderCircle, Plus, Upload, X } from "lucide-react";
import type { ClientDashboard } from "@/widget-engine/contracts";

export function NewDashboardDialog({ onClose, onCreated }: { onClose(): void; onCreated(id: string): Promise<void> | void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [environment, setEnvironment] = useState("Home network");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const response = await fetch("/api/dashboards", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, description, environment }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Dashboard konnte nicht angelegt werden.");
      await onCreated(body.id); onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Fehler"); setLoading(false); }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="small-modal" role="dialog" aria-modal="true"><header><span className="modal-symbol"><Plus size={18} /></span><div><h2>Neues Dashboard</h2><p>Ein leerer Raum für einen eigenen Kontext.</p></div><button className="icon-button" onClick={onClose}><X size={18} /></button></header><form onSubmit={submit}><label>Name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Edge lab" maxLength={80} required /></label><label>Beschreibung<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Was wird hier überwacht?" maxLength={280} /></label><label>Umgebung<input value={environment} onChange={(event) => setEnvironment(event.target.value)} placeholder="Primary network" maxLength={80} /></label>{error && <div className="form-error">{error}</div>}<footer><button type="button" className="secondary-button" onClick={onClose}>Abbrechen</button><button className="primary-button" disabled={loading}>{loading ? <LoaderCircle className="spin" size={16} /> : <ArrowRight size={16} />} Dashboard anlegen</button></footer></form></section></div>;
}

export function TransferDialog({ dashboard, onClose, onImported }: { dashboard: ClientDashboard; onClose(): void; onImported(id: string): Promise<void> | void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function importFile(file?: File) {
    if (!file) return;
    setLoading(true); setError("");
    try {
      if (file.size > 1024 * 1024) throw new Error("Die Datei ist größer als 1 MiB.");
      const raw = await file.text();
      const input = JSON.parse(raw);
      const response = await fetch("/api/dashboards/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Import fehlgeschlagen");
      await onImported(body.id); onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Import fehlgeschlagen"); setLoading(false); }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="transfer-modal" role="dialog" aria-modal="true"><header className="modal-header"><div><span className="modal-kicker"><FileJson size={13} /> PORTABLE SETUP</span><h2>Import & Export</h2><p>Teile oder sichere dein Dashboard als versioniertes JSON.</p></div><button className="icon-button close-button" onClick={onClose}><X size={18} /></button></header><div className="transfer-grid"><button className="transfer-card" onClick={() => window.location.assign(`/api/dashboards/${dashboard.id}/export`)}><span className="transfer-icon"><Download size={22} /></span><strong>Dashboard exportieren</strong><p>{dashboard.widgets.length} Widgets, Konfiguration und alle Breakpoint-Layouts.</p><small>Secrets werden durch sichere Platzhalter ersetzt.</small><span>JSON HERUNTERLADEN <ArrowRight size={14} /></span></button><button className="transfer-card" onClick={() => fileInput.current?.click()} disabled={loading}><span className="transfer-icon"><Upload size={22} /></span><strong>Dashboard importieren</strong><p>Vor dem Anlegen werden Format, Rolle, Widget-Verträge und Layouts geprüft.</p><small>Maximal 1 MiB · Formatversion 1</small><span>{loading ? "WIRD GEPRÜFT …" : "DATEI AUSWÄHLEN"} <ArrowRight size={14} /></span></button><input ref={fileInput} className="sr-only" type="file" accept="application/json,.json" onChange={(event) => void importFile(event.target.files?.[0])} /></div>{error && <div className="form-error transfer-error">{error}</div>}<footer className="transfer-footer"><span><i /> Export enthält keine Klartext-Secrets</span><button className="secondary-button" onClick={onClose}>Schließen</button></footer></section></div>;
}
