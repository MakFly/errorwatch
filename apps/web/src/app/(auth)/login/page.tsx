"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn, useSession } from "@/lib/auth-client";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/server/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Zap, FlaskConical, Github, Bug, Layers, Shield, ArrowRight } from "lucide-react";
import { toast } from "sonner";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

const isDev = process.env.NODE_ENV === "development";

const features = [
  { icon: Bug, text: "Real-time error tracking" },
  { icon: Layers, text: "Stack trace analysis" },
  { icon: Shield, text: "Smart issue grouping" },
];

type DevUser = { email: string; name: string | null };

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState<string | null>(null);
  const [devUsers, setDevUsers] = useState<DevUser[]>([]);
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (isDev) {
      fetch("/api/dev/users")
        .then((r) => r.json())
        .then((data) => (Array.isArray(data) ? setDevUsers(data) : []))
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!isPending && session?.user) {
      router.push("/dashboard");
    }
  }, [session, isPending, router]);

  const handleSSOLogin = async (provider: "github" | "google") => {
    setSsoLoading(provider);
    try {
      const appUrl = typeof window !== "undefined"
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_APP_URL ?? "");
      await signIn.social({
        provider,
        callbackURL: `${appUrl}/dashboard`,
      });
    } catch (error: any) {
      const errorCode = error?.code || error?.message;
      if (errorCode === "PROVIDER_NOT_FOUND" || errorCode?.includes("PROVIDER_NOT_FOUND")) {
        toast.error(`${provider.charAt(0).toUpperCase() + provider.slice(1)} login not configured. Add OAuth credentials to .env`);
      } else {
        toast.error(`${provider} login failed`);
      }
      console.error(`${provider} login failed:`, error);
      setSsoLoading(null);
    }
  };

  const fillDevData = () => {
    setEmail("dev@test.com");
    setPassword("password123");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    await signIn.email(
      { email, password },
      {
        onSuccess: () => {
          window.location.href = "/dashboard";
        },
        onError: (error) => {
          const errorMessage = error instanceof Error ? error.message : "Login failed";
          toast.error(errorMessage);
          setIsLoading(false);
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-6">
              <div className="accent-dot" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                Welcome back
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-3">
              Sign in to ErrorWatch
            </h1>
            <p className="text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-medium text-primary hover:underline">
                Sign up
              </Link>
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {isDev && devUsers.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Dev: Choisir un utilisateur</label>
                <Select
                  onValueChange={(email) => {
                    setEmail(email);
                    setPassword("password123");
                  }}
                  value={email || undefined}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Sélectionner un utilisateur..." />
                  </SelectTrigger>
                  <SelectContent>
                    {devUsers.map((u) => (
                      <SelectItem key={u.email} value={u.email}>
                        {u.name ? `${u.name} (${u.email})` : u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                  Sign in
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
            {isDev && (
              <Button
                type="button"
                variant="outline"
                onClick={fillDevData}
                className="w-full h-12 border-dashed border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
              >
                <FlaskConical className="mr-2 h-4 w-4" />
                Dev: Auto-fill
              </Button>
            )}
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/50" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-4 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSSOLogin("github")}
              disabled={ssoLoading !== null}
              className="h-12 border-border/50 hover:bg-muted/50"
            >
              {ssoLoading === "github" ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Github className="h-5 w-5" />
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSSOLogin("google")}
              disabled={ssoLoading !== null}
              className="h-12 border-border/50 hover:bg-muted/50"
            >
              {ssoLoading === "google" ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <GoogleIcon className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 text-muted-foreground">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="auth-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#auth-grid)" />
          </svg>
        </div>

        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{ background: "hsl(262 83% 58%)" }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full opacity-15 blur-3xl"
          style={{ background: "hsl(280 60% 50%)" }}
        />

        <div className="relative text-center max-w-md animate-fade-in-up animate-delay-200">
          <div className="animate-float">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center animate-pulse-glow">
              <Zap className="h-10 w-10 text-white" />
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-4 mt-8">
            Monitor Errors in Real-Time
          </h2>

          <p className="text-muted-foreground leading-relaxed mb-8">
            Join developers using ErrorWatch to track, debug, and resolve application errors faster.
          </p>

          <div className="space-y-4 text-left">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4 rounded-xl bg-card/50 border border-border/50 transition-all duration-300 hover:bg-card/80 hover:border-violet-500/30 hover:scale-[1.02] animate-fade-in-up"
                style={{ animationDelay: `${300 + index * 100}ms` }}
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center transition-colors group-hover:bg-violet-500/20">
                  <feature.icon className="h-5 w-5 text-violet-400" />
                </div>
                <span className="text-sm font-medium">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  );
}
