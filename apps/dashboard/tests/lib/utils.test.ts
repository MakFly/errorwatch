import { describe, test, expect } from "vitest";
import { cn } from "@/lib/utils";
import { normalizeGroups } from "@/lib/utils/normalize-groups";
import {
  isCriticalLevel,
  getSparklineColor,
  getSeverityConfig,
  SEVERITY_CONFIG,
} from "@/lib/severity-config";
import { resolveDashboardBreadcrumbs } from "@/lib/dashboard-breadcrumbs";

// ---------------------------------------------------------------------------
// cn() — Tailwind class merger
// ---------------------------------------------------------------------------
describe("cn", () => {
  test("merges multiple class strings", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  test("handles conditional classes (falsy values are omitted)", () => {
    expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
  });

  test("resolves Tailwind conflicts, keeping the last one", () => {
    // tailwind-merge: later class wins for conflicts
    const result = cn("text-red-500", "text-blue-500");
    expect(result).toBe("text-blue-500");
  });

  test("handles empty inputs gracefully", () => {
    expect(cn()).toBe("");
    expect(cn("", undefined, null as never)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// normalizeGroups()
// ---------------------------------------------------------------------------
describe("normalizeGroups", () => {
  test("returns an empty array when called with null/undefined", () => {
    expect(normalizeGroups(null)).toEqual([]);
    expect(normalizeGroups(undefined)).toEqual([]);
  });

  test("returns the array as-is when data is already an array", () => {
    const arr = [{ id: 1 }, { id: 2 }];
    expect(normalizeGroups(arr)).toBe(arr);
  });

  test("extracts the 'groups' property when data is an object", () => {
    const obj = { groups: [{ id: 3 }] };
    expect(normalizeGroups(obj)).toEqual([{ id: 3 }]);
  });

  test("returns empty array when object has no 'groups' property", () => {
    expect(normalizeGroups({ other: [] })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// severity-config helpers
// ---------------------------------------------------------------------------
describe("isCriticalLevel", () => {
  test("returns true for 'fatal'", () => {
    expect(isCriticalLevel("fatal")).toBe(true);
  });

  test("returns true for 'error'", () => {
    expect(isCriticalLevel("error")).toBe(true);
  });

  test("returns false for 'warning', 'info', 'debug'", () => {
    expect(isCriticalLevel("warning")).toBe(false);
    expect(isCriticalLevel("info")).toBe(false);
    expect(isCriticalLevel("debug")).toBe(false);
  });
});

describe("getSparklineColor", () => {
  test("returns a hex color string for each level", () => {
    const levels = ["fatal", "error", "warning", "info", "debug"] as const;
    for (const level of levels) {
      const color = getSparklineColor(level);
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("getSeverityConfig", () => {
  test("returns the correct config for a known level", () => {
    const config = getSeverityConfig("fatal");
    expect(config).toEqual(SEVERITY_CONFIG.fatal);
  });

  test("falls back to 'error' config when level is undefined", () => {
    const config = getSeverityConfig(undefined);
    expect(config).toEqual(SEVERITY_CONFIG.error);
  });
});

// ---------------------------------------------------------------------------
// resolveDashboardBreadcrumbs()
// ---------------------------------------------------------------------------
describe("resolveDashboardBreadcrumbs", () => {
  test("returns [{label:'Dashboard'}] for the root dashboard path", () => {
    expect(resolveDashboardBreadcrumbs("/dashboard")).toEqual([
      { label: "Dashboard" },
    ]);
  });

  test("returns [{label:'Overview'}] for an org-level path", () => {
    expect(resolveDashboardBreadcrumbs("/dashboard/acme")).toEqual([
      { label: "Overview" },
    ]);
  });

  test("returns [{label:'Issues'}] for the issues list page", () => {
    expect(
      resolveDashboardBreadcrumbs("/dashboard/acme/my-project/issues")
    ).toEqual([{ label: "Issues" }]);
  });

  test("returns breadcrumb with truncated fingerprint for an issue detail page", () => {
    const crumbs = resolveDashboardBreadcrumbs(
      "/dashboard/acme/my-project/issues/abcdefgh1234"
    );
    expect(crumbs).toHaveLength(2);
    expect(crumbs[0]).toEqual({
      label: "Issues",
      href: "/dashboard/acme/my-project/issues",
    });
    expect(crumbs[1].label).toBe("#abcdefgh");
  });

  test("returns [{label:'Stats'}] for the stats page", () => {
    expect(
      resolveDashboardBreadcrumbs("/dashboard/acme/my-project/stats")
    ).toEqual([{ label: "Stats" }]);
  });

  test("returns Settings breadcrumb", () => {
    expect(
      resolveDashboardBreadcrumbs("/dashboard/acme/my-project/settings")
    ).toEqual([{ label: "Settings" }]);
  });

  test("returns Performance > Transactions breadcrumbs for transactions sub-page", () => {
    const crumbs = resolveDashboardBreadcrumbs(
      "/dashboard/acme/my-project/performance/transactions"
    );
    expect(crumbs).toHaveLength(2);
    expect(crumbs[0].label).toBe("Performance");
    expect(crumbs[1].label).toBe("Transactions");
  });
});
