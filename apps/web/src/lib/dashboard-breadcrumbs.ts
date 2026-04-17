export interface HeaderBreadcrumbItem {
  label: string;
  href?: string;
}

function truncateId(value: string): string {
  return `#${value.slice(0, 8)}`;
}

function humanizeSegment(segment: string): string {
  return segment
    .split("-")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function buildProjectCrumbs(
  basePath: string,
  restSegments: string[]
): HeaderBreadcrumbItem[] {
  const [section, subSection, detail] = restSegments;

  if (!section) {
    return [{ label: "Overview" }];
  }

  if (section === "issues") {
    if (subSection) {
      return [
        { label: "Issues", href: `${basePath}/issues` },
        { label: truncateId(subSection) },
      ];
    }

    return [{ label: "Issues" }];
  }

  if (section === "logs") {
    return [{ label: "Logs" }];
  }

  if (section === "replays") {
    if (subSection) {
      return [
        { label: "Replays", href: `${basePath}/replays` },
        { label: truncateId(subSection) },
      ];
    }

    return [{ label: "Replays" }];
  }

  if (section === "stats") {
    return [{ label: "Stats" }];
  }

  if (section === "performance") {
    if (!subSection) {
      return [{ label: "Performance" }];
    }

    if (subSection === "transactions") {
      if (detail) {
        return [
          { label: "Performance", href: `${basePath}/performance` },
          { label: "Transactions", href: `${basePath}/performance/transactions` },
          { label: truncateId(detail) },
        ];
      }

      return [
        { label: "Performance", href: `${basePath}/performance` },
        { label: "Transactions" },
      ];
    }

    if (subSection === "queries") {
      return [
        { label: "Performance", href: `${basePath}/performance` },
        { label: "Database Queries" },
      ];
    }
  }

  if (section === "settings") {
    return [{ label: "Settings" }];
  }

  if (section === "admin") {
    return [{ label: "Admin" }];
  }

  if (section === "help") {
    return [{ label: "Help" }];
  }

  const lastSegment = restSegments[restSegments.length - 1] ?? section;
  return [{ label: humanizeSegment(lastSegment) || "Overview" }];
}

export function resolveDashboardBreadcrumbs(pathname: string): HeaderBreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] !== "dashboard") {
    return [{ label: "Dashboard" }];
  }

  if (segments.length === 1) {
    return [{ label: "Dashboard" }];
  }

  if (segments.length === 2) {
    return [{ label: "Overview" }];
  }

  const orgSlug = segments[1];
  const projectSlug = segments[2];
  const restSegments = segments.slice(3);
  const basePath = `/dashboard/${orgSlug}/${projectSlug}`;

  return buildProjectCrumbs(basePath, restSegments);
}
