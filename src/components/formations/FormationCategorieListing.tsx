// Server Component — listing des formations d'une CATÉGORIE du catalogue
// (« par métier » / « par secteur d'activité ») — refonte 2026-07-19 (Will).
// Remplace l'axe durée (`FormationDurationListing`, supprimé) : même squelette
// éprouvé (breadcrumb, hero, grille de cartes, FAQ Speakable, CtaBlock, sticky
// mobile), alimenté par `getFormationsV2ByCategorie`. Contenu 100 % FR
// (EN 301→FR). Prix publics dérivés de la matrice — jamais en dur.

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { FormationFormatCard } from "@/components/formations/FormationFormatCard";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { Link } from "@/i18n/navigation";
import {
  getFormationsV2ByCategorie,
  getFormationV2EntryPrice,
} from "@/content/formations/catalog-v2";
import { formationDureeIso, getCategorieMeta } from "@/content/formations/catalog-v2-meta";
import { formatAmount, getFormationPrice, type FormationCategorie } from "@/content/pricing";
import {
  buildCollectionPageJsonLd,
  buildCourseJsonLd,
  buildItemListJsonLd,
  SITE_URL,
} from "@/lib/seo";

const TIGHT_X = "lg:px-6 xl:px-10";

// FAQ Speakable par catégorie — Q/R distinctes pour éviter le duplicate content
// entre les 2 listings. FaqAccordion injecte FAQPage JSON-LD + Speakable.
// Les réponses « prix » DÉRIVENT de la matrice pricing.ts (garde-fou
// no-hardcoded-prices) — `formatAmount` non-compact porte déjà « € HT ».
function buildFaqByCategorie(): Record<
  Extract<FormationCategorie, "metier" | "secteur">,
  ReadonlyArray<{ id: string; question: string; answer: string }>
> {
  return {
    metier: [
      {
        id: "metier-vs-generale",
        question: "Formation métier ou offre générale : comment choisir ?",
        answer:
          "Si l'équipe à former appartient à une même fonction (RH, commercial, finance…), la formation métier va plus loin : chaque atelier porte sur les tâches précises de la fonction. Pour un groupe multi-services ou une première découverte, commencez par « IA pour bien commencer » ou « IA pour les équipes ».",
      },
      {
        id: "metier-melange",
        question: "Peut-on mélanger plusieurs métiers dans un même groupe ?",
        answer:
          "C'est possible, mais on le déconseille pour ces formations : leur valeur vient des cas d'usage propres à chaque fonction. Pour un groupe multi-métiers, l'offre générale « IA pour les équipes » est plus adaptée — même méthode, cas transversaux.",
      },
      {
        id: "metier-prix",
        question: "Combien coûte une formation par métier ?",
        answer: `Le prix est fixe et public, par groupe de 2 à 15 participants : ${formatAmount(getFormationPrice("metier", "1j") ?? Number.NaN, "fr")} la journée. Les deux formations de 2 jours (Production/Opérations et IT/Développement) sont à ${formatAmount(getFormationPrice("metier", "2j") ?? Number.NaN, "fr")}, scindables en 2×1 jour.`,
      },
      {
        id: "metier-perso",
        question: "Le programme est-il adapté à notre entreprise ?",
        answer:
          "Oui : le programme cadre est celui du métier, mais les ateliers travaillent sur les documents et cas réels apportés par vos participants — préparés en amont avec vous lors du cadrage.",
      },
    ],
    secteur: [
      {
        id: "secteur-vs-metier",
        question: "Formation secteur ou formation métier : quelle différence ?",
        answer:
          "La formation secteur couvre l'ensemble de l'activité d'une entreprise de votre secteur (santé, BTP, industrie…) avec ses contraintes propres — confidentialité des données de santé, appels d'offres, réglementation. La formation métier cible une fonction précise (RH, finance…), quel que soit le secteur.",
      },
      {
        id: "secteur-conformite",
        question: "Les contraintes réglementaires de notre secteur sont-elles prises en compte ?",
        answer:
          "Oui, c'est le cœur de ces formations : secret médical et RGPD santé, confidentialité des données financières, réglementation du bâtiment… Chaque programme intègre les règles du secteur et les réflexes à installer — ce qu'on soumet à l'IA, ce qu'on ne soumet jamais.",
      },
      {
        id: "secteur-prix",
        question: "Combien coûte une formation par secteur d'activité ?",
        answer: `Le prix est fixe et public, par groupe de 2 à 15 participants : ${formatAmount(getFormationPrice("secteur", "1j") ?? Number.NaN, "fr")} la journée. La formation Industrie (2 jours, scindable 2×1j) est à ${formatAmount(getFormationPrice("secteur", "2j") ?? Number.NaN, "fr")}.`,
      },
      {
        id: "secteur-absent",
        question: "Notre secteur n'est pas dans la liste — que faire ?",
        answer:
          "Réservez un appel : selon votre activité, une formation métier ou une offre générale adaptée à vos cas d'usage couvre très bien le besoin — et nous construisons aussi des programmes sur mesure.",
      },
    ],
  };
}

interface Props {
  categorie: Extract<FormationCategorie, "metier" | "secteur">;
  locale: Locale;
}

export function FormationCategorieListing({ categorie, locale }: Props): ReactNode {
  const isFr = locale === "fr";
  const meta = getCategorieMeta(categorie);
  const formations = getFormationsV2ByCategorie(categorie);
  const path = `/formations/${meta.slug}`;

  const breadcrumbItems = [
    { href: "/formations", label: "Formations IA" },
    { href: path, label: meta.labelFr },
  ];

  // ItemList — toutes les formations de la catégorie, vers leur fiche.
  const itemListJsonLd = buildItemListJsonLd({
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

  const collectionPageJsonLd = buildCollectionPageJsonLd({
    locale,
    path,
    name: meta.labelFr,
    description: meta.taglineFr,
    speakable: true,
  });

  // Course par formation de la catégorie (AEO : « formation IA RH », etc.).
  const courseJsonLdArray = formations.map((f) =>
    buildCourseJsonLd({
      locale,
      path: `/formations/${f.slugFr}`,
      name: f.titreFr,
      description: f.metaDescriptionFr,
      courseMode: ["Onsite"],
      duration: formationDureeIso(f.duree),
      audienceType:
        "Décideurs, managers, équipes opérationnelles PME ETI grandes entreprises (B2B)",
      about: "IA opérationnelle (ChatGPT, Claude, Gemini, méthode AXION)",
    }),
  );

  const prixEntree = formations
    .map((f) => getFormationV2EntryPrice(f))
    .filter((p): p is number => typeof p === "number");
  const minPrix = prixEntree.length ? Math.min(...prixEntree) : undefined;

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO compact — le hub porte le gros hero ; ici, droit au catalogue. */}
      <Section
        eyebrow={isFr ? "Catalogue formations" : "Training catalogue"}
        title={
          categorie === "metier"
            ? isFr
              ? "Formations IA"
              : "AI trainings"
            : isFr
              ? "Formations IA"
              : "AI trainings"
        }
        titleEm={categorie === "metier" ? "par métier" : "par secteur d'activité"}
        description={`${meta.taglineFr}${
          typeof minPrix === "number"
            ? ` Prix par groupe (2 à 15 participants), dès ${formatAmount(minPrix, "fr")}.`
            : ""
        }`}
        contentClassName={TIGHT_X}
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:gap-6">
          {formations.map((f) => (
            <FormationFormatCard key={f.id} formation={f} locale={locale} />
          ))}
        </div>

        {/* Renvoi croisé vers l'autre catégorie + le hub */}
        <p className="mt-8 text-center">
          <Link
            href={
              (categorie === "metier" ? "/formations/secteurs" : "/formations/metiers") as never
            }
            className="text-terracotta hover:text-terracotta-deep inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline"
          >
            {categorie === "metier"
              ? isFr
                ? "Voir aussi les formations par secteur d'activité"
                : "See also industry-specific trainings"
              : isFr
                ? "Voir aussi les formations par métier"
                : "See also role-specific trainings"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </p>
      </Section>

      {/* Orientation — pas sûr du bon choix ? */}
      <section className="bg-terracotta py-14 sm:py-16">
        <Container>
          <div className="flex flex-col items-center gap-6 text-center md:flex-row md:justify-between md:text-left">
            <div className="max-w-2xl">
              <h2
                className="text-mocha-fg text-[clamp(1.5rem,3vw,2.25rem)] leading-tight font-semibold tracking-tight"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr
                  ? "Pas sûr que ce soit la bonne formation ?"
                  : "Not sure it's the right training?"}
              </h2>
              <p className="text-mocha-fg/90 mt-2 text-base leading-relaxed">
                {isFr
                  ? "Réservez un appel gratuit et sans engagement : on fait le point sur vos besoins et on vous oriente vers le format le plus adapté à votre équipe."
                  : "Book a free, no-commitment call: we review your needs and point you to the format that fits your team best."}
              </p>
            </div>
            <div className="shrink-0">
              <Cta
                href="/appel"
                size="lg"
                className="bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)]"
                track={`formations-${meta.slug}-band-call`}
              >
                {isFr ? "Réserver un appel" : "Book a call"}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Cta>
            </div>
          </div>
        </Container>
      </section>

      {/* COUVERTURE NATIONALE (pSEO villes/régions) */}
      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr={meta.labelFr}
        serviceLabelEn={
          categorie === "metier" ? "Role-specific AI trainings" : "Industry AI trainings"
        }
        serviceSlug="interventions"
        tone="paper"
      />

      {/* FAQ Speakable */}
      <Section
        eyebrow={isFr ? "Questions fréquentes" : "Frequent questions"}
        title={isFr ? "Avant de choisir" : "Before choosing"}
        titleEm={isFr ? "votre formation" : "your training"}
      >
        <Container>
          <FaqAccordion className="mx-auto max-w-3xl" items={buildFaqByCategorie()[categorie]} />
        </Container>
      </Section>

      <CtaBlock
        eyebrow={isFr ? "Formation IA en entreprise" : "Corporate AI training"}
        title={isFr ? "Faites monter en compétence" : "Upskill"}
        titleEm={isFr ? "vos équipes à l'IA" : "your teams in AI"}
        description={
          isFr
            ? "Un formateur IA expert intervient sur votre site ou à distance. Vos équipes appliquent la méthode à leurs tâches réelles et gagnent des heures dès la 1ʳᵉ session."
            : "An expert AI trainer comes on site or online. Your teams apply the method to their real tasks and save hours from the very first session."
        }
        cta={
          <Cta
            href="/appel"
            size="lg"
            className="bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)]"
            track={`formations-${meta.slug}-ctablock`}
          >
            {isFr ? "Réserver un appel" : "Book a call"} →
          </Cta>
        }
        tone="dark"
      />

      <StickyMobileCta
        href="/appel"
        label={isFr ? "Réserver un appel" : "Book a call"}
        track={`formations-${meta.slug}-sticky-mobile`}
      />

      <JsonLd data={collectionPageJsonLd} />
      <JsonLd data={itemListJsonLd} />
      {courseJsonLdArray.map((course, idx) => (
        <JsonLd key={`course-${idx}`} data={course} />
      ))}
    </>
  );
}
