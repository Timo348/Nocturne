import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/slug";

describe("dashboard slugs", () => {
  it("normalizes names into stable URL-safe values", () => {
    expect(slugify("Timos Überwachungs-Übersicht")).toBe("timos-uberwachungs-ubersicht");
    expect(slugify("---")).toBe("dashboard");
  });
});
