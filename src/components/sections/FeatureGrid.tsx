import * as React from "react";
import { cn } from "@/lib/utils";

interface Feature {
  id: string;
  icon?: React.ReactNode;
  title: string;
  description?: string;
}

interface FeatureGridProps {
  items: ReadonlyArray<Feature>;
  columns?: 2 | 3 | 4;
  className?: string;
}

const cols: Record<NonNullable<FeatureGridProps["columns"]>, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

// Editorial v3 — feature item with terracotta-soft icon container, serif title,
// generous gap. Auto-adapts on dark surface via descendant selectors.
export function FeatureGrid({ items, columns = 3, className }: FeatureGridProps) {
  return (
    <ul className={cn("grid gap-x-10 gap-y-12", cols[columns], className)}>
      {items.map((item) => (
        <li key={item.id} className="flex flex-col gap-5">
          {item.icon ? (
            <div className="bg-terracotta-soft text-terracotta-deep inline-flex h-12 w-12 items-center justify-center rounded-full">
              {item.icon}
            </div>
          ) : null}
          <h3 className="text-fg [.bg-mocha-rich_&]:text-mocha-fg text-xl leading-tight font-semibold tracking-tight">
            {item.title}
          </h3>
          {item.description ? (
            <p className="text-fg-soft [.bg-mocha-rich_&]:text-mocha-fg/85 text-base leading-relaxed">
              {item.description}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
