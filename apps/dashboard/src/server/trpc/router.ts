/**
 * tRPC Router - defines all available procedures
 * @description All procedures except auth.getSession require authentication
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import superjson from "superjson";
import { router, publicProcedure, createCallerFactory, createTRPCContext } from "./trpc";
import { api } from "../api";
import { adminRouter } from "./routers/admin";

/**
 * Protected procedure middleware - requires authentication
 */
const protectedProcedure = publicProcedure.use(async (opts) => {
  const { session } = opts.ctx;

  if (!session?.user?.id) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required. Please log in.",
    });
  }

  return opts.next({
    ctx: {
      ...opts.ctx,
      session,
      userId: session.user.id,
      user: session.user,
    },
  });
});

/**
 * Auth router - public (getSession must be public)
 */
const authRouter = router({
  getSession: publicProcedure.query(async () => {
    return api.auth.getSession();
  }),
});

/**
 * Groups router - protected
 */
const groupsRouter = router({
  getAll: protectedProcedure
    .input(
      z.object({
        env: z.string().optional(),
        dateRange: z.enum(["24h", "7d", "30d", "90d", "all"]).optional(),
        projectId: z.string().uuid().optional(),
        search: z.string().optional(),
        status: z.enum(["open", "resolved", "ignored", "snoozed"]).optional(),
        level: z.enum(["fatal", "error", "warning", "info", "debug"]).optional(),
        sort: z.enum(["lastSeen", "firstSeen", "count"]).optional(),
        page: z.number().int().positive().optional(),
        limit: z.number().int().positive().max(100).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      return api.groups.getAll(input);
    }),

  getById: protectedProcedure
    .input(z.object({ fingerprint: z.string() }))
    .query(async ({ input }) => {
      return api.groups.getById(input.fingerprint);
    }),

  getEvents: protectedProcedure
    .input(z.object({
      fingerprint: z.string(),
      page: z.number().optional(),
      limit: z.number().optional()
    }))
    .query(async ({ input }) => {
      return api.groups.getEvents(input.fingerprint, input.page, input.limit);
    }),

  getTimeline: protectedProcedure
    .input(z.object({ fingerprint: z.string() }))
    .query(async ({ input }) => {
      return api.groups.getTimeline(input.fingerprint);
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      fingerprint: z.string(),
      status: z.enum(["open", "resolved", "ignored"]),
    }))
    .mutation(async ({ input }) => {
      return api.groups.updateStatus(input.fingerprint, input.status);
    }),

  updateAssignment: protectedProcedure
    .input(z.object({
      fingerprint: z.string(),
      assignedTo: z.string().nullable(),
    }))
    .mutation(async ({ input }) => {
      return api.groups.updateAssignment(input.fingerprint, input.assignedTo);
    }),

  getReleases: protectedProcedure
    .input(z.object({ fingerprint: z.string() }))
    .query(async ({ input }) => {
      return api.groups.getReleases(input.fingerprint);
    }),

  batchUpdateStatus: protectedProcedure
    .input(z.object({
      fingerprints: z.array(z.string()).min(1).max(100),
      status: z.enum(["open", "resolved", "ignored"]),
    }))
    .mutation(async ({ input }) => {
      return api.groups.batchUpdateStatus(input.fingerprints, input.status);
    }),

  merge: protectedProcedure
    .input(z.object({
      parentFingerprint: z.string(),
      childFingerprints: z.array(z.string()).min(1).max(50),
    }))
    .mutation(async ({ input }) => {
      return api.groups.merge(input.parentFingerprint, input.childFingerprints);
    }),

  unmerge: protectedProcedure
    .input(z.object({ fingerprint: z.string() }))
    .mutation(async ({ input }) => {
      return api.groups.unmerge(input.fingerprint);
    }),

  snooze: protectedProcedure
    .input(z.object({
      fingerprint: z.string(),
      until: z.string(),
    }))
    .mutation(async ({ input }) => {
      return api.groups.snooze(input.fingerprint, input.until);
    }),
});

/**
 * Insight types for stats analysis
 */
export interface StatsInsight {
  type: "trend" | "pattern" | "stability" | "alert" | "neutral";
  icon: "trending-up" | "trending-down" | "clock" | "calendar" | "shield" | "alert-triangle";
  title: string;
  message: string;
  value?: string;
  sentiment: "positive" | "negative" | "neutral";
}

/**
 * Stats router - protected
 */
const statsRouter = router({
  getGlobal: protectedProcedure
    .input(z.object({ projectId: z.string().uuid().optional() }).optional())
    .query(async ({ input }) => {
      return api.stats.getGlobal(input?.projectId);
    }),

  getTimeline: protectedProcedure
    .input(z.object({
      range: z.enum(["24h", "7d", "30d"]).optional(),
      projectId: z.string().uuid().optional(),
    }).optional())
    .query(async ({ input }) => {
      return api.stats.getTimeline(input?.range || "30d", input?.projectId);
    }),

  getEnvBreakdown: protectedProcedure
    .input(z.object({ projectId: z.string().uuid().optional() }).optional())
    .query(async ({ input }) => {
      return api.stats.getEnvBreakdown(input?.projectId);
    }),

  getSeverityBreakdown: protectedProcedure
    .input(z.object({ projectId: z.string().uuid().optional() }).optional())
    .query(async ({ input }) => {
      return api.stats.getSeverityBreakdown(input?.projectId);
    }),

  getDashboardStats: protectedProcedure
    .input(z.object({ projectId: z.string().uuid().optional() }).optional())
    .query(async ({ input }) => {
      return api.stats.getDashboardStats(input?.projectId);
    }),

  /**
   * Get computed insights from stats data
   * Analyzes trends, patterns, and stability metrics
   */
  getInsights: protectedProcedure
    .input(z.object({ projectId: z.string().uuid().optional() }).optional())
    .query(async ({ input }): Promise<StatsInsight[]> => {
      const insights: StatsInsight[] = [];

      try {
        // Fetch 30d timeline for analysis
        const timeline = await api.stats.getTimeline("30d", input?.projectId);
        const envBreakdown = await api.stats.getEnvBreakdown(input?.projectId);

        if (!timeline || timeline.length === 0) {
          return [{
            type: "neutral" as const,
            icon: "shield",
            title: "No data yet",
            message: "Start sending errors to see insights",
            sentiment: "neutral",
          }];
        }

        // Calculate total events
        const totalEvents = timeline.reduce((sum, point) => sum + point.events, 0);

        // Trend analysis: Compare last 7 days vs previous 7 days
        const last7Days = timeline.slice(-7);
        const previous7Days = timeline.slice(-14, -7);

        const last7Total = last7Days.reduce((sum, p) => sum + p.events, 0);
        const prev7Total = previous7Days.reduce((sum, p) => sum + p.events, 0);

        if (prev7Total > 0) {
          const changePercent = Math.round(((last7Total - prev7Total) / prev7Total) * 100);

          if (Math.abs(changePercent) >= 10) {
            insights.push({
              type: "trend",
              icon: changePercent > 0 ? "trending-up" : "trending-down",
              title: changePercent > 0 ? "Errors increasing" : "Errors decreasing",
              message: `${Math.abs(changePercent)}% ${changePercent > 0 ? "more" : "fewer"} errors vs last week`,
              value: `${changePercent > 0 ? "+" : ""}${changePercent}%`,
              sentiment: changePercent > 0 ? "negative" : "positive",
            });
          }
        }

        // Peak day analysis
        if (timeline.length >= 7) {
          const dayTotals: Record<string, { total: number; count: number }> = {};

          timeline.forEach((point) => {
            const date = new Date(point.date);
            const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
            if (!dayTotals[dayName]) {
              dayTotals[dayName] = { total: 0, count: 0 };
            }
            dayTotals[dayName].total += point.events;
            dayTotals[dayName].count += 1;
          });

          const dayAverages = Object.entries(dayTotals).map(([day, data]) => ({
            day,
            avg: data.total / data.count,
          }));

          const peakDay = dayAverages.reduce((max, curr) =>
            curr.avg > max.avg ? curr : max
          );

          const quietDay = dayAverages.reduce((min, curr) =>
            curr.avg < min.avg ? curr : min
          );

          if (peakDay.avg > quietDay.avg * 1.5) {
            insights.push({
              type: "pattern",
              icon: "calendar",
              title: "Peak error day",
              message: `${peakDay.day}s have the most errors`,
              value: `~${Math.round(peakDay.avg)}/day`,
              sentiment: "neutral",
            });
          }

          if (quietDay.avg < peakDay.avg * 0.5) {
            insights.push({
              type: "stability",
              icon: "shield",
              title: "Most stable day",
              message: `${quietDay.day}s have the fewest errors`,
              value: `~${Math.round(quietDay.avg)}/day`,
              sentiment: "positive",
            });
          }
        }

        // Environment insight
        if (envBreakdown && envBreakdown.length > 0) {
          const prodEnv = envBreakdown.find(
            (e) => e.env === "prod" || e.env === "production"
          );
          const totalEnvEvents = envBreakdown.reduce((sum, e) => sum + e.count, 0);

          if (prodEnv && totalEnvEvents > 0) {
            const prodPercent = Math.round((prodEnv.count / totalEnvEvents) * 100);

            if (prodPercent > 60) {
              insights.push({
                type: "alert",
                icon: "alert-triangle",
                title: "Production-heavy",
                message: `${prodPercent}% of errors are from production`,
                value: `${prodPercent}%`,
                sentiment: "negative",
              });
            }
          }
        }

        // Recent spike detection (last 24h vs average)
        if (timeline.length >= 7) {
          const avgDaily = totalEvents / timeline.length;
          const lastDay = timeline[timeline.length - 1];

          if (lastDay && lastDay.events > avgDaily * 2) {
            insights.push({
              type: "alert",
              icon: "alert-triangle",
              title: "Recent spike",
              message: `Today's errors are ${Math.round(lastDay.events / avgDaily)}x above average`,
              value: `${lastDay.events} errors`,
              sentiment: "negative",
            });
          }
        }

        // If no significant insights, add a positive stability message
        if (insights.length === 0) {
          insights.push({
            type: "stability",
            icon: "shield",
            title: "Looking stable",
            message: "No significant patterns or anomalies detected",
            sentiment: "positive",
          });
        }

        return insights.slice(0, 4); // Return max 4 insights
      } catch {
        return [{
          type: "neutral" as const,
          icon: "shield",
          title: "Unable to analyze",
          message: "Could not compute insights at this time",
          sentiment: "neutral",
        }];
      }
    }),
});

/**
 * Organizations router - protected
 */
const organizationsRouter = router({
  getAll: protectedProcedure.query(async () => {
    return api.organizations.getAll();
  }),

  canCreate: protectedProcedure.query(async () => {
    return api.organizations.canCreate();
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ input }) => {
      return api.organizations.create(input.name);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      return api.organizations.delete(input.id);
    }),
});

/**
 * Projects router - protected
 */
const projectsRouter = router({
  getAll: protectedProcedure.query(async () => {
    return api.projects.getAll();
  }),

  getCurrent: protectedProcedure.query(async () => {
    return api.projects.getCurrent();
  }),

  setCurrent: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      return api.projects.setCurrent(input.projectId);
    }),

  canCreate: protectedProcedure.query(async () => {
    return api.projects.canCreate();
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      organizationId: z.string().uuid(),
      environment: z.enum(["production", "staging", "development"]).optional(),
      platform: z.enum(["symfony", "laravel", "vuejs", "react", "nextjs", "nuxtjs", "nodejs", "hono", "fastify"])
    }))
    .mutation(async ({ input }) => {
      return api.projects.create(input);
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100)
    }))
    .mutation(async ({ input }) => {
      return api.projects.update(input.id, { name: input.name });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      return api.projects.delete(input.id);
    }),
});

/**
 * Members router - protected
 */
const membersRouter = router({
  getByOrganization: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ input }) => {
      return api.members.getByOrganization(input.organizationId);
    }),

  invite: protectedProcedure
    .input(z.object({
      organizationId: z.string().uuid(),
      email: z.string().email(),
      method: z.enum(["token", "direct"]).optional().default("token")
    }))
    .mutation(async ({ input }) => {
      return api.members.invite(input.organizationId, input.email, input.method);
    }),

  checkInvite: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      return api.members.checkInvite(input.token);
    }),

  acceptInvite: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      return api.members.acceptInvite(input.token);
    }),

  remove: protectedProcedure
    .input(z.object({ memberId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      return api.members.remove(input.memberId);
    }),
});

/**
 * Onboarding router - protected
 */
const onboardingRouter = router({
  getStatus: protectedProcedure.query(async () => {
    return api.onboarding.getStatus();
  }),

  setup: protectedProcedure
    .input(z.object({
      organizationName: z.string().min(1).max(100),
      projectName: z.string().min(1).max(100),
      environment: z.enum(["production", "staging", "development"]).optional(),
      platform: z.enum(["symfony", "laravel", "vuejs", "react", "nextjs", "nuxtjs", "nodejs", "hono", "fastify"])
    }))
    .mutation(async ({ input }) => {
      return api.onboarding.setup(input);
    }),
});

/**
 * API Keys router - protected
 */
const apiKeysRouter = router({
  getAll: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input }) => {
      return api.apiKeys.getAll(input.projectId);
    }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      name: z.string().min(1).max(100)
    }))
    .mutation(async ({ input }) => {
      return api.apiKeys.create(input.projectId, input.name);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      return api.apiKeys.delete(input.id);
    }),
});

/**
 * Alerts router - protected
 */
const alertsRouter = router({
  getRules: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input }) => {
      return api.alerts.getRules(input.projectId);
    }),

  createRule: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      name: z.string().min(1).max(100),
      type: z.enum(["new_error", "threshold", "regression"]),
      threshold: z.number().positive().optional(),
      windowMinutes: z.number().positive().optional(),
      channel: z.enum(["email", "slack", "webhook"]),
      config: z.object({
        email: z.string().email().optional(),
        slackWebhook: z.string().url().optional(),
        webhookUrl: z.string().url().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      return api.alerts.createRule(input);
    }),

  updateRule: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      updates: z.object({
        name: z.string().min(1).max(100).optional(),
        type: z.enum(["new_error", "threshold", "regression"]).optional(),
        threshold: z.number().positive().optional(),
        windowMinutes: z.number().positive().optional(),
        channel: z.enum(["email", "slack", "webhook"]).optional(),
        config: z.object({
          email: z.string().email().optional(),
          slackWebhook: z.string().url().optional(),
          webhookUrl: z.string().url().optional(),
        }).optional(),
        enabled: z.boolean().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      return api.alerts.updateRule(input.id, input.updates);
    }),

  deleteRule: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      return api.alerts.deleteRule(input.id);
    }),

  getNotifications: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input }) => {
      return api.alerts.getNotifications(input.projectId);
    }),
});

/**
 * Project Settings router - protected
 */
const projectSettingsRouter = router({
  get: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input }) => {
      return api.projectSettings.get(input.projectId);
    }),

  update: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      timezone: z.string().optional(),
      retentionDays: z.number().min(7).max(365).optional(),
      autoResolve: z.boolean().optional(),
      autoResolveDays: z.number().min(3).max(60).optional(),
      eventsEnabled: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { projectId, ...data } = input;
      return api.projectSettings.update(projectId, data);
  }),
});

/**
 * Billing router - protected
 */
const billingRouter = router({
  getSummary: protectedProcedure
    .input(z.object({ projectId: z.string().uuid().optional() }).optional())
    .query(async ({ input }) => {
      return api.billing.getSummary(input?.projectId);
    }),

  createCheckout: protectedProcedure
    .input(z.object({
      plan: z.enum(["pro", "team", "enterprise"]).optional()
    }).optional())
    .mutation(async ({ input }) => {
      return api.billing.createCheckout(input?.plan || "pro");
    }),

  createPortal: protectedProcedure
    .mutation(async () => {
      return api.billing.createPortal();
    }),
});

/**
 * Replay router - protected
 */
const replayRouter = router({
  getSessions: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      page: z.number().optional().default(1),
      limit: z.number().optional().default(20),
    }))
    .query(async ({ input }) => {
      return api.replay.getSessions(input.projectId, input.page, input.limit);
    }),

  getSessionsWithErrors: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      filters: z.object({
        deviceType: z.enum(["desktop", "mobile", "tablet"]).optional(),
        browser: z.string().optional(),
        os: z.string().optional(),
        durationMin: z.number().optional(),
        durationMax: z.number().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        errorCountMin: z.number().optional(),
        severity: z.enum(["fatal", "error", "warning", "info", "debug"]).optional(),
      }).optional(),
      page: z.number().optional().default(1),
      limit: z.number().optional().default(20),
    }))
    .query(async ({ input }) => {
      return api.replay.getSessionsWithErrors(
        input.projectId,
        input.filters,
        input.page,
        input.limit
      );
    }),

  getSession: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ input }) => {
      return api.replay.getSession(input.sessionId);
    }),

  getSessionEvents: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      errorEventId: z.string().uuid().optional(), // Filter by specific error (Sentry-like)
      errorTime: z.string().optional(), // Error timestamp for time window filtering
    }))
    .query(async ({ input }) => {
      return api.replay.getSessionEvents(input.sessionId, input.errorEventId, input.errorTime);
    }),
});

/**
 * User router - protected
 */
const userRouter = router({
  getProfile: protectedProcedure.query(async () => {
    return api.user.getProfile();
  }),

  updateProfile: protectedProcedure
    .input(z.object({
      name: z.string().max(100).optional(),
      image: z.string().url().optional(),
    }))
    .mutation(async ({ input }) => {
      return api.user.updateProfile(input);
    }),

  getSessions: protectedProcedure.query(async () => {
    return api.user.getSessions();
  }),

  revokeSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input }) => {
      return api.user.revokeSession(input.sessionId);
    }),

  revokeAllSessions: protectedProcedure.mutation(async () => {
    return api.user.revokeAllSessions();
  }),

  canChangePassword: protectedProcedure.query(async () => {
    return api.user.canChangePassword();
  }),
});

/**
 * Performance router - protected
 */
const performanceRouter = router({
  getWebVitals: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      dateRange: z.enum(["24h", "7d", "30d", "90d", "6m", "1y"]).optional(),
    }))
    .query(async ({ input }) => {
      return api.performance.getWebVitals(input.projectId, input.dateRange);
    }),

  getTransactions: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      op: z.string().optional(),
      page: z.number().int().positive().optional(),
      limit: z.number().int().positive().max(100).optional(),
    }))
    .query(async ({ input }) => {
      return api.performance.getTransactions(input.projectId, {
        op: input.op,
        page: input.page,
        limit: input.limit,
      });
    }),

  getTransaction: protectedProcedure
    .input(z.object({ transactionId: z.string() }))
    .query(async ({ input }) => {
      return api.performance.getTransaction(input.transactionId);
    }),

  getSlowest: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      dateRange: z.enum(["24h", "7d", "30d", "90d", "6m", "1y"]).optional(),
    }))
    .query(async ({ input }) => {
      return api.performance.getSlowest(input.projectId, input.dateRange);
    }),

  getSpanAnalysis: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      dateRange: z.enum(["24h", "7d", "30d", "90d", "6m", "1y"]).optional(),
    }))
    .query(async ({ input }) => {
      return api.performance.getSpanAnalysis(input.projectId, input.dateRange);
    }),

  getApdex: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      dateRange: z.enum(["24h", "7d", "30d", "90d", "6m", "1y"]).optional(),
    }))
    .query(async ({ input }) => {
      return api.performance.getApdex(input.projectId, input.dateRange);
    }),

  getServerStats: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      dateRange: z.enum(["24h", "7d", "30d", "90d", "6m", "1y"]).optional(),
    }))
    .query(async ({ input }) => {
      return api.performance.getServerStats(input.projectId, input.dateRange);
    }),

  getTopEndpoints: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      dateRange: z.enum(["24h", "7d", "30d", "90d", "6m", "1y"]).optional(),
    }))
    .query(async ({ input }) => {
      return api.performance.getTopEndpoints(input.projectId, input.dateRange);
    }),
});

/**
 * Logs router - protected
 */
const logsRouter = router({
  tail: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      limit: z.number().int().positive().max(500).optional(),
      cursor: z.string().optional(),
      level: z.enum(["debug", "info", "warning", "error"]).optional(),
      channel: z.string().max(100).optional(),
      search: z.string().max(200).optional(),
    }))
    .query(async ({ input }) => {
      return api.logs.tail(input);
    }),
});

/**
 * Attention router - protected
 * Returns prioritized error groups based on composite score
 */
const attentionRouter = router({
  getTop: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(20).optional(),
    }).optional())
    .query(async ({ input }) => {
      return api.attention.getTop(input?.projectId, input?.limit ?? 8);
    }),
});

/**
 * App router - combines all routers
 */
export const appRouter = router({
  auth: authRouter,
  groups: groupsRouter,
  stats: statsRouter,
  organizations: organizationsRouter,
  projects: projectsRouter,
  projectSettings: projectSettingsRouter,
  members: membersRouter,
  apiKeys: apiKeysRouter,
  alerts: alertsRouter,
  onboarding: onboardingRouter,
  billing: billingRouter,
  replay: replayRouter,
  user: userRouter,
  performance: performanceRouter,
  logs: logsRouter,
  attention: attentionRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;

/**
 * Server-side caller for Server Components
 */
export const createCaller = createCallerFactory(appRouter);

export const getServerCaller = async () => {
  const context = await createTRPCContext();
  return createCaller(context);
};

/**
 * Server-side helpers for SSR prefetch + HydrationBoundary
 */
import { createServerSideHelpers } from "@trpc/react-query/server";

export const createSSRHelpers = async () => {
  const context = await createTRPCContext();
  return createServerSideHelpers({
    router: appRouter,
    ctx: context,
    transformer: superjson,
  });
};
