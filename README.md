# Nocturne · Homelab Control Room

Nocturne ist ein modulares, selbst gehostetes Homelab-Dashboard mit personalisierbaren Dashboards, automatisch erkannten Widgets, responsive Drag-/Resize-Layouts, sicherem Datenabruf und versioniertem JSON-Transfer.

## Funktionsumfang

- Beliebig viele persönliche Dashboards mit getrennten Desktop-, Tablet- und Mobile-Layouts.
- Drag-and-drop, Resize und barrierearme Pfeiltasten-Steuerung; Änderungen werden optimistisch und entprellt im Hintergrund gespeichert.
- Build-Time-Discovery: Jeder Ordner unter `src/widgets/*` wird ohne zentralen Registry-Eintrag automatisch in getrennte Server- und Client-Registries aufgenommen.
- Strikter Widget-Vertrag für Metadaten, Rolle, Größenregeln, Zod-Konfiguration, Secret-Felder, Datenprovider und React-View.
- Widgets: Quick Links, Open-Meteo-Wetter, RSS/Atom, Gitea, Prometheus/PromQL, generischer REST-Wert und Host-/Collector-Metriken.
- Rollen `VIEWER`, `DEVELOPER`, `ADMIN`; Gitea, Prometheus und REST sind serverseitig auf Developer/Admin beschränkt.
- JSON-Import/-Export inklusive Konfigurationen und Breakpoint-Layouts. Share-Exporte ersetzen Secrets immer durch Platzhalter.
- Lokale Anmeldung, HttpOnly-Session-Cookie, AES-256-GCM für Widget-Secrets und serverseitiger Datenproxy.

## Schnellstart unter Windows / PowerShell

Voraussetzungen: Node.js 22+, pnpm und ein freier Port.

```powershell
Copy-Item .env.example .env
# Danach SESSION_SECRET, APP_ENCRYPTION_KEY und ADMIN_PASSWORD in .env ändern.

pnpm install
pnpm prisma migrate deploy
pnpm db:seed
pnpm dev
```

Danach `http://localhost:3000` öffnen. Die lokale Anmeldung verwendet `ADMIN_EMAIL` und `ADMIN_PASSWORD` aus `.env`.

## Docker Compose

```powershell
Copy-Item .env.example .env
# Sichere Werte und optional APP_PORT/FETCH_ALLOWED_HOSTS setzen.
docker compose pull
docker compose up -d
```

Das veröffentlichte Image liegt unter `timo348/nocturne:latest`. Für einen lokalen Build kann stattdessen `docker compose up -d --build` verwendet werden. Compose persistiert SQLite im Volume `nocturne-data`, führt Migration und Seed beim Start aus und stellt den Dienst standardmäßig auf Port `3000` bereit. Der Web-Container erhält bewusst keinen Docker-Socket.

## Konfiguration

| Variable | Zweck |
|---|---|
| `DATABASE_URL` | Lokal `file:./dev.db`; Compose überschreibt auf `/data/nocturne.db`. |
| `SESSION_SECRET` | Mindestens 32 zufällige Zeichen für signierte Sitzungen. |
| `APP_ENCRYPTION_KEY` | Separater Schlüssel für AES-GCM-verschlüsselte Widget-Secrets. |
| `SESSION_COOKIE_SECURE` | `false` für direkten HTTP-Zugriff; hinter einem HTTPS-Reverse-Proxy auf `true` setzen. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Erster lokaler Admin beim initialen Seed. |
| `APP_PORT` | Externer Compose-Port, Standard `3000`. |
| `FETCH_ALLOWED_HOSTS` | Kommagetrennte exakte Hosts/Hosts mit Port für private RSS-, Gitea-, Prometheus-, REST- und Collector-Ziele. |

Öffentliche HTTP(S)-Ziele werden nach DNS-Prüfung erlaubt. Private, Loopback-, Link-Local- und Sondernetze benötigen einen exakten Eintrag in `FETCH_ALLOWED_HOSTS`. Redirects, URL-Credentials und Nicht-HTTP-Protokolle werden abgewiesen. Standardabrufe sind auf 1 MiB und fünf Sekunden begrenzt; Prometheus-Instant-Queries auf 512 KiB und acht Sekunden.

## Prometheus-Widget

Das Widget ruft serverseitig den offiziellen Instant-Query-Endpunkt `/api/v1/query` auf. Eine PromQL-Abfrage darf einen Scalar oder Vector liefern; mehrere Vector-Reihen lassen sich als Summe, Durchschnitt, Minimum, Maximum oder erster Wert reduzieren.

Anzeigeformate:

- Zahl ohne Einheit;
- Prozent als vorhandener Wert `0–100` oder aus einer Ratio `0–1`;
- Bytes automatisch oder fest als Byte, KB, MB beziehungsweise GB;
- Sekunden automatisch oder fest als Millisekunden, Sekunden, Minuten beziehungsweise Stunden.

Die Byte-Formate erwarten Bytes und die Zeitformate Sekunden als PromQL-Ergebnis. Andere Quellformate können direkt in PromQL umgerechnet werden. Private Prometheus-Hosts müssen exakt in `FETCH_ALLOWED_HOSTS` stehen. Optional können ein Headername und ein verschlüsselt gespeicherter Headerwert für Bearer-, Basic- oder Tenant-Authentifizierung gesetzt werden. API-Form und Query-Semantik: [Prometheus HTTP API](https://prometheus.io/docs/prometheus/latest/querying/api/).

## Ein neues Widget hinzufügen

```text
src/widgets/my-widget/
├─ definition.ts   # Manifest, Rollen, Zod-Schema, Felder, Provider
└─ component.tsx   # Browser-View
```

`definition.ts` verwendet `defineWidget(...)`. Beim `dev`- und `build`-Start scannt `scripts/generate-widget-registry.ts` alle Widget-Ordner und erzeugt:

- `src/generated/widget-registry.server.ts` für Definitionen und injizierte Datenprovider;
- `src/generated/widget-registry.client.tsx` ausschließlich für React-Views.

Fehlende Dateien, doppelte Widget-Typen oder Contract-/TypeScript-Fehler brechen Start beziehungsweise Build ab. Es ist keine manuelle Registrierung nötig.

## Daten- und Sicherheitsmodell

- `Dashboard` und `WidgetInstance` liegen in SQLite; `config` und `layout` sind echte JSON-Felder.
- Secret-Felder werden vor dem Speichern mit AES-256-GCM versiegelt, bei API-Antworten redigiert und in Share-Exporten durch `{ "$secret": "required" }` ersetzt.
- Alle Dashboard-, Widget-, Layout-, Daten- und Import-Routen prüfen Sitzung, Eigentümer und Widget-Rolle serverseitig.
- Layout-PATCH verwendet `revision` als optimistische Sperre. Veraltete parallele Änderungen erhalten HTTP `409` statt still überschrieben zu werden.
- Der sichere HTTP-Client pinnt eine zuvor geprüfte DNS-Adresse, setzt den ursprünglichen Host/SNI, folgt keinen Redirects und verwendet eine exakte Allowlist für private Homelab-Ziele. Das folgt der [OWASP-SSRF-Empfehlung für Allowlisting und deaktivierte Redirects](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).
- Docker-Metriken kommen optional von einem schmalen externen Read-only-Collector. Ein Beispiel-Response steht weiter unten; der Webprozess mountet keinen Docker-Socket.

Collector-Response:

```json
{
  "hostname": "edge-01",
  "uptimeSeconds": 86400,
  "cpu": { "cores": 8, "load": [0.4, 0.3, 0.2] },
  "memory": { "total": 17179869184, "used": 8589934592, "percentage": 50 },
  "network": [{ "family": "IPv4", "address": "192.168.1.10" }],
  "containers": { "running": 12, "stopped": 1 },
  "collectedAt": "2026-07-12T00:00:00.000Z"
}
```

Die Wetterintegration nutzt den dokumentierten Open-Meteo-Endpunkt `/v1/forecast`; Gitea-Tokens werden gemäß Giteas API-Dokumentation als `Authorization: token …` gesendet: [Open-Meteo Forecast API](https://open-meteo.com/en/docs), [Gitea API Usage](https://docs.gitea.com/development/api-usage).

## Qualitätssicherung

```powershell
pnpm registry:generate
pnpm prisma validate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Die Tests decken Registry-Discovery, Rollen, responsive Layout-Grenzen, Secret-Verschlüsselung/Redaktion, SSRF-URL-Policy, Slugs und Importvalidierung ab.

## Projektstruktur

```text
prisma/                 Datenmodell, Migration, Seed
scripts/                Registry-Generator
src/app/                Next.js UI und API-Routen
src/components/         Dashboard-Shell, Grid, Dialoge, Konfiguration
src/lib/                Auth, DB, Cache, Secrets, Safe HTTP, Transfer
src/widget-engine/      Strikte Contracts, Registry und Layoutlogik
src/widgets/            Automatisch erkannte Widget-Module
tests/                  Contract- und Security-Tests
```
