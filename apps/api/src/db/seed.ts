/**
 * Database seed script
 * Creates dev user, org, project + API key. No fake telemetry.
 * Populate the dashboard via `make example-symfony-trigger-all`.
 *
 * Usage: bun run seed (from apps/api/)
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://errorwatch:errorwatch_dev_password@localhost:5432/errorwatch";

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client, { schema });

function id(): string {
  return crypto.randomUUID();
}

async function seed() {
  console.log("Seeding database...");

  const now = new Date();

  // ── 1. Instance settings (must exist before sign-up) ────────────────
  const tempUserId = id(); // placeholder, updated after user creation
  const existingSettings = await db
    .select()
    .from(schema.instanceSettings)
    .limit(1);
  if (existingSettings.length === 0) {
    await db.insert(schema.instanceSettings).values({
      id: id(),
      initialized: true,
      initializedAt: now,
      initializedByUserId: null,
      createdAt: now,
      updatedAt: now,
    });
    console.log("  Instance settings created");
  }

  // ── 2. User (direct DB insert with better-auth hash) ────────────────
  let userId: string;
  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(sql`${schema.users.email} = 'dev@test.com'`)
    .limit(1);

  if (existing.length > 0) {
    userId = existing[0].id;
    console.log("  User already exists:", userId);
  } else {
    userId = id();
    const hashedPassword = await hashPassword("password123");

    await db.insert(schema.users).values({
      id: userId,
      email: "dev@test.com",
      name: "Dev User",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });

    // BetterAuth stores credentials in the account table
    await db.insert(schema.accounts).values({
      id: id(),
      userId,
      accountId: userId,
      providerId: "credential",
      password: hashedPassword,
      createdAt: now,
      updatedAt: now,
    });

    console.log("  User created:", userId);
  }

  // ── 3. Organization ────────────────────────────────────────────────
  const orgId = id();
  const existingOrg = await db
    .select()
    .from(schema.organizations)
    .where(sql`${schema.organizations.slug} = 'tilvest'`)
    .limit(1);

  let finalOrgId: string;
  if (existingOrg.length === 0) {
    await db.insert(schema.organizations).values({
      id: orgId,
      name: "Tilvest",
      slug: "tilvest",
      createdAt: now,
    });
    finalOrgId = orgId;
    console.log("  Organization created: tilvest");
  } else {
    finalOrgId = existingOrg[0].id;
    console.log("  Organization already exists: tilvest");
  }

  // ── 4. Organization member ─────────────────────────────────────────
  const existingMember = await db
    .select()
    .from(schema.organizationMembers)
    .where(
      sql`${schema.organizationMembers.organizationId} = ${finalOrgId} AND ${schema.organizationMembers.userId} = ${userId}`
    )
    .limit(1);
  if (existingMember.length === 0) {
    await db.insert(schema.organizationMembers).values({
      id: id(),
      organizationId: finalOrgId,
      userId,
      role: "owner",
      createdAt: now,
    });
    console.log("  Member added as owner");
  }

  // ── 5. Project ─────────────────────────────────────────────────────
  const projectId = id();
  const existingProject = await db
    .select()
    .from(schema.projects)
    .where(sql`${schema.projects.slug} = 'distrib-app'`)
    .limit(1);

  let finalProjectId: string;
  if (existingProject.length === 0) {
    await db.insert(schema.projects).values({
      id: projectId,
      organizationId: finalOrgId,
      name: "Distrib App",
      slug: "distrib-app",
      platform: "laravel",
      createdAt: now,
    });
    finalProjectId = projectId;
    console.log("  Project created: distrib-app (laravel)");
  } else {
    finalProjectId = existingProject[0].id;
    console.log("  Project already exists: distrib-app");
  }

  // ── 6. API Key ─────────────────────────────────────────────────────
  const existingKey = await db
    .select()
    .from(schema.apiKeys)
    .where(sql`${schema.apiKeys.projectId} = ${finalProjectId}`)
    .limit(1);
  if (existingKey.length === 0) {
    const rawKey = `ew_live_${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "").slice(0, 4)}`;
    await db.insert(schema.apiKeys).values({
      id: id(),
      projectId: finalProjectId,
      key: rawKey, // In dev, store plaintext for easy testing
      keyPrefix: rawKey.slice(0, 8),
      keyLast4: rawKey.slice(-4),
      name: "Default Dev Key",
      createdAt: now,
    });
    console.log(`  API Key created: ${rawKey}`);
  }


  // ── Done ───────────────────────────────────────────────────────────
  console.log("\nSeed complete!");
  console.log("  Login: dev@test.com / password123");
  console.log("  Org: tilvest / Project: distrib-app");

  await client.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
