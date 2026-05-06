import * as React from "react";
import { Stat } from "@/components/marketing/Stat";
import { cn } from "@/lib/utils";

interface Metric {
  id: string;
  number: string | number;
  suffix?: string;
  label: string;
  variant?: "default" | "primary" | "purple" | "orange" | "green";
}

interface MetricsRowProps {
  stats: ReadonlyArray<Metric>;
  className?: string;
}

// Big-number stats row. Use 2-4 entries; mobile stacks to 2 cols.
export function MetricsRow({ stats, className }: MetricsRowProps) {
  const cols =
    stats.length >= 4 ? "lg:grid-cols-4" : stats.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2";
  return (
    <dl className={cn("grid grid-cols-2 gap-6", cols, className)}>
      {stats.map((stat) => (
        <Stat
          key={stat.id}
          number={stat.number}
          {...(stat.suffix !== undefined ? { suffix: stat.suffix } : {})}
          label={stat.label}
          {...(stat.variant !== undefined ? { variant: stat.variant } : {})}
        />
      ))}
    </dl>
  );
}
