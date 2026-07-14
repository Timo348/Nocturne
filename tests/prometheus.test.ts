import { describe, expect, it } from "vitest";
import type { SafeHttpOptions } from "@/widget-engine/contracts";
import { definition } from "@/widgets/prometheus/definition";
import { formatPrometheusSample, legacyMetricsUrl, normalizeMetricsUrl, parsePrometheusMetrics } from "@/widgets/prometheus/transform";

const exposition = `
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="get",code="200"} 1027 1710000000
http_requests_total{method="post",code="201"} 3
node_cpu_ratio 0.425
room_temperature_celsius -1.25e1
request_duration_seconds_bucket{le="+Inf"} 10 # {trace_id="abc"} 1.0
invalid_metric NaN
`;

describe("Prometheus metrics endpoint", () => {
  it("normalizes links without a protocol to HTTPS", () => {
    expect(normalizeMetricsUrl("monitoring.homelab.de/metrics")).toBe("https://monitoring.homelab.de/metrics");
    expect(normalizeMetricsUrl("http://win11.homelab.de/metrics")).toBe("http://win11.homelab.de/metrics");
    expect(legacyMetricsUrl("https://prometheus.homelab.de/base/")).toBe("https://prometheus.homelab.de/base/metrics");
  });

  it("parses native Prometheus text with labels, timestamps and exemplars", () => {
    const result = parsePrometheusMetrics(exposition);
    expect(result).toMatchObject({ metricCount: 4, seriesCount: 5, truncated: false });
    expect(result.samples[0]).toEqual({ name: "http_requests_total", labels: 'method="get",code="200"', value: 1027 });
    expect(result.samples[2]).toEqual({ name: "node_cpu_ratio", labels: "", value: 0.425 });
    expect(result.samples[4]).toEqual({ name: "request_duration_seconds_bucket", labels: 'le="+Inf"', value: 10 });
  });

  it("caps browser payloads while retaining complete endpoint counts", () => {
    const result = parsePrometheusMetrics(exposition, 2);
    expect(result.samples).toHaveLength(2);
    expect(result.seriesCount).toBe(5);
    expect(result.truncated).toBe(true);
  });

  it("rejects responses without readable metrics", () => {
    expect(() => parsePrometheusMetrics("# only comments\ninvalid text\nmetric NaN")).toThrow(/keine lesbaren/i);
  });

  it("formats ordinary, small and very large values compactly", () => {
    expect(formatPrometheusSample(1536.125)).toBe("1.536,125");
    expect(formatPrometheusSample(0.00001)).toBe("1.000e-5");
    expect(formatPrometheusSample(1_000_000_000_000)).toBe("1.000e+12");
  });

  it("loads the configured metrics link as text", async () => {
    let requestedUrl = "";
    let requestedOptions: SafeHttpOptions | undefined;
    const provider = definition.createProvider!({
      http: {
        async getJson() { throw new Error("JSON API must not be used"); },
        async getText(url: string, options?: SafeHttpOptions) {
          requestedUrl = url;
          requestedOptions = options;
          return exposition;
        },
      },
      async getHostSnapshot() { return {}; },
    });

    const config = definition.configSchema.parse({ metricsUrl: "win11.homelab.de/metrics" });
    const result = await provider.load(config) as { metricCount: number; seriesCount: number; source: string };
    expect(requestedUrl).toBe("https://win11.homelab.de/metrics");
    expect(requestedOptions).toMatchObject({ timeoutMs: 10_000, maxBytes: 2 * 1024 * 1024 });
    expect(result).toMatchObject({ metricCount: 4, seriesCount: 5, source: "win11.homelab.de" });
  });

  it("migrates the old base URL configuration to /metrics", () => {
    expect(definition.configSchema.parse({
      baseUrl: "https://prometheus.homelab.de/prometheus/",
      query: "up",
      label: "Up",
      reduction: "sum",
    })).toEqual({ metricsUrl: "https://prometheus.homelab.de/prometheus/metrics" });
  });
});
