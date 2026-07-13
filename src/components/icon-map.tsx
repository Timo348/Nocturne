"use client";

import { Activity, Braces, CloudSun, Gauge, GitBranch, Orbit, Rss } from "lucide-react";

const icons = { Activity, Braces, CloudSun, Gauge, GitBranch, Orbit, Rss };

export function WidgetIcon({ name, size = 18 }: { name: string; size?: number }) {
  const Icon = icons[name as keyof typeof icons] ?? Orbit;
  return <Icon size={size} aria-hidden="true" />;
}
