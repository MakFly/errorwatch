"use client";

import { createContext, useContext, ReactNode, useMemo } from "react";
import type { Project } from "@/server/api";
import { trpc } from "@/lib/trpc/client";

interface ProjectContextType {
  currentProjectSlug: string | null;
  currentProjectId: string | null;
  currentProject: Project | null;
  projects: Project[];
  orgProjects: Project[]; // Projects filtered by current org
  isLoading: boolean;
  refetchProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({
  children,
  currentOrgId,
  currentProjectSlug,
  initialProjects,
  initialCurrentProject = null,
}: {
  children: ReactNode;
  currentOrgId: string | null;
  currentProjectSlug: string | null;
  initialProjects?: Project[];
  initialCurrentProject?: Project | null;
}) {
  const {
    data: projects = [],
    isLoading,
    refetch: refetchQuery,
  } = trpc.projects.getAll.useQuery(undefined, {
    initialData: initialProjects,
  });

  const refetchProjects = async () => {
    await refetchQuery();
  };

  const orgProjects = useMemo(() => {
    if (!currentOrgId) return [];
    return projects.filter((project) => project.organizationId === currentOrgId);
  }, [projects, currentOrgId]);

  const currentProject = useMemo(() => {
    if (!currentProjectSlug || !currentOrgId) return null;
    return (
      orgProjects.find((project) => project.slug === currentProjectSlug) ??
      initialCurrentProject
    );
  }, [currentProjectSlug, currentOrgId, initialCurrentProject, orgProjects]);

  const currentProjectId = currentProject?.id || null;

  return (
    <ProjectContext.Provider value={{
      currentProjectSlug,
      currentProjectId,
      currentProject,
      projects,
      orgProjects,
      isLoading,
      refetchProjects,
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useCurrentProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useCurrentProject must be used within ProjectProvider");
  }
  return context;
}
