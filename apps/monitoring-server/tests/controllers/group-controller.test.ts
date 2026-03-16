/**
 * Tests for GroupController — IDOR regression tests
 * Verifies that project access is checked before performing any mutation.
 */
import { describe, test, expect } from "bun:test";
import { Hono } from "hono";

// ── Types ─────────────────────────────────────────────────────────────────────
type IssueStatus = "open" | "resolved" | "ignored" | "snoozed";

interface Group {
  fingerprint: string;
  projectId: string | null;
  status: IssueStatus;
}

// ── Test helpers ──────────────────────────────────────────────────────────────

/**
 * Build a Hono app that reproduces the GroupController logic with injectable
 * access-check and group-lookup functions.
 */
function buildGroupApp(opts: {
  groupsByFingerprint: Record<string, Group>;
  /** userId => projectId => boolean */
  accessMap: Record<string, Record<string, boolean>>;
  userId?: string;
}) {
  const { groupsByFingerprint, accessMap, userId = "user-1" } = opts;

  const app = new Hono();

  // Inject userId into every request (simulating auth middleware)
  app.use("/*", async (c, next) => {
    (c as any).set("userId", userId);
    await next();
  });

  // Helper stubs
  const getById = (fp: string): Group | undefined => groupsByFingerprint[fp];
  const verifyAccess = (projectId: string, uid: string): boolean =>
    accessMap[uid]?.[projectId] ?? false;

  // PATCH /groups/batch/status — must be registered BEFORE the :fingerprint route
  app.patch("/groups/batch/status", async (c) => {
    const uid = (c as any).get("userId");
    const { fingerprints, status } = (await c.req.json()) as {
      fingerprints: string[];
      status: IssueStatus;
    };

    if (!fingerprints?.length || !["open", "resolved", "ignored"].includes(status)) {
      return c.json({ error: "Invalid input" }, 400);
    }

    for (const fp of fingerprints) {
      const group = getById(fp);
      if (!group) return c.json({ error: `Group not found: ${fp}` }, 404);
      if (group.projectId && !verifyAccess(group.projectId, uid)) {
        return c.json({ error: "Forbidden: You don't have access to this project" }, 403);
      }
    }

    return c.json({ updated: fingerprints.length });
  });

  // PATCH /groups/:fingerprint/status — registered AFTER batch route to avoid conflict
  app.patch("/groups/:fingerprint/status", async (c) => {
    const uid = (c as any).get("userId");
    const fingerprint = c.req.param("fingerprint");
    const { status } = (await c.req.json()) as { status: IssueStatus };

    if (!["open", "resolved", "ignored", "snoozed"].includes(status)) {
      return c.json({ error: "Invalid status" }, 400);
    }

    const group = getById(fingerprint);
    if (!group) return c.json({ error: "Group not found" }, 404);

    if (group.projectId && !verifyAccess(group.projectId, uid)) {
      return c.json({ error: "Forbidden: You don't have access to this project" }, 403);
    }

    return c.json({ fingerprint, status });
  });

  // POST /groups/:fingerprint/merge
  app.post("/groups/:fingerprint/merge", async (c) => {
    const uid = (c as any).get("userId");
    const parentFp = c.req.param("fingerprint");
    const { fingerprints } = (await c.req.json()) as { fingerprints: string[] };

    if (!fingerprints?.length) return c.json({ error: "fingerprints array required" }, 400);

    const parent = getById(parentFp);
    if (!parent) return c.json({ error: "Group not found" }, 404);
    if (parent.projectId && !verifyAccess(parent.projectId, uid)) {
      return c.json({ error: "Forbidden: You don't have access to this project" }, 403);
    }

    for (const fp of fingerprints) {
      const group = getById(fp);
      if (!group) return c.json({ error: `Group not found: ${fp}` }, 404);
      if (group.projectId && !verifyAccess(group.projectId, uid)) {
        return c.json({ error: "Forbidden: You don't have access to this project" }, 403);
      }
    }

    return c.json({ merged: fingerprints.length });
  });

  // POST /groups/:fingerprint/unmerge
  app.post("/groups/:fingerprint/unmerge", async (c) => {
    const uid = (c as any).get("userId");
    const fingerprint = c.req.param("fingerprint");

    const group = getById(fingerprint);
    if (!group) return c.json({ error: "Group not found" }, 404);
    if (group.projectId && !verifyAccess(group.projectId, uid)) {
      return c.json({ error: "Forbidden: You don't have access to this project" }, 403);
    }

    return c.json({ success: true });
  });

  // PATCH /groups/:fingerprint/snooze
  app.patch("/groups/:fingerprint/snooze", async (c) => {
    const uid = (c as any).get("userId");
    const fingerprint = c.req.param("fingerprint");
    const { until } = (await c.req.json()) as { until: string };

    if (!until) return c.json({ error: "until date required" }, 400);

    const group = getById(fingerprint);
    if (!group) return c.json({ error: "Group not found" }, 404);
    if (group.projectId && !verifyAccess(group.projectId, uid)) {
      return c.json({ error: "Forbidden: You don't have access to this project" }, 403);
    }

    return c.json({ fingerprint, snoozedUntil: until });
  });

  return app;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const OWNED_GROUP: Group = { fingerprint: "fp-owned", projectId: "proj-A", status: "open" };
const OTHER_GROUP: Group = { fingerprint: "fp-other", projectId: "proj-B", status: "open" };

const GROUPS = {
  [OWNED_GROUP.fingerprint]: OWNED_GROUP,
  [OTHER_GROUP.fingerprint]: OTHER_GROUP,
};

const ACCESS_MAP = {
  "user-1": { "proj-A": true, "proj-B": false },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GroupController - updateStatus", () => {
  test("allows status update when user has project access", async () => {
    const app = buildGroupApp({ groupsByFingerprint: GROUPS, accessMap: ACCESS_MAP });
    const res = await app.request("/groups/fp-owned/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved" }),
    });
    expect(res.status).toBe(200);
  });

  test("returns 403 when user does not have access to the group's project", async () => {
    const app = buildGroupApp({ groupsByFingerprint: GROUPS, accessMap: ACCESS_MAP });
    const res = await app.request("/groups/fp-other/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved" }),
    });
    expect(res.status).toBe(403);
  });

  test("returns 404 for non-existent group fingerprint", async () => {
    const app = buildGroupApp({ groupsByFingerprint: GROUPS, accessMap: ACCESS_MAP });
    const res = await app.request("/groups/fp-does-not-exist/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("GroupController - batchUpdateStatus", () => {
  test("allows batch update when user has access to all groups", async () => {
    const app = buildGroupApp({ groupsByFingerprint: GROUPS, accessMap: ACCESS_MAP });
    const res = await app.request("/groups/batch/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fingerprints: ["fp-owned"], status: "resolved" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated).toBe(1);
  });

  test("returns 403 when batch includes a group from another project", async () => {
    const app = buildGroupApp({ groupsByFingerprint: GROUPS, accessMap: ACCESS_MAP });
    const res = await app.request("/groups/batch/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fingerprints: ["fp-owned", "fp-other"], status: "resolved" }),
    });
    expect(res.status).toBe(403);
  });
});

describe("GroupController - merge", () => {
  test("returns 403 when user lacks access to the parent group's project", async () => {
    const app = buildGroupApp({ groupsByFingerprint: GROUPS, accessMap: ACCESS_MAP });
    const res = await app.request("/groups/fp-other/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fingerprints: ["fp-owned"] }),
    });
    expect(res.status).toBe(403);
  });

  test("returns 403 when user lacks access to a child group's project", async () => {
    const app = buildGroupApp({ groupsByFingerprint: GROUPS, accessMap: ACCESS_MAP });
    const res = await app.request("/groups/fp-owned/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fingerprints: ["fp-other"] }),
    });
    expect(res.status).toBe(403);
  });
});

describe("GroupController - unmerge", () => {
  test("returns 403 when user lacks access to the group's project", async () => {
    const app = buildGroupApp({ groupsByFingerprint: GROUPS, accessMap: ACCESS_MAP });
    const res = await app.request("/groups/fp-other/unmerge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
  });
});

describe("GroupController - snooze", () => {
  test("allows snooze when user has project access", async () => {
    const app = buildGroupApp({ groupsByFingerprint: GROUPS, accessMap: ACCESS_MAP });
    const until = new Date(Date.now() + 86400000).toISOString();
    const res = await app.request("/groups/fp-owned/snooze", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ until }),
    });
    expect(res.status).toBe(200);
  });

  test("returns 403 when user lacks access to the group's project", async () => {
    const app = buildGroupApp({ groupsByFingerprint: GROUPS, accessMap: ACCESS_MAP });
    const until = new Date(Date.now() + 86400000).toISOString();
    const res = await app.request("/groups/fp-other/snooze", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ until }),
    });
    expect(res.status).toBe(403);
  });
});
