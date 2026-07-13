import { z } from "zod";
import { defineWidget } from "@/widget-engine/contracts";

const configSchema = z
  .object({
    label: z.string().trim().min(1).max(50).default("Home"),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    temperatureUnit: z.enum(["celsius", "fahrenheit"]).default("celsius"),
  })
  .strict();

type Config = z.infer<typeof configSchema>;

export const definition = defineWidget<Config>({
  manifest: {
    type: "weather",
    version: 1,
    name: "Weather pulse",
    description: "Aktuelles Wetter und Vier-Tage-Trend mit gecachten Open-Meteo-Daten.",
    icon: "CloudSun",
    category: "Essentials",
    accent: "#60a5fa",
    allowedRoles: ["VIEWER", "DEVELOPER", "ADMIN"],
    size: { default: { w: 3, h: 4 }, min: { w: 3, h: 4 }, max: { w: 6, h: 6 } },
    cacheTtlSeconds: 600,
  },
  configSchema,
  fields: [
    { key: "label", label: "Ort", type: "text", placeholder: "Berlin", required: true },
    { key: "latitude", label: "Breitengrad", type: "number", min: -90, max: 90, step: 0.0001, required: true },
    { key: "longitude", label: "Längengrad", type: "number", min: -180, max: 180, step: 0.0001, required: true },
    { key: "temperatureUnit", label: "Einheit", type: "select", options: [{ label: "Celsius", value: "celsius" }, { label: "Fahrenheit", value: "fahrenheit" }] },
  ],
  secretFields: [],
  createProvider: ({ http }) => ({
    async load(config) {
      const params = new URLSearchParams({
        latitude: String(config.latitude),
        longitude: String(config.longitude),
        current: "temperature_2m,apparent_temperature,is_day,weather_code,wind_speed_10m",
        daily: "weather_code,temperature_2m_max,temperature_2m_min",
        timezone: "auto",
        forecast_days: "4",
        temperature_unit: config.temperatureUnit,
      });
      const response = await http.getJson<Record<string, unknown>>(`https://api.open-meteo.com/v1/forecast?${params}`);
      return { ...response, label: config.label };
    },
  }),
});
