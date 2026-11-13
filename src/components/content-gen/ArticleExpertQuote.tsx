import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import type { Locale } from "@/i18n/routing";
import { JsonLd } from "@/components/marketing/JsonLd";
import { SITE_URL } from "@/lib/seo";
import { detecterInterdits } from "@/lib/contenu/interdits-publication";
import { SIGNATURE_AVIS } from "@/server/content-gen/brand/expert-bank";

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
 * Brique partagée — « Point de vue d'Axion-IA » (avis d'expert, lot L3 du
 * 24/10/2026).
 *
 * Le texte vient d'un modèle de langage : il ne peut pas être attribué à une
 * personne (Williams, Manon ou tout autre nom). Le bloc est donc TOUJOURS signé
 * « Point de vue d'Axion-IA », quel que soit le nom stocké en base. Les
 * anciennes lignes signées d'une personne restent INCHANGÉES en base : tout se
 * règle ici, au rendu, donc c'est réversible en revenant sur ce fichier.
 *
 * Le bloc ne se rend pas si le texte est vide ou s'il contient un interdit de
 * publication (`detecterInterdits`, mêmes règles que la porte de génération).
 * Le contrôle est volontairement strict : financement public non autorisé,
 * pas de dérogation « actualité ».
 *
 * Données structurées : un nœud `Organization` (jamais `Person`), qui pointe sur
 * l'organisation du site (`/#organization`).
 *
 * HTML sémantique `<figure><blockquote><figcaption>`. Server component, 0 JS,
 * CLS = 0. `data-aeo` = extraction par bloc autonome.
 */
export function ArticleExpertQuote({ quote, locale }: ArticleExpertQuoteProps) {
  if (!quote) return null;
  const text = quote.text?.trim() ?? "";
  if (text.length === 0) return null;
  if (detecterInterdits(text, { actualite: false, financementPublicAutorise: false }).length > 0) {
    return null;
  }
  const isFr = locale === "fr";

  const organisationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SIGNATURE_AVIS.name,
  };

  return (
    <Section spacing="compact">
      <Container className="max-w-3xl">
        <figure
          data-aeo="expert-quote"
          className="border-terracotta border-l-4 pl-5"
          aria-label={isFr ? "Point de vue d'Axion-IA" : "Axion-IA viewpoint"}
        >
          <blockquote className="text-fg text-xl leading-relaxed italic">
            «&nbsp;{text}&nbsp;»
          </blockquote>
          <figcaption className="text-fg-muted mt-3 text-sm not-italic">
            — <span className="text-fg font-semibold">{SIGNATURE_AVIS.title}</span>
          </figcaption>
        </figure>
        <JsonLd data={organisationJsonLd} />
      </Container>
    </Section>
  );
}
