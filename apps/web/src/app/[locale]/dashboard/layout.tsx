import { Suspense } from "react";
import { createSSRHelpers } from "@/server/trpc/router";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

async function PrefetchedDashboard({
  children,
}: {
  children: React.ReactNode;
}) {
  const helpers = await createSSRHelpers();

  await Promise.all([
    helpers.organizations.getAll.prefetch(),
    helpers.projects.getAll.prefetch(),
    helpers.auth.getSession.prefetch(),
    helpers.organizations.canCreate.prefetch(),
    helpers.projects.canCreate.prefetch(),
  ]);

  const dehydratedState = dehydrate(helpers.queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      {children}
    </HydrationBoundary>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense>
      <PrefetchedDashboard>{children}</PrefetchedDashboard>
    </Suspense>
  );
}
