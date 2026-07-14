"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, Link2, LoaderCircle, RefreshCw, ShieldCheck, Unlink, X } from "lucide-react";
import type { ClientDashboard } from "@/widget-engine/contracts";

type ShareInfo = { enabled: boolean; path: string | null };

export default function ShareDashboardDialog({ dashboard, onClose, onChanged }: { dashboard: ClientDashboard; onClose(): void; onChanged(): Promise<void> | void }) {
  const [info, setInfo] = useState<ShareInfo | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const linkInput = useRef<HTMLInputElement>(null);
  const url = info?.path && origin ? `${origin}${info.path}` : "";

  useEffect(() => {
    const originFrame = window.requestAnimationFrame(() => setOrigin(window.location.origin));
    let active = true;
    void fetch(`/api/dashboards/${dashboard.id}/share`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Freigabe konnte nicht geladen werden.");
        if (active) setInfo(body);
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Freigabe konnte nicht geladen werden."); });
    return () => { active = false; window.cancelAnimationFrame(originFrame); };
  }, [dashboard.id]);

  async function runAction(action: "enable" | "disable" | "regenerate") {
    if (action === "regenerate" && !window.confirm("Der bisherige Link funktioniert danach nicht mehr. Link wirklich erneuern?")) return;
    if (action === "disable" && !window.confirm("Alle Geräte mit diesem Link verlieren sofort den Zugriff. Freigabe wirklich beenden?")) return;
    setPending(true); setError(""); setCopied(false);
    try {
      const response = await fetch(`/api/dashboards/${dashboard.id}/share`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Freigabe konnte nicht geändert werden.");
      setInfo(body);
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Freigabe konnte nicht geändert werden.");
    } finally {
      setPending(false);
    }
  }

  async function copyLink() {
    if (!url) return;
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(url);
      else {
        linkInput.current?.select();
        document.execCommand("copy");
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      linkInput.current?.select();
      if (document.execCommand("copy")) setCopied(true);
      else setError("Link konnte nicht automatisch kopiert werden. Er ist zum manuellen Kopieren markiert.");
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="small-modal share-modal" role="dialog" aria-modal="true" aria-labelledby="share-dialog-title">
        <header><span className="modal-symbol"><Link2 size={18} /></span><div><h2 id="share-dialog-title">Dashboard teilen</h2><p>Eine reduzierte Live-Ansicht für TV und Monitoring.</p></div><button className="icon-button" onClick={onClose} aria-label="Schließen"><X size={18} /></button></header>
        <div className="share-dialog-body">
          {!info && !error && <div className="share-loading"><LoaderCircle className="spin" size={18} /> Freigabe wird geladen …</div>}
          {error && <div className="form-error">{error}</div>}
          {info && !info.enabled && <>
            <div className="share-intro"><span><ShieldCheck size={19} /></span><div><strong>Widerrufbarer Monitoring-Link</strong><p>Der Link zeigt nur Widgets und erlaubt das Verschieben. Konfiguration und geheime Werte bleiben geschützt.</p></div></div>
            <button className="primary-button share-enable" disabled={pending} onClick={() => void runAction("enable")}>{pending ? <LoaderCircle className="spin" size={16} /> : <Link2 size={16} />} Freigabelink erstellen</button>
          </>}
          {info?.enabled && <>
            <div className="share-active"><span><i /> FREIGABE AKTIV</span><small>Jeder mit diesem Link kann das Dashboard ansehen und dessen Layout verschieben.</small></div>
            <label className="share-link-field"><span>FREIGABELINK</span><div><input ref={linkInput} readOnly value={url} onFocus={(event) => event.currentTarget.select()} /><button className="icon-button" onClick={() => void copyLink()} aria-label="Link kopieren" title="Link kopieren">{copied ? <Check size={16} /> : <Copy size={16} />}</button></div></label>
            <div className="share-primary-actions"><button className="primary-button" onClick={() => window.open(url, "_blank", "noopener,noreferrer")}><ExternalLink size={16} /> Ansicht öffnen</button><button className="secondary-button" onClick={() => void copyLink()}>{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Kopiert" : "Link kopieren"}</button></div>
            <div className="share-management"><button disabled={pending} onClick={() => void runAction("regenerate")}><RefreshCw size={14} /> Link erneuern</button><button className="danger-item" disabled={pending} onClick={() => void runAction("disable")}><Unlink size={14} /> Freigabe beenden</button></div>
          </>}
        </div>
      </section>
    </div>
  );
}
