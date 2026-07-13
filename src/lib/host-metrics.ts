import "server-only";
import os from "node:os";

export async function getHostSnapshot() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const interfaces = Object.values(os.networkInterfaces())
    .flatMap((items) => items ?? [])
    .filter((item) => !item.internal)
    .map((item) => ({ family: item.family, address: item.address }));

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    uptimeSeconds: os.uptime(),
    cpu: {
      cores: os.cpus().length,
      model: os.cpus()[0]?.model ?? "Unknown CPU",
      load: os.loadavg(),
    },
    memory: {
      total: totalMemory,
      used: totalMemory - freeMemory,
      percentage: totalMemory === 0 ? 0 : Math.round(((totalMemory - freeMemory) / totalMemory) * 100),
    },
    network: interfaces,
    collectedAt: new Date().toISOString(),
  };
}
