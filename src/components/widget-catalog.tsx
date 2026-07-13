"use client";

import { useMemo, useState } from "react";
import { ArrowRight, LockKeyhole, Search, ShieldCheck, Sparkles, X } from "lucide-react";
import type { AppRole, WidgetCatalogItem } from "@/widget-engine/contracts";
import { WidgetIcon } from "./icon-map";

type Props = {
  catalog: WidgetCatalogItem[];
  role: AppRole;
  onClose(): void;
  onSelect(definition: WidgetCatalogItem): void;
};

const categories = ["Alle", "Essentials", "Monitoring", "Developer", "Feeds", "Custom"];

export default function WidgetCatalog({ catalog, role, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Alle");
  const filtered = useMemo(() => catalog.filter((item) => {
    const matchesCategory = category === "Alle" || item.category === category;
    const search = `${item.name} ${item.description} ${item.category}`.toLowerCase();
    return matchesCategory && search.includes(query.toLowerCase());
  }), [catalog, category, query]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="catalog-modal" role="dialog" aria-modal="true" aria-labelledby="catalog-title">
        <header className="modal-header">
          <div><span className="modal-kicker"><Sparkles size={13} /> MODULAR ENGINE</span><h2 id="catalog-title">Widget hinzufügen</h2><p>Erweitere deinen Control Room mit einem neuen Signal.</p></div>
          <button className="icon-button close-button" onClick={onClose} aria-label="Dialog schließen"><X size={19} /></button>
        </header>
        <div className="catalog-toolbar">
          <label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Widgets durchsuchen …" autoFocus /><kbd>⌘ K</kbd></label>
          <div className="category-tabs">{categories.map((item) => <button className={category === item ? "active" : ""} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div>
        </div>
        <div className="catalog-grid">
          {filtered.map((item) => {
            const allowed = item.allowedRoles.includes(role);
            return (
              <button className={`catalog-card ${!allowed ? "locked" : ""}`} onClick={() => allowed && onSelect(item)} disabled={!allowed} key={item.type}>
                <span className="catalog-card-icon" style={{ "--accent": item.accent } as React.CSSProperties}><WidgetIcon name={item.icon} size={22} /></span>
                <span className="catalog-card-copy"><span><small>{item.category}</small>{!allowed && <em><LockKeyhole size={11} /> {item.allowedRoles[0]}</em>}</span><strong>{item.name}</strong><p>{item.description}</p></span>
                <span className="catalog-card-footer"><span>{item.size.default.w} × {item.size.default.h} GRID</span><span>{allowed ? <><ShieldCheck size={13} /> VERFÜGBAR</> : "ROLLE BENÖTIGT"}</span><ArrowRight size={16} /></span>
              </button>
            );
          })}
          {filtered.length === 0 && <div className="catalog-empty">Keine Widgets passen zu deiner Suche.</div>}
        </div>
        <footer className="catalog-footer"><span><i /> {catalog.length} Widgets automatisch erkannt</span><span>Registry v1 · Contract checked</span></footer>
      </section>
    </div>
  );
}
