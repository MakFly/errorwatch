import { notFound, redirect } from "next/navigation";
import { NoProjectDashboard } from "@/components/NoProjectDashboard";
import { getDashboardCollections, getDashboardOrganization } from "../dashboard-data";

type OrgDashboardPageProps = {
  params: Promise<{ orgSlug: string }>;
};

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
