import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockPathname = vi.fn(() => "/dashboard");
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => React.createElement("a", { href, className }, children),
}));

// Mock auth-client signOut
vi.mock("@/lib/auth-client", () => ({
  signOut: vi.fn(),
}));

// Mock ProjectSelector — it has complex tRPC deps
vi.mock("@/components/ProjectSelector", () => ({
  ProjectSelector: () => React.createElement("div", { "data-testid": "project-selector" }),
}));

// Mock OrganizationContext
const mockUseCurrentOrganization = vi.fn();
vi.mock("@/contexts/OrganizationContext", () => ({
  useCurrentOrganization: () => mockUseCurrentOrganization(),
}));

// Mock SidebarContext
const mockClose = vi.fn();
vi.mock("@/components/SidebarContext", () => ({
  useSidebar: () => ({ isOpen: false, close: mockClose, toggle: vi.fn(), open: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import Sidebar from "@/components/Sidebar";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue("/dashboard");
  });

  test("renders the ErrorWatch brand name", () => {
    mockUseCurrentOrganization.mockReturnValue({ currentOrgSlug: null });
    render(<Sidebar />);
    // Two instances: mobile + desktop
    expect(screen.getAllByText("ErrorWatch").length).toBeGreaterThan(0);
  });

  test("renders navigation links in fallback state when no org slug is set", () => {
    mockUseCurrentOrganization.mockReturnValue({ currentOrgSlug: null });
    render(<Sidebar />);
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Issues").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Settings").length).toBeGreaterThan(0);
  });

  test("renders org-scoped navigation links when orgSlug is available", () => {
    mockPathname.mockReturnValue("/dashboard/acme/issues");
    mockUseCurrentOrganization.mockReturnValue({ currentOrgSlug: "acme" });
    render(<Sidebar />);
    const issuesLink = screen.getAllByRole("link").find(
      (l) => l.getAttribute("href") === "/dashboard/acme/issues"
    );
    expect(issuesLink).toBeDefined();
  });

  test("applies active styles to the link matching the current pathname", () => {
    mockPathname.mockReturnValue("/dashboard/acme/issues");
    mockUseCurrentOrganization.mockReturnValue({ currentOrgSlug: "acme" });
    render(<Sidebar />);
    const activeLink = screen.getAllByRole("link").find(
      (l) => l.getAttribute("href") === "/dashboard/acme/issues"
    );
    expect(activeLink?.className).toContain("bg-primary/10");
  });

  test("renders the logout button", () => {
    mockUseCurrentOrganization.mockReturnValue({ currentOrgSlug: null });
    render(<Sidebar />);
    expect(screen.getByText("Logout")).toBeInTheDocument();
  });
});
