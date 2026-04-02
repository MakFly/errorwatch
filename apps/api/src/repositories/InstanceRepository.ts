import { eq } from "drizzle-orm";
import { db } from "../db/connection";
import { instanceSettings } from "../db/schema";

export const INSTANCE_SETTINGS_ID = "default";

export const InstanceRepository = {
  findSettings: (executor: any = db) =>
    executor
      .select()
      .from(instanceSettings)
      .where(eq(instanceSettings.id, INSTANCE_SETTINGS_ID))
      .then((rows: any[]) => rows[0]),

  createSettings: (
    data: {
      initialized: boolean;
      initializedAt: Date | null;
      initializedByUserId: string | null;
      createdAt: Date;
      updatedAt: Date;
    },
    executor: any = db
  ) =>
    executor.insert(instanceSettings).values({
      id: INSTANCE_SETTINGS_ID,
      initialized: data.initialized,
      initializedAt: data.initializedAt,
      initializedByUserId: data.initializedByUserId,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }),

  markInitialized: (
    data: {
      initializedAt: Date;
      initializedByUserId: string;
      updatedAt: Date;
    },
    executor: any = db
  ) =>
    executor
      .update(instanceSettings)
      .set({
        initialized: true,
        initializedAt: data.initializedAt,
        initializedByUserId: data.initializedByUserId,
        updatedAt: data.updatedAt,
      })
      .where(eq(instanceSettings.id, INSTANCE_SETTINGS_ID)),
};
