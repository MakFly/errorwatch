import type { AuthContext } from "../../types/context";
import { GroupService } from "../../services/GroupService";
import type { IssueStatus } from "../../types/services";
import { verifyProjectAccess } from "../../services/project-access";
import { GroupRepository } from "../../repositories/GroupRepository";
import logger from "../../logger";

export const getAll = async (c: AuthContext) => {
  const userId = c.get("userId");
  const env = c.req.query("env");
  const dateRange = c.req.query("dateRange") as "24h" | "7d" | "30d" | "90d" | "all" | undefined;
  const projectId = c.req.query("projectId") as string | undefined;
  const search = c.req.query("search");
  const status = c.req.query("status") as "open" | "resolved" | "ignored" | undefined;
  const level = c.req.query("level") as "fatal" | "error" | "warning" | "info" | "debug" | undefined;
  const sort = c.req.query("sort") as "lastSeen" | "firstSeen" | "count" | undefined || "lastSeen";
  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);

  if (projectId) {
    const hasAccess = await verifyProjectAccess(projectId, userId);
    if (!hasAccess) {
      logger.warn("User attempted to access groups without project permission", { userId, projectId });
      return c.json({ error: "Forbidden: You don't have access to this project" }, 403);
    }
  }

  logger.debug("GET /api/v1/groups", { env, dateRange, projectId, search, status, level, sort, page, limit });
  const result = await GroupService.getAll({ env, dateRange, search, status, level, sort, page, limit }, projectId);
  return c.json(result);
};

export const getById = async (c: AuthContext) => {
  const userId = c.get("userId");
  const fingerprint = c.req.param("fingerprint");

  logger.debug("GET /api/v1/groups/:fingerprint", { fingerprint });
  const group = await GroupService.getById(fingerprint);

  if (!group) {
    logger.warn("Group not found", { fingerprint });
    return c.json({ error: "Group not found" }, 404);
  }

  if (group.projectId) {
    const hasAccess = await verifyProjectAccess(group.projectId, userId);
    if (!hasAccess) {
      logger.warn("User attempted to access group without project permission", {
        userId,
        fingerprint,
        projectId: group.projectId,
      });
      return c.json({ error: "Forbidden: You don't have access to this project" }, 403);
    }
  }

  return c.json(group);
};

export const getEvents = async (c: AuthContext) => {
  const userId = c.get("userId");
  const fingerprint = c.req.param("fingerprint");
  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = parseInt(c.req.query("limit") || "10", 10);

  const group = await GroupService.getById(fingerprint);
  if (!group) {
    return c.json({ error: "Group not found" }, 404);
  }

  if (group.projectId) {
    const hasAccess = await verifyProjectAccess(group.projectId, userId);
    if (!hasAccess) {
      logger.warn("User attempted to access group events without project permission", {
        userId,
        fingerprint,
        projectId: group.projectId,
      });
      return c.json({ error: "Forbidden: You don't have access to this project" }, 403);
    }
  }

  logger.debug("GET /api/v1/groups/:fingerprint/events", { fingerprint, page, limit });
  const result = await GroupService.getEvents(fingerprint, page, limit);
  return c.json(result);
};

export const getTimeline = async (c: AuthContext) => {
  const userId = c.get("userId");
  const fingerprint = c.req.param("fingerprint");

  const group = await GroupService.getById(fingerprint);
  if (!group) {
    return c.json({ error: "Group not found" }, 404);
  }

  if (group.projectId) {
    const hasAccess = await verifyProjectAccess(group.projectId, userId);
    if (!hasAccess) {
      logger.warn("User attempted to access group timeline without project permission", {
        userId,
        fingerprint,
        projectId: group.projectId,
      });
      return c.json({ error: "Forbidden: You don't have access to this project" }, 403);
    }
  }

  logger.debug("GET /api/v1/groups/:fingerprint/timeline", { fingerprint });
  const timeline = await GroupService.getTimeline(fingerprint);
  return c.json(timeline);
};

export const updateStatus = async (c: AuthContext) => {
  const userId = c.get("userId");
  const fingerprint = c.req.param("fingerprint");
  const { status } = await c.req.json() as { status: IssueStatus };

  logger.info("PATCH /api/v1/groups/:fingerprint/status", { fingerprint, status, userId });

  if (!["open", "resolved", "ignored", "snoozed"].includes(status)) {
    return c.json({ error: "Invalid status. Must be: open, resolved, ignored, or snoozed" }, 400);
  }

  const group = await GroupService.getById(fingerprint);
  if (!group) {
    return c.json({ error: "Group not found" }, 404);
  }

  if (group.projectId) {
    const hasAccess = await verifyProjectAccess(group.projectId, userId);
    if (!hasAccess) {
      logger.warn("User attempted to update group status without project permission", {
        userId,
        fingerprint,
        projectId: group.projectId,
      });
      return c.json({ error: "Forbidden: You don't have access to this project" }, 403);
    }
  }

  const result = await GroupService.updateStatus(fingerprint, status, userId);
  if (!result) {
    return c.json({ error: "Group not found" }, 404);
  }

  return c.json(result);
};

export const updateAssignment = async (c: AuthContext) => {
  const userId = c.get("userId");
  const fingerprint = c.req.param("fingerprint");
  const { assignedTo } = await c.req.json() as { assignedTo: string | null };

  logger.info("PATCH /api/v1/groups/:fingerprint/assign", { fingerprint, assignedTo, userId });

  const group = await GroupService.getById(fingerprint);
  if (!group) {
    return c.json({ error: "Group not found" }, 404);
  }

  if (group.projectId) {
    const hasAccess = await verifyProjectAccess(group.projectId, userId);
    if (!hasAccess) {
      logger.warn("User attempted to assign group without project permission", {
        userId,
        fingerprint,
        projectId: group.projectId,
      });
      return c.json({ error: "Forbidden: You don't have access to this project" }, 403);
    }
  }

  const result = await GroupService.updateAssignment(fingerprint, assignedTo);
  if (!result) {
    return c.json({ error: "Group not found" }, 404);
  }

  return c.json(result);
};

export const getReleases = async (c: AuthContext) => {
  const userId = c.get("userId");
  const fingerprint = c.req.param("fingerprint");

  const group = await GroupService.getById(fingerprint);
  if (!group) {
    return c.json({ error: "Group not found" }, 404);
  }

  if (group.projectId) {
    const hasAccess = await verifyProjectAccess(group.projectId, userId);
    if (!hasAccess) {
      logger.warn("User attempted to access group releases without project permission", {
        userId,
        fingerprint,
        projectId: group.projectId,
      });
      return c.json({ error: "Forbidden: You don't have access to this project" }, 403);
    }
  }

  logger.debug("GET /api/v1/groups/:fingerprint/releases", { fingerprint });
  const releases = await GroupService.getReleases(fingerprint);
  return c.json(releases);
};

export const batchUpdateStatus = async (c: AuthContext) => {
  const userId = c.get("userId");
  const { fingerprints, status } = await c.req.json() as { fingerprints: string[]; status: IssueStatus };

  if (!fingerprints?.length || !["open", "resolved", "ignored"].includes(status)) {
    return c.json({ error: "Invalid input" }, 400);
  }

  logger.info("PATCH /api/v1/groups/batch/status", { count: fingerprints.length, status, userId });

  // Verify project access for each group before performing the batch update
  for (const fingerprint of fingerprints) {
    const group = await GroupService.getById(fingerprint);
    if (!group) {
      return c.json({ error: `Group not found: ${fingerprint}` }, 404);
    }
    if (group.projectId) {
      const hasAccess = await verifyProjectAccess(group.projectId, userId);
      if (!hasAccess) {
        logger.warn("User attempted to batch update groups without project permission", {
          userId,
          fingerprint,
          projectId: group.projectId,
        });
        return c.json({ error: "Forbidden: You don't have access to this project" }, 403);
      }
    }
  }

  const updated = await GroupRepository.batchUpdateStatus(fingerprints, status, userId);
  return c.json({ updated });
};

export const merge = async (c: AuthContext) => {
  const userId = c.get("userId");
  const parentFingerprint = c.req.param("fingerprint");
  const { fingerprints } = await c.req.json() as { fingerprints: string[] };

  if (!fingerprints?.length) {
    return c.json({ error: "fingerprints array required" }, 400);
  }

  logger.info("POST /api/v1/groups/:fingerprint/merge", { parentFingerprint, children: fingerprints.length, userId });

  // Verify project access for the parent group
  const parentGroup = await GroupService.getById(parentFingerprint);
  if (!parentGroup) {
    return c.json({ error: "Group not found" }, 404);
  }
  if (parentGroup.projectId) {
    const hasAccess = await verifyProjectAccess(parentGroup.projectId, userId);
    if (!hasAccess) {
      logger.warn("User attempted to merge groups without project permission", {
        userId,
        fingerprint: parentFingerprint,
        projectId: parentGroup.projectId,
      });
      return c.json({ error: "Forbidden: You don't have access to this project" }, 403);
    }
  }

  // Verify project access for each child group
  for (const fingerprint of fingerprints) {
    const group = await GroupService.getById(fingerprint);
    if (!group) {
      return c.json({ error: `Group not found: ${fingerprint}` }, 404);
    }
    if (group.projectId) {
      const hasAccess = await verifyProjectAccess(group.projectId, userId);
      if (!hasAccess) {
        logger.warn("User attempted to merge groups without project permission", {
          userId,
          fingerprint,
          projectId: group.projectId,
        });
        return c.json({ error: "Forbidden: You don't have access to this project" }, 403);
      }
    }
  }

  const merged = await GroupRepository.merge(parentFingerprint, fingerprints);
  return c.json({ merged });
};

export const unmerge = async (c: AuthContext) => {
  const userId = c.get("userId");
  const fingerprint = c.req.param("fingerprint");

  logger.info("POST /api/v1/groups/:fingerprint/unmerge", { fingerprint, userId });

  const group = await GroupService.getById(fingerprint);
  if (!group) {
    return c.json({ error: "Group not found" }, 404);
  }
  if (group.projectId) {
    const hasAccess = await verifyProjectAccess(group.projectId, userId);
    if (!hasAccess) {
      logger.warn("User attempted to unmerge group without project permission", {
        userId,
        fingerprint,
        projectId: group.projectId,
      });
      return c.json({ error: "Forbidden: You don't have access to this project" }, 403);
    }
  }

  await GroupRepository.unmerge(fingerprint);
  return c.json({ success: true });
};

export const snooze = async (c: AuthContext) => {
  const userId = c.get("userId");
  const fingerprint = c.req.param("fingerprint");
  const { until } = await c.req.json() as { until: string };

  if (!until) {
    return c.json({ error: "until date required" }, 400);
  }

  logger.info("PATCH /api/v1/groups/:fingerprint/snooze", { fingerprint, until, userId });

  const group = await GroupService.getById(fingerprint);
  if (!group) {
    return c.json({ error: "Group not found" }, 404);
  }
  if (group.projectId) {
    const hasAccess = await verifyProjectAccess(group.projectId, userId);
    if (!hasAccess) {
      logger.warn("User attempted to snooze group without project permission", {
        userId,
        fingerprint,
        projectId: group.projectId,
      });
      return c.json({ error: "Forbidden: You don't have access to this project" }, 403);
    }
  }

  const result = await GroupRepository.snooze(fingerprint, new Date(until), userId);
  return c.json(result[0]);
};

