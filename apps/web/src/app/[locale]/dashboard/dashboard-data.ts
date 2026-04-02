import "server-only";

import { cache } from "react";
import type { Organization, Project, Session } from "@/server/api";
import { getServerCaller } from "@/server/trpc/router";

type DashboardCollections = {
  organizations: Organization[];
  projects: Project[];
  session: Session | null;
};

export const getDashboardCollections = cache(async (): Promise<DashboardCollections> => {
  const caller = await getServerCaller();

  const [session, organizations, projects] = await Promise.all([
    caller.auth.getSession(),
    caller.organizations.getAll(),
    caller.projects.getAll(),
  ]);

  return {
    session,
    organizations,
    projects,
  };
});

export const getDashboardOrganization = cache(async (orgSlug: string) => {
  const { organizations } = await getDashboardCollections();
  return organizations.find((organization) => organization.slug === orgSlug) ?? null;
});

export const getDashboardProject = cache(async (orgSlug: string, projectSlug: string) => {
  const { projects } = await getDashboardCollections();
  const organization = await getDashboardOrganization(orgSlug);

  if (!organization) {
    return null;
  }

  return (
    projects.find(
      (project) =>
        project.organizationId === organization.id && project.slug === projectSlug
    ) ?? null
  );
});
