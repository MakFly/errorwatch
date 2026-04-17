"use client";

import { useState } from "react";
import { Layers, Plus, ArrowRight, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { trpc } from "@/lib/trpc/client";
import { useRouter } from "next/navigation";

export function NoProjectDashboard() {
  const t = useTranslations("noProject");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const router = useRouter();
  const { data: organizations } = trpc.organizations.getAll.useQuery();

  const handleProjectCreated = () => {
    // Refresh the page to redirect to the new project
    router.refresh();
  };

  const hasOrganization = organizations && organizations.length > 0;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-8 text-center">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 backdrop-blur-sm">
              <Layers className="h-12 w-12 text-violet-400" />
            </div>
            <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 shadow-lg">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            {hasOrganization
              ? t("descriptionWithOrg")
              : t("descriptionWithoutOrg")}
          </p>
        </div>

        {/* Action card */}
        <div className="rounded-2xl border border-border/50 bg-card/50 p-6 text-left space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white">
              <Plus className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">{t("createProjectTitle")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("createProjectDescription")}
              </p>
            </div>
          </div>

          <div className="border-t border-border/50 pt-4 space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>{t("featureAlerts")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>{t("featureStackTraces")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>{t("featureFrameworks")}</span>
            </div>
          </div>
        </div>

        {/* CTA */}
        {hasOrganization ? (
          <Button
            size="lg"
            className="w-full h-12 gap-2"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="h-4 w-4" />
            {t("createFirstProject")}
          </Button>
        ) : (
          <Button
            size="lg"
            className="w-full h-12 gap-2"
            onClick={() => router.push("/onboarding")}
          >
            {t("completeOnboarding")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      <CreateProjectDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={handleProjectCreated}
      />
    </div>
  );
}
