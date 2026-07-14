import { describe, expect, it } from "vitest";
import { validateOutboundHeaders, validateOutboundUrl } from "@/lib/safe-http";

describe("outbound URL policy", () => {
  it("rejects non-HTTP schemes and embedded credentials", async () => {
    await expect(validateOutboundUrl("file:///etc/passwd")).rejects.toThrow(/HTTP and HTTPS/);
    await expect(validateOutboundUrl("http://user:pass@example.com/status")).rejects.toThrow(/Credentials/);
  });

  it("allows private, loopback and special HTTP targets without an allowlist", async () => {
    const result = await validateOutboundUrl("http://127.0.0.1/status");
    expect(result.url.hostname).toBe("127.0.0.1");
    expect(result.addresses).toEqual([{ address: "127.0.0.1", family: 4 }]);
  });

  it("still rejects a username-like prefix instead of treating it as a hostname", async () => {
    await expect(validateOutboundUrl("http://allowed.example@127.0.0.1/status")).rejects.toThrow(/Credentials/);
  });

  it("allows integration auth but blocks transport and browser credential headers", () => {
    expect(validateOutboundHeaders({ Authorization: "Bearer token", "X-API-Key": "secret" })).toEqual({ authorization: "Bearer token", "x-api-key": "secret" });
    expect(() => validateOutboundHeaders({ Host: "attacker.example" })).toThrow(/not allowed/i);
    expect(() => validateOutboundHeaders({ Cookie: "session=secret" })).toThrow(/not allowed/i);
    expect(() => validateOutboundHeaders({ "X-Test": "ok\r\nInjected: true" })).toThrow(/value/i);
  });
});
