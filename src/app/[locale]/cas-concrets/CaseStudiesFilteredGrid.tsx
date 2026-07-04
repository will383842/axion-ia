"use client";
// use-client: lit query params via useSearchParams() côté navigateur pour
// filtrer la grille de cas concrets SANS forcer la page en SSR dynamique.
// Audit Edge 2026-05-15 AGENT 5 §5.7 — `/fr/cas-concrets` émettait
// `Cache-Control: private` parce que `searchParams` était lu côté Server
// Component, forçant Next 16 en dynamic render. Refacto : la page redevient
// purement statique (ISR `revalidate = 86400`), ce composant masque côté
// CSS (display:none) les items qui ne matchent pas les filtres URL.
//
// Stratégie filtrage CSS (display:none) plutôt qu'unmount React :
//   - Hydration cohérente (server retourne tout, client masque seulement)
//   - Pas de "flash" au mount initial
//   - SEO / AEO : LLMs voient le set complet en HTML (filtre invisible aux crawlers)
//   - Plus rapide qu'un re-render React (class toggle CSS, INP-friendly)
//   - Compatible JS-off (filters dégradent gracefully : tout est visible)
//
// Bundle : `useSearchParams` + Suspense wrapper + ItemDescriptor = ~1 KB gz.
// Conforme au budget FLJS ≤ 75 KB gz (AGENTS.md performance budget).

import * as React from "react";
import { useSearchParams } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { CaseStudyCard } from "@/components/marketing/CaseStudyCard";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";

/* -------------------------------------------------------------------------- */
/*  Filter pills (Client Component) — surligne l'option active selon l'URL.    */
/*  Les liens restent `<a href>` réels : navigation + bookmarks fonctionnent   */
/*  identiquement avec/sans JS. Seul l'état visuel "actif" est dérivé du DOM.  */
/* -------------------------------------------------------------------------- */

interface PillDescriptor {
  /** Valeur URL (lowercased pour `industry`, raw key pour `size`). */
  value: string;
  /** Label affiché à l'utilisateur. */
  label: string;
}

interface CaseStudiesFilterPillsProps {
  locale: Locale;
  industries: ReadonlyArray<PillDescriptor>;
  sizes: ReadonlyArray<PillDescriptor>;
}

function FilterPillsInner({ locale, industries, sizes }: CaseStudiesFilterPillsProps) {
  const searchParams = useSearchParams();
  const filterIndustry = searchParams.get("industry")?.toLowerCase() ?? null;
  const filterSize = searchParams.get("size")?.toLowerCase() ?? null;
  const isFr = locale === "fr";
  const basePath = `/${locale}/cas-concrets`;

  const pillClass = (active: boolean) =>
    `rounded-sm border px-3 py-1.5 text-sm ${
      active
        ? "border-primary bg-primary text-primary-fg"
        : "border-border text-fg hover:border-border-hover"
    }`;

  return (
    <Container className="space-y-4">
      <div>
        <p className="text-fg mb-2 text-xs font-semibold tracking-wide uppercase">
          {isFr ? "Industrie" : "Industry"}
        </p>
        <ul className="flex flex-wrap gap-2">
          <li>
            <a href={basePath} className={pillClass(!filterIndustry)}>
              {isFr ? "Toutes" : "All"}
            </a>
          </li>
          {industries.map((ind) => (
            <li key={ind.value}>
              <a
                href={`${basePath}?industry=${encodeURIComponent(ind.value)}`}
                className={pillClass(filterIndustry === ind.value)}
              >
                {ind.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-fg mb-2 text-xs font-semibold tracking-wide uppercase">
          {isFr ? "Taille" : "Size"}
        </p>
        <ul className="flex flex-wrap gap-2">
          <li>
            <a href={basePath} className={pillClass(!filterSize)}>
              {isFr ? "Toutes" : "All"}
            </a>
          </li>
          {sizes.map((s) => (
            <li key={s.value}>
              <a href={`${basePath}?size=${s.value}`} className={pillClass(filterSize === s.value)}>
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </Container>
  );
}

/**
 * Wrapper Suspense pour `useSearchParams()` (Next 16 requirement).
 * Fallback = pills sans état actif (rendu initial SSR cohérent).
 */
export function CaseStudiesFilterPills(props: CaseStudiesFilterPillsProps) {
  return (
    <React.Suspense fallback={<FilterPillsFallback {...props} />}>
      <FilterPillsInner {...props} />
    </React.Suspense>
  );
}

function FilterPillsFallback({ locale, industries, sizes }: CaseStudiesFilterPillsProps) {
  // Pills sans surlignage actif (rendu SSR initial). Liens fonctionnels.
  const isFr = locale === "fr";
  const basePath = `/${locale}/cas-concrets`;
  const inactive =
    "rounded-sm border border-border text-fg hover:border-border-hover px-3 py-1.5 text-sm";
  return (
    <Container className="space-y-4">
      <div>
        <p className="text-fg mb-2 text-xs font-semibold tracking-wide uppercase">
          {isFr ? "Industrie" : "Industry"}
        </p>
        <ul className="flex flex-wrap gap-2">
          <li>
            <a href={basePath} className={inactive}>
              {isFr ? "Toutes" : "All"}
            </a>
          </li>
          {industries.map((ind) => (
            <li key={ind.value}>
              <a
                href={`${basePath}?industry=${encodeURIComponent(ind.value)}`}
                className={inactive}
              >
                {ind.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-fg mb-2 text-xs font-semibold tracking-wide uppercase">
          {isFr ? "Taille" : "Size"}
        </p>
        <ul className="flex flex-wrap gap-2">
          <li>
            <a href={basePath} className={inactive}>
              {isFr ? "Toutes" : "All"}
            </a>
          </li>
          {sizes.map((s) => (
            <li key={s.value}>
              <a href={`${basePath}?size=${s.value}`} className={inactive}>
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </Container>
  );
}

/* -------------------------------------------------------------------------- */
/*  Filtered grid (Client Component) — masque CSS les items hors filtre.       */
/* -------------------------------------------------------------------------- */

/**
 * Descripteur sérialisable d'un cas concret passé par le Server Component.
 * On évite d'importer `CaseStudy` complet pour réduire la charge JSON inline
 * (excerpts seulement, pas context/problem/solution/etc.).
 */
export interface CaseDescriptor {
  slug: string;
  title: string;
  excerpt: string;
  industry: string;
  /** Industry value lowercased — utilisé pour matcher le filtre URL. */
  industryKey: string;
  /** Industry EN lowercased — pour matcher le filtre URL FR ou EN indifféremment. */
  industryKeyEn: string;
  size: "tpe" | "pme" | "mid" | "enterprise";
  metric: string;
}

interface CaseStudiesFilteredGridProps {
  locale: Locale;
  cases: ReadonlyArray<CaseDescriptor>;
  totalCount: number;
}

function InnerGrid({ locale, cases, totalCount }: CaseStudiesFilteredGridProps) {
  const searchParams = useSearchParams();
  const filterIndustry = searchParams.get("industry")?.toLowerCase() ?? null;
  const filterSize = searchParams.get("size")?.toLowerCase() ?? null;
  const isFr = locale === "fr";

  // Match prédicat — exécuté côté navigateur uniquement.
  const matches = (c: CaseDescriptor) => {
    if (filterIndustry && c.industryKey !== filterIndustry && c.industryKeyEn !== filterIndustry) {
      return false;
    }
    if (filterSize && c.size !== filterSize) {
      return false;
    }
    return true;
  };

  // Compte les items visibles pour l'eyebrow + le message « no match ».
  // Calcul mémoïsé pour ne pas refaire la passe à chaque re-render.
  const visibleCount = React.useMemo(
    () => cases.reduce((acc, c) => (matches(c) ? acc + 1 : acc), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cases, filterIndustry, filterSize],
  );

  const eyebrow =
    visibleCount === totalCount
      ? isFr
        ? "Tous les cas"
        : "All cases"
      : isFr
        ? `${visibleCount} cas`
        : `${visibleCount} case(s)`;

  return (
    <Section eyebrow={eyebrow}>
      <Container>
        <ul className="xs:grid-cols-2 grid grid-cols-1 gap-4 md:grid-cols-3">
          {cases.map((c) => {
            const visible = matches(c);
            return (
              <li
                key={c.slug}
                // CSS-based filtering : item reste dans le DOM, simple toggle
                // de visibilité. Cohérent SSR/client (zéro hydration mismatch).
                className={visible ? undefined : "hidden"}
                aria-hidden={visible ? undefined : true}
              >
                <CaseStudyCard
                  href={`/cas-concrets/${c.slug}`}
                  title={c.title}
                  excerpt={c.excerpt}
                  industry={c.industry}
                  metric={c.metric}
                />
              </li>
            );
          })}
          {visibleCount === 0 ? (
            <li className="text-fg-soft col-span-full text-center">
              {isFr ? "Aucun cas ne correspond à ces filtres." : "No case matches these filters."}
            </li>
          ) : null}
        </ul>
      </Container>
    </Section>
  );
}

/**
 * Wrapper Suspense — Next 16 exige que tout consumer de `useSearchParams()`
 * soit enveloppé dans un boundary Suspense, sinon la page entière est forcée
 * en dynamic render (ce qui annulerait précisément le bénéfice du refacto).
 */
export function CaseStudiesFilteredGrid(props: CaseStudiesFilteredGridProps) {
  // Fallback = même grille rendue sans filtre. Comme `useSearchParams()` se
  // résout immédiatement côté client, ce fallback ne s'affiche qu'en SSR ;
  // il garantit que le HTML statique contient bien tous les cas (AEO / no-JS).
  const { locale, cases, totalCount } = props;
  const isFr = locale === "fr";
  return (
    <React.Suspense
      fallback={
        <Section eyebrow={isFr ? "Tous les cas" : "All cases"}>
          <Container>
            <ul className="xs:grid-cols-2 grid grid-cols-1 gap-4 md:grid-cols-3">
              {cases.map((c) => (
                <li key={c.slug}>
                  <CaseStudyCard
                    href={`/cas-concrets/${c.slug}`}
                    title={c.title}
                    excerpt={c.excerpt}
                    industry={c.industry}
                    metric={c.metric}
                  />
                </li>
              ))}
            </ul>
            <span className="sr-only">{totalCount}</span>
          </Container>
        </Section>
      }
    >
      <InnerGrid {...props} />
    </React.Suspense>
  );
}
