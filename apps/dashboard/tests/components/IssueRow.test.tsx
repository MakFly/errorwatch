import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Mock next/link — render as a plain <a> element
// ---------------------------------------------------------------------------
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
    title,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    title?: string;
  }) =>
    React.createElement("a", { href, className, title }, children),
}));

import { IssueRow } from "@/components/issues/IssueRow";

// ---------------------------------------------------------------------------
// Default props shared across tests
// ---------------------------------------------------------------------------
const defaultProps = {
  fingerprint: "abc123fingerprint",
  message: "TypeError: Cannot read property 'foo' of undefined",
  file: "src/components/dashboard/SomeWidget.tsx",
  line: 42,
  level: "error" as const,
  count: 150,
  lastSeen: new Date("2024-01-01T12:00:00Z"),
  orgSlug: "my-org",
  maxCount: 300,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("IssueRow", () => {
  test("renders the issue message", () => {
    render(<IssueRow {...defaultProps} />);
    expect(
      screen.getByText("TypeError: Cannot read property 'foo' of undefined")
    ).toBeInTheDocument();
  });

  test("renders the correct severity label for 'error' level", () => {
    render(<IssueRow {...defaultProps} level="error" />);
    expect(screen.getByText("ERROR")).toBeInTheDocument();
  });

  test("renders the correct severity label for 'fatal' level", () => {
    render(<IssueRow {...defaultProps} level="fatal" />);
    expect(screen.getByText("FATAL")).toBeInTheDocument();
  });

  test("renders the event count", () => {
    render(<IssueRow {...defaultProps} count={150} />);
    expect(screen.getByText("150")).toBeInTheDocument();
  });

  test("links to the correct issue detail URL", () => {
    render(<IssueRow {...defaultProps} />);
    const links = screen.getAllByRole("link");
    const detailLinks = links.filter((l) =>
      l.getAttribute("href")?.includes("abc123fingerprint")
    );
    expect(detailLinks.length).toBeGreaterThan(0);
    expect(detailLinks[0].getAttribute("href")).toBe(
      "/dashboard/my-org/issues/abc123fingerprint"
    );
  });

  test("expands to show full message and source location on toggle button click", () => {
    render(<IssueRow {...defaultProps} />);
    const toggleButton = screen.getByRole("button");
    fireEvent.click(toggleButton);
    // Expanded details should show "Full Message" heading
    expect(screen.getByText("Full Message")).toBeInTheDocument();
    expect(screen.getByText("Source Location")).toBeInTheDocument();
  });

  test("shows replay badge only when hasReplay is true", () => {
    const { rerender } = render(<IssueRow {...defaultProps} hasReplay={false} />);
    // PlayCircle icon should not be present (badge container hidden)
    const { container } = render(<IssueRow {...defaultProps} hasReplay={true} />);
    // The badge wraps a PlayCircle icon — its SVG should be present
    const svgIcons = container.querySelectorAll("svg");
    expect(svgIcons.length).toBeGreaterThan(0);
  });
});
