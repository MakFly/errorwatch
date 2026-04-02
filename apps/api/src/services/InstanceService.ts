import { sql } from "drizzle-orm";
import { db } from "../db/connection";
import { UserRepository } from "../repositories/UserRepository";
import { InstanceRepository } from "../repositories/InstanceRepository";
import { OrganizationRepository } from "../repositories/OrganizationRepository";
import { createCredentialUser } from "./auth-users";

const SELF_HOSTED = process.env.SELF_HOSTED === "true";
const INSTANCE_BOOTSTRAP_LOCK_ID = 42861001;

async function backfillLegacyInitialization(executor: any = db) {
  const settings = await InstanceRepository.findSettings(executor);
  if (settings) {
    return settings;
  }

  const hasOrganizations = await OrganizationRepository.hasAnyOrganization(executor);
  if (!hasOrganizations) {
    return null;
  }

  const now = new Date();
  await InstanceRepository.createSettings(
    {
      initialized: true,
      initializedAt: now,
      initializedByUserId: null,
      createdAt: now,
      updatedAt: now,
    },
    executor
  );

  return InstanceRepository.findSettings(executor);
}

export const InstanceService = {
  getStatus: async () => {
    if (!SELF_HOSTED) {
      return {
        selfHosted: false,
        initialized: true,
        allowSetup: false,
        allowPublicSignup: true,
      };
    }

    const settings = await backfillLegacyInitialization();
    const initialized = settings?.initialized ?? false;

    return {
      selfHosted: true,
      initialized,
      allowSetup: !initialized,
      allowPublicSignup: false,
    };
  },

  bootstrap: async (input: { name: string; email: string; password: string }) => {
    if (!SELF_HOSTED) {
      throw new Error("Bootstrap is only available in self-hosted mode");
    }

    const normalizedEmail = input.email.trim().toLowerCase();
    const normalizedName = input.name.trim() || normalizedEmail.split("@")[0];

    return db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${INSTANCE_BOOTSTRAP_LOCK_ID})`);

      const settings = await backfillLegacyInitialization(tx);
      if (settings?.initialized) {
        throw new Error("Instance already initialized");
      }

      const existingUser = await UserRepository.findByEmail(normalizedEmail);
      if (existingUser) {
        throw new Error("User already exists");
      }

      const user = await createCredentialUser(
        {
          name: normalizedName,
          email: normalizedEmail,
          password: input.password,
        },
        tx
      );

      const now = new Date();
      if (settings) {
        await InstanceRepository.markInitialized(
          {
            initializedAt: now,
            initializedByUserId: user.id,
            updatedAt: now,
          },
          tx
        );
      } else {
        await InstanceRepository.createSettings(
          {
            initialized: true,
            initializedAt: now,
            initializedByUserId: user.id,
            createdAt: now,
            updatedAt: now,
          },
          tx
        );
      }

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      };
    });
  },
};
