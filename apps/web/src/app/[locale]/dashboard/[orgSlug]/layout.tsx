import { notFound } from "next/navigation";
import { getDashboardOrganization } from "../dashboard-data";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const organization = await getDashboardOrganization(orgSlug);

  if (!organization) {
    notFound();
  }

  return <>{children}</>;
}
