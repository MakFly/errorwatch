"use client";

import { useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Building2,
  UserPlus,
  Check,
  AlertTriangle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useSession } from "@/lib/auth-client";

interface InviteInfo {
  organizationName: string;
  organizationSlug: string;
  role: string;
  email: string;
  expiresAt: Date;
}

export default function InvitePage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;
  const { data: session, isPending: sessionLoading } = useSession();
  const t = useTranslations("onboarding.invite");

  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const checkInviteQuery = trpc.members.checkInvite.useQuery(
    { token },
    { enabled: !!token }
  );
  const acceptMutation = trpc.members.acceptInvite.useMutation();

  const inviteInfo = useMemo<InviteInfo | null>(() => {
    const data = checkInviteQuery.data;
    if (data?.valid && data.organizationName && data.organizationSlug && data.email && data.role && data.expiresAt) {
      return {
        organizationName: data.organizationName,
        organizationSlug: data.organizationSlug,
        email: data.email,
        role: data.role,
        expiresAt: data.expiresAt,
      };
    }
    return null;
  }, [checkInviteQuery.data]);

  const isLoading = checkInviteQuery.isLoading || sessionLoading;
  const error = acceptError
    ?? (checkInviteQuery.data && !checkInviteQuery.data.valid ? (checkInviteQuery.data.error || t("invalidOrExpired")) : null)
    ?? (checkInviteQuery.error ? (checkInviteQuery.error.message || t("invalidOrExpired")) : null);

  const handleAccept = async () => {
    if (!session) {
      router.push(`/login?redirect=/invite/${token}`);
      return;
    }

    setIsAccepting(true);
    setAcceptError(null);

    try {
      await acceptMutation.mutateAsync({ token });
      setSuccess(true);
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (err) {
      setAcceptError(err instanceof Error ? err.message : t("failedToAccept"));
      setIsAccepting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (error && !inviteInfo) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-border/50 bg-card/30 p-6">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">{t("invalidTitle")}</h1>
              <p className="mt-2 text-muted-foreground">
                {error}
              </p>
              <Link href="/login" className="mt-6">
                <Button variant="outline" className="gap-2">
                  {t("goToLogin")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-border/50 bg-card/30 p-6">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10">
                <Check className="h-8 w-8 text-emerald-400" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">{t("successTitle")}</h1>
              <p className="mt-2 text-muted-foreground">
                You&apos;ve successfully joined <strong>{inviteInfo?.organizationName}</strong>
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                {t("redirecting")}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border/50 bg-card/30 p-6">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20">
              <UserPlus className="h-8 w-8 text-violet-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{t("invitedTitle")}</h1>
            <p className="mt-2 text-muted-foreground">
              {t("invitedSubtitle")}
            </p>
          </div>

          {inviteInfo && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{inviteInfo.organizationName}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("roleLabel")} <span className="capitalize">{inviteInfo.role}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-secondary/30 p-3 text-center">
                <p className="text-sm text-muted-foreground">
                  {t("invitationSentTo")} <strong>{inviteInfo.email}</strong>
                </p>
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {!session ? (
                <div className="space-y-3">
                  <p className="text-center text-sm text-muted-foreground">
                    {t("pleaseSignIn")}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Link href={`/login?redirect=/invite/${token}`}>
                      <Button variant="outline" className="w-full h-11">
                        {t("signIn")}
                      </Button>
                    </Link>
                    <Link href={`/signup?redirect=/invite/${token}`}>
                      <Button className="w-full h-11">
                        {t("signUp")}
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={handleAccept}
                  disabled={isAccepting}
                  className="w-full h-11 gap-2"
                >
                  {isAccepting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("acceptingButton")}
                    </>
                  ) : (
                    <>
                      {t("acceptButton")}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
