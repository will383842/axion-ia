// Server Component — listing des formations d'un palier durée (catalogue V2).
// Jumelle de `CollectiveDurationListing` : même design exact (breadcrumb, hero,
// grille de cartes, couverture locale, FAQ Speakable, CtaBlock, sticky mobile),
// mais alimenté par `catalog-v2` (getFormationsV2ByDuree) au lieu de la taxonomie
// interventions. Contenu 100 % FR (EN 301→FR). Public/live (gating au niveau page
// supprimé — décision Will 2026-06-11 : /formations live, sans mention Qualiopi).

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { FormationFormatCard } from "@/components/formations/FormationFormatCard";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import { LocalGeoFaqSection } from "@/components/sections/LocalGeoFaqSection";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { getFormationsV2ByDuree } from "@/content/formations/catalog-v2";
import {
  type DureeMeta,
  formationDureeIso,
  getDureeMeta,
  getSurMesureByDuree,
} from "@/content/formations/catalog-v2-meta";
import type { FormationDuree } from "@/content/pricing";
import { buildCourseJsonLd, buildItemListJsonLd, SITE_URL } from "@/lib/seo";

const TIGHT_X = "lg:px-6 xl:px-10";

// FAQ Speakable par palier durée — Q/R distinctes pour éviter le duplicate
// content SEO entre les 4 sous-pages. Contenu fidèle au catalogue V2 actuel
// (aucune mention Qualiopi, aucun format supprimé). FaqAccordion injecte
// automatiquement FAQPage JSON-LD + Speakable.
const FAQ_BY_DUREE: Record<
  FormationDuree,
  ReadonlyArray<{ id: string; question: string; answer: string }>
> = {
  "4h": [
    {
      id: "4h-objectif",
      question: "Que peut-on accomplir en 4 heures ?",
      answer:
        "Une demi-journée pour mettre toute l'équipe au même niveau de base : prise en main, méthode de prompt, premiers usages concrets sur vos propres tâches. Chaque participant produit dès la séance et repart capable de travailler avec l'IA dès le lendemain.",
    },
    {
      id: "4h-effectif",
      question: "Combien de participants en 4 heures ?",
      answer:
        "De 2 à 15 personnes ou de 16 à 30 personnes selon la tranche, tarif dégressif par effectif (détail sur la page Tarifs). En intra-entreprise dans vos locaux ; un smartphone par participant suffit, sans abonnement IA payant.",
    },
    {
      id: "4h-prerequis",
      question: "Faut-il déjà connaître l'IA ?",
      answer:
        "Pour la plupart des formats 4 h, aucun pré-requis : on démarre tous les postes en même temps. L'Art du Prompt (niveau 2) demande en revanche d'utiliser déjà l'IA au quotidien.",
    },
    {
      id: "4h-frais",
      question: "Frais de déplacement inclus ?",
      answer:
        "Non. Logement (si nécessaire), repas et forfait trajet sont facturés en sus, calculés selon distance et durée. Devis transparent fourni avant signature.",
    },
  ],
  "1j": [
    {
      id: "1j-objectif",
      question: "Que livre une formation IA d'1 jour ?",
      answer:
        "Une journée complète (6-8 h sur site) sur vos documents et cas réels. Chaque participant repart avec un livrable terminé et maîtrise plusieurs usages applicables à ses tâches dès le lendemain.",
    },
    {
      id: "1j-formats",
      question: "Quels formats 1 jour disponibles ?",
      answer:
        "Six formats au choix selon votre besoin : IA Fondamentaux, IA Commercial, IA au Bureau, IA sur le Terrain, Automatisations Découverte, et Claude Découverte (gamme Claude).",
    },
    {
      id: "1j-effectif",
      question: "Combien de participants en 1 jour ?",
      answer:
        "De 2 à 30 personnes selon le format et la gamme, avec un tarif dégressif par tranche d'effectif. Les formats Agents & Automatisations sont limités à 12 personnes pour garder un atelier de qualité.",
    },
    {
      id: "1j-outils",
      question: "Quels outils IA utilisés en formation 1 jour ?",
      answer:
        "Ceux que votre équipe utilise déjà ou qui collent à votre métier : ChatGPT, Claude, Mistral, Microsoft Copilot, Perplexity, et les automatisations métier si pertinent. Pas de techno imposée.",
    },
  ],
  "2j": [
    {
      id: "2j-objectif",
      question: "Pourquoi choisir 2 jours plutôt qu'1 jour ?",
      answer:
        "Pour intégrer durablement : jour 1 la maîtrise, jour 2 vos vrais dossiers traités en séance. Les 2 jours permettent d'installer les méthodes et de produire sur des cas avancés, pas seulement de découvrir.",
    },
    {
      id: "2j-formats",
      question: "Quels formats 2 jours disponibles ?",
      answer:
        "Quatre formats : IA Intégration Métier, IA Commercial Avancé, Agents & Automatisations (gamme Agents), et Claude Créateur (gamme Claude).",
    },
    {
      id: "2j-effectif",
      question: "Combien de participants en 2 jours ?",
      answer:
        "De 2 à 30 personnes pour les formats IA, avec tarif dégressif. Les formats Agents & Automatisations et Claude sont en petits groupes pour maximiser la pratique.",
    },
    {
      id: "2j-frais",
      question: "Frais de déplacement inclus en formation 2 jours ?",
      answer:
        "Non. Logement (2 nuits sur site), repas et forfait trajet facturés en sus. Devis transparent avant signature.",
    },
  ],
  "3j": [
    {
      id: "3j-objectif",
      question: "Quand choisir une formation de 3 jours ?",
      answer:
        "Pour une vraie transformation : processus complets, référents formés, équipe autonome à la sortie. Le format 3 jours déploie l'IA en profondeur dans l'organisation, au-delà de la montée en compétence individuelle.",
    },
    {
      id: "3j-formats",
      question: "Quels formats 3 jours disponibles ?",
      answer:
        "Trois formats : IA Transformation Équipe, Agents & Automatisations Avancé (gamme Agents), et Claude Architecte (gamme Claude) — le niveau le plus avancé de chaque gamme.",
    },
    {
      id: "3j-effectif",
      question: "Combien de participants en 3 jours ?",
      answer:
        "Selon le format et la gamme. Les formats Agents et Claude restent en petits groupes pour que chaque participant reparte avec son propre outil construit, pas avec des notes.",
    },
    {
      id: "3j-frais",
      question: "Frais de déplacement inclus en formation 3 jours ?",
      answer:
        "Non. Logement, repas et forfait trajet facturés en sus, calculés selon distance et durée. Devis transparent avant signature.",
    },
  ],
};

interface Props {
  dureeId: FormationDuree;
  locale: Locale;
}

export function FormationDurationListing({ dureeId, locale }: Props): ReactNode {
  const isFr = locale === "fr";
  const meta: DureeMeta = getDureeMeta(dureeId);
  const formations = getFormationsV2ByDuree(dureeId);
  const surMesure = getSurMesureByDuree(dureeId);
  const isEmpty = formations.length === 0;
  const path = `/formations/duree/${meta.slug}`;

  const breadcrumbItems = [
    { href: "/formations", label: "Formations IA" },
    { href: path, label: meta.labelFr },
  ];

  const itemListJsonLd = isEmpty
    ? null
    : buildItemListJsonLd({
        locale,
        path,
        name: meta.labelFr,
        items: formations.map((f, idx) => ({
          position: idx + 1,
          name: f.titreFr,
          url: `${SITE_URL}/${locale}/formations/${f.slugFr}`,
          description: f.accrocheFr,
        })),
      });

  const courseJsonLd = isEmpty
    ? null
    : buildCourseJsonLd({
        locale,
        path,
        name: `Formation IA opérationnelle — ${meta.labelFr}`,
        description: `Formation IA opérationnelle sur ${meta.heuresFr.toLowerCase()} pour TPE, PME, ETI et grandes entreprises. Format Axion-IA sur site, sur vos cas réels. ${formations.length} formations disponibles.`,
        courseMode: ["Onsite"],
        duration: formationDureeIso(dureeId),
        audienceType:
          "Décideurs, managers, équipes opérationnelles TPE PME ETI grandes entreprises (B2B)",
        about: "IA opérationnelle (ChatGPT, Claude, Mistral, Copilot, agents IA, automatisations)",
      });

  const faqItems = FAQ_BY_DUREE[dureeId];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO PALIER */}
      <section className="bg-halo-warm text-fg relative overflow-hidden py-14 sm:py-16 lg:py-20">
        <Container className={cn("relative", TIGHT_X)}>
          <div className="max-w-3xl">
            <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
              <span
                aria-hidden="true"
                className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
              />
              Formations équipe
              <span className="mx-2 opacity-50">·</span>
              {meta.shortFr}
            </p>

            <h1 className="display-editorial text-fg mt-5">{meta.labelFr}</h1>

            <p className="text-fg-soft mt-5 max-w-2xl text-lg leading-relaxed sm:text-xl">
              {meta.taglineFr}
              {!isEmpty
                ? ` — ${formations.length} formation${formations.length > 1 ? "s" : ""} disponible${formations.length > 1 ? "s" : ""}.`
                : ""}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Cta
                href="/appel"
                size="lg"
                className="bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)]"
                track={`formations-duree-${meta.slug}-hero-call`}
              >
                Réserver un appel
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Cta>
              <Cta
                href="/formations"
                variant="outline"
                size="lg"
                track={`formations-duree-${meta.slug}-hero-back`}
              >
                ← Autres durées
              </Cta>
            </div>
          </div>
        </Container>
      </section>

      {/* CORPS — liste des formations du palier */}
      <Section
        eyebrow="Formations disponibles"
        title="Toutes les formations"
        titleEm={`en ${meta.shortFr}`}
        description="Cliquez sur une formation pour voir le programme détaillé, le public visé et les paliers tarifaires. Vous pouvez aussi nous écrire ou réserver un appel pour être orienté·e."
        contentClassName={TIGHT_X}
      >
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-7">
          {formations.map((f) => (
            <FormationFormatCard key={f.id} formation={f} locale={locale} />
          ))}
        </div>
      </Section>

      {/* SUR MESURE — format de cette durée co-construit avec vous (sur devis) */}
      {surMesure.length > 0 ? (
        <Section
          tone="sand"
          eyebrow="Sur mesure"
          title="Plutôt un format"
          titleEm={`${meta.shortFr} sur mesure ?`}
          description="On co-construit le programme avec vous : thème, public, cas pratiques définis ensemble. Sur devis."
          contentClassName={TIGHT_X}
        >
          <Container>
            <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
              {surMesure.map((s) => (
                <div
                  key={s.id}
                  className="border-border bg-paper flex flex-col items-start gap-3 rounded-3xl border border-dashed p-6 sm:p-7"
                >
                  <div>
                    <p className="text-fg text-lg font-semibold">
                      {s.labelFr} <span className="text-fg-muted font-normal">· {s.dureeFr}</span>
                    </p>
                    <p className="text-fg-soft mt-1 text-[15px] leading-relaxed">
                      {s.descriptionFr}
                    </p>
                  </div>
                  <Cta
                    href="/contact"
                    variant="outline"
                    size="md"
                    track={`formations-duree-${meta.slug}-surmesure`}
                  >
                    Demander un devis
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Cta>
                </div>
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      {/* COUVERTURE NATIONALE (pSEO villes/régions) */}
      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr={`Les formations IA équipe ${meta.shortFr}`}
        serviceLabelEn={`AI team trainings ${meta.shortFr}`}
        serviceSlug="interventions"
        tone="paper"
      />

      {/* FAQ GÉOLOCALISÉE — émet FAQPage Speakable JSON-LD */}
      <LocalGeoFaqSection isFr={isFr} service="interventions" tone="sand" />

      {/* FAQ spécifique au palier durée — FAQPage Speakable JSON-LD auto. */}
      <Section
        eyebrow="Questions fréquentes"
        title={`Formation ${meta.shortFr}`}
        titleEm="ce qu'on vous demande souvent"
      >
        <Container>
          <FaqAccordion className="mx-auto max-w-3xl" items={faqItems} />
        </Container>
      </Section>

      <CtaBlock
        eyebrow="Une question ?"
        title="Parler à quelqu'un avant de réserver"
        description="Un appel où l'on prend le temps de tout cadrer à la perfection — pour valider que ce format colle à votre contexte. Sans engagement."
        cta={
          <Cta
            href="/appel"
            size="lg"
            className="bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)] hover:shadow-[0_12px_32px_-8px_rgba(26,77,217,0.7)]"
            track={`formations-duree-${meta.slug}-ctablock`}
          >
            Réserver un appel →
          </Cta>
        }
        tone="dark"
      />

      <StickyMobileCta
        href="/appel"
        label="Réserver un appel"
        track={`formations-duree-${meta.slug}-sticky-mobile`}
      />

      {itemListJsonLd ? <JsonLd data={itemListJsonLd} /> : null}
      {courseJsonLd ? <JsonLd data={courseJsonLd} /> : null}
    </>
  );
}
