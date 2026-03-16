"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  Key,
  Copy,
  Check,
  RefreshCw,
  User,
  Shield,
  Monitor,
  Smartphone,
  LogOut,
  AlertTriangle,
  Trash2,
  Building2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { useCurrentProject } from "@/contexts/ProjectContext";
import { useCurrentOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export function GeneralSection() {
  const router = useRouter();

  // Project state
  const [projectName, setProjectName] = useState("");
  const [dsn, setDsn] = useState("http://localhost:3333");
  const [timezone, setTimezone] = useState("UTC");
  const [copied, setCopied] = useState(false);
  const [deleteProjectDialogOpen, setDeleteProjectDialogOpen] = useState(false);

  // Organization state
  const [deleteOrgDialogOpen, setDeleteOrgDialogOpen] = useState(false);
  const [deleteOrgConfirmText, setDeleteOrgConfirmText] = useState("");

  // Profile state
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [revokeSessionId, setRevokeSessionId] = useState<string | null>(null);
  const [revokeAllDialogOpen, setRevokeAllDialogOpen] = useState(false);

  // Project queries
  const { currentProjectId, refetchProjects } = useCurrentProject();
  const { currentOrgSlug, currentOrgId, currentOrganization, refetch: refetchOrgs } = useCurrentOrganization();
  const { data: projects } = trpc.projects.getAll.useQuery();
  const { data: projectSettings, refetch: refetchSettings } = trpc.projectSettings.get.useQuery(
    { projectId: currentProjectId! },
    { enabled: !!currentProjectId }
  );

  // Profile queries
  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = trpc.user.getProfile.useQuery();
  const { data: sessions, isLoading: sessionsLoading, refetch: refetchSessions } = trpc.user.getSessions.useQuery();
  const { data: passwordInfo } = trpc.user.canChangePassword.useQuery();

  // Mutations
  const updateProjectMutation = trpc.projects.update.useMutation({ onSuccess: () => refetchProjects() });
  const updateSettingsMutation = trpc.projectSettings.update.useMutation({ onSuccess: () => refetchSettings() });
  const deleteProjectMutation = trpc.projects.delete.useMutation({
    onSuccess: () => {
      toast.success("Project deleted");
      refetchProjects();
      // Navigate to org dashboard (will show empty state or redirect to another project)
      router.push(`/dashboard/${currentOrgSlug}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete project");
    },
  });
  const updateProfileMutation = trpc.user.updateProfile.useMutation({
    onSuccess: () => refetchProfile(),
  });
  const revokeSessionMutation = trpc.user.revokeSession.useMutation({
    onSuccess: () => {
      refetchSessions();
      setRevokeSessionId(null);
      toast.success("Session revoked");
    },
  });
  const revokeAllSessionsMutation = trpc.user.revokeAllSessions.useMutation({
    onSuccess: (result) => {
      refetchSessions();
      setRevokeAllDialogOpen(false);
      toast.success(`${result.count} session(s) revoked`);
    },
  });
  const deleteOrgMutation = trpc.organizations.delete.useMutation({
    onSuccess: () => {
      toast.success("Organization deleted");
      refetchOrgs();
      // Navigate to dashboard root - will redirect to another org or onboarding
      router.push("/dashboard");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete organization");
    },
  });

  const currentProject = projects?.find((p) => p.id === currentProjectId);

  // Sync project data
  useEffect(() => {
    if (currentProject) setProjectName(currentProject.name);
  }, [currentProject]);

  useEffect(() => {
    if (projectSettings) setTimezone(projectSettings.timezone);
  }, [projectSettings]);

  // Sync profile data
  useEffect(() => {
    if (profile) setName(profile.name || "");
  }, [profile]);

  const copyDsn = () => {
    navigator.clipboard.writeText(dsn);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("DSN copied to clipboard");
  };

  const saveAllSettings = async () => {
    if (!currentProjectId || !currentProject) return;
    setSaving(true);
    try {
      const promises: Promise<unknown>[] = [];

      // Save project settings
      if (projectName !== currentProject.name) {
        promises.push(updateProjectMutation.mutateAsync({ id: currentProjectId, name: projectName }));
      }
      promises.push(updateSettingsMutation.mutateAsync({ projectId: currentProjectId, timezone }));

      // Save profile
      if (name.trim() !== (profile?.name || "")) {
        promises.push(updateProfileMutation.mutateAsync({ name: name.trim() || undefined }));
      }

      await Promise.all(promises);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const getDeviceIcon = (userAgent: string | null) => {
    if (!userAgent) return Monitor;
    const ua = userAgent.toLowerCase();
    if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
      return Smartphone;
    }
    return Monitor;
  };

  const timezones = [
    { value: "UTC", label: "UTC" },
    { value: "Europe/Paris", label: "Europe/Paris" },
    { value: "Europe/London", label: "Europe/London" },
    { value: "America/New_York", label: "America/New_York" },
    { value: "America/Los_Angeles", label: "America/Los_Angeles" },
    { value: "Asia/Tokyo", label: "Asia/Tokyo" },
  ];

  const isLoading = !projects || !projectSettings || profileLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-gradient-to-t from-primary/5 to-card">
              <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Section 1: Project & Profile */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Project Configuration */}
        <Card className="bg-gradient-to-t from-primary/5 to-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Project
            </CardTitle>
            <CardDescription>Project configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="projectName">Project Name</Label>
              <Input
                id="projectName"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="My App"
              />
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Profile */}
        <Card className="bg-gradient-to-t from-primary/5 to-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Profile
            </CardTitle>
            <CardDescription>Your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="email"
                  value={profile?.email || ""}
                  disabled
                  className="bg-muted/50"
                />
                {profile?.emailVerified && (
                  <Badge variant="default" className="shrink-0">
                    <Check className="mr-1 h-3 w-3" />
                    Verified
                  </Badge>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section 2: Integration & Security */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* DSN Configuration */}
        <Card className="bg-gradient-to-t from-primary/5 to-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              DSN
            </CardTitle>
            <CardDescription>Endpoint for error reporting</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dsn">Monitoring Server URL</Label>
              <div className="flex gap-2">
                <Input
                  id="dsn"
                  value={dsn}
                  onChange={(e) => setDsn(e.target.value)}
                  placeholder="https://your-server.com"
                  className="font-mono text-sm"
                />
                <Button variant="outline" size="icon" onClick={copyDsn}>
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 font-mono text-xs">
              <p className="text-muted-foreground mb-1"># Symfony config</p>
              <p>error_monitoring:</p>
              <p className="pl-4">dsn: &apos;{dsn}&apos;</p>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="bg-gradient-to-t from-primary/5 to-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Security
            </CardTitle>
            <CardDescription>Authentication settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {passwordInfo?.hasPassword ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Password</span>
                  </div>
                  <Badge variant="secondary">Set</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Password authentication enabled
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-amber-500/10 p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-amber-500">OAuth only</p>
                    <p className="text-xs text-muted-foreground">
                      Using Google, GitHub, etc.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active Sessions */}
      <Card className="bg-gradient-to-t from-primary/5 to-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-primary" />
                Active Sessions
              </CardTitle>
              <CardDescription>Manage your login sessions</CardDescription>
            </div>
            {sessions && sessions.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRevokeAllDialogOpen(true)}
                disabled={revokeAllSessionsMutation.isPending}
              >
                {revokeAllSessionsMutation.isPending ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="mr-2 h-4 w-4" />
                )}
                Revoke All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : sessions && sessions.length > 0 ? (
            <div className="space-y-2">
              {sessions.map((session) => {
                const DeviceIcon = getDeviceIcon(session.userAgent);
                const isExpired = new Date(session.expiresAt) < new Date();

                return (
                  <div
                    key={session.id}
                    className="flex items-center justify-between rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <DeviceIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{session.ipAddress || "Unknown IP"}</p>
                          {isExpired && <Badge variant="destructive" className="text-xs">Expired</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setRevokeSessionId(session.id)}
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">No active sessions</p>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={saveAllSettings} disabled={saving}>
          {saving && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>

      {/* Section 4: Danger Zone */}
      <Card className="border-destructive/30 bg-gradient-to-t from-destructive/5 to-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>Irreversible and destructive actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Delete Project */}
            <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Delete Project</p>
                <p className="text-xs text-muted-foreground">
                  Delete <strong>{currentProject?.name}</strong> and all its data
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteProjectDialogOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>

            {/* Delete Organization */}
            <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Delete Organization</p>
                <p className="text-xs text-muted-foreground">
                  Delete <strong>{currentOrganization?.name}</strong> and all projects
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setDeleteOrgConfirmText("");
                  setDeleteOrgDialogOpen(true);
                }}
              >
                <Building2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revoke Session Dialog */}
      <AlertDialog open={!!revokeSessionId} onOpenChange={(open) => !open && setRevokeSessionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will log out this device immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revokeSessionId && revokeSessionMutation.mutate({ sessionId: revokeSessionId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke All Sessions Dialog */}
      <AlertDialog open={revokeAllDialogOpen} onOpenChange={setRevokeAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke All Sessions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will log out all devices except your current one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revokeAllSessionsMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Project Dialog */}
      <AlertDialog open={deleteProjectDialogOpen} onOpenChange={setDeleteProjectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{currentProject?.name}</strong> and all its data including errors, events, and replays. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => currentProjectId && deleteProjectMutation.mutate({ id: currentProjectId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteProjectMutation.isPending}
            >
              {deleteProjectMutation.isPending ? "Deleting..." : "Delete Project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Organization Dialog */}
      <AlertDialog open={deleteOrgDialogOpen} onOpenChange={(open) => {
        setDeleteOrgDialogOpen(open);
        if (!open) setDeleteOrgConfirmText("");
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete Organization?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the organization <strong>{currentOrganization?.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 space-y-4">
            <div className="rounded-lg bg-destructive/10 p-3 text-sm space-y-2">
              <p className="font-medium text-destructive">This will delete:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>All projects ({projects?.length || 0} project{(projects?.length || 0) !== 1 ? "s" : ""})</li>
                <li>All error events and groups</li>
                <li>All session replays</li>
                <li>All settings and configurations</li>
                <li>All team members will lose access</li>
              </ul>
              <p className="font-medium text-destructive pt-2">This action cannot be undone.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-org-name" className="text-sm text-muted-foreground">
                Type <strong>{currentOrganization?.name}</strong> to confirm
              </Label>
              <Input
                id="confirm-org-name"
                value={deleteOrgConfirmText}
                onChange={(e) => setDeleteOrgConfirmText(e.target.value)}
                placeholder={currentOrganization?.name || ""}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => currentOrgId && deleteOrgMutation.mutate({ id: currentOrgId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteOrgMutation.isPending || deleteOrgConfirmText !== currentOrganization?.name}
            >
              {deleteOrgMutation.isPending ? "Deleting..." : "Delete Organization"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
