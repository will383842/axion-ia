import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import type { Locale } from "@/i18n/routing";
import { JsonLd } from "@/components/marketing/JsonLd";
import { SITE_URL } from "@/lib/seo";
import { expertKeyFromName, expertByKey } from "@/server/content-gen/brand/expert-bank";

export interface ExpertQuoteData {
  readonly name: string;
  readonly title: string | null;
  readonly text: string;
}

interface ArticleExpertQuoteProps {
  readonly quote: ExpertQuoteData | null | undefined;
  readonly locale: Locale;
}

/**
 * Brique partagée — citation d'expert nommé (chantier templates 2026-06-21).
 *
 * Le levier AEO le plus fort (+41 % de visibilité IA selon l'audit). Alimenté
 * par les champs DB réels `Article.expertQuoteName/Title/Text` → rendu
 * UNIQUEMENT si une VRAIE citation est renseignée (nom + texte). Jamais d'expert
 * inventé : si la donnée est vide, le bloc ne se rend pas.
 *
 * HTML sémantique `<figure><blockquote><figcaption>` (nom + titre). Server
 * component, 0 JS, CLS = 0. `data-aeo` = extraction par bloc autonome.
 */
export function ArticleExpertQuote({ quote, locale }: ArticleExpertQuoteProps) {
  if (!quote) return null;
  const name = quote.name?.trim() ?? "";
  const text = quote.text?.trim() ?? "";
  if (name.length === 0 || text.length === 0) return null;
  const title = quote.title?.trim() ?? "";
  const isFr = locale === "fr";

  // Refonte AEO 2026-06-22 — désambiguïsation d'entité : nœud Person + Quotation
  // pour l'expert cité (résout l'attribution visible en entité réelle, levier
  // E-E-A-T). N'émet un @id que pour un expert interne CONNU (slug non null) —
  // jamais d'entité inventée.
  const slug = expertKeyFromName(name);
  const expert = slug ? expertByKey(slug) : null;
  // Doctrine nommage (FOUNDER) : la figcaption affiche le `displayName`
  // (« Williams »), le nœud Person structuré porte le nom canonique
  // (« Williams Jullin »). On dérive TOUJOURS de la banque d'experts pour
  // normaliser aussi les valeurs DB historiques ; fallback = valeur brute.
  const displayName = expert?.displayName ?? name;
  const structuredName = expert?.name ?? name;
  // Tous les experts internes ont désormais une VRAIE page /equipe/<slug>
  // (manon = AuthorProfile DB, williams = page d'autorité statique) → l'@id
  // pointe sur cette page (200) pour fusionner l'entité avec `Organization.founder`
  // et la page d'autorité (audit Knowledge Panel 2026-07-06). Un expert sans
  // page connue retombe sur un @id racine `#person-<slug>` (jamais de 404).
  const EQUIPE_PAGE_SLUGS = new Set(["manon", "williams"]);
  const hasEquipePage = slug != null && EQUIPE_PAGE_SLUGS.has(slug);
  const personJsonLd = slug
    ? {
        "@context": "https://schema.org",
        "@type": "Person",
        "@id": hasEquipePage
          ? `${SITE_URL}/${locale}/equipe/${slug}#person`
          : `${SITE_URL}/#person-${slug}`,
        name: structuredName,
        ...(title.length > 0 ? { jobTitle: title } : {}),
        ...(hasEquipePage ? { url: `${SITE_URL}/${locale}/equipe/${slug}` } : {}),
        worksFor: { "@id": `${SITE_URL}/#organization` },
      }
    : null;

  return (
    <Section spacing="compact">
      <Container className="max-w-3xl">
        <figure
          data-aeo="expert-quote"
          className="border-terracotta border-l-4 pl-5"
          aria-label={isFr ? "Avis d'expert" : "Expert opinion"}
        >
          <blockquote className="text-fg text-xl leading-relaxed italic">
            «&nbsp;{text}&nbsp;»
          </blockquote>
          <figcaption className="text-fg-muted mt-3 text-sm not-italic">
            — <span className="text-fg font-semibold">{displayName}</span>
            {title.length > 0 ? `, ${title}` : ""}
          </figcaption>
        </figure>
        {personJsonLd ? <JsonLd data={personJsonLd} /> : null}
      </Container>
    </Section>
  );
}
