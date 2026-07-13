"use client";

import { Braces, Radio } from "lucide-react";
import type { WidgetViewProps } from "@/widget-engine/contracts";

export default function RestWidget({ data, loading, error, config }: WidgetViewProps) {
  if (loading) return <div className="metric-skeleton"><span /><span /></div>;
  if (error) return <div className="inline-error">API-Wert nicht verfügbar.<small>{error}</small></div>;
  const metric = (data ?? {}) as { value?: string | number | boolean; label?: string; prefix?: string; suffix?: string };
  return (
    <div className="api-metric">
      <div className="api-metric-top"><span><Braces size={15} /> JSON scalar</span><span className="live-pill"><Radio size={11} /> LIVE</span></div>
      <div className="api-value"><small>{metric.prefix}</small>{String(metric.value ?? "—")}<small>{metric.suffix}</small></div>
      <div className="api-label">{metric.label ?? String(config.label ?? "API value")}</div>
    </div>
  );
}
