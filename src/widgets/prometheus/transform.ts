export type PrometheusSample = {
  name: string;
  labels: string;
  value: number;
};

export type PrometheusMetrics = {
  samples: PrometheusSample[];
  metricCount: number;
  seriesCount: number;
  truncated: boolean;
};

const samplePattern = /^([A-Za-z_:][A-Za-z0-9_:]*)(\{(?:[^{}"]|"(?:\\.|[^"\\])*")*\})?\s+((?:[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?)|NaN|[+-]?Inf)(?:\s+\d+)?(?:\s+#.*)?$/;

export function normalizeMetricsUrl(value: string) {
  const trimmed = value.trim();
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function legacyMetricsUrl(value: string) {
  const endpoint = new URL(normalizeMetricsUrl(value));
  endpoint.pathname = `${endpoint.pathname.replace(/\/+$/, "")}/metrics`;
  return endpoint.toString();
}

export function parsePrometheusMetrics(text: string, maxSamples = 160): PrometheusMetrics {
  const samples: PrometheusSample[] = [];
  const metricNames = new Set<string>();
  let seriesCount = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = samplePattern.exec(line);
    if (!match) continue;
    const value = Number(match[3]);
    if (!Number.isFinite(value)) continue;
    const name = match[1];
    metricNames.add(name);
    seriesCount += 1;
    if (samples.length < maxSamples) {
      samples.push({
        name,
        labels: (match[2] ?? "").slice(1, -1),
        value,
      });
    }
  }

  if (seriesCount === 0) throw new Error("Der Endpunkt enthält keine lesbaren Prometheus-Metriken");
  return { samples, metricCount: metricNames.size, seriesCount, truncated: seriesCount > samples.length };
}

export function formatPrometheusSample(value: number) {
  const absolute = Math.abs(value);
  if ((absolute > 0 && absolute < 0.001) || absolute >= 1_000_000_000_000) {
    return value.toExponential(3);
  }
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 }).format(value);
}
