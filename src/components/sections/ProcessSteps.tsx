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

// Numbered process steps. Horizontal layout collapses to vertical < lg.
export function ProcessSteps({ steps, orientation = "horizontal", className }: ProcessStepsProps) {
  return (
    <ol
      className={cn(
        "grid gap-8",
        orientation === "horizontal" ? "lg:auto-cols-fr lg:grid-flow-col" : "",
        className,
      )}
    >
      {steps.map((step, idx) => (
        <li key={step.id} className="flex gap-4">
          <span
            aria-hidden="true"
            className="bg-primary text-primary-fg inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-sm font-semibold tabular-nums"
          >
            {String(idx + 1).padStart(2, "0")}
          </span>
          <div className="flex flex-col gap-2">
            <h3 className="text-fg text-lg leading-tight font-semibold tracking-tight">
              {step.title}
            </h3>
            {step.description ? (
              <p className="text-base leading-relaxed text-gray-700">{step.description}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
