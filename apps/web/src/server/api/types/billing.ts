export type PlanType = "free" | "pro" | "team" | "enterprise";
export type PaidPlanType = Exclude<PlanType, "free">;

export type QuotaStatus = {
  used: number;
  limit: number;
  percentage: number;
  exceeded: boolean;
  remaining: number;
};

export type BillingSummary = {
  plan: PlanType;
  billingEnabled: boolean;
  selfHosted: boolean;
  quotas: {
    eventsPerMonth: number;
    retentionDays: number;
    projects: number;
    users: number;
  };
  projectCount: number;
  usage: QuotaStatus | null;
  billing: {
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    stripeStatus: string | null;
    stripeCurrentPeriodEnd: Date | null;
  };
};

