import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { NoProjectDashboard } from "@/components/NoProjectDashboard";
import { getDashboardCollections, getDashboardOrganization } from "../dashboard-data";

type OrgDashboardPageProps = {
  params: Promise<{ locale: string; orgSlug: string }>;
};

export async function generateMetadata({
  params,
}: OrgDashboardPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return { title: t("dashboard") };
}

export default async function OrgDashboardPage({ params }: OrgDashboardPageProps) {
  const { orgSlug } = await params;
  const [organization, { projects }] = await Promise.all([
    getDashboardOrganization(orgSlug),
    getDashboardCollections(),
  ]);

  if (!organization) {
    notFound();
  }

  const orgProjects = projects.filter(
    (project) => project.organizationId === organization.id
  );

  if (orgProjects.length > 0) {
    redirect(`/dashboard/${orgSlug}/${orgProjects[0].slug}`);
  }

  if (orgProjects.length === 0) {
    return <NoProjectDashboard />;
  }

  return null;
}
