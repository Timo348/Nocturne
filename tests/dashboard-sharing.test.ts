import { describe, expect, it } from "vitest";
import { createShareToken, isShareToken, sharePath } from "@/lib/dashboard-sharing";

describe("dashboard sharing tokens", () => {
  it("creates URL-safe, high-entropy tokens", () => {
    const first = createShareToken();
    const second = createShareToken();
    expect(first).toHaveLength(43);
    expect(isShareToken(first)).toBe(true);
    expect(first).not.toBe(second);
    expect(sharePath(first)).toBe(`/shared/${first}`);
  });

  it("rejects malformed and abbreviated capabilities", () => {
    expect(isShareToken("short-token")).toBe(false);
    expect(isShareToken("a".repeat(42))).toBe(false);
    expect(isShareToken(`${"a".repeat(42)}!`)).toBe(false);
  });
});
