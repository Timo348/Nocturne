import { describe, expect, it } from "vitest";
import type { SafeHttpOptions } from "@/widget-engine/contracts";
import { definition } from "@/widgets/prometheus/definition";
import { formatPrometheusValue, reducePrometheusValues } from "@/widgets/prometheus/transform";

describe("Prometheus metric transformation", () => {
  it("reduces multiple vector samples deterministically", () => {
    const values = [1, 3, 8];
    expect(reducePrometheusValues(values, "first")).toBe(1);
    expect(reducePrometheusValues(values, "sum")).toBe(12);
    expect(reducePrometheusValues(values, "average")).toBe(4);
    expect(reducePrometheusValues(values, "min")).toBe(1);
    expect(reducePrometheusValues(values, "max")).toBe(8);
  });

  it("rejects an empty or non-finite Prometheus result", () => {
    expect(() => reducePrometheusValues([], "sum")).toThrow(/no finite numeric samples/i);
    expect(() => reducePrometheusValues([Number.NaN, Number.POSITIVE_INFINITY], "sum")).toThrow(/no finite numeric samples/i);
  });

  it("formats ratios, bytes and seconds in the selected units", () => {
    expect(formatPrometheusValue(0.425, "ratio_percent", 1)).toEqual({ valueText: "42,5", unitText: "%", progress: 42.5 });
    expect(formatPrometheusValue(1536, "bytes_auto", 2)).toEqual({ valueText: "1,50", unitText: "KB", progress: undefined });
    expect(formatPrometheusValue(5 * 1024 ** 3, "gigabytes", 2)).toEqual({ valueText: "5,00", unitText: "GB", progress: undefined });
    expect(formatPrometheusValue(5400, "duration_auto", 1)).toEqual({ valueText: "1,5", unitText: "h", progress: undefined });
  });

  it("queries the Prometheus instant endpoint and reduces vector samples", async () => {
    let requestedUrl = "";
    let requestedHeaders: Record<string, string> | undefined;
    const provider = definition.createProvider!({
      http: {
        async getJson<T>(url: string, options?: SafeHttpOptions) {
          requestedUrl = url;
          requestedHeaders = options?.headers;
          return {
            status: "success",
            data: {
              resultType: "vector",
              result: [{ value: [1_700_000_000, "4"] }, { value: [1_700_000_001, "8"] }],
            },
          } as T;
        },
        async getText() { return ""; },
      },
      async getHostSnapshot() { return {}; },
    });

    const result = await provider.load({
      baseUrl: "https://metrics.example/prometheus/",
      query: "sum(rate(http_requests_total[5m]))",
      label: "Requests",
      reduction: "average",
      unit: "number",
      decimals: 2,
      headerName: "Authorization",
      headerValue: "Bearer secret",
    }) as { value: number; seriesCount: number; source: string };

    const endpoint = new URL(requestedUrl);
    expect(endpoint.pathname).toBe("/prometheus/api/v1/query");
    expect(endpoint.searchParams.get("query")).toBe("sum(rate(http_requests_total[5m]))");
    expect(requestedHeaders).toEqual({ Authorization: "Bearer secret" });
    expect(result).toEqual({ value: 6, seriesCount: 2, source: "metrics.example" });
  });
});
