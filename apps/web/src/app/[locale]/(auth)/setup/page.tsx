"use client";

import { useEffect, useRef, useState } from "react";
import { signIn, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc/client";
import { ArrowRight, Lock, ServerCog, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function SetupPage() {
  const t = useTranslations("auth.setup");
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();
  const bootstrapMutation = trpc.instance.bootstrap.useMutation();

  const isDev = process.env.NODE_ENV === "development";
  const [name, setName] = useState(isDev ? "Dev Owner" : "");
  const [email, setEmail] = useState(isDev ? "dev@errorwatch.local" : "");
  const [password, setPassword] = useState(isDev ? "devpassword123" : "");
  const [isLoading, setIsLoading] = useState(false);
  const pendingOnboardingRef = useRef(false);

  useEffect(() => {
    if (!sessionPending && session?.user && !pendingOnboardingRef.current) {
      router.replace("/dashboard");
    }
  }, [router, session, sessionPending]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (password.length < 8) {
      toast.error(t("passwordTooShort"));
      return;
    }

    setIsLoading(true);

    try {
      await bootstrapMutation.mutateAsync({ name, email, password });

      pendingOnboardingRef.current = true;
      await signIn.email(
        { email, password },
        {
          onSuccess: () => {
            setIsLoading(false);
            router.replace("/onboarding");
          },
          onError: (error) => {
            pendingOnboardingRef.current = false;
            const errorMessage = error instanceof Error ? error.message : t("loginAfterSetupFailed");
            toast.error(errorMessage);
            setIsLoading(false);
          },
        }
      );
    } catch (error) {
      pendingOnboardingRef.current = false;
      const errorMessage = error instanceof Error ? error.message : t("setupFailed");
      toast.error(errorMessage);
      setIsLoading(false);
    }
  };

  const features = [
    { icon: ServerCog, text: t("feature1") },
    { icon: ShieldCheck, text: t("feature2") },
    { icon: Lock, text: t("feature3") },
  ];

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-6">
              <div className="accent-dot" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                {t("badge")}
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-3">{t("title")}</h1>
            <p className="text-muted-foreground">{t("subtitle")}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                {t("nameLabel")}
              </label>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                placeholder={t("namePlaceholder")}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                {t("emailLabel")}
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                {t("passwordLabel")}
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder={t("passwordPlaceholder")}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="h-12"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 btn-primary-glow text-base font-medium"
            >
              {isLoading ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <>
                  {t("submitButton")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 text-muted-foreground">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="setup-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#setup-grid)" />
          </svg>
        </div>

        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl bg-primary" />
        <div
          className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full opacity-15 blur-3xl"
          style={{ background: "hsl(var(--brand-secondary))" }}
        />

        <div className="relative text-center max-w-md animate-fade-in-up animate-delay-200">
          <div className="animate-float">
            <div className="w-20 h-20 mx-auto rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center animate-pulse-glow">
              <ServerCog className="h-10 w-10 text-primary-foreground" />
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-4 mt-8">{t("panelTitle")}</h2>
          <p className="text-muted-foreground leading-relaxed mb-8">{t("panelSubtitle")}</p>

          <div className="space-y-4 text-left">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4 rounded-lg bg-card/50 border border-border/50 transition-all duration-300 hover:bg-card/80 hover:border-primary/30 hover:scale-[1.02] animate-fade-in-up"
                style={{ animationDelay: `${300 + index * 100}ms` }}
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <span className="text-sm">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
