import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import type { Locale } from "@/i18n/routing";
import { JsonLd } from "@/components/marketing/JsonLd";
import { SITE_URL } from "@/lib/seo";
import { expertKeyFromName } from "@/server/content-gen/brand/expert-bank";

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
  // Seuls les experts ayant une VRAIE page /equipe/<slug> (AuthorProfile) ont
  // un @id pointant vers cette page. Sinon (ex. Williams, page à créer), on
  // ancre l'@id au domaine racine (#person-<slug>, toujours 200) pour déclarer
  // l'entité Person SANS introduire de lien /equipe qui renverrait 404.
  // NB : seul `manon` a une page /equipe ; `williams` n'existe pas encore →
  // retiré du set pour éviter un @id (et un url) pointant sur une 404.
  const EQUIPE_PAGE_SLUGS = new Set(["manon"]);
  const hasEquipePage = slug != null && EQUIPE_PAGE_SLUGS.has(slug);
  const personJsonLd = slug
    ? {
        "@context": "https://schema.org",
        "@type": "Person",
        "@id": hasEquipePage
          ? `${SITE_URL}/${locale}/equipe/${slug}#person`
          : `${SITE_URL}/#person-${slug}`,
        name,
        ...(title.length > 0 ? { jobTitle: title } : {}),
        ...(hasEquipePage ? { url: `${SITE_URL}/${locale}/equipe/${slug}` } : {}),
        worksFor: { "@id": `${SITE_URL}/#organization` },
      }
    : null;

  return (
    <Section>
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
            — <span className="text-fg font-semibold">{name}</span>
            {title.length > 0 ? `, ${title}` : ""}
          </figcaption>
        </figure>
        {personJsonLd ? <JsonLd data={personJsonLd} /> : null}
      </Container>
    </Section>
  );
}
