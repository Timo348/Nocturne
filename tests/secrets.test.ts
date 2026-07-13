import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, exportConfig, publicConfig, sealConfig, unsealConfig } from "@/lib/secrets";

describe("widget secret handling", () => {
  it("encrypts authenticated values without retaining plaintext", () => {
    const plaintext = "canary-token-never-leak";
    const encrypted = encryptSecret(plaintext);
    expect(encrypted).toMatch(/^enc:v1:/);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it("redacts secrets for browser state and JSON share exports", () => {
    const sealed = sealConfig({ baseUrl: "https://gitea.home", token: "canary-token" }, ["token"]);
    const browser = publicConfig(sealed, ["token"]);
    const exported = exportConfig(sealed, ["token"]);
    expect(browser["token"]).toBe("");
    expect(browser.__configuredSecrets).toEqual({ token: true });
    expect(exported.token).toEqual({ $secret: "required" });
    expect(JSON.stringify({ browser, exported })).not.toContain("canary-token");
    expect(unsealConfig(sealed, ["token"]).token).toBe("canary-token");
  });

  it("keeps the existing encrypted value when an edit submits an empty secret", () => {
    const original = sealConfig({ token: "original" }, ["token"]);
    const updated = sealConfig({ token: "" }, ["token"], original);
    expect(updated.token).toBe(original.token);
    expect(unsealConfig(updated, ["token"]).token).toBe("original");
  });
});
