import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db } from "../db/connection";
import { accounts, users } from "../db/schema";

type DatabaseExecutor = any;

export async function createCredentialUser(
  input: {
    name: string;
    email: string;
    password: string;
  },
  executor: DatabaseExecutor = db
) {
  const now = new Date();
  const userId = crypto.randomUUID();
  const hashedPassword = await hashPassword(input.password);

  await executor.insert(users).values({
    id: userId,
    name: input.name,
    email: input.email.toLowerCase(),
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });

  await executor.insert(accounts).values({
    id: crypto.randomUUID(),
    userId,
    accountId: userId,
    providerId: "credential",
    password: hashedPassword,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id: userId,
    name: input.name,
    email: input.email.toLowerCase(),
  };
}

export async function setCredentialPassword(
  input: {
    userId: string;
    password: string;
  },
  executor: DatabaseExecutor = db
) {
  const now = new Date();
  const hashedPassword = await hashPassword(input.password);
  const existingAccount = await executor
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, input.userId), eq(accounts.providerId, "credential")))
    .then((rows: { id: string }[]) => rows[0]);

  if (existingAccount) {
    await executor
      .update(accounts)
      .set({
        password: hashedPassword,
        updatedAt: now,
      })
      .where(eq(accounts.id, existingAccount.id));
    return;
  }

  await executor.insert(accounts).values({
    id: crypto.randomUUID(),
    userId: input.userId,
    accountId: input.userId,
    providerId: "credential",
    password: hashedPassword,
    createdAt: now,
    updatedAt: now,
  });
}
