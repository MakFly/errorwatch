"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { api } from "@/server/api";
import {
  FolderKanban,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  Activity,
  Bug,
  Clock,
} from "lucide-react";

function PlaceholderStatCard({
  title,
  icon,
  color,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    red: "bg-red-500/10 text-red-400",
    amber: "bg-amber-500/10 text-amber-400",
    emerald: "bg-emerald-500/10 text-emerald-400",
    violet: "bg-violet-500/10 text-violet-400",
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-card/80 to-card/40 p-6">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-amber-500/10 to-amber-500/5" />
      <div className="relative">
        <div className="mb-4 flex items-center gap-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colorClasses[color]}`}>
            {icon}
          </div>
          <div className="flex-1">
            <div className="h-8 w-16 rounded bg-muted/50" />
            <p className="mt-1 text-sm text-muted-foreground">{title}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlaceholderChart() {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/30 p-6">
      <div className="mb-4">
        <div className="h-5 w-32 rounded bg-muted/50" />
        <div className="mt-1 h-4 w-48 rounded bg-muted/30" />
      </div>
      <div className="h-64 flex items-end gap-2 px-4">
        {[40, 65, 45, 80, 55, 70, 50, 85, 60, 75, 45, 90].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-gradient-to-t from-violet-500/20 to-violet-500/5"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function PlaceholderErrorList() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-border/50 bg-card/30 p-4"
        >
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-red-500/10" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-muted/50" />
              <div className="h-3 w-1/2 rounded bg-muted/30" />
            </div>
            <div className="h-6 w-16 rounded-full bg-muted/30" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PlaceholderDashboard() {
  const t = useTranslations("placeholderDashboard");
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.organizations.getAll().then((organizations) => {
      if (organizations.length > 0) {
        // L'utilisateur a des organisations, rediriger vers la première
        router.replace(`/dashboard/${organizations[0].slug}`);
      } else {
        // Pas d'organisation, afficher le placeholder
        setIsLoading(false);
      }
    }).catch(() => {
      setIsLoading(false);
    });
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
          <p className="text-sm text-muted-foreground">{t("loadingDashboard")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* Disabled mock dashboard */}
      <div className="pointer-events-none select-none opacity-30 blur-[1px] lg:ml-64 p-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">{t("dashboardTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("dashboardOverview")}
          </p>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PlaceholderStatCard
            icon={<AlertTriangle className="h-6 w-6" />}
            title={t("statUnresolved")}
            color="red"
          />
          <PlaceholderStatCard
            icon={<Activity className="h-6 w-6" />}
            title={t("statEventsToday")}
            color="violet"
          />
          <PlaceholderStatCard
            icon={<Bug className="h-6 w-6" />}
            title={t("statNewIssues")}
            color="amber"
          />
          <PlaceholderStatCard
            icon={<Clock className="h-6 w-6" />}
            title={t("statAvgResponse")}
            color="emerald"
          />
        </div>

        {/* Chart */}
        <div className="mb-8">
          <PlaceholderChart />
        </div>

        {/* Error list */}
        <div>
          <div className="mb-4">
            <h2 className="text-lg font-semibold">{t("recentErrorsTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("recentErrorsDescription")}
            </p>
          </div>
          <PlaceholderErrorList />
        </div>
      </div>

      {/* Overlay with CTA */}
      <div className="fixed inset-0 lg:left-64 flex items-center justify-center bg-background/60 backdrop-blur-sm z-10">
        <div className="w-full max-w-md space-y-6 rounded-2xl border border-border/50 bg-card/95 p-8 text-center shadow-2xl mx-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20">
            <FolderKanban className="h-8 w-8 text-violet-400" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">{t("overlayTitle")}</h2>
            <p className="text-muted-foreground">
              {t("overlayDescription")}
            </p>
          </div>

          <Button asChild className="w-full h-11 gap-2">
            <Link href="/onboarding">
              <Sparkles className="h-4 w-4" />
              {t("completeSetup")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
