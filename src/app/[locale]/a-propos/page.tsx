import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, ShieldCheck, Building2, Calendar, Globe2, Check, X } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { HeroBadge } from "@/components/marketing/HeroBadge";
import { Cta } from "@/components/marketing/Cta";
import { TimelineBlock } from "@/components/sections/TimelineBlock";
import { TeamGrid } from "@/components/sections/TeamGrid";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { AboutHeroSchema } from "@/components/sections/AboutHeroSchema";
import { FaqBlock } from "@/components/sections/FaqBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Illustration } from "@/components/visual/Illustration";
import { ABOUT_TIMELINE, ABOUT_TEAM } from "@/content/transversal";
import { ABOUT_PHOTO_CREDITS } from "@/content/a-propos/about-photos";
import { UnsplashCredit } from "@/components/media/UnsplashCredit";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import {
  buildProductMetadata,
  buildPersonJsonLd,
  buildLocalBusinessJsonLd,
  SITE_URL,
  SITE_EDITORIAL_DATE,
} from "@/lib/seo";
import { buildSpeakableSpecification } from "@/lib/seo/speakable-universal";
// Prix formation dérivé du SSOT (jamais hardcodé) — même entrée de gamme que la
// page /tarifs vers laquelle la réponse renvoie (audit FAQ prix 2026-07-06).
import { formatAmount, getTierById, INTERVENTION_TIERS } from "@/content/pricing";
// Nom du fondateur via SSOT `FOUNDER` (displayName « Williams ») — Q/R PAA entité.
import { FOUNDER } from "@/lib/brand";
// Flag divulgation OF (Qualiopi/financement) — les Q/R Qualiopi/financement ne
// sont émises QUE si la Phase B est active (elles apparaîtront automatiquement
// dès le passage du flag, sans retoucher le code). Doctrine financement respectée.
import { isQualiopiCertificationObtenue } from "@/server/qualiopi/config/flag";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/a-propos",
    title:
      locale === "fr"
        ? "À propos · cabinet IA opérationnel · Axion-IA"
        : "About · operational AI consultancy · Axion-IA",
    description:
      locale === "fr"
        ? "Axion-IA, cabinet IA opérationnel dont le siège est à Grenoble (Auvergne-Rhône-Alpes) et qui intervient dans toute la France, notamment à Paris et en Île-de-France : mission, équipe, valeurs E-E-A-T, hébergement UE et réponse humaine sous 48 h. Découvrez notre méthode et nos engagements."
        : "Axion-IA — operational AI consultancy for companies. Mission, team, values, timeline.",
    alternates: { fr: "/a-propos", en: "/about" },
  });
}

// ISR — la page consomme le layout partagé (bandeau + JSON-LD Qualiopi gated
// Phase B, DB-sourcés au runtime). Sans `revalidate`, la page resterait figée
// au build stub. 24h suffit (contenu evergreen).
export const revalidate = 86400;

export default async function About({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [{ href: "/a-propos", label: isFr ? "À propos" : "About" }];

  // Person JSON-LD — E-E-A-T 2026 (Will fondateur identifié auprès des
  // answer engines : Google AI Overviews + Claude.ai + Perplexity + Bing
  // Copilot citent davantage les sources qui exposent un humain identifié
  // qu'une Organization faceless).
  const personJsonLd = buildPersonJsonLd({ locale: loc });

  // LocalBusiness root — 1 SEULE émission propre sur le site, sur /a-propos
  // (Sprint Correctif P1-2 2026-05-23 — audit E2E passe 2 runtime + décision Will).
  //
  // Axion-IA = 1 siège FR Grenoble / Auvergne-Rhône-Alpes (Service Area Business
  // pattern). Toutes les autres pages ville-service émettent Service+areaServed
  // (pas LocalBusiness) pour ne pas claim de bureau physique dans chaque ville
  // (anti-spam local Google). Cette émission ici donne à Google + AI overviews
  // une ancre locale CLAIRE et UNIQUE pour ancrer l'entité Axion-IA à Grenoble
  // (siège réel = RCS Grenoble). La visibilité Paris / Île-de-France / France
  // reste portée par `areaServed` + les pages pSEO villes (zone servie).
  //
  // ⚠️ Champs ÉMIS uniquement avec données réelles (no street/geo/horaires/CP
  // car données précises non publiables par Will pour l'instant — à compléter
  // dès que disponibles). Ce LB minimal reste compatible Schema.org et ne ment
  // pas sur des coords physiques inexistantes.
  const localBusinessRootJsonLd = buildLocalBusinessJsonLd({
    locale: loc,
    path: "/a-propos",
    name: isFr
      ? "Axion-IA — Cabinet IA opérationnel B2B (siège Grenoble, France)"
      : "Axion-IA — Operational B2B AI consultancy (HQ Grenoble, France)",
    description: isFr
      ? "Axion-IA est un cabinet IA opérationnel dont le siège est à Grenoble (Auvergne-Rhône-Alpes) et qui intervient sur toute la France — notamment à Paris et en Île-de-France — auprès de TPE, PME, ETI et grands comptes : interventions IA, audits, implémentations, coaching 1-to-1 et sites web augmentés."
      : "Axion-IA is an operational AI consultancy headquartered in Grenoble (Auvergne-Rhône-Alpes), serving the whole of France — including Paris and the Île-de-France region — for SMBs, mid-caps and enterprises: AI sessions, audits, implementations, 1-to-1 coaching and AI-augmented websites.",
    areaServed: { type: "AdministrativeArea", name: "France" },
    address: {
      city: "Grenoble",
      region: "Auvergne-Rhône-Alpes",
      postalCode: "38100",
      country: "FR",
    },
  });

  // AboutPage JSON-LD — wrapper sémantique de la page « À propos ». Relie la
  // page au #website (isPartOf) et à l'entité canonique #organization (about /
  // mainEntity) pour consolider le knowledge graph (Google + AI Overviews
  // rattachent la page d'autorité à l'entité Axion-IA). dateModified = signal
  // de fraîcheur AEO 2026.
  const aboutPageUrl = `${SITE_URL}/${loc}/a-propos`;
  const aboutPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": aboutPageUrl,
    url: aboutPageUrl,
    inLanguage: loc,
    name: isFr ? "À propos d'Axion-IA" : "About Axion-IA",
    description: isFr
      ? "Axion-IA, cabinet IA opérationnel dont le siège est à Grenoble (Auvergne-Rhône-Alpes), intervenant dans toute la France dont Paris et l'Île-de-France : mission, équipe, valeurs E-E-A-T et méthode."
      : "Axion-IA, an operational AI consultancy headquartered in Grenoble (Auvergne-Rhône-Alpes), serving the whole of France including Paris and Île-de-France: mission, team, E-E-A-T values and method.",
    dateModified: SITE_EDITORIAL_DATE,
    isPartOf: { "@type": "WebSite", "@id": `${SITE_URL}/#website` },
    mainEntity: { "@id": `${SITE_URL}/#organization` },
    about: { "@id": `${SITE_URL}/#organization` },
    // Speakable AEO — AboutPage est un sous-type WebPage : la propriété est valide
    // ici (défaut = h1 + [itemprop=text] + .speakable, présents dans le hero).
    speakable: buildSpeakableSpecification(),
  } as const;

  // FAQ AEO / PAA — Q/R factuelles citables sur l'entité Axion-IA (définition,
  // siège, ancienneté, fondateur, périmètre, délai, prix, contact). Ciblent les
  // « People Also Ask » de marque + les AI Overviews. FaqBlock émet automatiquement
  // le FAQPage JSON-LD via FaqAccordion. Prix/fondateur dérivés des SSOT (jamais
  // hardcodés). Aucune allégation Qualiopi/financement ici (gatées Phase B ailleurs).
  // Divulgation OF (Qualiopi/financement) — Phase B uniquement. Les Q/R gatées
  // ci-dessous s'affichent automatiquement dès l'activation du flag.
  // Audit F13 (2026-07-25) : pilote la FAQ « certifié Qualiopi » et « finançable »,
  // donc des affirmations — exige la certification réelle, pas la visibilité.
  const ofPublic = isQualiopiCertificationObtenue();

  const aboutFaq = isFr
    ? [
        {
          id: "definition",
          question: "Qu'est-ce qu'Axion-IA ?",
          answer:
            "Axion-IA est un cabinet de conseil en intelligence artificielle opérationnelle, basé en France (siège à Grenoble). Il accompagne les TPE, PME, ETI et grands comptes sur l'audit IA, la formation, l'implémentation de solutions IA en production, le coaching 1-à-1 et les sites web augmentés, avec une approche centrée sur des résultats concrets et mesurables.",
        },
        {
          id: "siege",
          question: "Où est le siège d'Axion-IA ?",
          answer:
            "Le siège d'Axion-IA est à Grenoble (Auvergne-Rhône-Alpes), en France. C'est un cabinet IA opérationnel français qui intervient sur toute la France — notamment à Paris et en Île-de-France — auprès des TPE, PME, ETI et grands comptes.",
        },
        {
          id: "couverture-paris",
          question: "Axion-IA intervient-il à Paris et en Île-de-France ?",
          answer:
            "Oui. Paris et l'Île-de-France sont le premier terrain d'intervention d'Axion-IA : audits, formations et implémentations y sont assurés dans les arrondissements parisiens et la première couronne, au même tarif public qu'en région. Le siège reste à Grenoble, mais les interventions sont menées partout en France.",
        },
        {
          id: "depuis-quand",
          question: "Depuis quand Axion-IA existe-t-il ?",
          answer:
            "Axion-IA a été fondé en 2026. Le cabinet a été créé en France pour la stabilité juridique et la proximité avec les entreprises françaises et européennes.",
        },
        {
          id: "fondateur",
          question: "Qui est le fondateur d'Axion-IA ?",
          answer: `Axion-IA a été fondé par ${FOUNDER.displayName}, son fondateur et CEO. Son parcours et son domaine d'expertise — l'IA opérationnelle pour l'entreprise — sont détaillés sur sa fiche fondateur dédiée.`,
        },
        {
          id: "perimetre",
          question: "Quel est le périmètre d'intervention d'Axion-IA ?",
          answer:
            "Axion-IA couvre les interventions IA, les audits, les implémentations en production, le coaching 1-à-1 et les sites web augmentés. Les données sont hébergées dans l'Union européenne (Hetzner Frankfurt).",
        },
        {
          id: "delai-reponse",
          question: "En combien de temps Axion-IA répond-il à une demande ?",
          answer:
            "Toute demande de devis ou de contact reçoit une réponse humaine sous 48 heures ouvrées, sans engagement.",
        },
        {
          id: "prix-formation-ia",
          question: "Combien coûte une formation IA en entreprise ?",
          answer: `Les formations IA en entreprise démarrent à ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-4h").priceFlat!, "fr")} HT pour un format court sur site. Le prix varie ensuite selon la durée, la gamme et le nombre de participants. Tous les tarifs sont publics sur la page Tarifs, et le devis précis se construit après un échange sur votre contexte.`,
        },
        {
          id: "contact",
          question: "Comment contacter Axion-IA ?",
          answer:
            "Le plus simple est de passer par la page Contact : un formulaire unique couvre les devis, audits, formations, implémentations, 1-à-1 et partenariats, avec une réponse humaine sous 48 heures ouvrées. Vous pouvez aussi réserver directement un appel de découverte.",
        },
        // Q/R Qualiopi / financement — émises UNIQUEMENT en Phase B (flag OF).
        // Doctrine financement : jamais de CPF, jamais « 100 % / gratuit »,
        // jamais de numéro de certificat ; uniquement OPCO / France Travail,
        // « prise en charge possible selon votre situation ».
        ...(ofPublic
          ? [
              {
                id: "qualiopi",
                question: "Axion-IA est-il un organisme de formation certifié Qualiopi ?",
                answer:
                  "Oui. Axion-IA est un organisme de formation certifié Qualiopi au titre des actions de formation. Cette certification atteste de la qualité du processus de formation et conditionne l'accès aux financements publics et mutualisés (OPCO, France Travail).",
              },
              {
                id: "financement",
                question:
                  "Les formations IA d'Axion-IA sont-elles finançables (OPCO, France Travail) ?",
                answer:
                  "Selon votre situation, une formation IA peut être prise en charge, en tout ou partie, par votre OPCO (salariés) ou par France Travail (demandeurs d'emploi). Axion-IA étudie votre éligibilité et monte le dossier avec vous, partout en France. Le versement dépend de l'accord de l'organisme financeur.",
              },
            ]
          : []),
      ]
    : [
        {
          id: "definition",
          question: "What is Axion-IA?",
          answer:
            "Axion-IA is an operational artificial-intelligence consultancy based in France (head office in Grenoble). It supports small businesses, SMEs, mid-caps and large accounts on AI audits, training, production AI implementation, 1-to-1 coaching and AI-augmented websites, with a focus on concrete, measurable results.",
        },
        {
          id: "siege",
          question: "Where is Axion-IA's head office?",
          answer:
            "Axion-IA's head office is in Grenoble (Auvergne-Rhône-Alpes), France. It is a French operational AI consultancy serving the whole of France — including Paris and the Île-de-France region — for small businesses, SMEs, mid-caps and large accounts.",
        },
        {
          id: "couverture-paris",
          question: "Does Axion-IA operate in Paris and the Île-de-France region?",
          answer:
            "Yes. Paris and Greater Paris are Axion-IA's primary engagement ground: audits, training and implementations are delivered in the Paris arrondissements and inner suburbs, at the same public rate as the rest of the country. The head office remains in Grenoble, but engagements are run across France.",
        },
        {
          id: "depuis-quand",
          question: "How long has Axion-IA existed?",
          answer:
            "Axion-IA was founded in 2026. The consultancy was created in France for legal stability and proximity to French and European companies.",
        },
        {
          id: "fondateur",
          question: "Who founded Axion-IA?",
          answer: `Axion-IA was founded by ${FOUNDER.displayName}, its founder and CEO. His background and area of expertise — operational AI for businesses — are detailed on his dedicated founder page.`,
        },
        {
          id: "perimetre",
          question: "What is Axion-IA's scope of work?",
          answer:
            "Axion-IA covers AI sessions, audits, production implementations, 1-to-1 coaching and AI-augmented websites. Data is hosted in the European Union (Hetzner Frankfurt).",
        },
        {
          id: "delai-reponse",
          question: "How quickly does Axion-IA reply to a request?",
          answer:
            "Every quote or contact request gets a human reply within 48 business hours, with no commitment.",
        },
        {
          id: "prix-formation-ia",
          question: "How much does corporate AI training cost?",
          answer: `Corporate AI training starts at ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-4h").priceFlat!, "en")} ex. VAT for a short on-site format. The price then varies with duration, track and number of participants. All rates are public on the Pricing page, and the precise quote is built after a call about your context.`,
        },
        {
          id: "contact",
          question: "How do I contact Axion-IA?",
          answer:
            "The simplest way is the Contact page: a single form covers quotes, audits, training, implementations, 1-to-1 and partnerships, with a human reply within 48 business hours. You can also book a discovery call directly.",
        },
        // Qualiopi / funding Q&A — emitted ONLY in Phase B (OF flag). Funding
        // doctrine: never CPF, never "100% / free", never a certificate number;
        // only OPCO / France Travail, "coverage possible depending on your situation".
        ...(ofPublic
          ? [
              {
                id: "qualiopi",
                question: "Is Axion-IA a Qualiopi-certified training provider?",
                answer:
                  "Yes. Axion-IA is a Qualiopi-certified training provider for training actions. This certification attests to the quality of the training process and is a prerequisite for access to public and pooled funding (OPCO, France Travail).",
              },
              {
                id: "financement",
                question: "Can Axion-IA's AI trainings be funded (OPCO, France Travail)?",
                answer:
                  "Depending on your situation, an AI training may be covered, in whole or in part, by your OPCO (for employees) or by France Travail (for jobseekers). Axion-IA reviews your eligibility and builds the file with you, across France. Payment depends on the funding body's approval.",
              },
            ]
          : []),
      ];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO 2-col custom — texte à gauche, AboutHeroSchema à droite */}
      <section className="bg-halo-warm text-fg relative pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-16 lg:pb-28">
        <Container className="relative">
          {/* Eyebrow → pastille centrée sur la page, au-dessus de la grille. */}
          <HeroBadge className="mb-8 sm:mb-10">
            <span
              aria-hidden="true"
              className="bg-terracotta inline-block h-1.5 w-1.5 rounded-full"
            />
            {isFr ? "À propos" : "About"}
          </HeroBadge>
          <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
            <div className="max-w-xl">
              <h1 className="display-editorial text-fg">
                {isFr ? "Cabinet IA " : "Operational AI "}
                <span
                  className="text-terracotta italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "opérationnel" : "consultancy"}
                </span>
              </h1>
              <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
                {isFr
                  ? "De l'IA qui passe en production et génère un ROI mesurable — pas une démo de plus. On identifie vos cas d'usage, on les prouve sur vos données réelles, puis on les déploie dans vos process. Hébergement UE, méthode documentée, livrables actionnables."
                  : "AI that reaches production and delivers measurable ROI — not one more demo. We identify your use cases, prove them on your real data, then deploy them inside your processes. EU hosting, documented method, actionable deliverables."}
              </p>
              {/* Pills réassurance */}
              <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2.5">
                {[
                  { icon: Building2, label: isFr ? "Axion-IA · Europe" : "Axion-IA · Europe" },
                  { icon: ShieldCheck, label: isFr ? "Hébergement UE" : "EU hosting" },
                  { icon: Calendar, label: isFr ? "Fondé 2026" : "Founded 2026" },
                  { icon: Globe2, label: isFr ? "FR · EN · UE" : "FR · EN · EU" },
                ].map((pill) => {
                  const Icon = pill.icon;
                  return (
                    <li
                      key={pill.label}
                      className="text-fg-soft inline-flex items-center gap-2 text-sm"
                    >
                      <Icon
                        aria-hidden="true"
                        className="text-terracotta h-4 w-4"
                        strokeWidth={2}
                      />
                      <span>{pill.label}</span>
                    </li>
                  );
                })}
              </ul>
              {/* CTAs hero */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Cta href="/formations" size="lg">
                  {isFr ? "Voir nos formations" : "See our trainings"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Cta>
                <Cta href="/audit" variant="outline" size="lg">
                  {isFr ? "Demander un audit" : "Request an audit"}
                </Cta>
              </div>
            </div>
            <AboutHeroSchema
              isFr={isFr}
              className="hero-schema"
              ariaLabel={
                isFr
                  ? "Schéma : doctrine Axion-IA en 3 piliers — opérationnel d'abord, ROI mesurable, souveraineté UE."
                  : "Diagram: Axion-IA doctrine in 3 pillars — operational first, measurable ROI, EU sovereignty."
              }
            />
          </div>
        </Container>
      </section>

      {/* Pourquoi Axion-IA — comparaison visuelle « promesses du marché » vs
         « méthode Axion-IA ». Casse le pavé de texte en 2 colonnes contrastées. */}
      <Section eyebrow={isFr ? "Pourquoi Axion-IA" : "Why Axion-IA"} tone="paper">
        <Container className="max-w-5xl">
          <p className="text-fg mx-auto max-w-3xl text-center text-2xl leading-snug font-medium tracking-tight sm:text-3xl">
            {isFr ? (
              <>
                Le marché de l&apos;IA d&apos;entreprise est saturé de promesses non tenues.{" "}
                <span
                  className="text-terracotta italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  Nous prenons le contre-pied.
                </span>
              </>
            ) : (
              <>
                The enterprise AI market is saturated with broken promises.{" "}
                <span
                  className="text-terracotta italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  We take the opposite stance.
                </span>
              </>
            )}
          </p>

          <div className="mt-12 grid gap-6 lg:grid-cols-2 lg:gap-8">
            {/* Colonne « ce que le marché fait » — ton éteint, X */}
            <div className="border-border bg-bg/40 rounded-2xl border border-dashed p-7 sm:p-8">
              <p className="text-fg-muted text-[12px] font-semibold tracking-[0.16em] uppercase">
                {isFr ? "Les promesses du marché" : "The market's promises"}
              </p>
              <ul className="mt-6 space-y-5" role="list">
                {(isFr
                  ? [
                      "Des pilotes qui ne passent jamais en production.",
                      "Des démos époustouflantes sur des données fabriquées.",
                      "Des factures longues comme un bras, sans ROI mesurable.",
                    ]
                  : [
                      "Pilots that never reach production.",
                      "Stunning demos built on fabricated data.",
                      "Long invoices, with no measurable ROI.",
                    ]
                ).map((item) => (
                  <li key={item} className="flex items-start gap-3.5">
                    <span
                      aria-hidden="true"
                      className="border-border text-fg-muted mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </span>
                    <span className="text-fg-soft decoration-fg-muted/40 text-[15px] leading-snug line-through">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Colonne « ce qu'Axion-IA fait » — accent terracotta, Check */}
            <div className="border-terracotta/40 bg-paper shadow-card rounded-2xl border-2 p-7 sm:p-8">
              <p className="text-terracotta text-[12px] font-semibold tracking-[0.16em] uppercase">
                {isFr ? "La méthode Axion-IA" : "The Axion-IA method"}
              </p>
              <ul className="mt-6 space-y-5" role="list">
                {(isFr
                  ? [
                      "Aucune intervention sans démonstration sur vos données réelles.",
                      "Aucun devis sans plan d'action chiffré et priorisé.",
                      "Aucun déploiement sans support post-livraison inclus.",
                    ]
                  : [
                      "No engagement without a live demo on your real data.",
                      "No quote without a costed, prioritised action plan.",
                      "No deployment without post-delivery support included.",
                    ]
                ).map((item) => (
                  <li key={item} className="flex items-start gap-3.5">
                    <span
                      aria-hidden="true"
                      className="bg-terracotta-soft text-terracotta mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    <span className="text-fg text-[15px] leading-snug font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="text-fg-soft mx-auto mt-10 max-w-3xl text-center text-base leading-relaxed">
            {isFr
              ? "Cabinet IA opérationnel, ça veut dire une chose : on travaille dans vos process, pas à côté. Notre siège est en France, choisi pour la stabilité juridique et la proximité avec les entreprises françaises et européennes."
              : "Operational AI consultancy means one thing: we work inside your processes, not next to them. Our head office is in France, chosen for legal stability and proximity to French and European companies."}
          </p>
        </Container>
      </Section>

      {/* Proof — chiffres clés */}
      <Section eyebrow={isFr ? "Repères" : "Key figures"} tone="sand">
        <Container>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                figure: "2026",
                label: isFr ? "Fondée 2026" : "Founded 2026",
                detail: isFr
                  ? "Cabinet IA français fondé en 2026."
                  : "French AI consultancy founded in 2026.",
              },
              {
                figure: "100 %",
                label: isFr ? "Hébergement UE" : "EU hosting",
                detail: isFr
                  ? "Données stockées sur Hetzner Frankfurt."
                  : "Data hosted on Hetzner Frankfurt.",
              },
              {
                figure: "48 h",
                label: isFr ? "Réponse devis" : "Quote reply",
                detail: isFr
                  ? "Sous 48 heures ouvrées, par un humain."
                  : "Within 48 business hours, by a human.",
              },
              {
                figure: "30 j",
                label: isFr ? "Support inclus" : "Support included",
                detail: isFr
                  ? "Maintenance corrective post-livraison incluse."
                  : "Post-delivery corrective maintenance included.",
              },
            ].map((stat) => (
              <div
                key={stat.figure}
                className="border-border bg-paper shadow-subtle rounded-2xl border p-6"
              >
                <p
                  className="text-terracotta text-4xl leading-none font-medium tracking-tight"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {stat.figure}
                </p>
                <p className="text-fg mt-3 text-sm font-semibold tracking-tight">{stat.label}</p>
                <p className="text-fg-soft mt-1.5 text-sm leading-snug">{stat.detail}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section eyebrow={isFr ? "Parcours" : "Timeline"}>
        <Container className="max-w-3xl">
          <TimelineBlock
            events={ABOUT_TIMELINE.map((e) => ({
              id: e.id,
              date: e.date,
              title: e[loc].title,
              description: e[loc].description,
            }))}
          />
        </Container>
      </Section>

      <Section eyebrow={isFr ? "Équipe" : "Team"}>
        <TeamGrid
          members={ABOUT_TEAM.map((m) => ({
            id: m.id,
            name: m[loc].name,
            role: m[loc].role,
            bio: m[loc].bio,
            // Photo réelle du fondateur sur la carte Will. Manon = persona
            // éditoriale IA (transparence AI Act art. 50) → aucun portrait
            // humain, avatar initiale conservé pour ne pas induire en erreur.
            ...(m.id === "will"
              ? {
                  photoUrl: "/illustrations/home-founder-william.avif",
                  // La fiche d'entité du fondateur n'est servie qu'en FR
                  // (`/equipe/[slug]` → `notFound()` hors FR) : pas de lien en EN,
                  // plutôt qu'un lien vers une page qui n'existe pas.
                  ...(isFr
                    ? {
                        href: FOUNDER.pagePath,
                        hrefLabel: `Le parcours de ${FOUNDER.displayName}`,
                      }
                    : {}),
                }
              : {}),
          }))}
        />
      </Section>

      <Section eyebrow={isFr ? "Valeurs" : "Values"}>
        <Container className="max-w-5xl">
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-14">
            <div className="text-fg space-y-6 text-lg leading-relaxed">
              <p>
                <strong>{isFr ? "Opérationnel d'abord." : "Operational first."}</strong>{" "}
                {isFr
                  ? "Aucune intervention sans démonstration sur vos données réelles."
                  : "No engagement without a live demo on your real data."}
              </p>
              <p>
                <strong>{isFr ? "ROI mesurable." : "Measurable ROI."}</strong>{" "}
                {isFr
                  ? "Plan d'action chiffré priorisé, support post-livraison inclus."
                  : "Costed prioritised action plan, post-delivery support included."}
              </p>
              <p>
                <strong>{isFr ? "Souveraineté." : "Sovereignty."}</strong>{" "}
                {isFr
                  ? "Hébergement UE par défaut, modèles open-source quand pertinent."
                  : "EU hosting by default, open-source models when relevant."}
              </p>
            </div>
            <div>
              <Illustration
                slot="APROPOS-02-mid"
                src="/illustrations/a-propos/valeurs.avif"
                aspectRatio="1:1"
                filenameTarget="public/illustrations/a-propos/valeurs.avif"
                caption={
                  isFr
                    ? "La précision opérationnelle d'Axion-IA."
                    : "Axion-IA's operational precision."
                }
                alt={
                  isFr
                    ? "Concepteur au travail, casque sur les oreilles, esquissant un schéma — la précision opérationnelle d'Axion-IA."
                    : "A maker at work, headphones on, sketching a diagram — Axion-IA's operational precision."
                }
              />
              <UnsplashCredit
                photographerName={ABOUT_PHOTO_CREDITS.valeurs?.photographer}
                photographerUrl={ABOUT_PHOTO_CREDITS.valeurs?.photographerUrl}
              />
            </div>
          </div>
        </Container>
      </Section>

      <Section tone="canvas">
        <Container className="max-w-3xl">
          <h2
            className="text-fg text-center text-3xl leading-tight font-medium tracking-tight sm:text-4xl"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {isFr ? (
              <>
                Une méthode, <span className="text-terracotta italic">pas une promesse.</span>
              </>
            ) : (
              <>
                A method, <span className="text-terracotta italic">not a promise.</span>
              </>
            )}
          </h2>
          <p className="text-fg-soft mx-auto mt-4 max-w-2xl text-center text-lg leading-relaxed">
            {isFr
              ? "Chaque mission suit le même fil : cadrage, démonstration sur vos données, déploiement et suivi. Vous voyez le résultat avant de vous engager."
              : "Every engagement follows the same thread: scoping, a demo on your data, deployment and follow-up. You see the result before you commit."}
          </p>
          <div className="mt-10">
            <Illustration
              slot="APROPOS-03-closing"
              src="/illustrations/a-propos/closing.avif"
              aspectRatio="16:9"
              filenameTarget="public/illustrations/a-propos/closing.avif"
              caption={
                isFr
                  ? "Un cabinet IA opérationnel en activité."
                  : "An operational AI consultancy at work."
              }
              alt={
                isFr
                  ? "Une équipe réunie autour d'ordinateurs portables dans un bureau lumineux — un cabinet IA opérationnel en activité."
                  : "A team gathered around laptops in a bright office — an operational AI consultancy at work."
              }
            />
            <UnsplashCredit
              photographerName={ABOUT_PHOTO_CREDITS.closing?.photographer}
              photographerUrl={ABOUT_PHOTO_CREDITS.closing?.photographerUrl}
            />
          </div>
        </Container>
      </Section>

      {/* FAQ AEO — entité Axion-IA (siège, ancienneté, périmètre) + FAQPage
         JSON-LD auto via FaqAccordion */}
      <FaqBlock
        tone="canvas"
        eyebrow="FAQ"
        title={isFr ? "Questions sur" : "Questions about"}
        titleEm="Axion-IA"
        description={
          isFr
            ? "Siège, ancienneté, périmètre, délai de réponse — l'essentiel sur le cabinet."
            : "Head office, history, scope, response time — the essentials about the consultancy."
        }
        items={aboutFaq}
      />

      <CtaBlock
        eyebrow={isFr ? "Démarrer" : "Start"}
        title={
          isFr ? "Démarrons par une intervention concrète" : "Let's start with a concrete session"
        }
        description={
          isFr
            ? `Le format collectif (1 journée) est conçu pour démarrer vite, sans pré-requis IA.`
            : `The group format (one day) is designed to start fast, with no AI prerequisites.`
        }
        cta={
          <Cta href="/formations" size="lg">
            {isFr ? "Voir nos formations" : "See our trainings"} →
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={aboutPageJsonLd} scriptId="jsonld-axion-ia-aboutpage" />
      <JsonLd data={personJsonLd} />
      <JsonLd data={localBusinessRootJsonLd} scriptId="jsonld-axion-ia-root-localbusiness" />
    </>
  );
}
