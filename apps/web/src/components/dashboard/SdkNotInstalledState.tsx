import type { LucideIcon } from "lucide-react";
import { PackageOpen } from "lucide-react";

interface SdkNotInstalledStateProps {
  title: string;
  message: string;
  icon?: LucideIcon;
}

export function SdkNotInstalledState({ title, message, icon: Icon = PackageOpen }: SdkNotInstalledStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-dashboard-border p-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <p className="font-mono text-sm font-semibold uppercase tracking-wider text-foreground">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
