"use client";

import { Cloud, CloudDrizzle, CloudLightning, CloudRain, CloudSnow, Droplets, Sun, Wind } from "lucide-react";
import type { WidgetViewProps } from "@/widget-engine/contracts";

type WeatherData = {
  label?: string;
  current?: { temperature_2m?: number; apparent_temperature?: number; weather_code?: number; wind_speed_10m?: number };
  current_units?: { temperature_2m?: string; wind_speed_10m?: string };
  daily?: { time?: string[]; weather_code?: number[]; temperature_2m_max?: number[]; temperature_2m_min?: number[] };
};

function weatherIcon(code = 0, size = 26) {
  if (code === 0) return <Sun size={size} />;
  if ([1, 2, 3, 45, 48].includes(code)) return <Cloud size={size} />;
  if ([51, 53, 55, 56, 57].includes(code)) return <CloudDrizzle size={size} />;
  if ([61, 63, 65, 80, 81, 82].includes(code)) return <CloudRain size={size} />;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return <CloudSnow size={size} />;
  if ([95, 96, 99].includes(code)) return <CloudLightning size={size} />;
  return <Cloud size={size} />;
}

const dayFormatter = new Intl.DateTimeFormat("de-DE", { weekday: "short" });

export default function WeatherWidget({ data, loading, error, config }: WidgetViewProps) {
  if (loading) return <div className="widget-skeleton weather-skeleton" aria-label="Wetter wird geladen" />;
  if (error) return <div className="inline-error">Wetterdaten nicht erreichbar.<small>{error}</small></div>;
  const weather = (data ?? {}) as WeatherData;
  const current = weather.current ?? {};
  const unit = weather.current_units?.temperature_2m ?? (config.temperatureUnit === "fahrenheit" ? "°F" : "°C");
  const days = weather.daily?.time ?? [];

  return (
    <div className="weather-widget">
      <div className="weather-current">
        <div>
          <span className="eyebrow">{String(weather.label ?? config.label ?? "Home")}</span>
          <div className="temperature">{Math.round(current.temperature_2m ?? 0)}<sup>{unit.replace("°", "")}</sup></div>
        </div>
        <span className="weather-orb">{weatherIcon(current.weather_code, 34)}</span>
      </div>
      <div className="weather-meta">
        <span><Droplets size={14} /> Gefühlt {Math.round(current.apparent_temperature ?? 0)}°</span>
        <span><Wind size={14} /> {Math.round(current.wind_speed_10m ?? 0)} {weather.current_units?.wind_speed_10m ?? "km/h"}</span>
      </div>
      <div className="forecast-row">
        {days.map((day, index) => (
          <div className="forecast-day" key={day}>
            <span>{index === 0 ? "Heute" : dayFormatter.format(new Date(`${day}T12:00:00`))}</span>
            {weatherIcon(weather.daily?.weather_code?.[index], 16)}
            <strong>{Math.round(weather.daily?.temperature_2m_max?.[index] ?? 0)}°</strong>
            <small>{Math.round(weather.daily?.temperature_2m_min?.[index] ?? 0)}°</small>
          </div>
        ))}
      </div>
    </div>
  );
}
