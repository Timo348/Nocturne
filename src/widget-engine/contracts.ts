import type { ComponentType } from "react";
import type { z } from "zod";
import type { AppTheme } from "@/lib/themes";

export const APP_ROLES = ["VIEWER", "DEVELOPER", "ADMIN"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export type WidgetCategory = "Essentials" | "Monitoring" | "Developer" | "Feeds" | "Custom";
export type WidgetFieldType = "text" | "password" | "url" | "number" | "select" | "toggle" | "textarea" | "links";

export type WidgetConfigField = {
  key: string;
  label: string;
  type: WidgetFieldType;
  defaultValue?: string | number | boolean;
  placeholder?: string;
  help?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ label: string; value: string }>;
};

export type GridPosition = { x: number; y: number; w: number; h: number };
export type WidgetLayout = {
  desktop: GridPosition;
  tablet: GridPosition;
  mobile: GridPosition;
};

export type WidgetSize = {
  default: { w: number; h: number };
  min: { w: number; h: number };
  max?: { w: number; h: number };
};

export type SafeHttpOptions = {
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxBytes?: number;
};

export type WidgetRuntimeDependencies = {
  http: {
    getJson<T = unknown>(url: string, options?: SafeHttpOptions): Promise<T>;
    getText(url: string, options?: SafeHttpOptions): Promise<string>;
  };
  getHostSnapshot(): Promise<unknown>;
};

export type WidgetProvider<TConfig = Record<string, unknown>> = {
  load(config: TConfig): Promise<unknown>;
};

export type WidgetManifest = {
  type: string;
  version: number;
  name: string;
  description: string;
  icon: string;
  category: WidgetCategory;
  accent: string;
  allowedRoles: AppRole[];
  size: WidgetSize;
  cacheTtlSeconds: number;
};

export type WidgetDefinition<TConfig = Record<string, unknown>> = {
  manifest: WidgetManifest;
  configSchema: z.ZodType<TConfig>;
  fields: WidgetConfigField[];
  secretFields: string[];
  createProvider?: (dependencies: WidgetRuntimeDependencies) => WidgetProvider<TConfig>;
};

export type WidgetCatalogItem = WidgetManifest & {
  fields: WidgetConfigField[];
};

export type ClientWidget = {
  id: string;
  type: string;
  title: string;
  config: Record<string, unknown>;
  layout: WidgetLayout;
  updatedAt: string;
};

export type ClientDashboard = {
  id: string;
  name: string;
  slug: string;
  description: string;
  environment: string;
  isDefault: boolean;
  isShared: boolean;
  shareTheme: AppTheme;
  revision: number;
  widgets: ClientWidget[];
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  theme: AppTheme;
};

export type BootstrapData = {
  user: SessionUser;
  dashboards: ClientDashboard[];
  catalog: WidgetCatalogItem[];
};

export type WidgetViewProps = {
  config: Record<string, unknown>;
  data: unknown;
  loading: boolean;
  error?: string;
};

export type WidgetComponent = ComponentType<WidgetViewProps>;

export function defineWidget<TConfig>(definition: WidgetDefinition<TConfig>) {
  return definition;
}

export function canUseWidget(role: AppRole, definition: WidgetDefinition) {
  return definition.manifest.allowedRoles.includes(role);
}
