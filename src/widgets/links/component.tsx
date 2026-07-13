"use client";

import { Database, ExternalLink, GitBranch, Play, Router } from "lucide-react";
import type { WidgetViewProps } from "@/widget-engine/contracts";

type LinkItem = { label: string; url: string; icon?: string };
const icons = { router: Router, database: Database, git: GitBranch, play: Play, external: ExternalLink };

export default function LinksWidget({ config }: WidgetViewProps) {
  const links = Array.isArray(config.links) ? (config.links as LinkItem[]) : [];
  return (
    <div className="shortcut-grid">
      {links.map((link) => {
        const Icon = icons[(link.icon as keyof typeof icons) ?? "external"] ?? ExternalLink;
        return (
          <a className="shortcut-card" href={link.url} target="_blank" rel="noreferrer" key={`${link.label}-${link.url}`}>
            <span className="shortcut-icon"><Icon size={18} aria-hidden="true" /></span>
            <span><strong>{link.label}</strong><small>{new URL(link.url).hostname}</small></span>
            <ExternalLink className="shortcut-arrow" size={14} aria-hidden="true" />
          </a>
        );
      })}
    </div>
  );
}
