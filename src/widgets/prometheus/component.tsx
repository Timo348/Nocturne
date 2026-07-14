"use client";

import { Gauge, Layers3, Radio } from "lucide-react";
import type { WidgetViewProps } from "@/widget-engine/contracts";
import { formatPrometheusSample, type PrometheusSample } from "./transform";

type PrometheusData = {
  samples?: PrometheusSample[];
  metricCount?: number;
  seriesCount?: number;
  truncated?: boolean;
  source?: string;
};

export default function PrometheusWidget({ data, loading, error }: WidgetViewProps) {
  if (loading) return <div className="prometheus-skeleton"><span /><span /><span /></div>;
  if (error) return <div className="inline-error">Metrics-Endpunkt nicht verfügbar.<small>{error}</small></div>;

  const metrics = (data ?? {}) as PrometheusData;
  const samples = metrics.samples ?? [];

  return (
    <div className="prometheus-widget">
      <div className="prometheus-top"><span><Gauge size={15} /> METRICS ENDPOINT</span><span className="live-pill"><Radio size={11} /> LIVE</span></div>
      <div className="prometheus-summary">
        <span><strong>{metrics.metricCount ?? 0}</strong><small>METRIKEN</small></span>
        <i />
        <span><strong>{metrics.seriesCount ?? 0}</strong><small>ZEITREIHEN</small></span>
        <span className="prometheus-source">{metrics.source ?? "Prometheus"}</span>
      </div>
      <div className="prometheus-metric-list">
        {samples.map((sample, index) => <div className="prometheus-metric-row" key={`${sample.name}-${sample.labels}-${index}`}>
          <span><strong>{sample.name}</strong>{sample.labels && <small title={sample.labels}>{sample.labels}</small>}</span>
          <code>{formatPrometheusSample(sample.value)}</code>
        </div>)}
      </div>
      {metrics.truncated && <div className="prometheus-truncated"><Layers3 size={12} /> Weitere Zeitreihen sind am Endpunkt verfügbar</div>}
    </div>
  );
}
