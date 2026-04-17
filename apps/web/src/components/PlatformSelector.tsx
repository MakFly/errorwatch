"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import type { Platform } from "@/server/api";

type CategoryKey = "fullstack" | "frontend" | "backend" | "php" | "infrastructure";

interface PlatformConfig {
  id: Platform;
  name: string;
  icon: string;
  category: "fullstack" | "frontend" | "backend" | "php" | "infrastructure";
}

const PLATFORMS: PlatformConfig[] = [
  // Fullstack
  { id: "nextjs", name: "Next.js", icon: "▲", category: "fullstack" },
  { id: "nuxtjs", name: "Nuxt.js", icon: "◆", category: "fullstack" },
  // Frontend
  { id: "react", name: "React", icon: "⚛", category: "frontend" },
  { id: "vuejs", name: "Vue.js", icon: "◇", category: "frontend" },
  // Backend
  { id: "nodejs", name: "Node.js", icon: "⬢", category: "backend" },
  { id: "hono", name: "Hono.js", icon: "🔥", category: "backend" },
  { id: "fastify", name: "Fastify", icon: "⚡", category: "backend" },
  // PHP
  { id: "symfony", name: "Symfony", icon: "♪", category: "php" },
  { id: "laravel", name: "Laravel", icon: "◈", category: "php" },
  // Infrastructure
  { id: "metrics-agent", name: "Metrics Agent", icon: "📊", category: "infrastructure" },
];

const CATEGORY_STYLES: Record<CategoryKey, { color: string }> = {
  fullstack: { color: "text-purple-400" },
  frontend: { color: "text-cyan-400" },
  backend: { color: "text-green-400" },
  php: { color: "text-red-400" },
  infrastructure: { color: "text-orange-400" },
};

interface PlatformSelectorProps {
  value: Platform | "";
  onChange: (platform: Platform) => void;
  className?: string;
}

export function PlatformSelector({ value, onChange, className }: PlatformSelectorProps) {
  const t = useTranslations("platform");
  const groupedPlatforms = (Object.keys(CATEGORY_STYLES) as CategoryKey[]).map((category) => ({
    category,
    color: CATEGORY_STYLES[category].color,
    platforms: PLATFORMS.filter((p) => p.category === category),
  }));

  return (
    <div className={cn("space-y-4", className)}>
      {groupedPlatforms.map((group) => (
        <div key={group.category}>
          <h4 className={cn("text-xs font-medium uppercase tracking-wider mb-2", group.color)}>
            {t(group.category)}
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {group.platforms.map((platform) => (
              <button
                key={platform.id}
                type="button"
                onClick={() => onChange(platform.id)}
                className={cn(
                  "relative flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all",
                  "text-left text-sm font-medium",
                  value === platform.id
                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/50"
                    : "border-border/50 bg-card/50 text-muted-foreground hover:border-border hover:bg-card hover:text-foreground"
                )}
              >
                <span className="text-lg">{platform.icon}</span>
                <span>{platform.name}</span>
                {value === platform.id && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export { PLATFORMS };
