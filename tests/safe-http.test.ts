import { afterEach, describe, expect, it } from "vitest";
import { validateOutboundHeaders, validateOutboundUrl } from "@/lib/safe-http";

afterEach(() => { process.env.FETCH_ALLOWED_HOSTS = ""; });

describe("outbound URL policy", () => {
  it("rejects non-HTTP schemes and embedded credentials", async () => {
    await expect(validateOutboundUrl("file:///etc/passwd")).rejects.toThrow(/HTTP and HTTPS/);
    await expect(validateOutboundUrl("http://user:pass@example.com/status")).rejects.toThrow(/Credentials/);
  });

  it("rejects private targets unless an administrator explicitly allowlists them", async () => {
    process.env.FETCH_ALLOWED_HOSTS = "";
    await expect(validateOutboundUrl("http://127.0.0.1/status")).rejects.toThrow(/FETCH_ALLOWED_HOSTS/);
    process.env.FETCH_ALLOWED_HOSTS = "127.0.0.1";
    const result = await validateOutboundUrl("http://127.0.0.1/status");
    expect(result.explicitlyAllowed).toBe(true);
  });

  it("does not treat a username-like prefix as an allowlisted hostname", async () => {
    process.env.FETCH_ALLOWED_HOSTS = "allowed.example";
    await expect(validateOutboundUrl("http://allowed.example@127.0.0.1/status")).rejects.toThrow(/Credentials/);
  });

  it("allows integration auth but blocks transport and browser credential headers", () => {
    expect(validateOutboundHeaders({ Authorization: "Bearer token", "X-API-Key": "secret" })).toEqual({ authorization: "Bearer token", "x-api-key": "secret" });
    expect(() => validateOutboundHeaders({ Host: "attacker.example" })).toThrow(/not allowed/i);
    expect(() => validateOutboundHeaders({ Cookie: "session=secret" })).toThrow(/not allowed/i);
    expect(() => validateOutboundHeaders({ "X-Test": "ok\r\nInjected: true" })).toThrow(/value/i);
  });
});
