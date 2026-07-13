"use client";

import { Gauge, Radio, Sigma } from "lucide-react";
import type { WidgetViewProps } from "@/widget-engine/contracts";
import { formatPrometheusValue, type PrometheusUnit } from "./transform";

type PrometheusData = { value?: number; seriesCount?: number; source?: string };

export default function PrometheusWidget({ data, loading, error, config }: WidgetViewProps) {
  if (loading) return <div className="prometheus-skeleton"><span /><span /><span /></div>;
  if (error) return <div className="inline-error">Prometheus-Metrik nicht verfügbar.<small>{error}</small></div>;

  const metric = (data ?? {}) as PrometheusData;
  const rawValue = Number(metric.value);
  const decimals = Number(config.decimals ?? 2);
  const formatted = Number.isFinite(rawValue)
    ? formatPrometheusValue(rawValue, String(config.unit ?? "number") as PrometheusUnit, decimals)
    : { valueText: "—", unitText: "", progress: undefined };

  return (
    <div className="prometheus-widget">
      <div className="prometheus-top"><span><Gauge size={15} /> PROMQL INSTANT</span><span className="live-pill"><Radio size={11} /> LIVE</span></div>
      <div className="prometheus-value"><strong>{formatted.valueText}</strong>{formatted.unitText && <span>{formatted.unitText}</span>}</div>
      <div className="prometheus-label">{String(config.label ?? "Prometheus metric")}</div>
      {formatted.progress !== undefined && <div className="prometheus-progress" aria-label={`${formatted.progress.toFixed(0)} Prozent`}><i style={{ width: `${formatted.progress}%` }} /></div>}
      <div className="prometheus-meta"><span><Sigma size={13} /> {metric.seriesCount ?? 0} {(metric.seriesCount ?? 0) === 1 ? "Zeitreihe" : "Zeitreihen"}</span><span>{metric.source ?? "Prometheus"}</span></div>
      <code className="prometheus-query" title={String(config.query ?? "")}>{String(config.query ?? "")}</code>
    </div>
  );
}
