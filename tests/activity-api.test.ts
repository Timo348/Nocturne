import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth")>();
  return { ...original, requireUser: mocks.requireUser };
});

vi.mock("@/lib/db", () => ({
  db: { activityEvent: { findMany: mocks.findMany } },
}));

import { GET } from "@/app/api/activity/route";

describe("activity API", () => {
  beforeEach(() => {
    mocks.findMany.mockReset();
    mocks.requireUser.mockReset();
    mocks.requireUser.mockResolvedValue({ id: "user-1", email: "one@example.test", name: "One", role: "ADMIN" });
  });

  it("queries only the signed-in user's events and serializes the public shape", async () => {
    mocks.findMany.mockResolvedValue([{
      id: "event-1",
      action: "created",
      entityType: "dashboard",
      entityId: "dashboard-1",
      dashboardId: "dashboard-1",
      message: "Dashboard erstellt.",
      metadata: { name: "Home" },
      createdAt: new Date("2026-07-12T12:00:00.000Z"),
    }]);

    const response = await GET(new Request("http://localhost/api/activity?limit=7"));

    expect(response.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-1" }, take: 7 }));
    await expect(response.json()).resolves.toEqual({ events: [{
      id: "event-1",
      action: "created",
      entityType: "dashboard",
      entityId: "dashboard-1",
      dashboardId: "dashboard-1",
      message: "Dashboard erstellt.",
      metadata: { name: "Home" },
      createdAt: "2026-07-12T12:00:00.000Z",
    }] });
  });

  it("rejects limits outside the bounded query", async () => {
    const response = await GET(new Request("http://localhost/api/activity?limit=101"));

    expect(response.status).toBe(400);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
