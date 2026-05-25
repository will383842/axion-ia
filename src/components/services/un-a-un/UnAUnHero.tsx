/**
 * UnAUnHero — Hero canonique service `un-a-un` (4e verticale, coaching 1-to-1).
 *
 * Sprint A Phase 2 — extrait depuis `src/app/[locale]/un-a-un/page.tsx`.
 * Réutilisé par les ~430 pages ville
 * `/fr/implantations/{region}/{ville}/un-a-un` (Phase 5).
 *
 * Server Component pur, zéro JS. Prix injectés via SSOT `@/content/pricing`
 * (`UN_A_UN_TIERS` → `getEntryTier` + `formatPrice`). Speakable JSON-LD émis
 * pour H1 + description (assistants vocaux + ChatGPT/Claude voice).
 */

import { ArrowUpRight } from "lucide-react";
import { Cta } from "@/components/marketing/Cta";
import { ServiceHero, type ServiceHeroNode } from "@/components/sections/ServiceHero";
import { JsonLd } from "@/components/marketing/JsonLd";
import { UN_A_UN_TIERS, formatPrice, getEntryTier } from "@/content/pricing";
import { buildSpeakableSpecification } from "@/lib/seo/speakable-universal";
import type { VilleContext } from "@/components/services/types";

interface UnAUnHeroProps {
  readonly isFr: boolean;
  /** Si fourni, le H1 interpole le nom de ville (page ville). Sinon, canonique. */
  readonly villeContext?: VilleContext;
}

export function UnAUnHero({ isFr, villeContext }: UnAUnHeroProps) {
  const entryTier = getEntryTier(UN_A_UN_TIERS);
  const formattedPrice = formatPrice(entryTier, isFr ? "fr" : "en");

  // Titre — canonique vs ville-aware. La partie italique reste constante côté
  // canonique ("pour une personne") et interpole la ville côté ville.
  const title = villeContext
    ? isFr
      ? "Un expert IA pour une personne"
      : "One AI expert for one person"
    : isFr
      ? "Un expert IA"
      : "One AI expert";
  const titleEm = villeContext
    ? isFr
      ? `à ${villeContext.name}`
      : `in ${villeContext.name}`
    : isFr
      ? "pour une personne"
      : "for one person";

  const description = villeContext
    ? isFr
      ? `Un collaborateur à ${villeContext.name}, un expert IA Axion-IA. Pas une formation groupe, pas un audit d'entreprise — un accompagnement individuel calibré sur le poste réel, les outils du quotidien et les objectifs concrets de la personne. À partir de ${formattedPrice}.`
      : `One employee in ${villeContext.name}, one Axion-IA AI expert. Not a group training, not a company audit — individual coaching calibrated to the real role, daily tools and concrete objectives of the person. From ${formattedPrice}.`
    : isFr
      ? `Un collaborateur, un expert IA Axion-IA. Pas une formation groupe, pas un audit d'entreprise — un accompagnement individuel calibré sur le poste réel, les outils du quotidien et les objectifs concrets de la personne. À partir de ${formattedPrice}.`
      : `One employee, one Axion-IA AI expert. Not a group training, not a company audit — individual coaching calibrated to the real role, daily tools and concrete objectives of the person. From ${formattedPrice}.`;

  // Speakable JSON-LD pour le hero — cible H1 + description (assistants vocaux).
  // Emis explicitement ici car la page hub canonique émet déjà un Service JSON-LD
  // sans Speakable côté hero ; les pages ville n'ont pas ce backup.
  const speakableJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPageElement",
    speakable: buildSpeakableSpecification({
      selectors: ["h1", "[data-un-a-un-hero-description]"],
    }),
  } as const;

  return (
    <>
      <ServiceHero
        eyebrow={isFr ? "Module 4 · Accompagnement 1-to-1" : "Module 4 · 1-to-1 coaching"}
        title={title}
        titleEm={titleEm}
        description={description}
        ctas={
          <>
            <Cta
              href="/contact"
              variant="primary"
              size="lg"
              shape="pill"
              track="un-a-un-hero-primary"
            >
              {isFr ? "Démarrer mon accompagnement" : "Start my coaching"}
              <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta
              href={"/interventions/collectives" as never}
              variant="outline"
              size="lg"
              shape="pill"
              track="un-a-un-hero-formations"
            >
              {isFr ? "Voir les formations groupe" : "See group training"}
            </Cta>
          </>
        }
        schemaCenterLabel={isFr ? "1 collaborateur" : "1 employee"}
        schemaAriaLabel={
          isFr
            ? "Schéma : un collaborateur au centre, entouré des 8 objectifs maîtrisables en coaching 1-to-1 (productivité, automatisation, outils IA, communication, reporting, prise de décision, autonomie, transfert d'expertise)."
            : "Diagram: one employee at the center, surrounded by 8 objectives masterable in 1-to-1 coaching (productivity, automation, AI tools, communication, reporting, decision-making, autonomy, expertise transfer)."
        }
        schemaNodes={
          [
            {
              label: isFr ? "Productivité" : "Productivity",
              benefit: isFr ? "1-3 h/jour gagnées" : "1-3 h/day saved",
              accent: "terracotta",
            },
            {
              label: isFr ? "Automatisation" : "Automation",
              benefit: isFr ? "Tâches répétitives" : "Repetitive tasks",
              accent: "primary",
            },
            {
              label: isFr ? "Outils IA" : "AI tools",
              benefit: isFr ? "ChatGPT, Claude, Copilot" : "ChatGPT, Claude, Copilot",
              accent: "sage",
            },
            {
              label: isFr ? "Communication" : "Communication",
              benefit: isFr ? "Mails, comptes-rendus" : "Emails, reports",
              accent: "mocha",
            },
            {
              label: isFr ? "Reporting" : "Reporting",
              benefit: isFr ? "Synthèse auto" : "Auto-synthesis",
              accent: "terracotta",
            },
            {
              label: isFr ? "Décision" : "Decision",
              benefit: isFr ? "Données structurées" : "Structured data",
              accent: "primary",
            },
            {
              label: isFr ? "Autonomie" : "Autonomy",
              benefit: isFr ? "Plus de dépendance" : "No more dependency",
              accent: "sage",
            },
            {
              label: isFr ? "Transfert" : "Transfer",
              benefit: isFr ? "Équipe formée" : "Team trained",
              accent: "mocha",
            },
          ] as const satisfies ReadonlyArray<ServiceHeroNode>
        }
      />
      <JsonLd data={speakableJsonLd} />
    </>
  );
}
