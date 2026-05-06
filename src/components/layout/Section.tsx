import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Container } from "./Container";

export type SectionTone = "canvas" | "paper" | "sand" | "halo-warm" | "halo-cool" | "mocha";

interface SectionProps extends Omit<ComponentPropsWithoutRef<"section">, "title"> {
  id?: string;
  eyebrow?: string;
  title?: ReactNode;
  /** Optional emphasized portion inside the title (rendered in serif italic terracotta). */
  titleEm?: ReactNode;
  /** Trailing portion of the title after `titleEm` (so the eyebrow → title → em → tail flow stays inline). */
  titleTail?: ReactNode;
  description?: ReactNode;
  className?: string;
  contentClassName?: string;
  children?: ReactNode;
  /**
   * Visual tone — controls bg + foreground color. Tokens defined in globals.css.
   * - `canvas`     : ivoire chaud (default)
   * - `paper`      : papier blanc — contraste / sections cards
   * - `sand`       : sable — intermissions
   * - `halo-warm`  : ivoire + halo terracotta diffus
   * - `halo-cool`  : sable + halo bleu/sauge
   * - `mocha`      : brun-aubergine riche (alternative au noir)
   */
  tone?: SectionTone;
  /**
   * Heading level for `title`. Default `h2`. Pass `h1` on listing pages
   * that don't carry a `<Hero>` so each page has exactly one h1 (WCAG 2.4.6).
   */
  titleAs?: "h1" | "h2" | "h3";
}

const toneClasses: Record<SectionTone, string> = {
  canvas: "bg-bg text-fg",
  paper: "bg-paper text-fg",
  sand: "bg-sand text-fg",
  "halo-warm": "bg-halo-warm text-fg",
  "halo-cool": "bg-halo-cool text-fg",
  mocha: "bg-mocha-rich text-mocha-fg",
};

const eyebrowClasses: Record<SectionTone, string> = {
  canvas: "text-fg-muted",
  paper: "text-fg-muted",
  sand: "text-fg-muted",
  "halo-warm": "text-fg-muted",
  "halo-cool": "text-fg-muted",
  mocha: "text-mocha-fg/70",
};

const descriptionClasses: Record<SectionTone, string> = {
  canvas: "text-fg-soft",
  paper: "text-fg-soft",
  sand: "text-fg-soft",
  "halo-warm": "text-fg-soft",
  "halo-cool": "text-fg-soft",
  mocha: "text-mocha-fg/85",
};

const titleClasses: Record<SectionTone, string> = {
  canvas: "text-fg",
  paper: "text-fg",
  sand: "text-fg",
  "halo-warm": "text-fg",
  "halo-cool": "text-fg",
  mocha: "text-mocha-fg",
};

const emClasses: Record<SectionTone, string> = {
  canvas: "text-terracotta",
  paper: "text-terracotta",
  sand: "text-terracotta",
  "halo-warm": "text-terracotta",
  "halo-cool": "text-terracotta",
  mocha: "text-terracotta-soft",
};

// Editorial Section v3. Default tone = canvas (ivoire) pour h2/h3 ; quand
// `titleAs="h1"` (= page hero) et tone non spécifié, default automatique
// `halo-warm` pour harmoniser tous les hero du site avec la home.
// Title supports an optional italic-editorial accent via `titleEm` + `titleTail`.
export function Section({
  id,
  eyebrow,
  title,
  titleEm,
  titleTail,
  description,
  className,
  contentClassName,
  children,
  titleAs = "h2",
  tone,
  ...rest
}: SectionProps) {
  // Auto-default : h1 = halo-warm (page hero), sinon canvas.
  const resolvedTone: SectionTone = tone ?? (titleAs === "h1" ? "halo-warm" : "canvas");
  const TitleTag = titleAs;
  return (
    <section
      id={id}
      className={cn(
        "relative overflow-hidden py-24 sm:py-28 lg:py-36",
        toneClasses[resolvedTone],
        className,
      )}
      {...rest}
    >
      <Container className={cn("relative", contentClassName)}>
        {(eyebrow ?? title ?? description) ? (
          <header className="mb-16 max-w-3xl space-y-5">
            {eyebrow ? (
              <p
                className={cn(
                  "text-[13px] font-medium tracking-[0.16em] uppercase",
                  eyebrowClasses[resolvedTone],
                )}
              >
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <TitleTag
                className={cn(
                  "text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight",
                  titleClasses[resolvedTone],
                )}
              >
                {title}
                {titleEm ? (
                  <span
                    className={cn("italic-editorial mx-2", emClasses[resolvedTone])}
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {titleEm}
                  </span>
                ) : null}
                {titleTail}
              </TitleTag>
            ) : null}
            {description ? (
              <p
                className={cn(
                  "max-w-2xl text-lg leading-relaxed sm:text-xl",
                  descriptionClasses[resolvedTone],
                )}
              >
                {description}
              </p>
            ) : null}
          </header>
        ) : null}
        {children}
      </Container>
    </section>
  );
}
