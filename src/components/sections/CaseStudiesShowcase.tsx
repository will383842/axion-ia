import * as React from "react";
import { CaseStudyCard } from "@/components/marketing/CaseStudyCard";
import { cn } from "@/lib/utils";

interface CaseStudyItem {
  id: string;
  href: string;
  title: string;
  excerpt: string;
  industry?: string;
  metric?: string;
}

interface CaseStudiesShowcaseProps {
  items: ReadonlyArray<CaseStudyItem>;
  className?: string;
}

// 3-6 cards. Mobile stacks; desktop ≥3 cols.
export function CaseStudiesShowcase({ items, className }: CaseStudiesShowcaseProps) {
  return (
    <ul className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {items.map((item) => (
        <li key={item.id} className="contents">
          <CaseStudyCard
            href={item.href}
            title={item.title}
            excerpt={item.excerpt}
            {...(item.industry !== undefined ? { industry: item.industry } : {})}
            {...(item.metric !== undefined ? { metric: item.metric } : {})}
          />
        </li>
      ))}
    </ul>
  );
}
