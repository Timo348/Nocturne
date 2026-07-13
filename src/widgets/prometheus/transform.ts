export const prometheusUnits = [
  "number",
  "percent",
  "ratio_percent",
  "bytes_auto",
  "bytes",
  "kilobytes",
  "megabytes",
  "gigabytes",
  "duration_auto",
  "milliseconds",
  "seconds",
  "minutes",
  "hours",
] as const;

export type PrometheusUnit = (typeof prometheusUnits)[number];
export type PrometheusReduction = "first" | "sum" | "average" | "min" | "max";

export function reducePrometheusValues(values: number[], reduction: PrometheusReduction) {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) throw new Error("Prometheus returned no finite numeric samples");
  if (reduction === "first") return finite[0];
  if (reduction === "sum") return finite.reduce((total, value) => total + value, 0);
  if (reduction === "average") return finite.reduce((total, value) => total + value, 0) / finite.length;
  if (reduction === "min") return Math.min(...finite);
  return Math.max(...finite);
}

function numberText(value: number, decimals: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPrometheusValue(value: number, unit: PrometheusUnit, decimals: number) {
  const places = Math.max(0, Math.min(4, Math.trunc(decimals)));
  let converted = value;
  let unitText = "";
  let progress: number | undefined;

  if (unit === "percent" || unit === "ratio_percent") {
    converted = unit === "ratio_percent" ? value * 100 : value;
    unitText = "%";
    progress = Math.max(0, Math.min(100, converted));
  } else if (unit === "bytes_auto") {
    const labels = ["B", "KB", "MB", "GB", "TB"];
    let index = 0;
    while (Math.abs(converted) >= 1024 && index < labels.length - 1) {
      converted /= 1024;
      index += 1;
    }
    unitText = labels[index];
  } else if (["bytes", "kilobytes", "megabytes", "gigabytes"].includes(unit)) {
    const powers = { bytes: 0, kilobytes: 1, megabytes: 2, gigabytes: 3 } as const;
    const labels = { bytes: "B", kilobytes: "KB", megabytes: "MB", gigabytes: "GB" } as const;
    const byteUnit = unit as keyof typeof powers;
    converted = value / 1024 ** powers[byteUnit];
    unitText = labels[byteUnit];
  } else if (unit === "duration_auto") {
    const absolute = Math.abs(value);
    if (absolute >= 3600) { converted = value / 3600; unitText = "h"; }
    else if (absolute >= 60) { converted = value / 60; unitText = "min"; }
    else if (absolute >= 1) { unitText = "s"; }
    else { converted = value * 1000; unitText = "ms"; }
  } else if (unit === "milliseconds") {
    converted = value * 1000;
    unitText = "ms";
  } else if (unit === "seconds") {
    unitText = "s";
  } else if (unit === "minutes") {
    converted = value / 60;
    unitText = "min";
  } else if (unit === "hours") {
    converted = value / 3600;
    unitText = "h";
  }

  return { valueText: numberText(converted, places), unitText, progress };
}
