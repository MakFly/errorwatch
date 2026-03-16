import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { MONITORING_API_URL } from "@/lib/config";
const API_URL = MONITORING_API_URL;
const API_VERSION = "v1";
const FAIL_OPEN = process.env.AUTH_FAIL_OPEN === "true" || process.env.NODE_ENV !== "production";
const SELF_HOSTED = process.env.SELF_HOSTED === "true";

const CACHE_TTL = 30000;

type SessionCacheEntry = {
  userId: string;
  expires: number;
};

const sessionCache = new Map<string, SessionCacheEntry>();

function getSessionFromCache(sessionToken: string): string | null {
  const entry = sessionCache.get(sessionToken);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    sessionCache.delete(sessionToken);
    return null;
  }
  return entry.userId;
}

function setSessionCache(sessionToken: string, userId: string) {
  if (sessionCache.size > 1000) {
    const oldestKey = sessionCache.keys().next().value;
    if (oldestKey) sessionCache.delete(oldestKey);
  }
  sessionCache.set(sessionToken, { userId, expires: Date.now() + CACHE_TTL });
}

function invalidateSessionCache(sessionToken: string) {
  sessionCache.delete(sessionToken);
}

function getSessionToken(cookieHeader: string): string | null {
  const match =
    cookieHeader.match(/better-auth\.session_token=([^;]+)/) ||
    cookieHeader.match(/__Secure-better-auth\.session_token=([^;]+)/);
  return match ? match[1] : null;
}

function invalidateSessionAndRedirect(
  request: NextRequest,
  redirectPath?: string,
  errorCode?: string
): NextResponse {
  const loginUrl = new URL("/login", request.url);
  if (redirectPath) {
    loginUrl.searchParams.set("redirect", redirectPath);
  }
  if (errorCode) {
    loginUrl.searchParams.set("error", errorCode);
  }
  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete("better-auth.session_token");
  response.cookies.delete("__Secure-better-auth.session_token");
  return response;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const cookieHeader = request.headers.get("cookie") ?? "";

  // Self-hosted: skip marketing page, go straight to login
  if (SELF_HOSTED && pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const publicRoutes = ["/", "/login", "/signup", "/invite"];
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || (route !== "/" && pathname.startsWith(`${route}/`))
  );

  const isApiRoute = pathname.startsWith("/api");
  const isStaticRoute = pathname.startsWith("/_next");
  const isOnboardingRoute = pathname.startsWith("/onboarding");

  const authRoutes = ["/login", "/signup"];
  const isAuthRoute = authRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  const sessionToken = getSessionToken(cookieHeader);
  const hasSessionCookie = sessionToken !== null;

  if (hasSessionCookie && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isPublicRoute || isApiRoute || isStaticRoute) {
    return NextResponse.next();
  }

  if (!hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  let sessionValidationFailed = false;
  let userId: string | null = null;

  const cachedUserId = sessionToken ? getSessionFromCache(sessionToken) : null;
  if (cachedUserId) {
    userId = cachedUserId;
  } else {
    try {
      const sessionRes = await fetch(`${API_URL}/api/auth/get-session`, {
        headers: {
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          Origin: request.headers.get("origin") || undefined,
        },
        cache: "no-store",
        credentials: "include",
      });

      if (!sessionRes.ok) {
        if (sessionToken) invalidateSessionCache(sessionToken);
        return invalidateSessionAndRedirect(request, pathname);
      }

      const sessionData = await sessionRes.json();
      if (!sessionData?.user?.id) {
        if (sessionToken) invalidateSessionCache(sessionToken);
        return invalidateSessionAndRedirect(request, pathname);
      }

      userId = sessionData.user.id;
      if (sessionToken) {
        setSessionCache(sessionToken, userId);
      }
    } catch (error) {
      console.error("[Middleware] Failed to validate session:", error);
      sessionValidationFailed = true;
      if (!FAIL_OPEN) {
        return invalidateSessionAndRedirect(request, pathname, "auth_unavailable");
      }
    }
  }

  if (!pathname.startsWith("/dashboard") && !isOnboardingRoute) {
    return NextResponse.next();
  }

  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    try {
      const [statusRes, orgsRes] = await Promise.all([
        fetch(`${API_URL}/api/${API_VERSION}/onboarding/status`, {
          headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
        }),
        fetch(`${API_URL}/api/${API_VERSION}/organizations`, {
          headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
        }),
      ]);

      let needsOnboarding = false;
      if (statusRes.ok) {
        const status = await statusRes.json();
        needsOnboarding = status.needsOnboarding ?? false;
      }

      if (needsOnboarding) {
        return NextResponse.redirect(new URL("/onboarding", request.url));
      }

      if (orgsRes.ok) {
        const organizations = await orgsRes.json();
        if (organizations && organizations.length > 0) {
          return NextResponse.redirect(
            new URL(`/dashboard/${organizations[0].slug}`, request.url)
          );
        }
      }

      return NextResponse.redirect(new URL("/onboarding", request.url));
    } catch (error) {
      console.error("Failed to fetch organizations:", error);
      if (!FAIL_OPEN) {
        return new NextResponse("Service unavailable", { status: 503 });
      }
    }
  }

  if (!sessionValidationFailed && isOnboardingRoute) {
    try {
      const statusRes = await fetch(
        `${API_URL}/api/${API_VERSION}/onboarding/status`,
        {
          headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
        }
      );

      if (statusRes.ok) {
        const status = await statusRes.json();
        if (!status.needsOnboarding) {
          return NextResponse.redirect(new URL("/dashboard", request.url));
        }
      }
    } catch (error) {
      console.error("Failed to check onboarding status:", error);
      if (!FAIL_OPEN) {
        return new NextResponse("Service unavailable", { status: 503 });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|_next/webpack|.*\\.(?:ico|png|jpg|jpeg|svg|css|js|woff2?)$).*)",
  ],
};
