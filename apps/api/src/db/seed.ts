/**
 * Database seed script
 * Creates dev user, org, project + realistic performance data
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

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 3600_000);
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
    const rawKey = `ew_${crypto.randomUUID().replace(/-/g, "")}`;
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

  // ── 7. Performance data: Transactions + Spans ──────────────────────
  console.log("  Seeding performance data...");

  const endpoints = [
    { name: "GET /api/v1/products", op: "http.server", avgMs: 45 },
    { name: "GET /api/v1/products/{id}", op: "http.server", avgMs: 32 },
    { name: "POST /api/v1/orders", op: "http.server", avgMs: 180 },
    { name: "GET /api/v1/orders", op: "http.server", avgMs: 95 },
    { name: "POST /api/v1/auth/login", op: "http.server", avgMs: 120 },
    { name: "GET /api/v1/users/me", op: "http.server", avgMs: 25 },
    { name: "POST /api/v1/payments/charge", op: "http.server", avgMs: 350 },
    { name: "GET /api/v1/inventory/check", op: "http.server", avgMs: 60 },
    { name: "POST /api/v1/notifications/send", op: "http.server", avgMs: 200 },
    { name: "GET /api/v1/reports/daily", op: "http.server", avgMs: 500 },
  ];

  const spanTemplates: Record<string, Array<{ op: string; desc: string; pctOfParent: number }>> = {
    "GET /api/v1/products": [
      { op: "db.sql.query", desc: "SELECT * FROM products WHERE active = 1 LIMIT 50", pctOfParent: 0.4 },
      { op: "db.sql.query", desc: "SELECT COUNT(*) FROM products WHERE active = 1", pctOfParent: 0.1 },
      { op: "cache.get", desc: "products:list:page:1", pctOfParent: 0.05 },
      { op: "serialize", desc: "ProductResource::collection", pctOfParent: 0.15 },
    ],
    "POST /api/v1/orders": [
      { op: "db.sql.query", desc: "SELECT * FROM products WHERE id IN (?, ?, ?)", pctOfParent: 0.08 },
      { op: "db.sql.query", desc: "INSERT INTO orders (user_id, total, status) VALUES (?, ?, ?)", pctOfParent: 0.1 },
      { op: "db.sql.query", desc: "INSERT INTO order_items (order_id, product_id, qty, price) VALUES (?, ?, ?, ?)", pctOfParent: 0.06 },
      { op: "db.sql.query", desc: "UPDATE products SET stock = stock - ? WHERE id = ?", pctOfParent: 0.05 },
      { op: "db.sql.query", desc: "UPDATE products SET stock = stock - ? WHERE id = ?", pctOfParent: 0.05 },
      { op: "db.sql.query", desc: "UPDATE products SET stock = stock - ? WHERE id = ?", pctOfParent: 0.05 },
      { op: "db.sql.query", desc: "UPDATE products SET stock = stock - ? WHERE id = ?", pctOfParent: 0.05 },
      { op: "db.sql.query", desc: "UPDATE products SET stock = stock - ? WHERE id = ?", pctOfParent: 0.05 },
      { op: "queue.dispatch", desc: "SendOrderConfirmation", pctOfParent: 0.03 },
      { op: "http.client", desc: "POST https://payments.stripe.com/v1/charges", pctOfParent: 0.25 },
    ],
    "POST /api/v1/payments/charge": [
      { op: "db.sql.query", desc: "SELECT * FROM orders WHERE id = ?", pctOfParent: 0.08 },
      { op: "http.client", desc: "POST https://api.stripe.com/v1/payment_intents", pctOfParent: 0.5 },
      { op: "db.sql.query", desc: "UPDATE orders SET status = 'paid', paid_at = NOW() WHERE id = ?", pctOfParent: 0.1 },
      { op: "queue.dispatch", desc: "ProcessPaymentWebhook", pctOfParent: 0.02 },
    ],
    "GET /api/v1/reports/daily": [
      { op: "db.sql.query", desc: "SELECT DATE(created_at), COUNT(*), SUM(total) FROM orders GROUP BY 1", pctOfParent: 0.35 },
      { op: "db.sql.query", desc: "SELECT DATE(created_at), COUNT(*) FROM users GROUP BY 1", pctOfParent: 0.2 },
      { op: "db.sql.query", desc: "SELECT product_id, SUM(qty) FROM order_items GROUP BY 1 ORDER BY 2 DESC LIMIT 10", pctOfParent: 0.15 },
      { op: "serialize", desc: "DailyReportResource", pctOfParent: 0.1 },
    ],
  };

  const transactionValues: Array<typeof schema.transactions.$inferInsert> = [];
  const spanValues: Array<typeof schema.spans.$inferInsert> = [];

  for (let i = 0; i < 120; i++) {
    const endpoint = endpoints[i % endpoints.length];
    const jitter = randomBetween(-30, 50);
    const duration = Math.max(10, endpoint.avgMs + jitter + randomBetween(-10, endpoint.avgMs * 0.5));
    const startTime = hoursAgo(randomBetween(0, 23));
    const endTime = new Date(startTime.getTime() + duration);
    const isError = Math.random() < 0.08;
    const txnId = id();

    const txnData: Record<string, unknown> = {};

    // Add N+1 data for orders endpoint
    if (endpoint.name === "POST /api/v1/orders") {
      txnData.n_plus_one_queries = [
        {
          query_pattern: "UPDATE products SET stock = stock - ? WHERE id = ?",
          count: 5,
          total_duration: Math.round(duration * 0.25),
        },
      ];
      txnData.query_stats = {
        total_queries: 8,
        unique_queries: 4,
        total_query_time: Math.round(duration * 0.49),
      };
    }

    transactionValues.push({
      id: txnId,
      projectId: finalProjectId,
      name: endpoint.name,
      op: endpoint.op,
      traceId: crypto.randomUUID(),
      status: isError ? "error" : "ok",
      duration,
      startTimestamp: startTime,
      endTimestamp: endTime,
      env: "production",
      data: Object.keys(txnData).length > 0 ? JSON.stringify(txnData) : null,
      createdAt: startTime,
    });

    // Generate spans
    const templates = spanTemplates[endpoint.name];
    if (templates) {
      let offset = randomBetween(1, 5);
      for (const tmpl of templates) {
        const spanDuration = Math.max(1, Math.round(duration * tmpl.pctOfParent * (0.8 + Math.random() * 0.4)));
        const spanStart = new Date(startTime.getTime() + offset);
        const spanEnd = new Date(spanStart.getTime() + spanDuration);

        spanValues.push({
          id: id(),
          transactionId: txnId,
          op: tmpl.op,
          description: tmpl.desc,
          status: isError && Math.random() < 0.3 ? "error" : "ok",
          duration: spanDuration,
          startTimestamp: spanStart,
          endTimestamp: spanEnd,
        });

        offset += spanDuration + randomBetween(1, 3);
      }
    }
  }

  // Batch insert
  for (let i = 0; i < transactionValues.length; i += 50) {
    await db.insert(schema.transactions).values(transactionValues.slice(i, i + 50));
  }
  for (let i = 0; i < spanValues.length; i += 50) {
    await db.insert(schema.spans).values(spanValues.slice(i, i + 50));
  }
  console.log(`  ${transactionValues.length} transactions, ${spanValues.length} spans inserted`);

  // ── 8. Error groups + events ───────────────────────────────────────
  console.log("  Seeding error data...");

  const errors = [
    {
      message: "TypeError: Cannot read properties of undefined (reading 'price')",
      file: "app/Services/OrderService.php",
      line: 142,
      exceptionType: "TypeError",
      level: "error",
    },
    {
      message: "Illuminate\\Database\\QueryException: SQLSTATE[23000]: Integrity constraint violation",
      file: "app/Repositories/ProductRepository.php",
      line: 89,
      exceptionType: "QueryException",
      level: "error",
    },
    {
      message: "App\\Exceptions\\PaymentFailedException: Payment gateway timeout after 30s",
      file: "app/Services/PaymentService.php",
      line: 67,
      exceptionType: "PaymentFailedException",
      level: "fatal",
    },
    {
      message: "RuntimeException: Cache store [redis] is not defined",
      file: "vendor/laravel/framework/src/Illuminate/Cache/CacheManager.php",
      line: 113,
      exceptionType: "RuntimeException",
      level: "error",
    },
    {
      message: "Symfony\\Component\\HttpKernel\\Exception\\NotFoundHttpException: Route not found",
      file: "app/Http/Controllers/Api/V1/ProductController.php",
      line: 45,
      exceptionType: "NotFoundHttpException",
      level: "warning",
    },
  ];

  for (const err of errors) {
    const fingerprint = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    const count = randomBetween(3, 50);
    const firstSeen = hoursAgo(randomBetween(48, 168));
    const lastSeen = hoursAgo(randomBetween(0, 6));

    await db.insert(schema.errorGroups).values({
      fingerprint,
      projectId: finalProjectId,
      message: err.message,
      file: err.file,
      line: err.line,
      level: err.level,
      count,
      firstSeen,
      lastSeen,
      exceptionType: err.exceptionType,
      usersAffected: randomBetween(1, 15),
    });

    // Insert a few events per group
    const eventCount = Math.min(count, 5);
    for (let i = 0; i < eventCount; i++) {
      const createdAt = new Date(
        firstSeen.getTime() + Math.random() * (lastSeen.getTime() - firstSeen.getTime())
      );
      await db.insert(schema.errorEvents).values({
        id: id(),
        fingerprint,
        projectId: finalProjectId,
        stack: `${err.exceptionType}: ${err.message}\n  at ${err.file}:${err.line}\n  at app/Http/Kernel.php:45\n  at vendor/laravel/framework/src/Illuminate/Foundation/Http/Kernel.php:200`,
        url: "/api/v1/" + err.file.split("/").pop()?.replace(".php", "").toLowerCase(),
        env: "production",
        level: err.level,
        exceptionType: err.exceptionType,
        exceptionValue: err.message.split(": ").slice(1).join(": ") || err.message,
        platform: "php",
        createdAt,
        tags: JSON.stringify({ tenant: "acme", environment: "production" }),
        sdk: JSON.stringify({ name: "errorwatch-laravel", version: "2.0.0" }),
        userContext: JSON.stringify({
          id: `user_${randomBetween(1, 100)}`,
          email: `user${randomBetween(1, 100)}@example.com`,
        }),
      });
    }
  }
  console.log(`  ${errors.length} error groups with events inserted`);

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
