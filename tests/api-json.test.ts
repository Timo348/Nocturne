import { describe, expect, it } from "vitest";
import { readJsonBody } from "@/lib/api";

function request(body: string, contentType = "application/json") {
  return new Request("http://localhost/api/test", { method: "POST", headers: { "content-type": contentType }, body });
}

describe("JSON request boundary", () => {
  it("requires the JSON content type", async () => {
    await expect(readJsonBody(request("{}", "text/plain"))).rejects.toThrow(/application\/json/i);
  });

  it("rejects prototype-pollution keys recursively", async () => {
    await expect(readJsonBody(request('{"config":{"__proto__":{"admin":true}}}'))).rejects.toThrow(/Forbidden JSON key/);
  });

  it("rejects excessive nesting", async () => {
    const body = `${"{\"value\":".repeat(22)}null${"}".repeat(22)}`;
    await expect(readJsonBody(request(body))).rejects.toThrow(/nested too deeply/);
  });
});
