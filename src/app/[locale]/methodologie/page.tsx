import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Search,
  ClipboardList,
  Cog,
  TrendingUp,
  Database,
  Unlock,
  LineChart,
  ShieldCheck,
} from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { HeroBadge } from "@/components/marketing/HeroBadge";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { MethodologyHeroSchema } from "@/components/sections/MethodologyHeroSchema";
import { FaqBlock } from "@/components/sections/FaqBlock";
// `Illustration` avait été RETIRÉ le 2026-08-10 : ses deux usages étaient des
// `Illustration` SANS `src`, donc des cadres pointillés « emplacement d'image »
// servis tels quels en production. Il est réintroduit ici avec de VRAIES photos
// (Unsplash curées en AVIF local par scripts/curate-pages-editoriales-unsplash.mjs).
// ⚠️ Ne jamais reposer un `<Illustration>` sans `src` — c'est ce qui produit le
// cadre pointillé en prod.
import { Illustration } from "@/components/visual/Illustration";
import { EditorialPhotoCredit } from "@/components/media/EditorialPhotoCredit";
import { FadeInOnView } from "@/components/motion/FadeInOnView";
import { FeatureMediaCard } from "@/components/marketing/FeatureMediaCard";
import { DarkTriadPanel } from "@/components/marketing/DarkTriadPanel";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import {
  buildProductMetadata,
  buildHowToJsonLd,
  buildArticleJsonLd,
  buildWebPageJsonLd,
  SITE_EDITORIAL_DATE,
} from "@/lib/seo";
import { INTERVENTION_TIERS, getTierById } from "@/content/pricing";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/methodologie",
    title:
      locale === "fr"
        ? "Méthodologie Axion-IA · 4 étapes vers le ROI"
        : "Axion-IA methodology · 4 steps to ROI",
    description:
      locale === "fr"
        ? "La méthode Axion-IA en 4 étapes : cartographie terrain, audit en 5 jours, implémentation en 6-8 semaines, ROI mesuré. Découplée du contrat long. Demandez un audit."
        : "Our methodology: field audit, applied demos, costed plan, piloted implementation.",
    alternates: { fr: "/methodologie", en: "/methodology" },
    // og:type "article" et non "website" (défaut) : la page émet déjà un nœud
    // `Article` JSON-LD avec datePublished / dateModified / author. Laisser
    // "website" contredisait ce signal et privait les aperçus LinkedIn/Facebook
    // des métadonnées `article:*` (fraîcheur + attribution). Même traitement que
    // /actualites/[slug] et les autres pages éditoriales.
    ogType: "article",
    article: {
      publishedTime: "2025-12-01",
      modifiedTime: SITE_EDITORIAL_DATE,
      section: locale === "fr" ? "Méthodologie" : "Methodology",
      tags:
        locale === "fr"
          ? ["méthodologie IA", "audit IA", "implémentation IA", "ROI IA"]
          : ["AI methodology", "AI audit", "AI implementation", "AI ROI"],
    },
  });
}

export default async function MethodologyPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // Nœud WebPage page-level — porteur du `speakable` (h1). Réutilise EXACTEMENT
  // le titre/description de la metadata (pas de réécriture). Coexiste avec
  // l'Article et le HowTo émis plus bas.
  const webPageJsonLd = buildWebPageJsonLd({
    locale: loc,
    path: "/methodologie",
    name: isFr
      ? "Méthodologie Axion-IA · 4 étapes vers le ROI"
      : "Axion-IA methodology · 4 steps to ROI",
    description: isFr
      ? "La méthode Axion-IA en 4 étapes : cartographie terrain, audit en 5 jours, implémentation en 6-8 semaines, ROI mesuré. Découplée du contrat long. Demandez un audit."
      : "Our methodology: field audit, applied demos, costed plan, piloted implementation.",
    speakable: true,
  });

  // Article JSON-LD via factory centralisée — porte les signaux E-E-A-T 2026
  // (Author + dateModified + publisher logo + mainEntityOfPage) automatiquement.
  // Audit perfection 2026-05-12.
  const articleJsonLd = buildArticleJsonLd({
    locale: loc,
    path: loc === "fr" ? "/methodologie" : "/methodology",
    headline: isFr
      ? "Méthodologie Axion-IA · 4 étapes vers le ROI"
      : "Axion-IA methodology · 4 steps to ROI",
    description: isFr
      ? "Notre méthode propriétaire en 4 étapes : identifier sur le terrain, auditer en 5 jours, implémenter en 6-8 semaines, mesurer le ROI réel."
      : "Our proprietary 4-step method: identify in the field, audit in 5 days, implement in 6-8 weeks, measure real ROI.",
    datePublished: "2025-12-01",
    dateModified: SITE_EDITORIAL_DATE,
    articleSection: isFr ? "Méthodologie" : "Methodology",
    keywords: isFr
      ? ["méthodologie IA", "audit IA", "implémentation IA", "ROI IA"]
      : ["AI methodology", "AI audit", "AI implementation", "AI ROI"],
  });

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [{ href: "/methodologie", label: isFr ? "Méthodologie" : "Methodology" }];

  // HowTo JSON-LD — AEO 2026 critical : Google AI Overviews + Perplexity
  // citent les HowTo schemas pour répondre aux requêtes « comment Axion-IA
  // procède ? », « quelles étapes pour un audit IA ? », etc.
  const howToJsonLd = buildHowToJsonLd({
    locale: loc,
    path: "/methodologie",
    name: isFr
      ? "Méthodologie Axion-IA · 4 étapes vers le ROI"
      : "Axion-IA methodology · 4 steps to ROI",
    description: isFr
      ? "Notre méthode propriétaire en 4 étapes : identifier sur le terrain, auditer en 5 jours, implémenter en 6-8 semaines, mesurer le ROI réel."
      : "Our proprietary 4-step method: identify in the field, audit in 5 days, implement in 6-8 weeks, measure real ROI.",
    totalTime: "P12W",
    // Prix d'entrée de la méthode = tarif SSOT du format collectif (1 journée)
    // (la « 1 journée d'intervention » de l'étape Identifier). Jamais hardcodé :
    // dérivé de pricing.ts pour rester aligné si Will fait évoluer la grille.
    estimatedCost: {
      currency: "EUR",
      value: String(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat),
    },
    steps: isFr
      ? [
          {
            name: "Identifier",
            text: "Cartographie terrain en 1 journée d'intervention sur site. 3-5 process candidats à l'IA, démos live sur vos données anonymisées, identification des quick-wins déployables sous 30 jours.",
          },
          {
            name: "Auditer",
            text: "Audit IA en 5 jours : cartographie complète, scoring ROI/complexité par opportunité, plan d'implémentation chiffré priorisé. Livrable PDF 25-40 pages + atelier de restitution.",
          },
          {
            name: "Implémenter",
            text: "Mise en production en 6-8 semaines : cadrage technique, prototype itératif, tests utilisateurs, déploiement progressif, support 30 jours inclus.",
          },
          {
            name: "Mesurer",
            text: "Mesure du ROI réel post-déploiement : heures économisées, coût économisé, impact qualitatif. Itération si dérive de qualité observée.",
          },
        ]
      : [
          {
            name: "Identify",
            text: "Field mapping in 1 day on-site session. 3-5 candidate processes for AI, live demos on your anonymised data, identification of quick-wins deployable within 30 days.",
          },
          {
            name: "Audit",
            text: "5-day AI audit: complete mapping, ROI/complexity scoring per opportunity, costed prioritised implementation plan. 25-40 page PDF deliverable + debrief workshop.",
          },
          {
            name: "Implement",
            text: "Production deployment in 6-8 weeks: technical scoping, iterative prototype, user testing, progressive rollout, 30-day support included.",
          },
          {
            name: "Measure",
            text: "Real ROI measurement post-deployment: hours saved, cost saved, qualitative impact. Iteration if quality drift is observed.",
          },
        ],
  });

  // Habillage visuel des 4 étapes — accent, icône, et surtout le CHIFFRE-CLÉ
  // affiché dans la bande. Les durées et livrables sont repris mot pour mot du
  // texte des étapes ci-dessous (1 journée sur site, audit 5 jours, mise en
  // production 6-8 semaines, mesure du ROI post-déploiement) : aucun chiffre
  // nouveau n'est avancé ici. Ordre = celui de `steps`.
  const STEP_VISUALS = [
    {
      accent: "terracotta" as const,
      Icon: Search,
      figureFr: "1 jour",
      figureEn: "1 day",
      labelFr: "sur site · 3-5 process",
      labelEn: "on site · 3-5 processes",
    },
    {
      accent: "primary" as const,
      Icon: ClipboardList,
      figureFr: "5 jours",
      figureEn: "5 days",
      labelFr: "livrable 25-40 pages",
      labelEn: "25-40 page deliverable",
    },
    {
      accent: "sage" as const,
      Icon: Cog,
      figureFr: "6-8 sem.",
      figureEn: "6-8 wks",
      labelFr: "jusqu'à la production",
      labelEn: "through to production",
    },
    {
      accent: "ochre" as const,
      Icon: TrendingUp,
      figureFr: "ROI",
      figureEn: "ROI",
      labelFr: "mesuré, pas promis",
      labelEn: "measured, not promised",
    },
  ];

  // Étapes — refonte Will 2026-08-10.
  //
  // Le paragraphe de 5-6 lignes par étape était le cœur du reproche « beaucoup
  // trop textuel ». Il est éclaté en trois niveaux de lecture :
  //   `p`       une phrase, ce que l'étape EST ;
  //   `bullets` trois points scannables, ce qu'elle CONTIENT ;
  //   `livrable` ce avec quoi vous repartez.
  //
  // Rien n'est perdu pour le référencement : le texte long d'origine reste
  // intégralement dans le `HowTo` JSON-LD ci-dessus, qui est ce que lisent
  // Google AI Overviews et Perplexity. Le `livrable` absorbe l'ancienne section
  // « Quatre livrables » — elle répétait les mêmes 4 items une seconde fois.
  const steps = isFr
    ? [
        {
          n: "01",
          h: "Identifier",
          p: "Une journée sur site pour cartographier vos process et repérer où l'IA fait gagner du temps.",
          bullets: [
            "3 à 5 process candidats retenus",
            "Démos live sur vos données anonymisées",
            "Quick-wins déployables sous 30 jours",
          ],
          livrable: "Cartographie terrain",
        },
        {
          n: "02",
          h: "Auditer",
          p: "Cinq jours pour chiffrer chaque opportunité et vous remettre un plan que vos équipes peuvent exécuter.",
          bullets: [
            "Cartographie complète des process",
            "Scoring ROI / complexité par opportunité",
            "Atelier de restitution avec vos équipes",
          ],
          livrable: "Plan chiffré priorisé · PDF 25-40 pages",
        },
        {
          n: "03",
          h: "Implémenter",
          p: "Six à huit semaines pour passer du plan à une solution qui tourne dans vos outils.",
          bullets: [
            "Cadrage technique puis prototype itératif",
            "Tests utilisateurs, déploiement progressif",
            "Stack open-source ou propriétaire selon le cas",
          ],
          livrable: "Solution en production · 30 jours de support",
        },
        {
          n: "04",
          h: "Mesurer",
          p: "On revient compter ce que ça a réellement rapporté, sur les indicateurs convenus au départ.",
          bullets: [
            "Heures et coûts économisés, impact qualitatif",
            "Itération si une dérive de qualité apparaît",
            "Aucun engagement long terme",
          ],
          livrable: "ROI mesuré",
        },
      ]
    : [
        {
          n: "01",
          h: "Identify",
          p: "One day on site to map your processes and spot where AI actually saves time.",
          bullets: [
            "3 to 5 candidate processes selected",
            "Live demos on your anonymised data",
            "Quick-wins deployable within 30 days",
          ],
          livrable: "Field mapping",
        },
        {
          n: "02",
          h: "Audit",
          p: "Five days to cost every opportunity and hand you a plan your teams can execute.",
          bullets: [
            "Complete process mapping",
            "ROI / complexity scoring per opportunity",
            "Debrief workshop with your teams",
          ],
          livrable: "Costed prioritised plan · 25-40 page PDF",
        },
        {
          n: "03",
          h: "Implement",
          p: "Six to eight weeks to go from plan to a solution running inside your tools.",
          bullets: [
            "Technical scoping then iterative prototype",
            "User testing, progressive rollout",
            "Open-source or proprietary stack as needed",
          ],
          livrable: "Solution in production · 30 days of support",
        },
        {
          n: "04",
          h: "Measure",
          p: "We come back and count what it actually returned, on the indicators agreed upfront.",
          bullets: [
            "Hours and costs saved, qualitative impact",
            "Iteration if quality drift appears",
            "No long-term commitment",
          ],
          livrable: "Measured ROI",
        },
      ];

  // Icônes des 3 principes, dans l'ordre de `whyMethodology`.
  const PRINCIPLE_ICONS = [Database, Unlock, LineChart];

  const whyMethodology = isFr
    ? [
        {
          h: "Sur vos données, pas sur des démos vendeur",
          p: "Chaque étape s'appuie sur vos process réels, vos outils, vos chiffres. On démontre, on ne raconte pas.",
        },
        {
          h: "Découplée du contrat long",
          p: "Vous pouvez vous arrêter après l'audit, après l'implémentation, après la mesure. Aucun lock-in technique ni commercial.",
        },
        {
          h: "Mesurée, pas promise",
          p: "Le ROI est calculé sur des indicateurs convenus avant le déploiement, pas sur des projections marketing.",
        },
      ]
    : [
        {
          h: "On your data, not on vendor demos",
          p: "Every step uses your real processes, tools and numbers. We demonstrate — we don't pitch.",
        },
        {
          h: "Decoupled from long contracts",
          p: "You can stop after the audit, after deployment, after measurement. Zero technical or commercial lock-in.",
        },
        {
          h: "Measured, not promised",
          p: "ROI is calculated on indicators agreed before deployment, not on marketing projections.",
        },
      ];

  // FAQ AEO — Q/R factuelles citables (Google AI Overviews / Perplexity).
  // FaqBlock émet automatiquement le FAQPage JSON-LD via FaqAccordion.
  const methodoFaq = isFr
    ? [
        {
          id: "duree-audit",
          question: "Combien de temps dure un audit IA Axion-IA ?",
          answer:
            "L'audit IA Axion-IA se déroule sur 5 jours : cartographie complète des process, scoring ROI/complexité par opportunité et plan d'implémentation chiffré priorisé. Vous repartez avec un livrable PDF de 25 à 40 pages et un atelier de restitution.",
        },
        {
          id: "arret-apres-audit",
          question: "Peut-on s'arrêter après l'audit, sans poursuivre l'implémentation ?",
          answer:
            "Oui. La méthode est volontairement découplée du contrat long : vous pouvez vous arrêter après l'audit, après l'implémentation ou après la mesure. Aucun lock-in technique ni commercial, et le plan chiffré reste exploitable même si vous internalisez la suite.",
        },
        {
          id: "roi-attendu",
          question: "Quel ROI attendre d'une mission Axion-IA ?",
          answer:
            "Le ROI est calculé sur des indicateurs convenus avant le déploiement (heures économisées, coût économisé, impact qualitatif), pas sur des projections marketing. Il est mesuré sur vos process réels après mise en production, puis ajusté si une dérive de qualité est observée.",
        },
        {
          id: "etapes",
          question: "Quelles sont les étapes de la méthodologie Axion-IA ?",
          answer:
            "Quatre temps clairement séparés, chacun produisant un livrable concret : Identifier (cartographie terrain en 1 journée), Auditer (audit en 5 jours), Implémenter (mise en production en 6-8 semaines, support 30 jours inclus), Mesurer (ROI réel post-déploiement).",
        },
        {
          id: "par-ou-commencer",
          question: "Par où commencer si on n'a jamais fait d'IA ?",
          answer:
            "Par l'étape 1, la journée d'intervention sur site. Aucun pré-requis technique : on part de vos process actuels et de vos vrais documents. À la fin de la journée, vous avez 3 à 5 pistes chiffrées et vous savez si la suite vaut le coup. Beaucoup d'entreprises s'arrêtent là et déploient les quick-wins en interne.",
        },
        {
          id: "donnees-propres",
          question: "Faut-il que nos données soient propres ou structurées au préalable ?",
          answer:
            "Non. On travaille sur vos données telles qu'elles sont, y compris des PDF scannés, des tableurs bricolés ou des boîtes mail. La qualité des données fait partie du diagnostic : si un process n'est pas exploitable en l'état, c'est une conclusion de l'audit, pas un pré-requis pour le démarrer.",
        },
        {
          id: "qui-intervient",
          question: "Qui intervient concrètement chez nous ?",
          answer:
            "L'intervenant senior qui a cadré votre besoin. C'est lui qui anime la journée sur site, qui conduit l'audit et qui réalise l'implémentation — pas de passage de relais entre un avant-vente et une équipe de production.",
        },
        {
          id: "donnees-sortie",
          question: "Nos données sortent-elles de l'entreprise ?",
          answer:
            "Les démonstrations se font sur des données anonymisées. Pour les solutions déployées, l'hébergement est européen (Hetzner, Francfort) et le traitement conforme RGPD. Selon la sensibilité, la stack peut être open-source auto-hébergée chez vous plutôt que sur un service tiers — c'est un arbitrage posé au cadrage technique.",
        },
        {
          id: "taille-entreprise",
          question: "La méthode fonctionne-t-elle pour une PME ?",
          answer:
            "Oui, avec le même niveau d'exigence que pour un grand groupe. Les 4 étapes sont les mêmes, seule leur profondeur varie : chez un artisan, l'étape 1 suffit souvent à dégager 1 à 3 heures par jour.",
        },
        {
          id: "roi-absent",
          question: "Que se passe-t-il si le ROI n'est pas au rendez-vous ?",
          answer:
            "Les indicateurs sont convenus AVANT le déploiement, ce qui rend le constat vérifiable des deux côtés. Si une dérive de qualité est observée, l'étape 4 déclenche une itération. Et comme la méthode est découplée du contrat long, vous n'êtes engagé sur aucune suite : vous pouvez vous arrêter à la fin de n'importe quelle étape.",
        },
      ]
    : [
        {
          id: "duree-audit",
          question: "How long does an Axion-IA AI audit take?",
          answer:
            "The Axion-IA AI audit runs over 5 days: complete process mapping, ROI/complexity scoring per opportunity and a costed prioritised implementation plan. You leave with a 25-40 page PDF deliverable and a debrief workshop.",
        },
        {
          id: "arret-apres-audit",
          question: "Can we stop after the audit, without continuing the implementation?",
          answer:
            "Yes. The method is deliberately decoupled from long contracts: you can stop after the audit, after implementation or after measurement. Zero technical or commercial lock-in, and the costed plan stays usable even if you handle the rest in-house.",
        },
        {
          id: "roi-attendu",
          question: "What ROI should we expect from an Axion-IA engagement?",
          answer:
            "ROI is calculated on indicators agreed before deployment (hours saved, cost saved, qualitative impact), not on marketing projections. It is measured on your actual processes after go-live, then adjusted if quality drift is observed.",
        },
        {
          id: "etapes",
          question: "What are the steps of the Axion-IA methodology?",
          answer:
            "Four clearly separated phases, each producing a concrete deliverable: Identify (1-day field mapping), Audit (5-day audit), Implement (production in 6-8 weeks, 30-day support included), Measure (real post-deployment ROI).",
        },
        {
          id: "par-ou-commencer",
          question: "Where do we start if we have never done any AI?",
          answer:
            "With step 1, the on-site day. No technical prerequisite: we start from your current processes and your real documents. By the end of the day you have 3 to 5 costed leads and you know whether the rest is worth it. Many companies stop there and roll out the quick-wins in-house.",
        },
        {
          id: "donnees-propres",
          question: "Do our data need to be clean or structured beforehand?",
          answer:
            "No. We work with your data as it is, including scanned PDFs, improvised spreadsheets or mailboxes. Data quality is part of the diagnosis: if a process is not usable as-is, that is a finding of the audit, not a prerequisite to start it.",
        },
        {
          id: "qui-intervient",
          question: "Who actually comes on site?",
          answer:
            "The senior who scoped your need. They run the on-site day, conduct the audit and carry out the implementation — no handover between a pre-sales contact and a delivery team.",
        },
        {
          id: "donnees-sortie",
          question: "Do our data leave the company?",
          answer:
            "Demos run on anonymised data. For deployed solutions, hosting is European (Hetzner, Frankfurt) and processing is GDPR-compliant. Depending on sensitivity, the stack can be open-source and self-hosted on your side rather than on a third-party service.",
        },
        {
          id: "taille-entreprise",
          question: "Does the method work for a 5-person business?",
          answer:
            "Yes, with the same standard as for a large group. The 4 steps are identical, only their depth varies: for a craftsman, step 1 alone often frees up 1 to 3 hours a day.",
        },
        {
          id: "roi-absent",
          question: "What happens if the ROI does not materialise?",
          answer:
            "Indicators are agreed BEFORE deployment, which makes the outcome verifiable on both sides. If quality drift is observed, step 4 triggers an iteration. And since the method is decoupled from long contracts, you are committed to nothing further: you can stop at the end of any step.",
        },
      ];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      {/* HERO — layout 2 colonnes (text + flow narratif méthodologie). */}
      <section className="bg-halo-warm text-fg relative pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-16 lg:pb-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--color-border-strong) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border-strong) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse at center, white 15%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, white 15%, transparent 70%)",
            opacity: 0.1,
          }}
        />
        <Container className="relative">
          {/* Eyebrow → pastille centrée sur la page, au-dessus de la grille. */}
          <HeroBadge className="mb-8 sm:mb-10">
            <span
              aria-hidden="true"
              className="bg-terracotta inline-block h-1.5 w-1.5 rounded-full"
            />
            {isFr ? "Méthodologie" : "Methodology"}
          </HeroBadge>
          <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
            {/* Colonne gauche — eyebrow + titre + description + CTA */}
            <div className="max-w-xl">
              <h1 className="display-editorial text-fg">
                {isFr ? "4 étapes vers le " : "4 steps to "}
                <span
                  className="text-terracotta mx-2 italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "ROI mesurable" : "measurable ROI"}
                </span>
              </h1>
              <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
                {isFr
                  ? "Méthodologie Axion-IA, éprouvée sur 50+ entreprises de la PME au grand groupe. On démontre sur vos données, pas sur des démos vendeur."
                  : "Axion-IA methodology, proven on 50+ companies from small business to mid-market. We demonstrate on your data, not vendor demos."}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Cta href="/audit" size="lg">
                  {isFr ? "Voir les 4 niveaux d'audit" : "See the 4 audit levels"}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Cta>
                <Cta href="/cas-concrets" variant="outline" size="lg">
                  {isFr ? "Voir les cas concrets" : "See case studies"}
                </Cta>
              </div>
            </div>

            {/* Colonne droite — flow narratif méthodologie 4 étapes */}
            <MethodologyHeroSchema
              isFr={isFr}
              className="hero-schema"
              ariaLabel={
                isFr
                  ? "Schéma méthodologie Axion-IA : votre entreprise au départ, 4 étapes méthodologiques (Identifier, Auditer, Implémenter, Mesurer), puis 4 résultats concrets (plan chiffré, process automatisés, équipes formées, ROI mesuré)."
                  : "Axion-IA methodology diagram: your company at the start, 4 method steps (Identify, Audit, Implement, Measure), then 4 concrete outcomes (costed plan, automated processes, trained teams, measured ROI)."
              }
            />
          </div>
        </Container>
      </section>

      {/* SECTION — détail des 4 étapes */}
      <Section
        eyebrow={isFr ? "Le détail" : "In detail"}
        title={isFr ? "Comment se déroule" : "How it"}
        titleEm={isFr ? "concrètement" : "actually unfolds"}
        description={
          isFr
            ? "Quatre temps clairement séparés. Chacun produit un livrable concret. Chacun peut être le dernier."
            : "Four clearly separated phases. Each produces a concrete deliverable. Each can be the last."
        }
      >
        <Container>
          {/* Bande éditoriale d'ouverture — la page restait 100 % texte après le
              retrait des deux cadres pointillés du 2026-08-10. Photo réelle
              (Unsplash curée en AVIF local), pas un placeholder. */}
          <div className="mx-auto mb-10 max-w-3xl">
            <Illustration
              slot="METHO-02-demarche"
              aspectRatio="16:9"
              filenameTarget="public/illustrations/methodologie-demarche.avif"
              src="/illustrations/methodologie-demarche.avif"
              caption={
                isFr
                  ? "Quatre temps séparés, un livrable à chaque étape"
                  : "Four separate phases, one deliverable at each step"
              }
              alt={
                isFr
                  ? "Une équipe travaille devant un tableau blanc couvert de notes de cadrage."
                  : "A team working at a whiteboard covered with scoping notes."
              }
            />
            <EditorialPhotoCredit slot="methodologie-demarche" />
          </div>
          {/* Refonte Will 2026-08-10 — c'était quatre colonnes de texte nu
              (numéro mono + titre + paragraphe), le principal reproche de
              « page beaucoup trop textuelle ».
              Chaque étape porte maintenant une bande visuelle avec SA DURÉE en
              grand et son livrable en légende : la rangée se lit comme une
              frise temporelle (1 jour → 5 jours → 6-8 semaines → ROI), et les
              chiffres sont déjà dans le texte des étapes — rien d'inventé. */}
          <ol className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {steps.map((s, i) => {
              const v = STEP_VISUALS[i];
              if (!v) return null;
              return (
                <li key={s.n} className="h-full">
                  <FadeInOnView delay={i * 70} className="h-full">
                    <FeatureMediaCard
                      index={i + 1}
                      accent={v.accent}
                      Icon={v.Icon}
                      title={s.h}
                      description={s.p}
                      bullets={s.bullets}
                      footnote={{
                        label: isFr ? "Livrable" : "Deliverable",
                        value: s.livrable,
                      }}
                      stat={{
                        figure: isFr ? v.figureFr : v.figureEn,
                        label: isFr ? v.labelFr : v.labelEn,
                      }}
                    />
                  </FadeInOnView>
                </li>
              );
            })}
          </ol>
        </Container>
      </Section>

      {/* SECTION — Pourquoi cette méthodologie (extension copy +300 mots) */}
      <Section
        tone="sand"
        eyebrow={isFr ? "Notre parti pris" : "Our principle"}
        title={isFr ? "Pourquoi" : "Why this"}
        titleEm={isFr ? "cette méthode" : "method"}
        description={
          isFr
            ? "Trois principes non-négociables qui guident chaque mission Axion-IA, du diagnostic flash à l'audit stratégique ETI."
            : "Three non-negotiable principles guiding every Axion-IA engagement, from flash diagnosis to strategic mid-cap audit."
        }
      >
        <Container>
          {/* Refonte Will 2026-08-10 — cette section affichait un CADRE POINTILLÉ
              « emplacement d'image » (slot METHO-02, `Illustration` sans `src`)
              en production, à côté d'une simple liste à puces numérotée.
              Le placeholder est supprimé : les 3 principes passent dans le
              panneau mocha partagé, qui casse le rythme ivoire de la page et
              donne à la section le poids éditorial qu'un cadre vide lui volait. */}
          <DarkTriadPanel
            items={whyMethodology.map((w, i) => ({
              Icon: PRINCIPLE_ICONS[i] ?? ShieldCheck,
              eyebrow: String(i + 1).padStart(2, "0"),
              title: w.h,
              description: w.p,
            }))}
          />
        </Container>
      </Section>

      {/* Section « Quatre livrables » RETIRÉE (Will 2026-08-10, second passage :
          « ça fait trop basique »). Elle répétait les 4 mêmes items que les
          étapes juste au-dessus, en plus pauvre. Le livrable de chaque étape est
          désormais porté par la carte de l'étape elle-même (prop `footnote`) :
          l'information est au même endroit que son contexte, et la page perd une
          section redondante au lieu d'en gagner une faible. */}

      {/* Bande éditoriale de clôture — équilibre image/texte avant la FAQ. */}
      <Section tone="canvas">
        <Container className="max-w-3xl">
          <Illustration
            slot="METHO-04-terrain"
            aspectRatio="16:9"
            filenameTarget="public/illustrations/methodologie-terrain.avif"
            src="/illustrations/methodologie-terrain.avif"
            caption={
              isFr
                ? "La méthode se joue chez vous, sur vos dossiers réels"
                : "The method plays out on your site, on your real files"
            }
            alt={
              isFr
                ? "Un intervenant échange avec deux salariés autour d'un poste de travail."
                : "A consultant talking with two employees around a workstation."
            }
          />
          <EditorialPhotoCredit slot="methodologie-terrain" />
        </Container>
      </Section>

      {/* FAQ AEO — visible + FAQPage JSON-LD auto via FaqAccordion */}
      <FaqBlock
        tone="canvas"
        eyebrow="FAQ"
        title={isFr ? "Questions" : "Common"}
        titleEm={isFr ? "fréquentes" : "questions"}
        description={
          isFr
            ? "Durée d'audit, engagement, ROI — les réponses concrètes avant de démarrer."
            : "Audit duration, commitment, ROI — concrete answers before you start."
        }
        items={methodoFaq}
      />

      <CtaBlock
        title={isFr ? "Prêt à démarrer ?" : "Ready to start?"}
        description={
          isFr
            ? "Réservez le format collectif (1 journée) pour identifier 3-5 quick-wins en une journée."
            : "Book the group format to identify 3-5 quick-wins in one day."
        }
        cta={
          <Cta href="/formations" size="lg">
            {isFr ? "Voir nos formations" : "See our trainings"} →
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={webPageJsonLd} />
      <JsonLd data={articleJsonLd} />
      <JsonLd data={howToJsonLd} />
    </>
  );
}
