import "server-only";
import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import type { SafeHttpOptions } from "@/widget-engine/contracts";

const DEFAULT_TIMEOUT = 5_000;
const DEFAULT_MAX_BYTES = 1024 * 1024;
const FORBIDDEN_OUTBOUND_HEADERS = new Set([
  "connection", "content-length", "cookie", "host", "keep-alive", "proxy-authenticate",
  "proxy-authorization", "set-cookie", "te", "trailer", "transfer-encoding", "upgrade",
]);

export function validateOutboundHeaders(headers: Record<string, string> = {}) {
  const output: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    const normalized = name.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(normalized)) throw new Error(`Invalid outbound header name: ${name}`);
    if (FORBIDDEN_OUTBOUND_HEADERS.has(normalized)) throw new Error(`Outbound header is not allowed: ${name}`);
    if (/\r|\n/.test(value)) throw new Error(`Invalid outbound header value: ${name}`);
    output[normalized] = value;
  }
  return output;
}

function exactAllowlist() {
  return new Set(
    (process.env.FETCH_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

function isBlockedIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isBlockedIp(address: string) {
  if (net.isIPv4(address)) return isBlockedIpv4(address);
  if (!net.isIPv6(address)) return true;
  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) return isBlockedIpv4(normalized.slice(7));
  return normalized === "::" || normalized === "::1" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("ff");
}

export async function validateOutboundUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid target URL");
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Only HTTP and HTTPS targets are allowed");
  if (url.username || url.password) throw new Error("Credentials in target URLs are not allowed");

  const host = url.hostname.toLowerCase();
  const hostWithPort = url.port ? `${host}:${url.port}` : host;
  const explicitlyAllowed = exactAllowlist().has(host) || exactAllowlist().has(hostWithPort) || exactAllowlist().has(url.origin.toLowerCase());
  const addresses = net.isIP(host) ? [{ address: host, family: net.isIPv6(host) ? 6 : 4 }] : await dns.lookup(host, { all: true, verbatim: true });
  if (addresses.length === 0) throw new Error("Target host did not resolve");
  if (!explicitlyAllowed && addresses.some(({ address }) => isBlockedIp(address))) {
    throw new Error("Private or special network targets require FETCH_ALLOWED_HOSTS");
  }
  return { url, addresses, explicitlyAllowed };
}

function requestBuffer(raw: string, options: SafeHttpOptions = {}) {
  return new Promise<{ data: Buffer; contentType: string }>(async (resolve, reject) => {
    try {
      const { url, addresses } = await validateOutboundUrl(raw);
      const selected = addresses[0];
      const transport = url.protocol === "https:" ? https : http;
      const request = transport.request(
        {
          protocol: url.protocol,
          hostname: selected.address,
          port: url.port || undefined,
          path: `${url.pathname}${url.search}`,
          servername: url.protocol === "https:" ? url.hostname : undefined,
          method: "GET",
          headers: {
            host: url.host,
            accept: "application/json, application/xml, text/xml, text/plain;q=0.9, */*;q=0.1",
            "user-agent": "Nocturne-Homelab/0.1",
            ...validateOutboundHeaders(options.headers),
          },
        },
        (response) => {
          if ((response.statusCode ?? 500) < 200 || (response.statusCode ?? 500) >= 300) {
            response.resume();
            reject(new Error(`Upstream returned ${response.statusCode}`));
            return;
          }
          const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
          const chunks: Buffer[] = [];
          let length = 0;
          response.on("data", (chunk: Buffer) => {
            length += chunk.length;
            if (length > maxBytes) {
              request.destroy(new Error("Upstream response exceeded the size limit"));
              return;
            }
            chunks.push(chunk);
          });
          response.on("end", () => resolve({ data: Buffer.concat(chunks), contentType: String(response.headers["content-type"] ?? "") }));
        },
      );
      request.setTimeout(options.timeoutMs ?? DEFAULT_TIMEOUT, () => request.destroy(new Error("Upstream request timed out")));
      request.on("error", reject);
      request.end();
    } catch (error) {
      reject(error);
    }
  });
}

export const safeHttpClient = {
  async getJson<T = unknown>(url: string, options?: SafeHttpOptions): Promise<T> {
    const { data } = await requestBuffer(url, options);
    return JSON.parse(data.toString("utf8")) as T;
  },
  async getText(url: string, options?: SafeHttpOptions) {
    const { data } = await requestBuffer(url, options);
    return data.toString("utf8");
  },
};
