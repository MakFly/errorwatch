import { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getDashboardCollections, getDashboardOrganization, getDashboardProject } from "../../dashboard-data";
import { ProjectDashboardShell } from "./project-shell";

interface ProjectLayoutProps {
  children: ReactNode;
  params: Promise<{ orgSlug: string; projectSlug: string }>;
}

export default async function ProjectLayout({
  children,
  params,
}: ProjectLayoutProps) {
  const { orgSlug, projectSlug } = await params;
  const [{ organizations, projects }, organization, project] = await Promise.all([
    getDashboardCollections(),
    getDashboardOrganization(orgSlug),
    getDashboardProject(orgSlug, projectSlug),
  ]);

  if (!organization || !project) {
    notFound();
  }

  return (
    <ProjectDashboardShell
      currentOrgSlug={orgSlug}
      currentProjectSlug={projectSlug}
      organizations={organizations}
      projects={projects}
    >
      {children}
    </ProjectDashboardShell>
  );
}
