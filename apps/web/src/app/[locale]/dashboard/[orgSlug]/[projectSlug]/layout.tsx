import { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDashboardCollections, getDashboardOrganization, getDashboardProject } from "../../dashboard-data";
import { ProjectDashboardShell } from "./project-shell";

interface ProjectLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string; orgSlug: string; projectSlug: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return { title: t("dashboard") };
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
