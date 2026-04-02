"use client";

import { createContext, useContext, ReactNode, useMemo } from "react";
import type { Organization } from "@/server/api";
import { trpc } from "@/lib/trpc/client";

interface OrganizationContextType {
  currentOrgId: string | null;
  currentOrgSlug: string | null;
  currentOrganization: Organization | null;
  organizations: Organization[];
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

type OrganizationProviderProps = {
  children: ReactNode;
  currentOrgSlug: string | null;
  initialOrganizations?: Organization[];
  initialCurrentOrganization?: Organization | null;
};

export function OrganizationProvider({
  children,
  currentOrgSlug,
  initialOrganizations,
  initialCurrentOrganization = null,
}: OrganizationProviderProps) {
  const {
    data: organizations = [],
    isLoading,
    refetch: refetchOrgs,
  } = trpc.organizations.getAll.useQuery(undefined, {
    initialData: initialOrganizations,
  });

  const refetch = async () => {
    await refetchOrgs();
  };

  const currentOrganization = useMemo(() => {
    if (!currentOrgSlug) return null;
    return (
      organizations.find((organization) => organization.slug === currentOrgSlug) ??
      initialCurrentOrganization
    );
  }, [currentOrgSlug, initialCurrentOrganization, organizations]);

  const currentOrgId = currentOrganization?.id || null;

  return (
    <OrganizationContext.Provider value={{ currentOrgId, currentOrgSlug, currentOrganization, organizations, isLoading, refetch }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useCurrentOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error("useCurrentOrganization must be used within OrganizationProvider");
  }
  return context;
}
