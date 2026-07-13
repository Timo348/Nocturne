"use client";

import { useMemo, useState } from "react";
import { Check, ChevronRight, CircleHelp, Eye, LoaderCircle, Plus, Save, Trash2, X } from "lucide-react";
import type { ClientWidget, WidgetCatalogItem, WidgetConfigField } from "@/widget-engine/contracts";
import { WidgetIcon } from "./icon-map";

type Props = {
  dashboardId: string;
  definition: WidgetCatalogItem;
  widget?: ClientWidget;
  onClose(): void;
  onSaved(): Promise<void> | void;
};

type LinkValue = { label: string; url: string; icon: string };

function initialConfig(definition: WidgetCatalogItem, widget?: ClientWidget) {
  if (widget) return structuredClone(widget.config);
  return definition.fields.reduce<Record<string, unknown>>((result, field) => {
    if (field.defaultValue !== undefined) result[field.key] = field.defaultValue;
    else if (field.type === "links") result[field.key] = [{ label: "", url: "", icon: "external" }];
    else if (field.type === "toggle") result[field.key] = true;
    else if (field.type === "select") result[field.key] = field.options?.[0]?.value ?? "";
    else result[field.key] = "";
    return result;
  }, {});
}

function Field({ field, value, configured, onChange }: { field: WidgetConfigField; value: unknown; configured?: boolean; onChange(value: unknown): void }) {
  if (field.type === "links") {
    const links = Array.isArray(value) ? (value as LinkValue[]) : [];
    return (
      <div className="drawer-field drawer-links">
        <div className="field-label"><span>{field.label}</span><small>{field.help}</small></div>
        {links.map((link, index) => <div className="link-editor" key={index}>
          <input aria-label={`Link ${index + 1} Name`} value={link.label} onChange={(event) => { const next = [...links]; next[index] = { ...link, label: event.target.value }; onChange(next); }} placeholder="Service" />
          <input aria-label={`Link ${index + 1} URL`} value={link.url} onChange={(event) => { const next = [...links]; next[index] = { ...link, url: event.target.value }; onChange(next); }} placeholder="https://service.home" />
          <select aria-label={`Link ${index + 1} Icon`} value={link.icon} onChange={(event) => { const next = [...links]; next[index] = { ...link, icon: event.target.value }; onChange(next); }}><option value="external">External</option><option value="router">Router</option><option value="database">Storage</option><option value="git">Git</option><option value="play">Media</option></select>
          <button className="icon-button" aria-label="Link entfernen" onClick={() => onChange(links.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={15} /></button>
        </div>)}
        <button className="text-button" type="button" disabled={links.length >= 12} onClick={() => onChange([...links, { label: "", url: "", icon: "external" }])}><Plus size={14} /> Link hinzufügen</button>
      </div>
    );
  }
  if (field.type === "toggle") return <label className="toggle-field"><span><strong>{field.label}</strong><small>{field.help}</small></span><input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} /><i /></label>;

  const common = { value: String(value ?? ""), onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange(event.target.value) };
  return (
    <label className="drawer-field">
      <span className="field-label"><span>{field.label}{field.required && <em>*</em>}</span>{configured && <small className="secret-set"><Check size={11} /> Secret gesetzt</small>}</span>
      {field.type === "select" ? <select {...common}>{field.options?.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select> : field.type === "textarea" ? <textarea {...common} placeholder={field.placeholder} /> : <input {...common} type={field.type === "password" ? "password" : field.type === "number" ? "number" : field.type === "url" ? "url" : "text"} min={field.min} max={field.max} step={field.step} placeholder={configured && field.type === "password" ? "Leer lassen, um Secret zu behalten" : field.placeholder} required={field.required} />}
      {field.help && <small className="field-help"><CircleHelp size={12} /> {field.help}</small>}
    </label>
  );
}

export default function WidgetConfigDrawer({ dashboardId, definition, widget, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(widget?.title ?? definition.name);
  const [config, setConfig] = useState<Record<string, unknown>>(() => initialConfig(definition, widget));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const configuredSecrets = useMemo(() => (config.__configuredSecrets ?? {}) as Record<string, boolean>, [config]);

  async function save() {
    setSaving(true);
    setError("");
    try {
      for (const field of definition.fields) {
        if (field.required && (config[field.key] === "" || config[field.key] == null)) throw new Error(`${field.label} ist erforderlich.`);
      }
      const configPayload = Object.fromEntries(definition.fields.map((field) => [field.key, config[field.key]]));
      const url = widget ? `/api/widgets/${widget.id}` : `/api/dashboards/${dashboardId}/widgets`;
      const response = await fetch(url, {
        method: widget ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(widget ? { title, config: configPayload } : { type: definition.type, title, config: configPayload }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Widget konnte nicht gespeichert werden.");
      await onSaved();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Speichern fehlgeschlagen");
      setSaving(false);
    }
  }

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="config-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <header className="drawer-header">
          <div className="drawer-breadcrumb"><span>WIDGETS</span><ChevronRight size={12} /><span>{widget ? "CONFIGURE" : "ADD"}</span></div>
          <button className="icon-button" onClick={onClose} aria-label="Konfiguration schließen"><X size={18} /></button>
        </header>
        <div className="drawer-intro"><span className="drawer-widget-icon" style={{ "--accent": definition.accent } as React.CSSProperties}><WidgetIcon name={definition.icon} size={22} /></span><div><h2 id="drawer-title">{widget ? `${definition.name} konfigurieren` : definition.name}</h2><p>{definition.description}</p></div></div>
        <div className="drawer-preview"><div><Eye size={14} /><span>LIVE PREVIEW</span></div><strong>{title || definition.name}</strong><small>{definition.category} · {definition.size.default.w} × {definition.size.default.h} Grid</small></div>
        <div className="drawer-form">
          <label className="drawer-field"><span className="field-label"><span>Widget-Titel<em>*</em></span></span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} required /></label>
          <div className="form-section-label"><span>CONFIGURATION</span><i /></div>
          {definition.fields.map((field) => <Field key={field.key} field={field} value={config[field.key]} configured={configuredSecrets[field.key]} onChange={(value) => setConfig((current) => ({ ...current, [field.key]: value }))} />)}
          {error && <div className="form-error" role="alert">{error}</div>}
        </div>
        <footer className="drawer-footer"><button className="secondary-button" onClick={onClose}>Abbrechen</button><button className="primary-button" onClick={() => void save()} disabled={saving || !title.trim()}>{saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}{saving ? "Speichert …" : widget ? "Änderungen speichern" : "Widget hinzufügen"}</button></footer>
      </aside>
    </div>
  );
}
