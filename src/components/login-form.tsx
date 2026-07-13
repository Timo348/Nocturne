"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Gauge, GitBranch, Layers3, ShieldCheck } from "lucide-react";

export default function LoginForm() {
  const [email, setEmail] = useState("admin@home.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Login fehlgeschlagen");
      window.location.assign("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Login fehlgeschlagen");
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <div className="login-aurora login-aurora-one" />
      <div className="login-aurora login-aurora-two" />
      <section className="login-story">
        <div className="brand-lockup brand-lockup-large"><span className="brand-mark"><i /><i /><i /></span><span>NOCTURNE<small>CONTROL ROOM</small></span></div>
        <div className="login-story-copy">
          <span className="kicker"><span /> YOUR HOMELAB, COMPOSED</span>
          <h1>Everything alive.<br /><em>One calm surface.</em></h1>
          <p>Nocturne verbindet Services, Signale und Infrastruktur in einem persönlichen Arbeitsraum, der sich deinem Setup anpasst.</p>
          <div className="login-feature-row">
            <span><Layers3 size={17} /> Modular</span>
            <span><Gauge size={17} /> Live metrics</span>
            <span><GitBranch size={17} /> Developer ready</span>
          </div>
        </div>
        <div className="login-visual" aria-hidden="true">
          <div className="visual-grid" />
          <div className="visual-card visual-card-one"><span>ARCHITECTURE</span><strong>MODULAR</strong><i /></div>
          <div className="visual-card visual-card-two"><span>CONFIGURATION</span><strong>JSON</strong><div><i /><i /><i /><i /></div></div>
          <div className="visual-orbit"><i /><i /><i /></div>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="mobile-brand brand-lockup"><span className="brand-mark"><i /><i /><i /></span><span>NOCTURNE<small>CONTROL ROOM</small></span></div>
          <div className="login-heading"><span className="login-icon"><ShieldCheck size={19} /></span><div><h2>Willkommen zurück</h2><p>Melde dich in deinem Control Room an.</p></div></div>
          <form onSubmit={submit}>
            <label>E-Mail-Adresse<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label>Passwort<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••••••" required autoFocus /></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button login-button" disabled={loading}>{loading ? "Verbindung wird hergestellt …" : "Control Room öffnen"}<ArrowRight size={17} /></button>
          </form>
          <div className="login-security"><i /><span><strong>Local-first authentication</strong><small>Deine Sitzung bleibt in deinem Netzwerk.</small></span></div>
        </div>
        <div className="login-footer"><span>NOCTURNE / 0.1</span><span>SELF-HOSTED</span></div>
      </section>
    </main>
  );
}
