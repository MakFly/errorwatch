import { pgTable, text, integer, boolean, timestamp, unique, index, uniqueIndex, jsonb, real } from "drizzle-orm/pg-core";

// ============================================
// Error Tracking Tables
// ============================================

export const errorGroups = pgTable("error_groups", {
  fingerprint: text("fingerprint").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  file: text("file").notNull(),
  line: integer("line").notNull(),
  url: text("url"),
  statusCode: integer("status_code"),
  level: text("level").notNull().default("error"), // fatal, error, warning, info, debug
  count: integer("count").notNull().default(1),
  firstSeen: timestamp("first_seen", { withTimezone: true }).notNull(),
  lastSeen: timestamp("last_seen", { withTimezone: true }).notNull(),
  // Issue lifecycle
  status: text("status").notNull().default("open"), // open, resolved, ignored
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedBy: text("resolved_by"),
  // Assignment
  assignedTo: text("assigned_to"),
  assignedAt: timestamp("assigned_at", { withTimezone: true }),
  // Merge support
  mergedInto: text("merged_into"),
  // User impact
  usersAffected: integer("users_affected").notNull().default(0),
  // Snooze support
  snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
  snoozedBy: text("snoozed_by"),
}, (table) => ({
  projectLastSeenIdx: index("idx_error_groups_project_last_seen").on(table.projectId, table.lastSeen),
  statusIdx: index("idx_error_groups_status").on(table.status),
  mergedIntoIdx: index("idx_error_groups_merged_into").on(table.mergedInto),
  // Composite indexes for list queries (status + level + lastSeen)
  projectStatusLevelIdx: index("idx_error_groups_project_status_level").on(table.projectId, table.status, table.level, table.lastSeen),
  // Index for searching by message/file (partial for performance)
  messageIdx: index("idx_error_groups_message").on(table.message),
}));

export const errorEvents = pgTable("error_events", {
  id: text("id").primaryKey(),
  fingerprint: text("fingerprint")
    .notNull()
    .references(() => errorGroups.fingerprint, {
      onDelete: "cascade",
    }),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" }),
  stack: text("stack").notNull(),
  url: text("url"),
  env: text("env").notNull(),
  statusCode: integer("status_code"),
  level: text("level").notNull().default("error"), // fatal, error, warning, info, debug
  // Breadcrumbs: JSON array of user actions trail
  // Format: [{ timestamp, category, type, level, message, data }, ...]
  breadcrumbs: jsonb("breadcrumbs"),
  // Session ID for session replay linking
  sessionId: text("session_id"),
  // User context
  userId: text("user_id"),
  // Release tracking
  release: text("release"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
}, (table) => ({
  // Performance indexes for common queries
  projectCreatedIdx: index("idx_error_events_project_created").on(table.projectId, table.createdAt),
  userIdx: index("idx_error_events_user").on(table.userId),
  fingerprintIdx: index("idx_error_events_fingerprint").on(table.fingerprint),
  envIdx: index("idx_error_events_env").on(table.env),
  sessionIdx: index("idx_error_events_session").on(table.sessionId),
  releaseIdx: index("idx_error_events_release").on(table.release),
  // Composite indexes for complex queries
  projectFingerprintIdx: index("idx_error_events_project_fingerprint").on(table.projectId, table.fingerprint),
  projectEnvIdx: index("idx_error_events_project_env").on(table.projectId, table.env),
  // Dedup: prevent exact duplicate events (same fingerprint + project + timestamp)
  dedupIdx: uniqueIndex("idx_error_events_dedup").on(table.fingerprint, table.projectId, table.createdAt),
}));

// ============================================
// Application Logs (Live Terminal)
// ============================================

export const applicationLogs = pgTable("application_logs", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  level: text("level").notNull(), // debug, info, warning, error
  channel: text("channel").notNull(),
  message: text("message").notNull(),
  context: jsonb("context"),
  extra: jsonb("extra"),
  env: text("env"),
  release: text("release"),
  source: text("source").notNull().default("app"), // http, cli, messenger, deprecation, app
  url: text("url"),
  requestId: text("request_id"),
  userId: text("user_id"),
  ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  projectCreatedIdx: index("idx_application_logs_project_created").on(table.projectId, table.createdAt),
  projectLevelCreatedIdx: index("idx_application_logs_project_level_created").on(table.projectId, table.level, table.createdAt),
  projectChannelCreatedIdx: index("idx_application_logs_project_channel_created").on(table.projectId, table.channel, table.createdAt),
}));

// ============================================
// Authentication Tables (BetterAuth managed)
// ============================================

export const users = pgTable("user", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  emailVerified: boolean("email_verified"),
  image: text("image"),
  password: text("password"), // For direct invite - stores hashed password
  plan: text("plan").notNull().default("free"), // "free" | "pro" | "team" | "enterprise"
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  stripeStatus: text("stripe_status"),
  stripeCurrentPeriodEnd: timestamp("stripe_current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const sessions = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const accounts = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const verifications = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

// ============================================
// Multi-Tenant Tables
// ============================================

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const organizationMembers = pgTable("organization_members", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
}, (table) => ({
  orgMemberUniqueIdx: uniqueIndex("org_member_unique").on(table.organizationId, table.userId),
}));

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  environment: text("environment"),
  platform: text("platform").notNull().default("nodejs"), // symfony, laravel, vuejs, react, nextjs, nuxtjs, nodejs, hono, fastify
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const invitations = pgTable("invitations", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull().default("member"),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

// ============================================
// API & Configuration Tables
// ============================================

export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  // Stores hashed key (bcrypt)
  key: text("key").notNull().unique(),
  keyPrefix: text("key_prefix"),
  keyLast4: text("key_last4"),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

// Alert rules for notifications
export const alertRules = pgTable("alert_rules", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'threshold', 'new_error', 'regression'
  threshold: integer("threshold"), // events count for threshold type
  windowMinutes: integer("window_minutes"), // time window for threshold
  channel: text("channel").notNull(), // 'email', 'slack', 'webhook'
  config: jsonb("config"), // { email, webhookUrl, slackWebhook }
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

// Notification history
export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  ruleId: text("rule_id").references(() => alertRules.id, { onDelete: "set null" }),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  fingerprint: text("fingerprint"), // related error group if applicable
  channel: text("channel").notNull(),
  status: text("status").notNull(), // 'sent', 'failed', 'pending'
  error: text("error"), // error message if failed
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

// Releases for tracking deploys
export const releases = pgTable("releases", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  version: text("version").notNull(),
  environment: text("environment").notNull().default("production"),
  url: text("url"),
  commitSha: text("commit_sha"),
  commitMessage: text("commit_message"),
  commitAuthor: text("commit_author"),
  deployedBy: text("deployed_by"),
  deployedAt: timestamp("deployed_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
}, (table) => ({
  projectVersionIdx: index("idx_releases_project_version").on(table.projectId, table.version),
  projectEnvIdx: index("idx_releases_project_env").on(table.projectId, table.environment),
}));

// Sourcemaps for stack trace deobfuscation
export const sourcemaps = pgTable("sourcemaps", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  releaseId: text("release_id").references(() => releases.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  // Now stored on filesystem, this stores the path
  storagePath: text("storage_path").notNull(),
  fileHash: text("file_hash"),
  size: integer("size"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
}, (table) => ({
  projectReleaseIdx: index("idx_sourcemaps_project_release").on(table.projectId, table.releaseId),
  filenameIdx: index("idx_sourcemaps_filename").on(table.filename),
}));

// Project settings for retention and configuration
export const projectSettings = pgTable("project_settings", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .unique()
    .references(() => projects.id, { onDelete: "cascade" }),
  timezone: text("timezone").notNull().default("UTC"),
  retentionDays: integer("retention_days").notNull().default(30),
  autoResolve: boolean("auto_resolve").notNull().default(true),
  autoResolveDays: integer("auto_resolve_days").notNull().default(14),
  // Sample rate (0.0 to 1.0, 1.0 = 100%)
  sampleRate: real("sample_rate").notNull().default(1.0),
  // Event ingestion toggle - when false, API returns 403 for all events
  eventsEnabled: boolean("events_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

// ============================================
// Performance Monitoring Tables
// ============================================

// Performance metrics (Web Vitals, custom metrics)
export const performanceMetrics = pgTable("performance_metrics", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'web_vitals', 'page_load', 'custom'
  name: text("name").notNull(), // 'LCP', 'FID', 'CLS', 'TTFB', 'INP', etc.
  value: integer("value").notNull(), // stored as integer (milliseconds or score * 1000)
  unit: text("unit"), // 'ms', 'score', 'bytes'
  url: text("url"),
  env: text("env").notNull(),
  tags: jsonb("tags"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  sessionId: text("session_id"),
  userId: text("user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
}, (table) => ({
  projectTypeIdx: index("idx_perf_project_type").on(table.projectId, table.type, table.timestamp),
  nameIdx: index("idx_perf_name").on(table.name, table.timestamp),
}));

// Transactions (distributed tracing)
export const transactions = pgTable("transactions", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // 'HTTP GET /api/users', 'DB Query users'
  op: text("op").notNull(), // 'http.server', 'db', 'http.client', 'ui.render'
  traceId: text("trace_id"),
  parentSpanId: text("parent_span_id"),
  status: text("status"), // 'ok', 'error', 'cancelled'
  duration: integer("duration").notNull(), // ms
  startTimestamp: timestamp("start_timestamp", { withTimezone: true }).notNull(),
  endTimestamp: timestamp("end_timestamp", { withTimezone: true }).notNull(),
  tags: jsonb("tags"),
  data: jsonb("data"),
  env: text("env").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
}, (table) => ({
  projectOpIdx: index("idx_trans_project_op").on(table.projectId, table.op, table.startTimestamp),
  traceIdx: index("idx_trans_trace").on(table.traceId),
}));

// Spans (sub-units of transactions)
export const spans = pgTable("spans", {
  id: text("id").primaryKey(),
  transactionId: text("transaction_id")
    .notNull()
    .references(() => transactions.id, { onDelete: "cascade" }),
  parentSpanId: text("parent_span_id"),
  op: text("op").notNull(),
  description: text("description"),
  status: text("status"),
  duration: integer("duration").notNull(), // ms
  startTimestamp: timestamp("start_timestamp", { withTimezone: true }).notNull(),
  endTimestamp: timestamp("end_timestamp", { withTimezone: true }).notNull(),
  data: jsonb("data"),
}, (table) => ({
  transactionIdx: index("idx_spans_transaction").on(table.transactionId),
}));

// ============================================
// Session Replay Tables
// ============================================

// User sessions for replay
export const replaySessions = pgTable("replay_sessions", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: text("user_id"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  duration: integer("duration"), // ms
  url: text("url"),
  userAgent: text("user_agent"),
  deviceType: text("device_type"), // 'desktop', 'mobile', 'tablet'
  browser: text("browser"),
  os: text("os"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
}, (table) => ({
  projectStartedIdx: index("idx_sessions_project").on(table.projectId, table.startedAt),
  userIdx: index("idx_sessions_user").on(table.userId),
}));

// Session events (rrweb recordings)
// Each error gets its own snapshot of events (Sentry-like architecture)
export const sessionEvents = pgTable("session_events", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => replaySessions.id, { onDelete: "cascade" }),
  errorEventId: text("error_event_id")
    .references(() => errorEvents.id, { onDelete: "set null" }), // Link to specific error
  type: integer("type").notNull(), // rrweb event type
  data: text("data").notNull(), // Compressed JSON (gzip base64)
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
}, (table) => ({
  sessionTimestampIdx: index("idx_session_events_session").on(table.sessionId, table.timestamp),
  errorEventIdx: index("idx_session_events_error").on(table.errorEventId),
  // Dedup: prevent duplicate session events (same session + type + timestamp)
  sessionDedupIdx: uniqueIndex("idx_session_events_dedup").on(table.sessionId, table.type, table.timestamp),
}));

// ============================================
// Custom Fingerprint Rules
// ============================================

export const fingerprintRules = pgTable("fingerprint_rules", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  pattern: text("pattern").notNull(),     // regex pattern to match on error message
  groupKey: text("group_key").notNull(),   // custom fingerprint key when pattern matches
  description: text("description"),
  priority: integer("priority").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
}, (table) => ({
  projectPriorityIdx: index("idx_fingerprint_rules_project").on(table.projectId, table.priority),
}));

// ============================================
// Performance Aggregation Tables
// ============================================

// Hourly aggregates of performance metrics (Web Vitals, custom)
export const performanceMetricsHourly = pgTable("performance_metrics_hourly", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  name: text("name").notNull(),
  env: text("env").notNull(),
  hourBucket: timestamp("hour_bucket", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(0),
  sum: real("sum").notNull().default(0),
  avg: real("avg").notNull().default(0),
  min: real("min").notNull().default(0),
  max: real("max").notNull().default(0),
  p50: real("p50").notNull().default(0),
  p75: real("p75").notNull().default(0),
  p90: real("p90").notNull().default(0),
  p95: real("p95").notNull().default(0),
  p99: real("p99").notNull().default(0),
}, (table) => ({
  projectTypeHourIdx: index("idx_perf_hourly_project_type").on(table.projectId, table.type, table.hourBucket),
  uniqueBucket: uniqueIndex("idx_perf_hourly_unique").on(table.projectId, table.type, table.name, table.env, table.hourBucket),
}));

// Daily aggregates of performance metrics
export const performanceMetricsDaily = pgTable("performance_metrics_daily", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  name: text("name").notNull(),
  env: text("env").notNull(),
  dayBucket: timestamp("day_bucket", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(0),
  sum: real("sum").notNull().default(0),
  avg: real("avg").notNull().default(0),
  min: real("min").notNull().default(0),
  max: real("max").notNull().default(0),
  p50: real("p50").notNull().default(0),
  p75: real("p75").notNull().default(0),
  p90: real("p90").notNull().default(0),
  p95: real("p95").notNull().default(0),
  p99: real("p99").notNull().default(0),
}, (table) => ({
  projectTypeDayIdx: index("idx_perf_daily_project_type").on(table.projectId, table.type, table.dayBucket),
  uniqueBucket: uniqueIndex("idx_perf_daily_unique").on(table.projectId, table.type, table.name, table.env, table.dayBucket),
}));

// Hourly aggregates of transactions
export const transactionAggregatesHourly = pgTable("transaction_aggregates_hourly", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  op: text("op").notNull(),
  env: text("env").notNull(),
  hourBucket: timestamp("hour_bucket", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  durationSum: real("duration_sum").notNull().default(0),
  durationAvg: real("duration_avg").notNull().default(0),
  durationMin: real("duration_min").notNull().default(0),
  durationMax: real("duration_max").notNull().default(0),
  durationP50: real("duration_p50").notNull().default(0),
  durationP75: real("duration_p75").notNull().default(0),
  durationP90: real("duration_p90").notNull().default(0),
  durationP95: real("duration_p95").notNull().default(0),
  durationP99: real("duration_p99").notNull().default(0),
  // Pre-computed Apdex buckets
  apdexSatisfied: integer("apdex_satisfied").notNull().default(0),
  apdexTolerating: integer("apdex_tolerating").notNull().default(0),
  apdexFrustrated: integer("apdex_frustrated").notNull().default(0),
}, (table) => ({
  projectOpHourIdx: index("idx_trans_hourly_project_op").on(table.projectId, table.op, table.hourBucket),
  uniqueBucket: uniqueIndex("idx_trans_hourly_unique").on(table.projectId, table.name, table.op, table.env, table.hourBucket),
}));

// Daily aggregates of transactions
export const transactionAggregatesDaily = pgTable("transaction_aggregates_daily", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  op: text("op").notNull(),
  env: text("env").notNull(),
  dayBucket: timestamp("day_bucket", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  durationSum: real("duration_sum").notNull().default(0),
  durationAvg: real("duration_avg").notNull().default(0),
  durationMin: real("duration_min").notNull().default(0),
  durationMax: real("duration_max").notNull().default(0),
  durationP50: real("duration_p50").notNull().default(0),
  durationP75: real("duration_p75").notNull().default(0),
  durationP90: real("duration_p90").notNull().default(0),
  durationP95: real("duration_p95").notNull().default(0),
  durationP99: real("duration_p99").notNull().default(0),
  // Pre-computed Apdex buckets
  apdexSatisfied: integer("apdex_satisfied").notNull().default(0),
  apdexTolerating: integer("apdex_tolerating").notNull().default(0),
  apdexFrustrated: integer("apdex_frustrated").notNull().default(0),
}, (table) => ({
  projectOpDayIdx: index("idx_trans_daily_project_op").on(table.projectId, table.op, table.dayBucket),
  uniqueBucket: uniqueIndex("idx_trans_daily_unique").on(table.projectId, table.name, table.op, table.env, table.dayBucket),
}));

// ============================================
// System Metrics Tables
// ============================================

export const systemMetrics = pgTable("system_metrics", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  hostId: text("host_id").notNull(),
  hostname: text("hostname").notNull(),
  os: text("os").notNull(),
  osVersion: text("os_version"),
  architecture: text("architecture"),
  cpu: jsonb("cpu").notNull(),
  memory: jsonb("memory").notNull(),
  disks: jsonb("disks"),
  networks: jsonb("networks"),
  tags: jsonb("tags"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
}, (table) => ({
  projectHostTimestampIdx: index("idx_system_metrics_project_host_timestamp").on(table.projectId, table.hostId, table.timestamp),
  hostTimestampIdx: index("idx_system_metrics_host_timestamp").on(table.hostId, table.timestamp),
  projectTimestampIdx: index("idx_system_metrics_project_timestamp").on(table.projectId, table.timestamp),
}));
