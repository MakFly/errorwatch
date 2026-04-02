"use client";

import { useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Building2,
  UserPlus,
  Check,
  AlertTriangle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { signIn, useSession } from "@/lib/auth-client";

interface InviteInfo {
  organizationName: string;
  organizationSlug: string;
  role: string;
  email: string;
  expiresAt: Date;
  hasAccount: boolean;
}

export function InviteClient() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;
  const { data: session, isPending: sessionLoading } = useSession();
  const t = useTranslations("onboarding.invite");

  const [isAccepting, setIsAccepting] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [success, setSuccess] = useState(false);

  const checkInviteQuery = trpc.members.checkInvite.useQuery(
    { token },
    { enabled: !!token }
  );
  const acceptMutation = trpc.members.acceptInvite.useMutation();
  const redeemMutation = trpc.members.redeemInvite.useMutation();

  const inviteInfo = useMemo<InviteInfo | null>(() => {
    const data = checkInviteQuery.data;
    if (
      data?.valid &&
      data.organizationName &&
      data.organizationSlug &&
      data.email &&
      data.role &&
      data.expiresAt &&
      typeof data.hasAccount === "boolean"
    ) {
      return {
        organizationName: data.organizationName,
        organizationSlug: data.organizationSlug,
        email: data.email,
        role: data.role,
        expiresAt: data.expiresAt,
        hasAccount: data.hasAccount,
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

  const handleRedeem = async (event: React.FormEvent) => {
    event.preventDefault();

    if (password.length < 8) {
      setRedeemError(t("passwordTooShort"));
      return;
    }

    setIsRedeeming(true);
    setRedeemError(null);

    try {
      await redeemMutation.mutateAsync({ token, name, password });
      await signIn.email(
        { email: inviteInfo?.email ?? "", password },
        {
          onSuccess: () => {
            window.location.href = "/dashboard";
          },
          onError: (error) => {
            setRedeemError(error instanceof Error ? error.message : t("loginAfterRedeemFailed"));
            setIsRedeeming(false);
          },
        }
      );
    } catch (error) {
      setRedeemError(error instanceof Error ? error.message : t("failedToRedeem"));
      setIsRedeeming(false);
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

              {(error || redeemError) && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  {error ?? redeemError}
                </div>
              )}

              {!session ? (
                <div className="space-y-3">
                  {inviteInfo?.hasAccount ? (
                    <>
                      <p className="text-center text-sm text-muted-foreground">
                        {t("pleaseSignIn")}
                      </p>
                      <Link href={`/login?redirect=/invite/${token}`}>
                        <Button variant="outline" className="w-full h-11">
                          {t("signIn")}
                        </Button>
                      </Link>
                    </>
                  ) : (
                    <form onSubmit={handleRedeem} className="space-y-3">
                      <p className="text-center text-sm text-muted-foreground">
                        {t("activateAccount")}
                      </p>
                      <div className="space-y-2">
                        <label htmlFor="invite-name" className="text-sm font-medium">
                          {t("nameLabel")}
                        </label>
                        <Input
                          id="invite-name"
                          type="text"
                          autoComplete="name"
                          placeholder={t("namePlaceholder")}
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          required
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="invite-password" className="text-sm font-medium">
                          {t("passwordLabel")}
                        </label>
                        <Input
                          id="invite-password"
                          type="password"
                          autoComplete="new-password"
                          placeholder={t("passwordPlaceholder")}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          required
                          className="h-11"
                        />
                      </div>
                      <Button type="submit" disabled={isRedeeming} className="w-full h-11 gap-2">
                        {isRedeeming ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t("redeemingButton")}
                          </>
                        ) : (
                          <>
                            {t("activateButton")}
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </form>
                  )}
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
