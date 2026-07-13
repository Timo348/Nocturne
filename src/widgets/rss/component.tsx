"use client";

import { ArrowUpRight } from "lucide-react";
import type { WidgetViewProps } from "@/widget-engine/contracts";

type FeedData = { title?: string; items?: Array<{ title: string; url: string; summary: string; publishedAt: string }> };
const relative = new Intl.RelativeTimeFormat("de-DE", { numeric: "auto" });

function relativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Gerade eben";
  const hours = Math.round((date.getTime() - Date.now()) / 3_600_000);
  if (Math.abs(hours) < 24) return relative.format(hours, "hour");
  return relative.format(Math.round(hours / 24), "day");
}

export default function RssWidget({ data, loading, error }: WidgetViewProps) {
  if (loading) return <div className="feed-skeleton">{[1, 2, 3].map((item) => <span key={item} />)}</div>;
  if (error) return <div className="inline-error">Feed nicht erreichbar.<small>{error}</small></div>;
  const feed = (data ?? {}) as FeedData;
  return (
    <div className="feed-list">
      {(feed.items ?? []).map((item, index) => (
        <a href={item.url} target="_blank" rel="noreferrer" className="feed-item" key={`${item.url}-${index}`}>
          <span className="feed-index">{String(index + 1).padStart(2, "0")}</span>
          <span className="feed-copy"><strong>{item.title}</strong><small>{relativeDate(item.publishedAt)} · {item.summary}</small></span>
          <ArrowUpRight size={15} aria-hidden="true" />
        </a>
      ))}
      {(feed.items ?? []).length === 0 && <div className="empty-state">Dieser Feed enthält aktuell keine Einträge.</div>}
    </div>
  );
}
