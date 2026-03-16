"use client";

import { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Play,
  RefreshCw,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Calendar,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";

const API_URL =
  process.env.NEXT_PUBLIC_MONITORING_API_URL || "http://localhost:3333";

function formatDuration(ms: number | null): string {
  if (ms == null) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString();
}

const CRON_DESCRIPTIONS: Record<string, { label: string; description: string }> = {
  "aggregate-hourly": {
    label: "Aggregate Hourly",
    description:
      "Aggregates raw performance_metrics and transactions into hourly buckets using PERCENTILE_CONT. Runs for each hour of the target date (24 iterations).",
  },
  "aggregate-daily": {
    label: "Aggregate Daily",
    description:
      "Rolls up hourly aggregates into daily buckets using weighted averages. Must run after hourly aggregation.",
  },
  "cleanup-expired": {
    label: "Cleanup Expired",
    description:
      "Purges raw performance data older than 30 days, error events beyond retention, orphaned error groups, and hourly aggregates older than 12 months.",
  },
};

export default function AdminPage() {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [result, setResult] = useState<{ type: string; data: unknown } | null>(null);
  const [targetDate, setTargetDate] = useState(
    new Date(Date.now() - 86400000).toISOString().split("T")[0]
  );

  const isConfiguredQuery = trpc.admin.isConfigured.useQuery();

  const cronStatusQuery = trpc.admin.getCronStatus.useQuery(undefined, {
    enabled: false, // manual fetch only
  });

  const runJobMutation = trpc.admin.runJobSync.useMutation();
  const clearFailedMutation = trpc.admin.clearFailedJobs.useMutation();

  const fetchStatus = useCallback(async () => {
    await cronStatusQuery.refetch();
  }, [cronStatusQuery]);

  const triggerJob = useCallback(
    async (type: "aggregate-hourly" | "aggregate-daily" | "cleanup-expired") => {
      setActionLoading(type);
      setResult(null);
      try {
        const data = await runJobMutation.mutateAsync({ type, targetDate });
        setResult({ type, data });
        cronStatusQuery.refetch();
      } finally {
        setActionLoading(null);
      }
    },
    [targetDate, runJobMutation, cronStatusQuery]
  );

  const clearFailed = useCallback(async () => {
    setActionLoading("clear-failed");
    try {
      await clearFailedMutation.mutateAsync();
      cronStatusQuery.refetch();
    } finally {
      setActionLoading(null);
    }
  }, [clearFailedMutation, cronStatusQuery]);

  const loading = cronStatusQuery.isFetching;
  const error =
    cronStatusQuery.error?.message ||
    runJobMutation.error?.message ||
    clearFailedMutation.error?.message ||
    null;

  const status = cronStatusQuery.data?.cronStatus ?? null;
  const failedJobs = cronStatusQuery.data?.failedJobs ?? [];

  // Show configuration error if ADMIN_API_KEY is not set server-side
  if (isConfiguredQuery.data && !isConfiguredQuery.data.configured) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <AlertCircle className="size-12 text-amber-500" />
        <h2 className="text-lg font-semibold">Admin API Key Required</h2>
        <p className="max-w-md text-center text-sm text-muted-foreground">
          Set <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">ADMIN_API_KEY</code> in
          your <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">.env.local</code> to match the
          monitoring server&apos;s <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">ADMIN_API_KEY</code>.
          This key is read server-side only and is never exposed to the browser.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">
            Cron jobs, aggregation management & queue monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-500">
            Dev Only
          </Badge>
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted/50 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {status ? "Refresh" : "Load Status"}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* How to implement section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How Cron Jobs Work</CardTitle>
          <CardDescription>
            Aggregation jobs run automatically via BullMQ schedulers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="rounded-lg border bg-muted/30 p-4 font-mono text-xs leading-relaxed">
            <p className="mb-2 font-sans text-sm font-medium text-foreground">
              Automatic scheduling (already active):
            </p>
            <div className="space-y-1 text-muted-foreground">
              <p>
                <span className="text-emerald-400">0 2 * * *</span> — aggregate-hourly
                <span className="ml-2 font-sans text-[10px] text-muted-foreground/70">
                  (2:00 AM UTC)
                </span>
              </p>
              <p>
                <span className="text-emerald-400">0 3 * * *</span> — aggregate-daily
                <span className="ml-2 font-sans text-[10px] text-muted-foreground/70">
                  (3:00 AM UTC)
                </span>
              </p>
              <p>
                <span className="text-emerald-400">0 4 * * *</span> — cleanup-expired
                <span className="ml-2 font-sans text-[10px] text-muted-foreground/70">
                  (4:00 AM UTC)
                </span>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {Object.entries(CRON_DESCRIPTIONS).map(([key, { label, description }]) => (
              <div
                key={key}
                className="rounded-lg border p-3"
              >
                <p className="mb-1 font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
          <div className="rounded-lg border bg-muted/30 p-4 text-xs">
            <p className="mb-2 font-medium text-sm text-foreground">
              API Endpoints (curl)
            </p>
            <div className="space-y-2 font-mono text-muted-foreground">
              <p># Check status</p>
              <p className="text-foreground">
                curl -H &quot;Authorization: Bearer $KEY&quot; {API_URL}/api/v1/admin/cron/status
              </p>
              <p className="mt-2"># Trigger async job</p>
              <p className="text-foreground">
                curl -X POST -H &quot;Authorization: Bearer $KEY&quot; -H &quot;Content-Type: application/json&quot; \
              </p>
              <p className="pl-4 text-foreground">
                -d {`'{"type":"aggregate-hourly","targetDate":"2026-02-19"}'`} \
              </p>
              <p className="pl-4 text-foreground">
                {API_URL}/api/v1/admin/cron/trigger
              </p>
              <p className="mt-2"># Run sync (blocks until done)</p>
              <p className="text-foreground">
                curl -X POST ... {API_URL}/api/v1/admin/cron/run-sync
              </p>
              <p className="mt-2"># Backfill 30 days (one-shot script)</p>
              <p className="text-foreground">
                bun run apps/monitoring-server/src/scripts/backfill-aggregates.ts
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manual trigger */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run Job Manually</CardTitle>
          <CardDescription>
            Execute a cron job synchronously for a specific date
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Target Date
              </label>
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-muted-foreground" />
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                />
              </div>
            </div>
            {(Object.keys(CRON_DESCRIPTIONS) as Array<"aggregate-hourly" | "aggregate-daily" | "cleanup-expired">).map((type) => (
              <button
                key={type}
                onClick={() => triggerJob(type)}
                disabled={actionLoading !== null}
                className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted/50 disabled:opacity-50"
              >
                {actionLoading === type ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}
                {CRON_DESCRIPTIONS[type].label}
              </button>
            ))}
          </div>

          {result && (
            <div className="mt-4 rounded-lg border bg-muted/30 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-400">
                <CheckCircle2 className="size-4" />
                {result.type} completed
              </div>
              <pre className="overflow-x-auto text-xs text-muted-foreground">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Queue status */}
      {status && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Scheduled jobs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="size-4" />
                  Scheduled Jobs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {status.scheduledJobs.map((job) => (
                    <div
                      key={job.key}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{job.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {job.pattern}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Next run</p>
                        <p className="text-xs font-medium">
                          {formatDate(job.next)}
                        </p>
                      </div>
                    </div>
                  ))}
                  {status.scheduledJobs.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No scheduled jobs. Restart the monitoring server.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Queue stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Queue Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-2">
                  {Object.entries(status.queueStats).map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-lg border p-3 text-center"
                    >
                      <p className="text-lg font-bold">{value}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">
                        {key}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent history */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent History</CardTitle>
              <CardDescription>Last 10 completed jobs</CardDescription>
            </CardHeader>
            <CardContent>
              {status.recentHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No completed jobs yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="pb-2 pr-4">Job</th>
                        <th className="pb-2 pr-4">Finished</th>
                        <th className="pb-2 pr-4">Duration</th>
                        <th className="pb-2">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {status.recentHistory.map((job) => (
                        <tr key={job.id} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-medium">{job.name}</td>
                          <td className="py-2 pr-4 text-xs text-muted-foreground">
                            {formatDate(job.finishedOn)}
                          </td>
                          <td className="py-2 pr-4 font-mono text-xs">
                            {formatDuration(job.duration)}
                          </td>
                          <td className="py-2">
                            <pre className="max-w-xs truncate font-mono text-xs text-muted-foreground">
                              {JSON.stringify(job.returnvalue)}
                            </pre>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Failed jobs */}
      {failedJobs.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base text-red-400">
                  <AlertCircle className="size-4" />
                  Failed Jobs ({failedJobs.length})
                </CardTitle>
              </div>
              <button
                onClick={clearFailed}
                disabled={actionLoading === "clear-failed"}
                className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50"
              >
                {actionLoading === "clear-failed" ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Trash2 className="size-3" />
                )}
                Clear All
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {failedJobs.map((job) => (
                <div
                  key={job.id}
                  className="rounded-lg border border-red-500/20 bg-red-500/5 p-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{job.name}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {job.attemptsMade} attempts
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-red-400">{job.failedReason}</p>
                  {job.stacktrace?.[0] && (
                    <pre className="mt-2 max-h-20 overflow-auto rounded bg-muted/50 p-2 font-mono text-[10px] text-muted-foreground">
                      {job.stacktrace[0]}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
