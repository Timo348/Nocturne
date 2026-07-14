export const APP_THEMES = ["nocturne", "aurora", "ember", "graphite"] as const;

export type AppTheme = (typeof APP_THEMES)[number];

export type ThemeOption = {
  id: AppTheme;
  name: string;
  description: string;
  colors: readonly [string, string, string];
};

export const DEFAULT_THEME: AppTheme = "nocturne";

export const THEME_OPTIONS: readonly ThemeOption[] = [
  {
    id: "nocturne",
    name: "Nocturne",
    description: "Das bekannte violette Control-Room-Theme.",
    colors: ["#6f50e8", "#1b2540", "#0d1222"],
  },
  {
    id: "aurora",
    name: "Polarlicht",
    description: "Klares Blau und Cyan für technische Monitoring-Wände.",
    colors: ["#0891b2", "#12334a", "#071a2a"],
  },
  {
    id: "ember",
    name: "Glut",
    description: "Warme Orange- und Kupfertöne mit hohem Kontrast.",
    colors: ["#ea580c", "#45291e", "#1e100c"],
  },
  {
    id: "graphite",
    name: "Graphit",
    description: "Reduziertes Anthrazit mit grünen Status-Akzenten.",
    colors: ["#10b981", "#26322f", "#101514"],
  },
] as const;

export function isAppTheme(value: unknown): value is AppTheme {
  return typeof value === "string" && (APP_THEMES as readonly string[]).includes(value);
}

export function normalizeTheme(value: unknown): AppTheme {
  return isAppTheme(value) ? value : DEFAULT_THEME;
}
