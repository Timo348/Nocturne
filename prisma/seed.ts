import { hash } from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@home.local").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "change-me-now";
  if (process.env.NODE_ENV === "production" && (!process.env.ADMIN_PASSWORD || password.length < 12)) {
    throw new Error("ADMIN_PASSWORD with at least 12 characters is required in production");
  }
  const name = process.env.ADMIN_NAME ?? "Timo";
  const passwordHash = await hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { name, role: Role.ADMIN },
    create: { email, name, passwordHash, role: Role.ADMIN },
  });

  const existing = await prisma.dashboard.findFirst({ where: { ownerId: user.id } });
  if (existing) return;

  await prisma.dashboard.create({
    data: {
      ownerId: user.id,
      name: "Home operations",
      slug: "home-operations",
      description: "Dein Homelab auf einen Blick",
      environment: "Primary network",
      isDefault: true,
      widgets: {
        create: [
          {
            type: "infrastructure",
            title: "System health",
            config: { collectorUrl: "", collectorToken: "", showNetwork: true },
            layout: {
              desktop: { x: 0, y: 0, w: 5, h: 4 },
              tablet: { x: 0, y: 0, w: 4, h: 4 },
              mobile: { x: 0, y: 0, w: 1, h: 4 }
            },
          },
          {
            type: "weather",
            title: "Weather",
            config: { label: "Berlin", latitude: 52.52, longitude: 13.405, temperatureUnit: "celsius" },
            layout: {
              desktop: { x: 5, y: 0, w: 3, h: 4 },
              tablet: { x: 4, y: 0, w: 4, h: 4 },
              mobile: { x: 0, y: 4, w: 1, h: 4 }
            },
          },
          {
            type: "links",
            title: "Quick access",
            config: {
              links: [
                { label: "Router", url: "https://router.home", icon: "router" },
                { label: "Storage", url: "https://nas.home", icon: "database" },
                { label: "Gitea", url: "https://gitea.home", icon: "git" },
                { label: "Media", url: "https://media.home", icon: "play" }
              ]
            },
            layout: {
              desktop: { x: 8, y: 0, w: 4, h: 4 },
              tablet: { x: 0, y: 4, w: 8, h: 3 },
              mobile: { x: 0, y: 8, w: 1, h: 4 }
            },
          },
        ],
      },
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
