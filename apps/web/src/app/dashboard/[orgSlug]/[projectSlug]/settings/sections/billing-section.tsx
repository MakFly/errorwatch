"use client";

import React from "react";
import { Crown, Database, RefreshCw } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc/client";
import { useCurrentProject } from "@/contexts/ProjectContext";
import { toast } from "sonner";

export function BillingSection() {
  const { currentProjectId } = useCurrentProject();
  const { data: billingSummary, isLoading } = trpc.billing.getSummary.useQuery(
    { projectId: currentProjectId || undefined },
    { enabled: true }
  );

  const createCheckoutMutation = trpc.billing.createCheckout.useMutation();
  const createPortalMutation = trpc.billing.createPortal.useMutation();

  const handleUpgrade = async () => {
    try {
      const result = await createCheckoutMutation.mutateAsync({ plan: "pro" });
      if (result?.url) window.location.href = result.url;
      else toast.error("Checkout unavailable");
    } catch {
      toast.error("Failed to start checkout");
    }
  };

  const handleManageBilling = async () => {
    try {
      const result = await createPortalMutation.mutateAsync();
      if (result?.url) window.location.href = result.url;
      else toast.error("Portal unavailable");
    } catch {
      toast.error("Failed to open portal");
    }
  };

  const plan = billingSummary?.plan || "free";
  const usage = billingSummary?.usage;
  const quotas = billingSummary?.quotas;
  const selfHosted = billingSummary?.selfHosted ?? false;
  const isPaidPlan = plan !== "free";
  const hasBillingCustomer = !!billingSummary?.billing?.stripeCustomerId;
  const billingEnabled = billingSummary?.billingEnabled ?? false;
  const usagePercent = usage ? Math.min(100, usage.percentage) : 0;

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-gradient-to-t from-primary/5 to-card">
          <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
          <CardContent><Skeleton className="h-24 w-full" /></CardContent>
        </Card>
        <Card className="bg-gradient-to-t from-primary/5 to-card">
          <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
          <CardContent><Skeleton className="h-24 w-full" /></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="bg-gradient-to-t from-primary/5 to-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            Current Plan
          </CardTitle>
          <CardDescription>Manage your subscription</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold capitalize">{plan}</p>
              <p className="text-sm text-muted-foreground">
                {quotas?.retentionDays || 0} days retention
              </p>
            </div>
            <Badge variant={isPaidPlan ? "default" : "secondary"}>
              {selfHosted ? "Self-Hosted" : isPaidPlan ? "Active" : "Free"}
            </Badge>
          </div>

          <div className="space-y-1 text-sm text-muted-foreground">
            <p>{quotas?.projects === -1 ? "Unlimited" : quotas?.projects} projects</p>
            <p>{quotas?.users === -1 ? "Unlimited" : quotas?.users} users</p>
          </div>

          {selfHosted ? (
            <p className="text-xs text-muted-foreground">
              Self-hosted mode — all features unlocked.
            </p>
          ) : isPaidPlan && hasBillingCustomer ? (
            <Button
              className="w-full"
              variant="outline"
              onClick={handleManageBilling}
              disabled={createPortalMutation.isPending || !billingEnabled}
            >
              {createPortalMutation.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Manage Billing
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={handleUpgrade}
              disabled={createCheckoutMutation.isPending || !billingEnabled}
            >
              {createCheckoutMutation.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Upgrade to Pro
            </Button>
          )}

          {!billingEnabled && !selfHosted && (
            <p className="text-xs text-muted-foreground">
              Stripe not configured. Add keys to enable billing.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-t from-primary/5 to-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Monthly Usage
          </CardTitle>
          <CardDescription>Events tracked this month</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Events</span>
              <span className="font-medium">
                {(usage?.used || 0).toLocaleString()} / {usage?.limit === -1 ? "∞" : (usage?.limit || 0).toLocaleString()}
              </span>
            </div>
            <Progress value={usage?.limit === -1 ? 0 : usagePercent} className="h-2" />
          </div>

          <p className="text-sm text-muted-foreground">
            {usage?.limit === -1
              ? "Unlimited events on your plan"
              : `${Math.max(0, (usage?.limit || 0) - (usage?.used || 0)).toLocaleString()} events remaining`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
