import * as React from "react";
import { Stat } from "@/components/marketing/Stat";
import { cn } from "@/lib/utils";

interface Metric {
  id: string;
  number: string | number;
  suffix?: string;
  label: string;
  variant?: "default" | "primary" | "purple" | "orange" | "green" | "terracotta";
}

interface MetricsRowProps {
  stats: ReadonlyArray<Metric>;
  className?: string;
}

// Editorial v3 — big-number stats row. Mobile stacks to 2 cols, desktop
// full row. Use 2-4 entries.
//
// A11y (Sprint LHCI 2026-05-29) — migration `<dl>` → `<ul role="list">` :
// axe-core règle `definition-list` n'accepte pas `<dl><div>...` wrapper non
// strict pour styling. Stat rend `<div><p><p>` qui n'est pas <dt>/<dd> direct
// child. `<ul>` + `<li>` est sémantiquement équivalent pour des stats
// (label-value pairs non strictement définitionnelles) et pass axe-core.
export function MetricsRow({ stats, className }: MetricsRowProps) {
  const cols =
    stats.length >= 4 ? "lg:grid-cols-4" : stats.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2";
  return (
    <ul
      role="list"
      className={cn("grid list-none grid-cols-2 gap-x-8 gap-y-12 p-0", cols, className)}
    >
      {stats.map((stat) => (
        <li key={stat.id} className="list-none">
          <Stat
            number={stat.number}
            {...(stat.suffix !== undefined ? { suffix: stat.suffix } : {})}
            label={stat.label}
            {...(stat.variant !== undefined ? { variant: stat.variant } : {})}
          />
        </li>
      ))}
    </ul>
  );
}
