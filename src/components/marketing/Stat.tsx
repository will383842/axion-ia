import { cn } from "@/lib/utils";

interface StatProps {
  number: string | number;
  suffix?: string;
  label: string;
  variant?: "default" | "primary" | "purple" | "orange" | "green" | "terracotta";
  className?: string;
}

// Editorial v3 — Big-number stat in Fraunces serif. Auto-adapts on mocha
// surface (default variant flips to mocha-fg).
const variantClasses: Record<NonNullable<StatProps["variant"]>, string> = {
  default: "text-fg [.bg-mocha-rich_&]:text-mocha-fg",
  primary: "text-primary",
  purple: "text-accent-purple",
  // 🔴 a11y 2026-08-21 — `text-accent-orange` rend 2,69:1 sur le fond du site : il
  // échoue AA même au seuil « texte large » (3,00), alors que ce composant affiche
  // justement de très grands nombres. `--color-warning` rend 4,61:1, garde la
  // famille orangée, et passe le seuil du texte NORMAL.
  orange: "text-warning",
  green: "text-sage",
  terracotta: "text-terracotta [.bg-mocha-rich_&]:text-terracotta-soft",
};

export function Stat({ number, suffix, label, variant = "default", className }: StatProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <p
        className={cn(
          "[font-feature-settings:'tnum'] text-[clamp(3.5rem,7vw,6rem)] leading-[0.95] font-medium tracking-[-0.04em]",
          variantClasses[variant],
        )}
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {number}
        {suffix ? (
          <span className="text-terracotta [.bg-mocha-rich_&]:text-terracotta-soft ml-1 text-2xl font-medium tracking-normal opacity-90">
            {suffix}
          </span>
        ) : null}
      </p>
      <p className="text-fg-soft [.bg-mocha-rich_&]:text-mocha-fg/70 text-sm leading-snug">
        {label}
      </p>
    </div>
  );
}
