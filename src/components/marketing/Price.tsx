import { cn } from "@/lib/utils";

interface PriceProps {
  amount: number;
  currency?: "EUR" | "USD";
  suffix?: "HT" | "TTC" | "from";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses: Record<NonNullable<PriceProps["size"]>, string> = {
  sm: "text-base font-semibold",
  md: "text-2xl font-semibold",
  lg: "text-4xl font-semibold tracking-tight",
  xl: "text-[clamp(3rem,5vw,5rem)] leading-[1.04] font-semibold tracking-tight",
};

// Tabular numerals so the digits don't jump on hover/swap.
export function Price({ amount, currency = "EUR", suffix, size = "md", className }: PriceProps) {
  const symbol = currency === "USD" ? "$" : "€";
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  return (
    <span
      className={cn(
        "text-fg inline-flex items-baseline gap-2 [font-feature-settings:'tnum']",
        sizeClasses[size],
        className,
      )}
    >
      <span>
        {formatted}
        <span aria-hidden="true">&nbsp;</span>
        {symbol}
      </span>
      {suffix ? (
        <span className="text-xs font-medium tracking-wide text-gray-600 uppercase">{suffix}</span>
      ) : null}
    </span>
  );
}
