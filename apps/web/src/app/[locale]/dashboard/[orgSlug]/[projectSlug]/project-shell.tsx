"use client";

import type { Organization, Project } from "@/server/api";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { ErrorWatchSidebar } from "@/components/errorwatch-sidebar";
import { ErrorWatchHeader } from "@/components/errorwatch-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { SSEProvider } from "@/components/sse-provider";

type ProjectDashboardShellProps = {
  children: React.ReactNode;
  currentOrgSlug: string;
  currentProjectSlug: string;
  organizations: Organization[];
  projects: Project[];
};

export function ProjectDashboardShell({
  children,
  currentOrgSlug,
  currentProjectSlug,
  organizations,
  projects,
}: ProjectDashboardShellProps) {
  const currentOrganization =
    organizations.find((organization) => organization.slug === currentOrgSlug) ?? null;

  const currentProject =
    projects.find(
      (project) =>
        project.organizationId === currentOrganization?.id &&
        project.slug === currentProjectSlug
    ) ?? null;

  return (
    <OrganizationProvider
      currentOrgSlug={currentOrgSlug}
      initialOrganizations={organizations}
      initialCurrentOrganization={currentOrganization}
    >
      <ProjectProvider
        currentProjectSlug={currentProjectSlug}
        currentOrgId={currentOrganization?.id ?? null}
        initialProjects={projects}
        initialCurrentProject={currentProject}
      >
        <SSEProvider>
          <SidebarProvider>
            <ErrorWatchSidebar variant="inset" />
            <SidebarInset>
              <ErrorWatchHeader />
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="@container/main flex min-w-0 flex-1 flex-col">
                  {children}
                </div>
              </div>
            </SidebarInset>
          </SidebarProvider>
          <Toaster />
        </SSEProvider>
      </ProjectProvider>
    </OrganizationProvider>
  );
}
