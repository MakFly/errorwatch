import { Skeleton } from "@/components/ui/skeleton";

export default function IssueDetailLoading() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Back link */}
      <div className="border-b border-dashboard-border px-6 py-3 md:px-8">
        <Skeleton className="h-4 w-20" />
      </div>

      {/* Title block */}
      <div className="border-b border-dashboard-border px-6 py-6 md:px-8 md:py-8">
        <div className="flex gap-2 mb-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="mt-4 h-4 w-72" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-px border-b border-dashboard-border bg-dashboard-border md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-background px-6 py-4 md:px-8">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-7 w-24" />
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-dashboard-border px-4 py-3 md:px-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-24" />
        ))}
      </div>

      {/* Split */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[300px_1fr]">
        <div className="border-b border-dashboard-border lg:border-b-0 lg:border-r">
          <div className="border-b border-dashboard-border/40 px-4 py-3">
            <Skeleton className="h-4 w-20" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border-b border-dashboard-border/40 px-4 py-2.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-1.5 h-3 w-20" />
            </div>
          ))}
        </div>

        <div>
          <div className="border-b border-dashboard-border px-6 py-3 md:px-8">
            <Skeleton className="h-4 w-32" />
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border-b border-dashboard-border/40 px-6 py-2.5 md:px-8">
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
