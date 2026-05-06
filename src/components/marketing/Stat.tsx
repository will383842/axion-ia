import { cn } from "@/lib/utils";

interface StatProps {
  number: string | number;
  suffix?: string;
  label: string;
  variant?: "default" | "primary" | "purple" | "orange" | "green";
  className?: string;
}

const variantClasses: Record<NonNullable<StatProps["variant"]>, string> = {
  default: "text-fg",
  primary: "text-primary",
  purple: "text-accent-purple",
  orange: "text-accent-orange",
  green: "text-accent-green",
};

// Big-number stat block (Webflow `MetricsRow` pattern).
// Tabular numerals so animated counters don't jump.
export function Stat({ number, suffix, label, variant = "default", className }: StatProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p
        className={cn(
          "[font-feature-settings:'tnum'] text-[clamp(2.5rem,5vw,4.5rem)] leading-[1.04] font-semibold tracking-tight",
          variantClasses[variant],
        )}
      >
        {number}
        {suffix ? (
          <span className="ml-1 text-base font-medium tracking-normal">{suffix}</span>
        ) : null}
      </p>
      <p className="text-sm leading-snug text-gray-700">{label}</p>
    </div>
  );
}
