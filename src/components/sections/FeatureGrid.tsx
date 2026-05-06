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

export function FeatureGrid({ items, columns = 3, className }: FeatureGridProps) {
  return (
    <ul className={cn("grid gap-x-8 gap-y-10", cols[columns], className)}>
      {items.map((item) => (
        <li key={item.id} className="flex flex-col gap-3">
          {item.icon ? (
            <div className="bg-primary/10 text-primary inline-flex h-10 w-10 items-center justify-center rounded-md">
              {item.icon}
            </div>
          ) : null}
          <h3 className="text-fg text-lg leading-tight font-semibold tracking-tight">
            {item.title}
          </h3>
          {item.description ? (
            <p className="text-base leading-relaxed text-gray-700">{item.description}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
