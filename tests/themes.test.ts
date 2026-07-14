import { describe, expect, it } from "vitest";
import { APP_THEMES, DEFAULT_THEME, THEME_OPTIONS, isAppTheme, normalizeTheme } from "@/lib/themes";

describe("dashboard themes", () => {
  it("defines one selectable option for every supported theme", () => {
    expect(THEME_OPTIONS.map((theme) => theme.id)).toEqual(APP_THEMES);
    expect(new Set(THEME_OPTIONS.flatMap((theme) => theme.colors)).size).toBeGreaterThan(APP_THEMES.length);
  });

  it("falls back safely when persisted theme data is unknown", () => {
    expect(isAppTheme("aurora")).toBe(true);
    expect(isAppTheme("future-theme")).toBe(false);
    expect(normalizeTheme("graphite")).toBe("graphite");
    expect(normalizeTheme("future-theme")).toBe(DEFAULT_THEME);
  });
});
