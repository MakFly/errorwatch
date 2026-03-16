"use client";

import { useState, useEffect } from "react";
import { signUp, signIn, useSession } from "@/lib/auth-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/server/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Zap, FlaskConical, Github, Rocket, Users, BarChart3, ArrowRight } from "lucide-react";
import { toast } from "sonner";

// SSO provider icons
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
  { icon: Rocket, text: "Setup in under 5 minutes" },
  { icon: Users, text: "Unlimited team members" },
  { icon: BarChart3, text: "Detailed analytics & insights" },
];

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState<string | null>(null);
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending && session?.user) {
      // Si déjà connecté, rediriger vers /dashboard qui gère la suite
      router.push("/dashboard");
    }
  }, [session, isPending, router]);

  const handleSSOSignup = async (provider: "github" | "google") => {
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
        toast.error(`${provider.charAt(0).toUpperCase() + provider.slice(1)} signup not configured. Add OAuth credentials to .env`);
      } else {
        toast.error(`${provider} signup failed`);
      }
      console.error(`${provider} signup failed:`, error);
      setSsoLoading(null);
    }
  };

  const fillDevData = () => {
    const timestamp = Date.now();
    setName("Dev User");
    setEmail(`dev+${timestamp}@test.com`);
    setPassword("password123");
    setConfirmPassword("password123");
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    await signUp.email(
      { name, email, password },
      {
        onSuccess: () => {
          // Nouvel utilisateur = pas de projet = onboarding
          window.location.href = "/onboarding";
        },
        onError: (error) => {
          const errorMessage = error instanceof Error ? error.message : "Signup failed";
          toast.error(errorMessage);
          setIsLoading(false);
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-fade-in-up">
          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-6">
              <div className="accent-dot" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                Get started
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-3">
              Create your account
            </h1>
            <p className="text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Full name
              </label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-12"
              />
            </div>
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min. 8 chars"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium">
                  Confirm
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="h-12"
                />
              </div>
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
                  Create account
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

          {/* SSO Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/50" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-4 text-muted-foreground">
                Or sign up with
              </span>
            </div>
          </div>

          {/* SSO Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSSOSignup("github")}
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
              onClick={() => handleSSOSignup("google")}
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

      {/* Right side - Visual (desktop only) */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-12 relative overflow-hidden">
        {/* Grid pattern background */}
        <div className="absolute inset-0 opacity-5 text-muted-foreground">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="signup-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#signup-grid)" />
          </svg>
        </div>

        {/* Gradient orbs */}
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{ background: "hsl(262 83% 58%)" }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full opacity-15 blur-3xl"
          style={{ background: "hsl(280 60% 50%)" }}
        />

        {/* Content */}
        <div className="relative text-center max-w-md animate-fade-in-up animate-delay-200">
          {/* Logo with floating + pulse glow effect */}
          <div className="animate-float">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center animate-pulse-glow">
              <Zap className="h-10 w-10 text-white" />
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-4 mt-8">
            Start Monitoring Today
          </h2>

          <p className="text-muted-foreground leading-relaxed mb-8">
            Join thousands of developers who trust ErrorWatch to keep their applications running smoothly.
          </p>

          {/* Feature list with staggered animation */}
          <div className="space-y-4 text-left">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4 rounded-xl bg-card/50 border border-border/50 transition-all duration-300 hover:bg-card/80 hover:border-violet-500/30 hover:scale-[1.02] animate-fade-in-up"
                style={{ animationDelay: `${300 + index * 100}ms` }}
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
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
