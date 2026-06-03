import * as React from "react";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Link } from "@/i18n/navigation";
import { JsonLd } from "@/components/marketing/JsonLd";
import { SITE_URL, BUILD_DATE } from "@/lib/seo";
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

// Editorial v3 — sober body (max-w-3xl, h2 sans-serif) preserved for legal
// legibility / quick scan. Hero promoted to canonical page hero (h1 +
// display-editorial + halo-warm decoration) so legal pages share the same
// visual weight as the rest of the site.
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
      ? {
          "@context": "https://schema.org",
          "@type": "WebPage",
          "@id": `${SITE_URL}/${locale}${canonicalPath}`,
          url: `${SITE_URL}/${locale}${canonicalPath}`,
          name: titleEm ? `${title} ${titleEm}` : title,
          inLanguage: locale,
          isPartOf: { "@id": `${SITE_URL}/#website` },
          publisher: { "@id": `${SITE_URL}/#organization` },
          dateModified: BUILD_DATE,
        }
      : null;
  return (
    <>
      {webPageJsonLd ? <JsonLd data={webPageJsonLd} /> : null}
      <Section
        tone="halo-warm"
        titleAs="h1"
        eyebrow={isFr ? "Légal" : "Legal"}
        title={title}
        {...(titleEm !== undefined ? { titleEm } : {})}
        description={intro}
      />

      <Section tone="paper">
        <Container className="max-w-3xl">
          {lastUpdated ? (
            <p className="text-fg-muted mb-10 text-[11px] tracking-[0.16em] uppercase">
              {isFr ? "Dernière mise à jour : " : "Last updated: "}
              <time {...(lastUpdatedIso ? { dateTime: lastUpdatedIso } : {})}>{lastUpdated}</time>
            </p>
          ) : null}
          <div className="space-y-12">
            {sections.map((section) => (
              <section key={section.title} className="space-y-4">
                <h2 className="text-fg text-2xl leading-tight font-semibold tracking-tight">
                  {section.title}
                </h2>
                <p className="text-fg-soft text-base leading-relaxed">{section.body}</p>
              </section>
            ))}
          </div>

          {relatedLinks && relatedLinks.length > 0 ? (
            <nav
              aria-label={isFr ? "Voir aussi" : "See also"}
              className="border-border mt-16 border-t pt-8"
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
        </Container>
      </Section>
    </>
  );
}
