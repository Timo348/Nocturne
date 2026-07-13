"use client";

import { ArrowUpRight, GitFork, LockKeyhole, Star } from "lucide-react";
import type { WidgetViewProps } from "@/widget-engine/contracts";

type Repo = { id: string; name: string; url: string; language: string; stars: number; forks: number; updatedAt: string; private: boolean };
const colors: Record<string, string> = { TypeScript: "#3178c6", JavaScript: "#f1e05a", Go: "#00add8", Python: "#3572A5", Rust: "#dea584", Dockerfile: "#384d54", Other: "#8b96b6" };

export default function GiteaWidget({ data, loading, error }: WidgetViewProps) {
  if (loading) return <div className="repo-skeleton">{[1, 2, 3].map((item) => <span key={item} />)}</div>;
  if (error) return <div className="inline-error">Gitea ist nicht erreichbar.<small>{error}</small></div>;
  const repositories = ((data as { repositories?: Repo[] })?.repositories ?? []);
  return (
    <div className="repo-list">
      {repositories.map((repo) => (
        <a className="repo-row" href={repo.url} target="_blank" rel="noreferrer" key={repo.id}>
          <span className="language-dot" style={{ backgroundColor: colors[repo.language] ?? colors.Other }} />
          <span className="repo-main"><strong>{repo.name}</strong><small>{repo.private && <LockKeyhole size={11} />} {repo.language}</small></span>
          <span className="repo-stat"><Star size={12} />{repo.stars}</span>
          <span className="repo-stat"><GitFork size={12} />{repo.forks}</span>
          <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      ))}
      {repositories.length === 0 && <div className="empty-state">Keine Repositories gefunden.</div>}
    </div>
  );
}
