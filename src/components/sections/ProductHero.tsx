import * as React from "react";
import { Container } from "@/components/layout/Container";
import { HeroBadge } from "@/components/marketing/HeroBadge";
import { Price } from "@/components/marketing/Price";
import { cn } from "@/lib/utils";

interface ProductHeroProps {
  eyebrow: string;
  accent?: "primary" | "purple" | "orange" | "green";
  title: React.ReactNode;
  /** Portion du titre rendue en italique terracotta serif (signature v3). */
  titleEm?: React.ReactNode;
  /** Suite du titre après `titleEm` (texte standard). */
  titleTail?: React.ReactNode;
  /** AEO answer block — 40-80 words, citable by LLMs. */
  answer: React.ReactNode;
  priceEur?: number;
  priceSuffix?: "HT" | "from";
  cta: React.ReactNode;
  meta?: React.ReactNode;
  /** Optionnel — schéma visuel rendu à droite du hero en lg+ (Sprint
   * Visual Rhythm 2026). En son absence, layout 1-col historique. */
  heroSchema?: React.ReactNode;
  className?: string;
}

// Editorial v3 — bg-halo-warm + 4px accent border-l with terracotta halo.
// Title uses Fraunces serif; answer block is body-sans for legibility.
const ACCENT_BORDER: Record<NonNullable<ProductHeroProps["accent"]>, string> = {
  primary: "border-l-primary",
  purple: "border-l-accent-purple",
  orange: "border-l-accent-orange",
  green: "border-l-accent-green",
};

const ACCENT_HALO: Record<NonNullable<ProductHeroProps["accent"]>, string> = {
  primary: "before:bg-primary/20",
  purple: "before:bg-accent-purple/20",
  orange: "before:bg-accent-orange/20",
  green: "before:bg-accent-green/20",
};

const ACCENT_DOT: Record<NonNullable<ProductHeroProps["accent"]>, string> = {
  primary: "bg-primary",
  purple: "bg-accent-purple",
  orange: "bg-accent-orange",
  green: "bg-accent-green",
};

export function ProductHero({
  eyebrow,
  accent = "primary",
  title,
  titleEm,
  titleTail,
  answer,
  priceEur,
  priceSuffix = "HT",
  cta,
  meta,
  heroSchema,
  className,
}: ProductHeroProps) {
  // Eyebrow → pastille centrée sur la page, au-dessus du bloc hero accentué.
  const heroBadge = (
    <HeroBadge className="mb-10 sm:mb-12">
      <span
        aria-hidden="true"
        className={cn("inline-block h-1.5 w-1.5 rounded-full", ACCENT_DOT[accent])}
      />
      {eyebrow}
    </HeroBadge>
  );

  // Layout centré (Will 2026-07-11) : quand un `heroSchema` est fourni, le hero
  // passe en « texte centré + schéma EN DESSOUS ». Sans schéma, on conserve le
  // bloc historique aligné à gauche avec sa barre d'accent (border-l-4).
  const centered = Boolean(heroSchema);
  const heroBlock = (
    <div
      className={cn(
        "relative",
        centered
          ? "mx-auto max-w-3xl text-center"
          : cn("max-w-4xl border-l-4 pl-6 sm:pl-10", ACCENT_BORDER[accent]),
      )}
    >
      <h1
        className="text-fg text-[clamp(2.5rem,6vw,5rem)] leading-[1.04] font-medium tracking-tight"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {title}
        {titleEm ? (
          <span className="text-terracotta mx-2 italic" style={{ fontFamily: "var(--font-serif)" }}>
            {titleEm}
          </span>
        ) : null}
        {titleTail}
      </h1>
      <div
        className={cn(
          "text-fg-soft mt-7 max-w-2xl text-lg leading-relaxed sm:text-xl",
          centered && "mx-auto",
        )}
      >
        {answer}
      </div>
      {typeof priceEur === "number" ? (
        <div className={cn("mt-10", centered && "flex justify-center")}>
          <Price amount={priceEur} suffix={priceSuffix} size="xl" />
        </div>
      ) : null}
      <div className={cn("mt-10 flex flex-wrap gap-4", centered && "justify-center")}>{cta}</div>
      {meta ? (
        <div
          className={cn(
            "text-fg-muted mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs",
            centered && "justify-center",
          )}
        >
          {meta}
        </div>
      ) : null}
    </div>
  );

  return (
    <section
      className={cn(
        // Top padding réduit ~40 % vs bas (Will 2026-05-08 — héro paraissait trop bas).
        "bg-halo-warm relative overflow-hidden pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-20 lg:pb-32",
        // Faint accent halo derrière le bord gauche
        "before:absolute before:top-1/2 before:left-0 before:h-[60%] before:w-[20%] before:-translate-y-1/2 before:rounded-full before:blur-3xl",
        ACCENT_HALO[accent],
        className,
      )}
    >
      <Container className="relative">
        {heroBadge}
        {heroSchema ? (
          // Layout centré (Will 2026-07-11) — texte centré, schéma visuel EN DESSOUS
          <div className="flex flex-col items-center gap-12 lg:gap-14 xl:gap-16">
            {heroBlock}
            <div className="relative mx-auto w-full max-w-[36rem]">{heroSchema}</div>
          </div>
        ) : (
          heroBlock
        )}
      </Container>
    </section>
  );
}
