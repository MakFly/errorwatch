---
name: Dashboard routing and component patterns
description: orgSlug/projectSlug params, provider stack, SSR prefetch, server/client component split for apps/web/
type: project
---

## Route Structure

```
app/[locale]/dashboard/
  layout.tsx           → SSR prefetch (orgs, projects, session) + HydrationBoundary
  providers.tsx        → OrganizationProvider > ProjectProvider > SSEProvider > SidebarProvider
  [orgSlug]/
    page.tsx           → "use client"; redirects to first projectSlug or NoProjectDashboard
    layout.tsx         → pass-through (awaits params)
    [projectSlug]/
      layout.tsx       → awaits params: Promise<{orgSlug, projectSlug}>
      page.tsx         → main dashboard (client component)
      issues/ stats/ logs/ replays/ performance/ settings/ crons/ infrastructure/ admin/ help/
```

## Params Pattern (Next.js 15/16)

```ts
interface Props {
  params: Promise<{ orgSlug: string; projectSlug: string }>;
}
const { orgSlug, projectSlug } = await params; // must be awaited in layouts
```

## Client Components — Context Over Params

Pages under `[projectSlug]/` do NOT read route params directly. Instead:
- `useCurrentProject()` → `currentProjectId`, `currentProject`
- `useCurrentOrganization()` → `currentOrgSlug`
- tRPC queries guarded: `{ enabled: !!currentProjectId }`
- Navigation URLs: `/dashboard/${currentOrgSlug}/${currentProject?.slug}/...`

## Provider Stack (inherited by all dashboard pages)

```
NuqsAdapter → TRPCProvider → NextIntlClientProvider → HydrationBoundary
  → OrganizationProvider → ProjectProvider → SSEProvider → SidebarProvider
    → ErrorWatchSidebar + ErrorWatchHeader → <page content>
```

## SSR Prefetch Pattern

```ts
const helpers = await createSSRHelpers();
await Promise.all([
  helpers.organizations.getAll.prefetch(),
  helpers.projects.getAll.prefetch(),
  helpers.auth.getSession.prefetch(),
]);
const dehydratedState = dehydrate(helpers.queryClient);
return <HydrationBoundary state={dehydratedState}>...</HydrationBoundary>;
```

## Server vs Client Component Split

- Pages = Server Components by default
- Interactive parts extracted to `client.tsx` files or `"use client"` directive
- All user-visible strings: `useTranslations()` with namespace in both `en-US.json` and `fr.json`

## shadcn/ui

Components in `src/components/ui/`: alert-dialog, avatar, badge, breadcrumb, button, card, chart, checkbox, collapsible, command, data-table, dialog, drawer, dropdown-menu, input, label, progress, select, separator, sheet, sidebar, skeleton, sonner, switch, table, tabs, toggle-group, toggle, tooltip.

## nuqs

`NuqsAdapter` wired at locale layout level. Ready to use but no page currently calls `useQueryState` — available for URL state management.
