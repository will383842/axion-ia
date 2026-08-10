import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Container } from "./Container";
import { HeroBadge } from "@/components/marketing/HeroBadge";

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
  /**
   * Optional media (ex. photo hero Unsplash) rendue À DROITE du titre sur les
   * page heros (`titleAs="h1"`), en grille 2 colonnes dès `lg`. Empilée sous le
   * titre sur mobile. Quand fournie, remplace la décoration SVG abstraite.
   * Will 2026-06-24 — « l'image doit être à droite dans le héro, pas dessous ».
   */
  media?: ReactNode;
  className?: string;
  contentClassName?: string;
  children?: ReactNode;
  /**
   * Visual tone — controls bg + foreground color. Tokens defined in globals.css.
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

// Décoration visuelle pour les page heros (titleAs="h1") — anneaux concentriques,
// halos diffus et particules à droite. Donne du caractère sans illustration custom.
function PageHeroDecoration() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-0 right-0 hidden h-full w-[55%] overflow-hidden lg:block"
    >
      <svg
        viewBox="0 0 600 540"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="hero-halo-tc" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-terracotta)" stopOpacity="0.18" />
            <stop offset="60%" stopColor="var(--color-terracotta)" stopOpacity="0.04" />
            <stop offset="100%" stopColor="var(--color-terracotta)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="hero-halo-pr" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.10" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </radialGradient>
          <pattern id="hero-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="var(--color-border-strong)"
              strokeWidth="0.5"
              strokeOpacity="0.25"
            />
          </pattern>
          <radialGradient id="hero-grid-mask" cx="65%" cy="50%" r="50%">
            <stop offset="0%" stopColor="white" stopOpacity="0.5" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="hero-vignette-mask">
            <rect width="100%" height="100%" fill="url(#hero-grid-mask)" />
          </mask>
        </defs>

        {/* Grid texturé fade vignette */}
        <rect width="600" height="540" fill="url(#hero-grid)" mask="url(#hero-vignette-mask)" />

        {/* Halo principal terracotta (centre-droite) */}
        <circle cx="420" cy="270" r="280" fill="url(#hero-halo-tc)" />
        {/* Halo secondaire primary (haut-droite) */}
        <circle cx="520" cy="120" r="180" fill="url(#hero-halo-pr)" />

        {/* Anneaux concentriques décoratifs */}
        <circle
          cx="430"
          cy="270"
          r="200"
          stroke="var(--color-border-strong)"
          strokeOpacity="0.25"
          strokeDasharray="2 6"
          fill="none"
        />
        <circle
          cx="430"
          cy="270"
          r="140"
          stroke="var(--color-border-strong)"
          strokeOpacity="0.40"
          fill="none"
        />
        <circle
          cx="430"
          cy="270"
          r="90"
          stroke="var(--color-terracotta)"
          strokeOpacity="0.35"
          strokeDasharray="3 5"
          fill="none"
        />
        <circle
          cx="430"
          cy="270"
          r="50"
          stroke="var(--color-terracotta)"
          strokeOpacity="0.6"
          strokeWidth="1.5"
          fill="none"
        />

        {/* Particules + dots */}
        <circle cx="430" cy="270" r="5" fill="var(--color-terracotta)" />
        <circle cx="430" cy="270" r="10" fill="var(--color-terracotta)" fillOpacity="0.25" />
        <circle cx="80" cy="80" r="2.5" fill="var(--color-terracotta)" opacity="0.6" />
        <circle cx="540" cy="100" r="3" fill="var(--color-primary)" opacity="0.55" />
        <circle cx="560" cy="380" r="2.5" fill="var(--color-sage)" opacity="0.5" />
        <circle cx="60" cy="460" r="2" fill="var(--color-terracotta)" opacity="0.5" />
        <circle cx="280" cy="50" r="1.8" fill="var(--color-primary)" opacity="0.5" />
        <circle cx="320" cy="500" r="1.8" fill="var(--color-sage)" opacity="0.5" />

        {/* Étoiles 4-pointes décoratives */}
        <path
          d="M 100 240 L 102 246 L 108 248 L 102 250 L 100 256 L 98 250 L 92 248 L 98 246 Z"
          fill="var(--color-terracotta)"
          opacity="0.55"
        />
        <path
          d="M 570 220 L 572 225 L 577 227 L 572 229 L 570 234 L 568 229 L 563 227 L 568 225 Z"
          fill="var(--color-primary)"
          opacity="0.45"
        />

        {/* Segments géométriques */}
        <line
          x1="40"
          y1="180"
          x2="60"
          y2="180"
          stroke="var(--color-terracotta)"
          strokeOpacity="0.4"
          strokeWidth="1"
        />
        <line
          x1="540"
          y1="450"
          x2="560"
          y2="450"
          stroke="var(--color-sage)"
          strokeOpacity="0.4"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}

// Editorial Section v3. Default tone = canvas (ivoire) pour h2/h3 ; quand
// `titleAs="h1"` (= page hero) et tone non spécifié, default automatique
// `halo-warm` + décoration visuelle (anneaux, halos, particules) pour
// harmoniser tous les hero du site avec la home.
// Title supports an optional italic-editorial accent via `titleEm` + `titleTail`.
export function Section({
  id,
  eyebrow,
  title,
  titleEm,
  titleTail,
  description,
  media,
  className,
  contentClassName,
  children,
  titleAs = "h2",
  tone,
  ...rest
}: SectionProps) {
  // Auto-default : h1 = halo-warm (page hero), sinon canvas.
  const resolvedTone: SectionTone = tone ?? (titleAs === "h1" ? "halo-warm" : "canvas");
  const isPageHero = titleAs === "h1";
  // Héro illustré : grille 2 colonnes (titre à gauche, media à droite). La photo
  // remplace la décoration SVG abstraite (sinon redondance visuelle).
  const hasHeroMedia = isPageHero && Boolean(media);
  const TitleTag = titleAs;

  const headerNode =
    (eyebrow ?? title ?? description) ? (
      <header
        className={cn(
          "space-y-5",
          // Hero : marge plus généreuse en bas pour aérer le hero du contenu.
          // En héro illustré, pas de max-width (la colonne grille la borne).
          isPageHero
            ? hasHeroMedia
              ? "mb-0"
              : "mb-0 max-w-3xl lg:max-w-2xl xl:max-w-3xl"
            : "mb-16 max-w-3xl",
        )}
      >
        {/* Eyebrow des sections de contenu (h2/h3) : conserve l'alignement à
            gauche sans fond. Sur les page hero (h1), l'eyebrow devient une
            pastille centrée rendue plus bas (heroBadge). */}
        {eyebrow && !isPageHero ? (
          <p
            className={cn(
              "text-[13px] font-medium tracking-[0.16em] uppercase",
              eyebrowClasses[resolvedTone],
            )}
          >
            {/* Dot terracotta — signature visuelle orange dans chaque hero */}
            <span
              aria-hidden="true"
              className={cn(
                "mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle",
                resolvedTone === "mocha" ? "bg-terracotta-soft" : "bg-terracotta",
              )}
            />
            {eyebrow}
          </p>
        ) : null}
        {title ? (
          <TitleTag
            className={cn(
              // Hero (h1) : typo display editorial Fraunces géante (cohérence
              // home + tous les hero du site). Sections (h2/h3) : sans-serif
              // semibold conservé pour hiérarchie visuelle interne.
              isPageHero
                ? "display-editorial"
                : "text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight",
              titleClasses[resolvedTone],
            )}
          >
            {title}
            {titleEm ? (
              <>
                {/* 🔴 Espace TEXTUELLE, pas seulement visuelle (2026-08-10).
                    L'accent était séparé par `mx-2` : l'œil voyait bien deux
                    mots, mais le DOM ne contenait aucun caractère d'espace
                    entre eux. Le nom accessible du titre et le texte extrait
                    par les moteurs devenaient « Comment se dérouleconcrètement »,
                    « Pourquoicette méthode », « Questionsfréquentes » — sur
                    TOUTES les pages qui passent un `titleEm`.
                    La marge est remplacée par une vraie espace : le rendu reste
                    équivalent et le mot redevient un mot. Le `titleTail` (« . »)
                    continue de coller à l'accent, ce qui est voulu. */}{" "}
                <span
                  className={cn("italic", emClasses[resolvedTone])}
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {titleEm}
                </span>
              </>
            ) : null}
            {titleTail}
          </TitleTag>
        ) : null}
        {description ? (
          <p
            className={cn(
              "leading-relaxed",
              isPageHero ? "mt-6 max-w-2xl text-lg sm:text-xl" : "max-w-2xl text-lg sm:text-xl",
              descriptionClasses[resolvedTone],
            )}
          >
            {description}
          </p>
        ) : null}
      </header>
    ) : null;

  // Page hero (h1) : eyebrow rendue en pastille centrée sur la page, au-dessus
  // du header (single-col comme 2-col media). Aligne tous les hero du site sur
  // la home (demande Will 2026-07-10).
  const heroBadge =
    isPageHero && eyebrow ? (
      <HeroBadge className="mb-10 sm:mb-12">
        <span
          aria-hidden="true"
          className={cn(
            "inline-block h-1.5 w-1.5 rounded-full",
            resolvedTone === "mocha" ? "bg-terracotta-soft" : "bg-terracotta",
          )}
        />
        {eyebrow}
      </HeroBadge>
    ) : null;

  return (
    <section
      id={id}
      className={cn(
        "relative overflow-hidden",
        // Hero : top réduit ~40 % vs bottom (Will 2026-05-08 — héro paraissait
        // trop bas sous le header). Sections de contenu : `py-` symétrique conservé.
        isPageHero ? "pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-20 lg:pb-32" : "py-24 sm:py-28 lg:py-36",
        toneClasses[resolvedTone],
        className,
      )}
      {...rest}
    >
      {/* Décoration visuelle sur les page hero (h1) — anneaux + halos + particules.
          Masquée quand une photo hero est fournie (la photo prend sa place). */}
      {isPageHero && !hasHeroMedia ? <PageHeroDecoration /> : null}

      <Container className={cn("relative", contentClassName)}>
        {heroBadge}
        {/* Héro illustré : grille 2 colonnes (titre | photo) dès lg, empilé avant.
            Sinon, header rendu directement (DOM inchangé pour tous les autres heros). */}
        {hasHeroMedia ? (
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
            {headerNode}
            <div className="min-w-0">{media}</div>
          </div>
        ) : (
          headerNode
        )}
        {/* Children sous le hero — espacement plus généreux pour respiration */}
        {children ? <div className={isPageHero ? "mt-14" : ""}>{children}</div> : null}
      </Container>
    </section>
  );
}
