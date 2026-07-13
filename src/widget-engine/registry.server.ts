import "server-only";
import { generatedWidgetDefinitions } from "@/generated/widget-registry.server";
import type { AppRole, WidgetCatalogItem, WidgetDefinition, WidgetRuntimeDependencies } from "./contracts";

export function createWidgetRegistry(dependencies: WidgetRuntimeDependencies) {
  const definitions = new Map<string, WidgetDefinition>();
  const providers = new Map<string, ReturnType<NonNullable<WidgetDefinition["createProvider"]>>>();

  for (const definition of generatedWidgetDefinitions) {
    const { type } = definition.manifest;
    if (definitions.has(type)) throw new Error(`Duplicate widget type: ${type}`);
    definitions.set(type, definition as WidgetDefinition);
    if (definition.createProvider) providers.set(type, definition.createProvider(dependencies) as never);
  }

  return {
    get(type: string) {
      return definitions.get(type);
    },
    require(type: string) {
      const definition = definitions.get(type);
      if (!definition) throw new Error(`Unknown widget type: ${type}`);
      return definition;
    },
    provider(type: string) {
      return providers.get(type);
    },
    catalog(role?: AppRole): WidgetCatalogItem[] {
      return [...definitions.values()].map((definition) => ({
        ...definition.manifest,
        fields: definition.fields,
        allowedRoles: definition.manifest.allowedRoles,
        ...(role ? { available: definition.manifest.allowedRoles.includes(role) } : {}),
      })) as WidgetCatalogItem[];
    },
    all() {
      return [...definitions.values()];
    },
  };
}

export type WidgetRegistry = ReturnType<typeof createWidgetRegistry>;
