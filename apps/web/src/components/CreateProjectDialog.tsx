"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FolderKanban, Rocket, RefreshCw, Building2, Layers } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { PlatformSelector } from "./PlatformSelector";
import { useCurrentOrganization } from "@/contexts/OrganizationContext";
import type { Platform } from "@/server/api";
import { useTranslations } from "next-intl";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateProjectDialog({ open, onOpenChange, onSuccess }: CreateProjectDialogProps) {
  const t = useTranslations("project");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [organizationId, setOrganizationId] = useState("");
  const [platform, setPlatform] = useState<Platform | "">("");
  const [error, setError] = useState<string | null>(null);

  const { data: organizations } = trpc.organizations.getAll.useQuery();
  const { currentOrgSlug } = useCurrentOrganization();
  const utils = trpc.useUtils();

  // Get the selected organization name for validation
  const selectedOrgName = useMemo(() => {
    if (!organizations || !organizationId) return "";
    const org = organizations.find(o => o.id === organizationId);
    return org?.name || "";
  }, [organizations, organizationId]);

  // Dynamic Zod schema with org name validation
  const projectSchema = useMemo(() => z.object({
    name: z.string()
      .min(1, t("validationRequired"))
      .max(100, t("validationTooLong"))
      .refine(
        (name) => !selectedOrgName || name.toLowerCase() !== selectedOrgName.toLowerCase(),
        t("validationSameAsOrg")
      ),
    environment: z.enum(["production", "staging", "development"]),
  }), [selectedOrgName, t]);

  type ProjectFormData = z.infer<typeof projectSchema>;

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      environment: "production",
    },
  });

  // Re-validate when org changes
  useEffect(() => {
    if (form.formState.isSubmitted) {
      form.trigger("name");
    }
  }, [selectedOrgName, form]);

  const createMutation = trpc.projects.create.useMutation({
    onSuccess: (data) => {
      form.reset();
      setPlatform("");
      setError(null);
      onOpenChange(false);
      utils.projects.getAll.invalidate();
      utils.projects.canCreate.invalidate();
      toast.success(t("createSuccess"));
      onSuccess?.();
      // Navigate to the new project
      if (currentOrgSlug && data.slug) {
        router.push(`/dashboard/${currentOrgSlug}/${data.slug}`);
      }
    },
    onError: (err) => {
      setError(err.message);
      toast.error(err.message?.slice(0, 100) || tCommon("error"));
    },
  });

  // Auto-select first org if available
  useEffect(() => {
    if (organizations && organizations.length > 0 && !organizationId) {
      setOrganizationId(organizations[0].id);
    }
  }, [organizations, organizationId]);

  const handleSubmit = form.handleSubmit((data) => {
    if (!organizationId || !platform) return;

    setError(null);
    createMutation.mutate({
      name: data.name.trim(),
      organizationId,
      environment: data.environment,
      platform,
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-primary" />
            {t("createTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("createDescription")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Organization Select */}
          {organizations && organizations.length > 1 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {t("organizationLabel")}
              </Label>
              <Select value={organizationId} onValueChange={setOrganizationId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("organizationPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="projectName" className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
              {t("nameLabel")}
            </Label>
            <Input
              id="projectName"
              placeholder={t("namePlaceholder")}
              {...form.register("name")}
              className={form.formState.errors.name ? "border-destructive" : ""}
              autoFocus
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          {/* Environment */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Rocket className="h-4 w-4 text-muted-foreground" />
              {t("environmentLabel")}
            </Label>
            <Select
              value={form.watch("environment")}
              onValueChange={(v) => form.setValue("environment", v as "production" | "staging" | "development")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="production">{t("environmentProduction")}</SelectItem>
                <SelectItem value="staging">{t("environmentStaging")}</SelectItem>
                <SelectItem value="development">{t("environmentDevelopment")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Platform */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              {t("platformLabel")}
            </Label>
            <PlatformSelector value={platform} onChange={setPlatform} />
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={createMutation.isPending || !form.watch("name")?.trim() || !platform}>
              {createMutation.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  {tCommon("creating")}
                </>
              ) : (
                t("createSubmit")
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
