import * as React from "react";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  title: string;
  description?: string;
}

interface ProcessStepsProps {
  steps: ReadonlyArray<Step>;
  /** Layout: vertical (default mobile) or horizontal (desktop). */
  orientation?: "vertical" | "horizontal";
  className?: string;
}

// Editorial v3 — numbered steps with serif terracotta numbers + top border line.
// Auto-adapts on dark surfaces via descendant selectors.
export function ProcessSteps({ steps, orientation = "horizontal", className }: ProcessStepsProps) {
  return (
    <ol
      className={cn(
        "grid gap-12",
        orientation === "horizontal" ? "lg:auto-cols-fr lg:grid-flow-col" : "",
        className,
      )}
    >
      {steps.map((step, idx) => (
        <li
          key={step.id}
          className="border-border-strong [.bg-mocha-rich_&]:border-border-on-mocha flex flex-col gap-4 border-t pt-6"
        >
          <span
            aria-hidden="true"
            className="text-terracotta [.bg-mocha-rich_&]:text-terracotta-soft text-3xl font-medium tabular-nums"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {String(idx + 1).padStart(2, "0")}
          </span>
          <h3 className="text-fg [.bg-mocha-rich_&]:text-mocha-fg text-xl leading-tight font-semibold tracking-tight">
            {step.title}
          </h3>
          {step.description ? (
            <p className="text-fg-soft [.bg-mocha-rich_&]:text-mocha-fg/85 text-base leading-relaxed">
              {step.description}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
