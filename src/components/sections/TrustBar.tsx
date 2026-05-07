import * as React from "react";
import { cn } from "@/lib/utils";

interface Logo {
  id: string;
  name: string;
  /** Inline SVG element; pass a wordmark already monochrome (currentColor). */
  logo: React.ReactNode;
}

interface TrustBarProps {
  logos: ReadonlyArray<Logo>;
  /** Optional eyebrow line above the row. */
  label?: string;
  className?: string;
}

// Logo strip — monochrome, neutral gray, hover bumps to fg. ARIA: each logo
// is a list item with name as accessible label (passed via aria-label on
// the wrapper since the logo svg should be aria-hidden).
export function TrustBar({ logos, label, className }: TrustBarProps) {
  return (
    <div className={cn("flex flex-col items-center gap-6", className)}>
      {label ? (
        <p className="text-fg-muted text-xs font-semibold tracking-wide uppercase">{label}</p>
      ) : null}
      <ul className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 opacity-80">
        {logos.map((entry) => (
          <li
            key={entry.id}
            aria-label={entry.name}
            className="hover:text-fg text-fg-muted transition-colors"
          >
            <span aria-hidden="true">{entry.logo}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
