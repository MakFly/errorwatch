/**
 * Centralized runtime configuration.
 * Self-hosted images read public URLs at runtime instead of baking them into the build.
 */

type RuntimeConfig = {
  appUrl: string;
  monitoringApiUrl: string;
  ssoEnabled: boolean;
};

declare global {
  interface Window {
    __ERRORWATCH_RUNTIME_CONFIG__?: Partial<RuntimeConfig>;
  }
}

const DEFAULT_APP_URL = "http://localhost:4001";
const DEFAULT_MONITORING_API_URL = "http://localhost:3333";

function readServerEnv(key: string): string | undefined {
  if (typeof window !== "undefined") {
    return undefined;
  }

  const value = (process.env as Record<string, string | undefined>)[key];
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function getFirstServerEnv(keys: string[], fallback: string): string {
  for (const key of keys) {
    const value = readServerEnv(key);
    if (value) {
      return value;
    }
  }

  return fallback;
}

function getServerSsoEnabled(): boolean {
  return readServerEnv("NEXT_PUBLIC_ENABLE_SSO") !== "false";
}

function getServerRuntimeConfig(): RuntimeConfig {
  return {
    appUrl: getFirstServerEnv(["APP_URL", "DASHBOARD_URL", "NEXT_PUBLIC_APP_URL"], DEFAULT_APP_URL),
    monitoringApiUrl: getFirstServerEnv(
      ["MONITORING_API_URL", "API_URL", "BETTER_AUTH_URL", "NEXT_PUBLIC_MONITORING_API_URL"],
      DEFAULT_MONITORING_API_URL
    ),
    ssoEnabled: getServerSsoEnabled(),
  };
}

function getClientRuntimeConfig(): RuntimeConfig {
  const runtimeConfig = window.__ERRORWATCH_RUNTIME_CONFIG__ ?? {};

  return {
    appUrl: runtimeConfig.appUrl || process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL,
    monitoringApiUrl:
      runtimeConfig.monitoringApiUrl ||
      process.env.NEXT_PUBLIC_MONITORING_API_URL ||
      DEFAULT_MONITORING_API_URL,
    ssoEnabled:
      typeof runtimeConfig.ssoEnabled === "boolean"
        ? runtimeConfig.ssoEnabled
        : process.env.NEXT_PUBLIC_ENABLE_SSO !== "false",
  };
}

export function getRuntimeConfig(): RuntimeConfig {
  return typeof window === "undefined" ? getServerRuntimeConfig() : getClientRuntimeConfig();
}

export function serializeRuntimeConfig(): string {
  return JSON.stringify(getServerRuntimeConfig()).replace(/</g, "\\u003c");
}

export function getAppUrl(): string {
  return getRuntimeConfig().appUrl;
}

export function getMonitoringApiUrl(): string {
  return getRuntimeConfig().monitoringApiUrl;
}

export function getInternalMonitoringApiUrl(): string {
  if (typeof window === "undefined") {
    return getFirstServerEnv(
      ["INTERNAL_API_URL", "MONITORING_API_URL", "API_URL", "BETTER_AUTH_URL"],
      DEFAULT_MONITORING_API_URL
    );
  }

  return getMonitoringApiUrl();
}

export function isSsoEnabled(): boolean {
  return getRuntimeConfig().ssoEnabled;
}

export function getServerEnvFlag(key: string): boolean {
  return readServerEnv(key) === "true";
}

export function getServerNodeEnv(): string | undefined {
  return readServerEnv("NODE_ENV");
}
