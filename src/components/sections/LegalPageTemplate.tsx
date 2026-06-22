import * as React from "react";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Link } from "@/i18n/navigation";
import { JsonLd } from "@/components/marketing/JsonLd";
import { SITE_URL, buildWebPageJsonLd } from "@/lib/seo";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/routing";

interface LegalPageTemplateProps {
  isFr: boolean;
  title: string;
  /** Optional emphasized portion rendered in serif italic terracotta (parity v3). */
  titleEm?: string;
  intro: string;
  sections: ReadonlyArray<{ title: string; body: string }>;
  /**
   * Optional "last updated" date. Human-readable label (ex. "6 mai 2026").
   * If `lastUpdatedIso` est fourni, il alimente l'attribut `dateTime` du <time>.
   */
  lastUpdated?: string;
  /** ISO date (YYYY-MM-DD ou ISO complet) pour l'attribut machine `dateTime`. */
  lastUpdatedIso?: string;
  /**
   * Maillage interne optionnel — bloc « Voir aussi » rendu en fin de page.
   * Routes internes uniquement (typées via next-intl <Link>).
   */
  relatedLinks?: ReadonlyArray<{ href: string; label: string }>;
  /**
   * Localized pathname SANS préfixe de locale (ex. `/mentions-legales`).
   * Si fourni avec `locale`, émet un nœud `WebPage` JSON-LD (schema.org n'a
   * pas de type `PrivacyPolicy`/`TermsOfService` — on utilise `WebPage`).
   * Le `BreadcrumbList` est émis séparément par le composant Breadcrumbs.
   */
  canonicalPath?: string;
  /** Locale active — requis pour `inLanguage` + URL du nœud WebPage. */
  locale?: Locale;
}

// Au-delà de ce nombre de sections, on affiche un sommaire ancré sticky
// (sidebar desktop / accordéon natif mobile). En deçà, mise en page simple
// sur une colonne — un sommaire serait du bruit. CGV (~24 sections) et
// mentions légales (~12) le déclenchent ; cookies/RGPD courts ne l'ont pas.
const TOC_MIN_SECTIONS = 6;

/**
 * Slug stable et lisible pour les ancres de section (#objet, #penalites…).
 * Sans accents, sans ponctuation, dédupliqué. Permet le deep-linking et le
 * sommaire — 100 % server-rendered (aucun JS).
 */
function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function buildAnchors(sections: ReadonlyArray<{ title: string }>): string[] {
  const seen = new Map<string, number>();
  return sections.map((s, i) => {
    const base = slugify(s.title) || `section-${i + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  });
}

// Pastille « Dernière mise à jour » — chip discret posé dans le hero.
function LastUpdatedPill({ isFr, label, iso }: { isFr: boolean; label: string; iso?: string }) {
  return (
    <span className="border-border bg-bg/70 text-fg-muted inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12px] font-medium tracking-[0.08em] uppercase backdrop-blur-sm">
      <span aria-hidden="true" className="bg-terracotta h-1.5 w-1.5 rounded-full" />
      {isFr ? "Mise à jour" : "Updated"} · <time {...(iso ? { dateTime: iso } : {})}>{label}</time>
    </span>
  );
}

// Editorial v4 (2026-06-22) — refonte UI au niveau home/audit : hero canonique
// (h1 display-editorial + halo + décoration), sommaire ancré sticky, sections
// distinctes numérotées et deep-linkables, bande contact. 100 % server-rendered
// (zéro JS client → budget Web Vitals préservé, CLS=0). Corps en `max-w` de
// lecture pour la lisibilité juridique.
export function LegalPageTemplate({
  isFr,
  title,
  titleEm,
  intro,
  sections,
  lastUpdated,
  lastUpdatedIso,
  relatedLinks,
  canonicalPath,
  locale,
}: LegalPageTemplateProps) {
  // WebPage JSON-LD optionnel (schema.org n'expose pas PrivacyPolicy/TermsOfService).
  // Émis uniquement si la page fournit canonicalPath + locale (rétro-compatible).
  const webPageJsonLd =
    canonicalPath && locale
      ? buildWebPageJsonLd({
          locale,
          path: canonicalPath,
          id: `${SITE_URL}/${locale}${canonicalPath}`,
          name: titleEm ? `${title} ${titleEm}` : title,
          // isPartOf #website + publisher #organization : défauts de la factory.
          // Audit fraîcheur 2026-06-08 : la date de révision éditoriale réelle
          // (`lastUpdatedIso`, déjà affichée dans le <time>) au lieu de BUILD_DATE.
          ...(lastUpdatedIso ? { dateModified: lastUpdatedIso } : {}),
        })
      : null;

  const anchors = buildAnchors(sections);
  const showToc = sections.length >= TOC_MIN_SECTIONS;
  const tocLabel = isFr ? "Sommaire" : "Contents";

  // Une section de contenu — carte distincte, numérotée, deep-linkable.
  const renderSection = (section: { title: string; body: string }, i: number) => {
    const id = anchors[i] as string;
    return (
      <section
        key={id}
        id={id}
        // scroll-mt : compense le header sticky lors d'un saut d'ancre.
        className="group/sec border-border bg-bg/60 shadow-subtle hover:shadow-card scroll-mt-28 rounded-2xl border p-6 transition-shadow duration-300 sm:p-8"
      >
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="border-terracotta/25 bg-terracotta/[0.06] text-terracotta mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-base"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {i + 1}
          </span>
          <h2 className="text-fg min-w-0 scroll-mt-28 pt-1 text-xl leading-snug font-semibold tracking-tight sm:text-2xl">
            <a
              href={`#${id}`}
              className="hover:text-terracotta inline-flex items-center gap-2 transition-colors"
            >
              {section.title}
              <span
                aria-hidden="true"
                className="text-terracotta/50 text-base opacity-0 transition-opacity group-hover/sec:opacity-100"
              >
                #
              </span>
            </a>
          </h2>
        </div>
        <p className="text-fg-soft mt-4 text-[15px] leading-relaxed sm:pl-[3.25rem] sm:text-base">
          {section.body}
        </p>
      </section>
    );
  };

  return (
    <>
      {webPageJsonLd ? <JsonLd data={webPageJsonLd} /> : null}

      {/* Hero canonique — même poids visuel que home / audit. */}
      <Section
        tone="halo-warm"
        titleAs="h1"
        eyebrow={isFr ? "Légal" : "Legal"}
        title={title}
        {...(titleEm !== undefined ? { titleEm } : {})}
        description={intro}
      >
        {lastUpdated ? (
          <LastUpdatedPill
            isFr={isFr}
            label={lastUpdated}
            {...(lastUpdatedIso ? { iso: lastUpdatedIso } : {})}
          />
        ) : null}
      </Section>

      <Section tone="paper" className="py-20 sm:py-24 lg:py-28">
        <Container>
          <div
            className={cn(
              showToc
                ? "lg:grid lg:grid-cols-[15rem_minmax(0,46rem)] lg:justify-center lg:gap-14 xl:grid-cols-[16rem_minmax(0,48rem)]"
                : "mx-auto max-w-3xl",
            )}
          >
            {/* ── Sommaire ── */}
            {showToc ? (
              <aside className="lg:sticky lg:top-28 lg:self-start">
                {/* Desktop : nav sticky persistante */}
                <nav
                  aria-label={tocLabel}
                  className="border-border bg-bg/60 hidden rounded-2xl border p-5 lg:block"
                >
                  <p className="text-fg-muted mb-4 text-[11px] font-semibold tracking-[0.16em] uppercase">
                    {tocLabel}
                  </p>
                  <ol className="space-y-1">
                    {sections.map((s, i) => (
                      <li key={anchors[i]}>
                        <a
                          href={`#${anchors[i]}`}
                          className="text-fg-soft hover:bg-terracotta/[0.06] hover:text-terracotta group flex gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] leading-snug transition-colors"
                        >
                          <span className="text-fg-muted group-hover:text-terracotta tabular-nums">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span>{s.title}</span>
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>

                {/* Mobile : accordéon natif (zéro JS) */}
                <details className="border-border bg-bg/60 group rounded-2xl border lg:hidden">
                  <summary className="text-fg flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold">
                    <span className="flex items-center gap-2.5">
                      <span aria-hidden="true" className="bg-terracotta h-1.5 w-1.5 rounded-full" />
                      {tocLabel}
                      <span className="text-fg-muted font-normal">({sections.length})</span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="text-fg-muted transition-transform group-open:rotate-180"
                    >
                      ▾
                    </span>
                  </summary>
                  <ol className="border-border space-y-0.5 border-t px-3 py-3">
                    {sections.map((s, i) => (
                      <li key={anchors[i]}>
                        <a
                          href={`#${anchors[i]}`}
                          className="text-fg-soft hover:bg-terracotta/[0.06] hover:text-terracotta flex gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors"
                        >
                          <span className="text-fg-muted tabular-nums">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span>{s.title}</span>
                        </a>
                      </li>
                    ))}
                  </ol>
                </details>
              </aside>
            ) : null}

            {/* ── Contenu ── */}
            <div className={cn("min-w-0", showToc ? "mt-10 lg:mt-0" : "")}>
              <div className="space-y-5">{sections.map(renderSection)}</div>

              {/* Bande contact — sobre, alignée charte. */}
              <div className="border-terracotta/15 bg-terracotta/[0.04] mt-12 rounded-2xl border p-6 sm:p-8">
                <p className="text-fg text-lg font-semibold tracking-tight">
                  {isFr ? "Une question sur ce document ?" : "A question about this page?"}
                </p>
                <p className="text-fg-soft mt-2 text-[15px] leading-relaxed">
                  {isFr
                    ? "Notre équipe répond à toute demande relative à nos conditions, à vos données ou à nos engagements légaux."
                    : "Our team answers any request about our terms, your data or our legal commitments."}
                </p>
                <Link
                  href={"/contact" as never}
                  className="bg-terracotta hover:bg-terracotta-deep shadow-cta-terracotta mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-colors"
                >
                  {isFr ? "Nous contacter" : "Contact us"}
                  <span aria-hidden="true">→</span>
                </Link>
              </div>

              {relatedLinks && relatedLinks.length > 0 ? (
                <nav
                  aria-label={isFr ? "Voir aussi" : "See also"}
                  className="border-border mt-12 border-t pt-8"
                >
                  <p className="text-fg-muted mb-4 text-[11px] tracking-[0.16em] uppercase">
                    {isFr ? "Voir aussi" : "See also"}
                  </p>
                  <ul className="flex flex-wrap gap-x-6 gap-y-2">
                    {relatedLinks.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href as never}
                          className="text-terracotta hover:text-terracotta-deep text-sm font-medium underline-offset-4 hover:underline"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              ) : null}
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
