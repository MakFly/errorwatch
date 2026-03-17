import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { ErrorWatchSidebar } from "@/components/errorwatch-sidebar";
import { ErrorWatchHeader } from "@/components/errorwatch-header";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OrganizationProvider>
    <ProjectProvider>
      <SidebarProvider>
        <ErrorWatchSidebar variant="inset" />
        <SidebarInset>
          <ErrorWatchHeader />
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col">
              {children}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </ProjectProvider>
    </OrganizationProvider>
  );
}
