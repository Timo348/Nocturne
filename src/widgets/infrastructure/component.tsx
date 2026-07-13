"use client";

import { Box, Cpu, HardDrive, Network } from "lucide-react";
import type { WidgetViewProps } from "@/widget-engine/contracts";

type Snapshot = {
  hostname?: string;
  uptimeSeconds?: number;
  cpu?: { cores?: number; load?: number[] };
  memory?: { total?: number; used?: number; percentage?: number };
  network?: Array<{ family: string | number; address: string }>;
  containers?: { running: number; stopped: number };
};

function bytes(value = 0) {
  const gb = value / 1024 ** 3;
  return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
}

function uptime(value = 0) {
  const days = Math.floor(value / 86_400);
  const hours = Math.floor((value % 86_400) / 3_600);
  return days ? `${days}d ${hours}h` : `${hours}h`;
}

export default function InfrastructureWidget({ data, loading, error, config }: WidgetViewProps) {
  if (loading) return <div className="infra-skeleton"><span /><span /><span /></div>;
  if (error) return <div className="inline-error">Metriken nicht verfügbar.<small>{error}</small></div>;
  const snapshot = (data ?? {}) as Snapshot;
  const memory = snapshot.memory?.percentage ?? 0;
  const load = snapshot.cpu?.load?.[0] ?? 0;
  const cpuPercent = Math.min(100, Math.round((load / Math.max(1, snapshot.cpu?.cores ?? 1)) * 100));
  const utilization = Math.max(cpuPercent, memory);
  const address = snapshot.network?.find((entry) => String(entry.family).includes("4"))?.address ?? "No address";
  return (
    <div className="infra-widget">
      <div className="infra-hero">
        <div><span className="eyebrow">{snapshot.hostname ?? "Local host"}</span><strong>Host erreichbar</strong><small>Uptime {uptime(snapshot.uptimeSeconds)}</small></div>
        <div className="health-ring" aria-label={`Höchste Auslastung ${utilization} Prozent`} style={{ "--health": `${utilization}%` } as React.CSSProperties}><span>{utilization}<small>%</small></span></div>
      </div>
      <div className="metric-grid">
        <div className="mini-metric"><span><Cpu size={15} /> CPU</span><strong>{cpuPercent}%</strong><div><i style={{ width: `${cpuPercent}%` }} /></div><small>{snapshot.cpu?.cores ?? 0} cores</small></div>
        <div className="mini-metric"><span><HardDrive size={15} /> Memory</span><strong>{memory}%</strong><div><i style={{ width: `${memory}%` }} /></div><small>{bytes(snapshot.memory?.used)} / {bytes(snapshot.memory?.total)}</small></div>
        {snapshot.containers ? <div className="mini-metric"><span><Box size={15} /> Docker</span><strong>{snapshot.containers.running}</strong><small>{snapshot.containers.stopped} stopped</small></div> : config.showNetwork !== false ? <div className="mini-metric"><span><Network size={15} /> Network</span><strong className="address-value">{address}</strong><small>{snapshot.network?.length ?? 0} interfaces</small></div> : null}
      </div>
    </div>
  );
}
