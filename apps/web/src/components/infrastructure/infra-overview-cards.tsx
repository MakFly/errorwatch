"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Cpu, MemoryStick, Server } from "lucide-react";
import { useMemo } from "react";

type LatestSnapshot = {
  cpu: { user?: number; system?: number };
  memory: { usedPercent?: number; total?: number; used?: number };
};

function safeCpuLoad(cpu: LatestSnapshot["cpu"]): number {
  const u = Number(cpu?.user);
  const s = Number(cpu?.system);
  if (!Number.isFinite(u) || !Number.isFinite(s)) return 0;
  return u + s;
}

/** Agent payloads often omit usedPercent; derive from used/total when missing. */
function safeMemoryUsedPercent(memory: LatestSnapshot["memory"]): number {
  const p = Number(memory?.usedPercent);
  if (Number.isFinite(p)) return p;
  const total = Number(memory?.total);
  const used = Number(memory?.used);
  if (total > 0 && Number.isFinite(used)) return (used / total) * 100;
  return 0;
}

export function InfraOverviewCards({
  latest,
  hostCount,
  baseUrl,
}: {
  latest: LatestSnapshot[];
  hostCount: number;
  baseUrl: string;
}) {
  const t = useTranslations("infrastructure");

  const averages = useMemo(() => {
    if (latest.length === 0) return { cpu: 0, memory: 0 };
    const avgCpu =
      latest.reduce((sum, s) => sum + safeCpuLoad(s.cpu), 0) / latest.length;
    const avgMem =
      latest.reduce((sum, s) => sum + safeMemoryUsedPercent(s.memory), 0) /
      latest.length;
    return { cpu: avgCpu, memory: avgMem };
  }, [latest]);

  const cards = [
    {
      label: t("overviewCpu"),
      value: `${averages.cpu.toFixed(1)}%`,
      icon: Cpu,
      color:
        averages.cpu > 80
          ? "text-red-400"
          : averages.cpu > 60
            ? "text-amber-400"
            : "text-emerald-400",
    },
    {
      label: t("overviewMemory"),
      value: `${averages.memory.toFixed(1)}%`,
      icon: MemoryStick,
      color:
        averages.memory > 85
          ? "text-red-400"
          : averages.memory > 70
            ? "text-amber-400"
            : "text-emerald-400",
    },
    {
      label: t("overviewHosts"),
      value: String(hostCount),
      icon: Server,
      color: "text-blue-400",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cards.map((card) => (
        <Link
          key={card.label}
          href={`${baseUrl}/infrastructure`}
          className="group rounded-2xl border border-dashboard-border bg-dashboard-surface/30 p-4 transition-colors hover:bg-dashboard-surface/50"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {card.label}
              </p>
              <p className={`mt-1 text-2xl font-bold ${card.color}`}>
                {card.value}
              </p>
            </div>
            <card.icon className="h-5 w-5 text-muted-foreground/50" />
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            {t("viewAll")} →
          </p>
        </Link>
      ))}
    </div>
  );
}
