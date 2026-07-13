import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

export const ACTIVITY_ACTIONS = ["created", "updated", "deleted", "imported", "layout_updated"] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const ACTIVITY_ENTITY_TYPES = ["dashboard", "widget", "layout"] as const;
export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number];

export type ActivityInput = {
  userId: string;
  action: ActivityAction;
  entityType: ActivityEntityType;
  message: string;
  dashboardId?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
};

type ActivityClient = Pick<Prisma.TransactionClient, "activityEvent">;

export function recordActivity(input: ActivityInput, client: ActivityClient = db) {
  return client.activityEvent.create({
    data: {
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      message: input.message,
      ...(input.dashboardId ? { dashboardId: input.dashboardId } : {}),
      ...(input.entityId ? { entityId: input.entityId } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    },
  });
}
