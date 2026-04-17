"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useCurrentProject } from "@/contexts/ProjectContext";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import cronstrue from "cronstrue";
import {
  Plus,
  Clock,
  Terminal,
  Copy,
  Check,
  ArrowRight,
  BookOpen,
  Zap,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Timer,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/dashboard/PageHeader";
import type { CronCheckinStatus, CronMonitorStatus } from "@/server/api/types";

function formatSchedule(schedule: string | null): string {
  if (!schedule) return "-";
  try {
    return cronstrue.toString(schedule, { throwExceptionOnParseError: true });
  } catch {
    return schedule;
  }
}

function MonitorStatusBadge({ status }: { status: CronMonitorStatus }) {
  const variants: Record<CronMonitorStatus, "default" | "secondary" | "outline"> = {
    active: "default",
    paused: "secondary",
    disabled: "outline",
  };
  const colors: Record<CronMonitorStatus, string> = {
    active: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    paused: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    disabled: "bg-muted text-muted-foreground",
  };
  return (
    <Badge variant={variants[status]} className={colors[status]}>
      {status}
    </Badge>
  );
}

function CheckinStatusBadge({ status }: { status: CronCheckinStatus | null }) {
  if (!status) return <span className="text-muted-foreground">-</span>;
  const colors: Record<CronCheckinStatus, string> = {
    ok: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    error: "bg-red-500/15 text-red-600 border-red-500/30",
    missed: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    in_progress: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  };
  const labels: Record<CronCheckinStatus, string> = {
    ok: "OK",
    error: "Error",
    missed: "Missed",
    in_progress: "In Progress",
  };
  return (
    <Badge variant="outline" className={colors[status]}>
      {labels[status]}
    </Badge>
  );
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

interface CreateMonitorFormData {
  name: string;
  slug: string;
  schedule: string;
  timezone: string;
  toleranceMinutes: number;
}

export default function CronsPage() {
  const t = useTranslations("crons");
  const tHeader = useTranslations("pageHeader.crons");
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const projectSlug = params.projectSlug as string;
  const { currentProjectId } = useCurrentProject();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateMonitorFormData>({
    name: "",
    slug: "",
    schedule: "",
    timezone: "UTC",
    toleranceMinutes: 5,
  });

  const utils = trpc.useUtils();

  const { data: monitors, isLoading } = trpc.cron.getMonitors.useQuery(
    { projectId: currentProjectId! },
    { enabled: !!currentProjectId }
  );

  const createMutation = trpc.cron.createMonitor.useMutation({
    onSuccess: () => {
      toast.success(t("monitorCreated"));
      setCreateOpen(false);
      setForm({ name: "", slug: "", schedule: "", timezone: "UTC", toleranceMinutes: 5 });
      utils.cron.getMonitors.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      slug: prev.slug === slugify(prev.name) || prev.slug === "" ? slugify(name) : prev.slug,
    }));
  };

  const handleCreate = () => {
    if (!currentProjectId || !form.name || !form.slug) return;
    createMutation.mutate({
      projectId: currentProjectId,
      name: form.name,
      slug: form.slug,
      schedule: form.schedule || undefined,
      timezone: form.timezone || "UTC",
      toleranceMinutes: form.toleranceMinutes || 5,
    });
  };

  const baseUrl = `/dashboard/${orgSlug}/${projectSlug}`;

  const hasMonitors = monitors && monitors.length > 0;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <PageHeader title={tHeader("title")} description={tHeader("description")}>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="size-4" />
              {t("createMonitor")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("createMonitor")}</DialogTitle>
              <DialogDescription>{t("description")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">{t("name")}</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="my-cron-job"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="slug">{t("slug")}</Label>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                  placeholder="my-cron-job"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="schedule">{t("schedule")}</Label>
                <Input
                  id="schedule"
                  value={form.schedule}
                  onChange={(e) => setForm((p) => ({ ...p, schedule: e.target.value }))}
                  placeholder="0 * * * *"
                />
                {form.schedule && (
                  <p className="text-xs text-muted-foreground">
                    {formatSchedule(form.schedule)}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="timezone">{t("timezone")}</Label>
                  <Input
                    id="timezone"
                    value={form.timezone}
                    onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))}
                    placeholder="UTC"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="toleranceMinutes">{t("tolerance")}</Label>
                  <Input
                    id="toleranceMinutes"
                    type="number"
                    min={1}
                    value={form.toleranceMinutes}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, toleranceMinutes: Number(e.target.value) }))
                    }
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending || !form.name || !form.slug}
              >
                {createMutation.isPending ? "Creating..." : t("createMonitor")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {/* Onboarding Guide - shown when no monitors exist */}
      {!isLoading && !hasMonitors && <CronOnboardingGuide t={t} onCreateClick={() => setCreateOpen(true)} />}

      {/* Monitors Table */}
      {(isLoading || hasMonitors) && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="size-4" />
            {t("title")}
          </CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("slug")}</TableHead>
                  <TableHead>{t("schedule")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("lastCheckin")}</TableHead>
                  <TableHead>{t("nextExpected")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monitors?.map((monitor) => (
                  <TableRow key={monitor.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <Link
                        href={`${baseUrl}/crons/${monitor.id}`}
                        className="font-medium hover:underline"
                      >
                        {monitor.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        {monitor.slug}
                      </code>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {monitor.schedule ? (
                        <span title={monitor.schedule}>{formatSchedule(monitor.schedule)}</span>
                      ) : (
                        <span className="italic">{t("noSchedule")}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <MonitorStatusBadge status={monitor.status} />
                        {monitor.lastCheckinStatus && (
                          <CheckinStatusBadge status={monitor.lastCheckinStatus} />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {monitor.lastCheckinAt
                        ? new Date(monitor.lastCheckinAt).toLocaleString()
                        : "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {monitor.nextExpectedAt
                        ? new Date(monitor.nextExpectedAt).toLocaleString()
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}

// ============================================
// Code Block with Copy Button
// ============================================

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative">
      <div className="flex items-center justify-between rounded-t-lg border border-b-0 bg-muted/50 px-4 py-2">
        <span className="text-xs font-medium text-muted-foreground">{language}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          onClick={handleCopy}
        >
          {copied ? (
            <>
              <Check className="size-3 text-emerald-500" />
              <span className="text-emerald-500">Copied</span>
            </>
          ) : (
            <>
              <Copy className="size-3" />
              <span>Copy</span>
            </>
          )}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-b-lg border bg-zinc-950 p-4 text-sm leading-relaxed">
        <code className="text-zinc-100">{code}</code>
      </pre>
    </div>
  );
}

// ============================================
// Onboarding Guide Component
// ============================================

function CronOnboardingGuide({
  t,
  onCreateClick,
}: {
  t: ReturnType<typeof useTranslations<"crons">>;
  onCreateClick: () => void;
}) {
  return (
    <div className="grid gap-6">
      {/* Hero Section */}
      <Card className="overflow-hidden border-violet-500/20 bg-gradient-to-br from-violet-500/5 via-card to-purple-500/5">
        <CardContent className="p-8">
          <div className="flex flex-col items-center gap-6 text-center md:flex-row md:text-left">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 shadow-lg shadow-violet-600/25">
              <Clock className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="mb-2 text-xl font-bold">{t("guide.heroTitle")}</h2>
              <p className="mb-4 text-muted-foreground">{t("guide.heroDescription")}</p>
              <div className="flex flex-wrap justify-center gap-3 md:justify-start">
                <Button onClick={onCreateClick} className="gap-2">
                  <Plus className="size-4" />
                  {t("guide.createFirstMonitor")}
                </Button>
                <Button variant="outline" className="gap-2" asChild>
                  <a href="#sdk-integration">
                    <Terminal className="size-4" />
                    {t("guide.sdkIntegration")}
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Important: passive monitoring, not orchestration */}
      <Card className="border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-orange-500/5">
        <CardContent className="p-6">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" />
            <div>
              <h3 className="font-semibold">{t("guide.passiveTitle")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("guide.passiveDescription")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Architecture Diagram */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="size-5 text-violet-600" />
            {t("guide.howItWorksTitle")}
          </CardTitle>
          <CardDescription>{t("guide.howItWorksSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Visual Diagram */}
          <div className="overflow-x-auto rounded-xl border bg-zinc-950 p-6">
            <pre className="text-xs leading-relaxed text-zinc-300 md:text-sm">
              <code>{`┌─────────────────────────────────────┐
│         ${t("guide.diagramYourServer")}              │
│  (crontab / Laravel Scheduler /     │
│   Symfony Messenger / K8s CronJob)  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  0 2 * * *  backup.sh        │  │
│  └──────────────┬────────────────┘  │
└─────────────────┼───────────────────┘
                  │
    ${t("guide.diagramJobStarts")}  │  POST /cron/checkin
    ──────────────┤  { slug: "backup", status: "in_progress" }
                  │
    ${t("guide.diagramJobRuns")}   │  ...
                  │
    ${t("guide.diagramJobEnds")}   │  POST /cron/checkin
    ──────────────┤  { slug: "backup", status: "ok" }
                  │
                  ▼
┌─────────────────────────────────────┐
│        ErrorWatch API               │
│                                     │
│  ✓ ${t("guide.diagramRecords")}              │
│  ✓ ${t("guide.diagramComputes")}      │
│  ✓ ${t("guide.diagramEveryMinute")}      │
│  ✓ ${t("guide.diagramAlerts")}          │
└─────────────────────────────────────┘`}</code>
            </pre>
          </div>

          {/* 3 Steps */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex gap-3 rounded-xl border p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-600/10 text-lg font-bold text-violet-600">
                1
              </div>
              <div>
                <h3 className="font-semibold">{t("guide.step1Title")}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t("guide.step1Description")}</p>
              </div>
            </div>
            <div className="flex gap-3 rounded-xl border p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600/10 text-lg font-bold text-blue-600">
                2
              </div>
              <div>
                <h3 className="font-semibold">{t("guide.step2Title")}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t("guide.step2Description")}</p>
              </div>
            </div>
            <div className="flex gap-3 rounded-xl border p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600/10 text-lg font-bold text-emerald-600">
                3
              </div>
              <div>
                <h3 className="font-semibold">{t("guide.step3Title")}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t("guide.step3Description")}</p>
              </div>
            </div>
          </div>

          {/* Status Legend */}
          <div className="rounded-xl border bg-muted/30 p-4">
            <h4 className="mb-3 text-sm font-semibold">{t("guide.statusLegendTitle")}</h4>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-500" />
                <span className="text-sm"><code className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-600">ok</code> — {t("guide.statusOk")}</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="size-4 text-red-500" />
                <span className="text-sm"><code className="rounded bg-red-500/10 px-1.5 py-0.5 text-red-600">error</code> — {t("guide.statusError")}</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-500" />
                <span className="text-sm"><code className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-600">missed</code> — {t("guide.statusMissed")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Timer className="size-4 text-blue-500" />
                <span className="text-sm"><code className="rounded bg-blue-500/10 px-1.5 py-0.5 text-blue-600">in_progress</code> — {t("guide.statusInProgress")}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SDK Integration */}
      <Card id="sdk-integration">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Terminal className="size-5 text-blue-600" />
            {t("guide.sdkTitle")}
          </CardTitle>
          <CardDescription>{t("guide.sdkDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="curl" className="w-full">
            <TabsList className="mb-4 w-full justify-start">
              <TabsTrigger value="curl">cURL</TabsTrigger>
              <TabsTrigger value="node">Node.js</TabsTrigger>
              <TabsTrigger value="php">PHP</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
              <TabsTrigger value="laravel">Laravel</TabsTrigger>
              <TabsTrigger value="symfony">Symfony</TabsTrigger>
            </TabsList>

            <TabsContent value="curl" className="space-y-4">
              <div>
                <h4 className="mb-2 text-sm font-semibold">{t("guide.simpleCheckin")}</h4>
                <CodeBlock
                  language="bash"
                  code={`# Simple check-in (auto-creates monitor if it doesn't exist)
curl -X POST https://api.errorwatch.io/api/v1/cron/checkin \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ew_live_your_api_key" \\
  -d '{"monitor_slug": "daily-backup", "status": "ok"}'`}
                />
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold">{t("guide.wrappingJob")}</h4>
                <CodeBlock
                  language="bash"
                  code={`# Start: mark as in_progress
CHECKIN_ID=$(curl -s -X POST https://api.errorwatch.io/api/v1/cron/checkin \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ew_live_your_api_key" \\
  -d '{"monitor_slug": "daily-backup", "status": "in_progress"}' \\
  | jq -r '.checkinId')

# Run your actual job
./my-backup-script.sh

# Finish: mark as ok or error
curl -X POST https://api.errorwatch.io/api/v1/cron/checkin \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ew_live_your_api_key" \\
  -d "{\\"monitor_slug\\": \\"daily-backup\\", \\"status\\": \\"ok\\", \\"checkin_id\\": \\"$CHECKIN_ID\\"}"
`}
                />
              </div>
            </TabsContent>

            <TabsContent value="node" className="space-y-4">
              <div>
                <h4 className="mb-2 text-sm font-semibold">{t("guide.simpleCheckin")}</h4>
                <CodeBlock
                  language="TypeScript"
                  code={`const API_URL = "https://api.errorwatch.io/api/v1/cron/checkin";
const API_KEY = process.env.ERRORWATCH_API_KEY;

// Simple check-in
await fetch(API_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY,
  },
  body: JSON.stringify({
    monitor_slug: "daily-backup",
    status: "ok",
  }),
});`}
                />
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold">{t("guide.wrappingJob")}</h4>
                <CodeBlock
                  language="TypeScript"
                  code={`async function withCronMonitor(slug: string, fn: () => Promise<void>) {
  const API_URL = "https://api.errorwatch.io/api/v1/cron/checkin";
  const API_KEY = process.env.ERRORWATCH_API_KEY!;

  // Start
  const startRes = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
    body: JSON.stringify({ monitor_slug: slug, status: "in_progress" }),
  });
  const { checkinId } = await startRes.json();
  const startTime = Date.now();

  try {
    await fn();

    // Success
    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
      body: JSON.stringify({
        monitor_slug: slug,
        status: "ok",
        checkin_id: checkinId,
        duration: Date.now() - startTime,
      }),
    });
  } catch (error) {
    // Error
    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
      body: JSON.stringify({
        monitor_slug: slug,
        status: "error",
        checkin_id: checkinId,
        duration: Date.now() - startTime,
        payload: { error: String(error) },
      }),
    });
    throw error;
  }
}

// Usage
await withCronMonitor("daily-backup", async () => {
  await runDailyBackup();
});`}
                />
              </div>
            </TabsContent>

            <TabsContent value="php" className="space-y-4">
              <CodeBlock
                language="PHP"
                code={`<?php
$apiUrl = 'https://api.errorwatch.io/api/v1/cron/checkin';
$apiKey = getenv('ERRORWATCH_API_KEY');

function cronCheckin(string $slug, string $status, ?string $checkinId = null): ?string {
    global $apiUrl, $apiKey;

    $payload = ['monitor_slug' => $slug, 'status' => $status];
    if ($checkinId) $payload['checkin_id'] = $checkinId;

    $ch = curl_init($apiUrl);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'X-API-Key: ' . $apiKey,
        ],
        CURLOPT_POSTFIELDS => json_encode($payload),
    ]);
    $response = json_decode(curl_exec($ch), true);
    curl_close($ch);

    return $response['checkinId'] ?? null;
}

// Wrap your cron job
$checkinId = cronCheckin('daily-report', 'in_progress');
$start = microtime(true);

try {
    generateDailyReport();
    cronCheckin('daily-report', 'ok', $checkinId);
} catch (Throwable $e) {
    cronCheckin('daily-report', 'error', $checkinId);
    throw $e;
}`}
              />
            </TabsContent>

            <TabsContent value="python" className="space-y-4">
              <CodeBlock
                language="Python"
                code={`import os, time, requests
from functools import wraps

API_URL = "https://api.errorwatch.io/api/v1/cron/checkin"
API_KEY = os.environ["ERRORWATCH_API_KEY"]

def cron_monitor(slug: str):
    """Decorator to monitor a cron job."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            headers = {"Content-Type": "application/json", "X-API-Key": API_KEY}

            # Start
            res = requests.post(API_URL, json={
                "monitor_slug": slug, "status": "in_progress"
            }, headers=headers)
            checkin_id = res.json().get("checkinId")
            start = time.time()

            try:
                result = func(*args, **kwargs)
                # Success
                requests.post(API_URL, json={
                    "monitor_slug": slug, "status": "ok",
                    "checkin_id": checkin_id,
                    "duration": int((time.time() - start) * 1000),
                }, headers=headers)
                return result
            except Exception as e:
                # Error
                requests.post(API_URL, json={
                    "monitor_slug": slug, "status": "error",
                    "checkin_id": checkin_id,
                    "duration": int((time.time() - start) * 1000),
                    "payload": {"error": str(e)},
                }, headers=headers)
                raise
        return wrapper
    return decorator

# Usage
@cron_monitor("daily-backup")
def run_daily_backup():
    ...`}
              />
            </TabsContent>

            <TabsContent value="laravel" className="space-y-4">
              <CodeBlock
                language="PHP (Laravel)"
                code={`<?php
// app/Console/Commands/DailyBackup.php

namespace App\\Console\\Commands;

use Illuminate\\Console\\Command;
use Illuminate\\Support\\Facades\\Http;

class DailyBackup extends Command
{
    protected $signature = 'backup:daily';

    public function handle(): int
    {
        $apiUrl = config('services.errorwatch.url') . '/api/v1/cron/checkin';
        $apiKey = config('services.errorwatch.api_key');

        // Start monitoring
        $response = Http::withHeaders(['X-API-Key' => $apiKey])
            ->post($apiUrl, [
                'monitor_slug' => 'daily-backup',
                'status' => 'in_progress',
            ]);
        $checkinId = $response->json('checkinId');
        $start = now();

        try {
            // Your job logic here
            $this->performBackup();

            // Report success
            Http::withHeaders(['X-API-Key' => $apiKey])
                ->post($apiUrl, [
                    'monitor_slug' => 'daily-backup',
                    'status' => 'ok',
                    'checkin_id' => $checkinId,
                    'duration' => $start->diffInMilliseconds(now()),
                ]);

            return Command::SUCCESS;
        } catch (\\Throwable $e) {
            // Report error
            Http::withHeaders(['X-API-Key' => $apiKey])
                ->post($apiUrl, [
                    'monitor_slug' => 'daily-backup',
                    'status' => 'error',
                    'checkin_id' => $checkinId,
                    'duration' => $start->diffInMilliseconds(now()),
                    'payload' => ['error' => $e->getMessage()],
                ]);

            throw $e;
        }
    }
}

// config/services.php
'errorwatch' => [
    'url' => env('ERRORWATCH_API_URL', 'https://api.errorwatch.io'),
    'api_key' => env('ERRORWATCH_API_KEY'),
],

// app/Console/Kernel.php
$schedule->command('backup:daily')->dailyAt('02:00');`}
              />
            </TabsContent>

            <TabsContent value="symfony" className="space-y-4">
              <CodeBlock
                language="PHP (Symfony)"
                code={`<?php
// src/Command/DailyBackupCommand.php

namespace App\\Command;

use Symfony\\Component\\Console\\Attribute\\AsCommand;
use Symfony\\Component\\Console\\Command\\Command;
use Symfony\\Component\\Console\\Input\\InputInterface;
use Symfony\\Component\\Console\\Output\\OutputInterface;
use Symfony\\Contracts\\HttpClient\\HttpClientInterface;

#[AsCommand(name: 'app:backup:daily')]
class DailyBackupCommand extends Command
{
    public function __construct(
        private HttpClientInterface $httpClient,
        private string $errorwatchUrl,
        private string $errorwatchApiKey,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $apiUrl = $this->errorwatchUrl . '/api/v1/cron/checkin';

        // Start monitoring
        $response = $this->httpClient->request('POST', $apiUrl, [
            'headers' => ['X-API-Key' => $this->errorwatchApiKey],
            'json' => [
                'monitor_slug' => 'daily-backup',
                'status' => 'in_progress',
            ],
        ]);
        $checkinId = $response->toArray()['checkinId'];
        $start = microtime(true);

        try {
            $this->performBackup();

            // Report success
            $this->httpClient->request('POST', $apiUrl, [
                'headers' => ['X-API-Key' => $this->errorwatchApiKey],
                'json' => [
                    'monitor_slug' => 'daily-backup',
                    'status' => 'ok',
                    'checkin_id' => $checkinId,
                    'duration' => (int)((microtime(true) - $start) * 1000),
                ],
            ]);

            return Command::SUCCESS;
        } catch (\\Throwable $e) {
            // Report error
            $this->httpClient->request('POST', $apiUrl, [
                'headers' => ['X-API-Key' => $this->errorwatchApiKey],
                'json' => [
                    'monitor_slug' => 'daily-backup',
                    'status' => 'error',
                    'checkin_id' => $checkinId,
                    'duration' => (int)((microtime(true) - $start) * 1000),
                    'payload' => ['error' => $e->getMessage()],
                ],
            ]);

            throw $e;
        }
    }
}

# crontab
# 0 2 * * * cd /var/www && php bin/console app:backup:daily`}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Key Concepts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="size-4 text-amber-500" />
              {t("guide.autoCreateTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t("guide.autoCreateDescription")}</p>
            <CodeBlock
              language="bash"
              code={`# First call auto-creates the "daily-backup" monitor
curl -X POST .../api/v1/cron/checkin \\
  -H "X-API-Key: ew_live_..." \\
  -d '{"monitor_slug": "daily-backup", "status": "ok"}'`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-red-500" />
              {t("guide.missedDetectionTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">{t("guide.missedDetectionDescription")}</p>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-medium">{t("guide.example")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("guide.missedExample")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* API Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="size-4 text-violet-600" />
            {t("guide.apiReferenceTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="mb-1 text-sm font-semibold">POST /api/v1/cron/checkin</h4>
              <p className="mb-2 text-xs text-muted-foreground">{t("guide.apiCheckinDescription")}</p>
              <CodeBlock
                language="JSON"
                code={`{
  "monitor_slug": "daily-backup",    // Required: unique identifier
  "status": "ok",                    // Required: "in_progress" | "ok" | "error"
  "checkin_id": "abc-123",           // Optional: correlate start/finish
  "duration": 4523,                  // Optional: execution time in ms
  "env": "production",              // Optional: environment tag
  "payload": { "rows": 1500 }       // Optional: custom metadata
}`}
              />
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <h4 className="mb-2 text-sm font-semibold">{t("guide.apiResponseTitle")}</h4>
              <CodeBlock
                language="JSON"
                code={`{
  "success": true,
  "checkinId": "550e8400-e29b-41d4-a716-446655440000"
}`}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <Card className="border-violet-500/20 bg-gradient-to-r from-violet-500/5 to-purple-500/5">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <h3 className="text-lg font-bold">{t("guide.readyTitle")}</h3>
          <p className="text-sm text-muted-foreground">{t("guide.readyDescription")}</p>
          <Button onClick={onCreateClick} size="lg" className="gap-2">
            <Plus className="size-4" />
            {t("guide.createFirstMonitor")}
            <ArrowRight className="size-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
