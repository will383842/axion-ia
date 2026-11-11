import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import {
  buildProductMetadata,
  buildItemListJsonLd,
  buildCollectionPageJsonLd,
  SITE_URL,
} from "@/lib/seo";
import { ServiceHero } from "@/components/sections/ServiceHero";
import {
  INTERVENTION_TIERS,
  UN_A_UN_RECURRING_TIER,
  JOURNEE_IA_TIER,
  getTierById,
  type PricingTier,
  formatTierPrice,
} from "@/content/pricing";
import {
  CHEMIN_JOURNEE_IA,
  CONDITION_GARANTIE,
  DEROULE_JOURNEE_IA,
  GARANTIE_PHRASE,
  RAPPORT_COMPLET,
  lienDiagnostic,
} from "@/content/journee-ia-commun";
import { ANCRE_JOURNEE_IA, LIBELLE_RENDEZ_VOUS_RENVOI } from "@/content/renvoi-journee-ia";
import { getFormationsV2 } from "@/content/formations/catalog-v2";
import { EFFECTIF_PLAGE_EN, EFFECTIF_PLAGE_FR } from "@/content/formations/effectif";
import { SERVICE_BY_ID, serviceOfficial } from "@/content/services";

// Page récap tarifs (Sprint Header refonte 2026-05-24, Will ; réalignée sur La
// Journée IA après l'audit SEO/GEO du 11/11/2026).
//
// 🔑 UN SEUL prix public : celui de La Journée IA, lu dans `pricing.ts`
// (`formatTierPrice(JOURNEE_IA_TIER)`). Elle est en tête de la page, avec son
// rapport (sous 3 jours ouvrés) et sa garantie, mot pour mot depuis
// `journee-ia-commun.ts`. Tout le reste est « sur devis écrit » : aucune carte de
// cette page n'affiche un autre montant, même si l'interrupteur des prix publics
// de `pricing.ts` venait à être levé.
//
// Cette page renvoie vers les pages module (`/journee-ia`, `/formations`, `/audit`,
// `/implementation`, `/un-a-un`, `/sites-web-augmentes`) pour le détail. JSON-LD :
// CollectionPage + ItemList ; la FAQPage est émise par `FaqAccordion` À PARTIR DES
// MÊMES `faqItems` que la FAQ visible (identiques par construction).
//
// ISR : revalidate 1 h pour que les changements `pricing.ts` se propagent
// sous l'heure suivante en prod sans rebuild complet.
export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
}

/** Le libellé de tout ce qui n'est pas La Journée IA. */
function libelleSurDevisEcrit(locale: "fr" | "en"): string {
  return locale === "fr" ? "Sur devis écrit" : "On written quote";
}

function titreMeta(isFr: boolean): string {
  return isFr
    ? "Tarifs Axion-IA · La Journée IA, le reste sur devis écrit"
    : "Axion-IA pricing · the AI Day, everything else on quote";
}

function descriptionMeta(isFr: boolean): string {
  return isFr
    ? `La Journée IA : ${formatTierPrice(JOURNEE_IA_TIER, "fr")}, rapport complet sous 3 jours ouvrés et garantie écrite. Formations, audit approfondi et projets IA : sur devis écrit.`
    : `The AI Day: ${formatTierPrice(JOURNEE_IA_TIER, "en")}, full report within 3 business days and a written guarantee. Trainings, in-depth audit and AI projects: on written quote.`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  return buildProductMetadata({
    locale,
    path: "/tarifs",
    title: titreMeta(isFr),
    description: descriptionMeta(isFr),
    alternates: { fr: "/tarifs", en: "/pricing" },
  });
}

// ---- Helpers locaux (page-only) ----------------------------------------

/** Une prestation sur devis écrit : une carte, un lien vers sa page. */
interface CarteSurDevisDef {
  id: string;
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  detail: string;
  ctaLabel: string;
  /** Les formats de la prestation, sans montant (accompagnement individuel). */
  tiers?: ReadonlyArray<PricingTier>;
}

function TierCard({ tier, locale }: { tier: PricingTier; locale: "fr" | "en" }) {
  const label = locale === "fr" ? tier.labelFr : tier.labelEn;
  const description = locale === "fr" ? tier.descriptionFr : tier.descriptionEn;
  const duration = locale === "fr" ? tier.durationFr : tier.durationEn;
  const groupSize = locale === "fr" ? tier.groupSizeFr : tier.groupSizeEn;
  return (
    <article
      className="border-border-strong/40 bg-paper hover:border-terracotta/40 hover:shadow-card relative flex h-full flex-col rounded-2xl border p-6 transition"
      data-tier-id={tier.id}
    >
      <h3 className="text-fg text-lg leading-tight font-semibold">{label}</h3>
      {/* Un seul prix public (La Journée IA) : jamais de montant sur ces cartes. */}
      <p className="text-fg-muted mt-2 text-sm">{libelleSurDevisEcrit(locale)}</p>
      {duration || groupSize ? (
        <p className="text-fg-muted mt-2 text-xs leading-snug">
          {[duration, groupSize].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      <p className="text-fg-soft mt-4 text-sm leading-relaxed">{description}</p>
    </article>
  );
}

// ---- Page --------------------------------------------------------------

export default async function PricingPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const prixJournee = formatTierPrice(JOURNEE_IA_TIER, loc);
  const surDevis = libelleSurDevisEcrit(loc);

  // Titre/description meta réutilisés à l'identique (SSOT avec generateMetadata)
  // pour le nœud CollectionPage ci-dessous.
  const metaTitle = titreMeta(isFr);
  const metaDescription = descriptionMeta(isFr);

  const heroDesc = isFr
    ? `${RAPPORT_COMPLET} ${GARANTIE_PHRASE} Tout le reste — formations, audit approfondi, accompagnement individuel, mise en place de l'IA — est sur devis écrit, sous 48 h ouvrées.`
    : `Full report within 3 business days after the day. If the gains identified do not exceed 3 times the price of the day, we refund you within 30 days. Everything else — trainings, in-depth audit, 1-to-1 support, AI deployment — is on written quote, within 48 business hours.`;

  // Accompagnement individuel : Collaborateur & Dirigeant × 1 jour + suivi régulier.
  // Les formats 2 jours ont été RETIRÉS de la vente (décision Will 2026-07-17).
  const unAUnDisplayTiers: ReadonlyArray<PricingTier> = [
    getTierById(INTERVENTION_TIERS, "intervention-membre-equipe"),
    getTierById(INTERVENTION_TIERS, "intervention-dirigeants"),
    UN_A_UN_RECURRING_TIER,
  ];

  // R7 (ordre de Williams du 08/11/2026) : plus de fourchette publique. Le prix
  // d'une formation reste par groupe, sur devis écrit.
  const formationsCount = getFormationsV2().length;

  // Tout ce qui suit La Journée IA, dans l'ordre de la page.
  const cartes: ReadonlyArray<CarteSurDevisDef> = [
    {
      id: "formations",
      href: "/formations",
      eyebrow: isFr ? "Montée en compétence" : "Upskilling",
      title: isFr ? "Formations IA en entreprise" : "Corporate AI trainings",
      description: isFr
        ? `${formationsCount} formations, de 4 h à 2 jours — offres générales, par métier et par secteur d'activité. Intra-entreprise, dans vos locaux ou à distance, ${EFFECTIF_PLAGE_FR} (séminaire : 50).`
        : `${formationsCount} trainings, 4 h to 2 days — general, role-specific and industry-specific. In-house, on site or remote, ${EFFECTIF_PLAGE_EN} (seminar: 50).`,
      detail: isFr
        ? `Prix par groupe (${EFFECTIF_PLAGE_FR}), jamais par personne, établi sur devis écrit selon la formation, la durée et le format. Les conditions de paiement et d'annulation figurent dans nos conditions générales.`
        : `Price per group (${EFFECTIF_PLAGE_EN}), never per person, on written quote according to the training, duration and format. Payment and cancellation terms are set out in our terms and conditions.`,
      ctaLabel: isFr
        ? `Voir les ${formationsCount} formations`
        : `See the ${formationsCount} trainings`,
    },
    {
      id: "un-a-un",
      href: "/un-a-un",
      eyebrow: isFr ? "Accompagnement individuel" : "1-to-1 support",
      title: serviceOfficial(SERVICE_BY_ID.unAUn, isFr),
      description: isFr
        ? "Une journée en tête-à-tête avec le dirigeant ou un collaborateur clé, ou un suivi régulier."
        : "A one-to-one day with the executive or a key team member, or regular follow-up.",
      detail: isFr
        ? "Chaque format est établi sur devis écrit, selon la personne accompagnée et la durée."
        : "Each format is on written quote, according to the person and the duration.",
      ctaLabel: isFr ? "Voir l'accompagnement individuel" : "See 1-to-1 support",
      tiers: unAUnDisplayTiers,
    },
    {
      id: "audits",
      href: "/audit",
      eyebrow: isFr ? "Au-delà de La Journée IA" : "Beyond the AI Day",
      title: isFr ? "Audit IA approfondi" : "In-depth AI audit",
      description: isFr
        ? "Quand votre situation demande plus qu'une journée : cartographie détaillée, gains chiffrés action par action, feuille de route."
        : "When your situation needs more than a day: detailed mapping, gains costed action by action, roadmap.",
      detail: isFr
        ? "Un autre cadrage que La Journée IA : périmètre, durée et livrables sont fixés ensemble, puis chiffrés sur devis écrit sous 48 h ouvrées."
        : "A different scope from the AI Day: perimeter, duration and deliverables are set together, then priced on written quote within 48 business hours.",
      ctaLabel: isFr ? "Voir l'audit IA" : "See the AI audit",
    },
    {
      id: "implementations",
      href: "/implementation",
      eyebrow: isFr ? "Mise en production" : "Production deployment",
      title: serviceOfficial(SERVICE_BY_ID.implementation, isFr),
      description: isFr
        ? "Pilote, assistant sur vos documents, agents IA, automatisations, IA sur mesure. Mise en production en 4 à 12 semaines, support de 30 jours inclus."
        : "Pilot, assistant on your documents, AI agents, automations, custom AI. In production in 4 to 12 weeks, 30-day support included.",
      detail: isFr
        ? "Chaque chantier est chiffré sur devis écrit, après un cadrage de 45 minutes."
        : "Each build is priced on written quote, after a 45-minute scoping call.",
      ctaLabel: isFr ? "Voir la mise en place" : "See the builds",
    },
    {
      id: "plateforme",
      href: "/sites-web-augmentes",
      eyebrow: isFr ? "Plateforme sur mesure" : "Custom platform",
      title: isFr ? "Plateforme web augmentée à l'IA" : "AI-augmented web platform",
      description: isFr
        ? "Plateforme web conçue pour l'IA, ou IA greffée sur votre outil existant (assistant sur vos documents, recherche, automatisations, agents)."
        : "AI-native custom web platform or AI graft on your existing stack (document assistant, semantic search, automations, agents).",
      detail: isFr
        ? "Devis écrit sous 48 h après un cadrage de 45 minutes. Le périmètre varie selon vos outils, vos intégrations et la complexité : c'est pourquoi nous établissons un devis plutôt qu'une fourchette."
        : "Written quote within 48 h after a 45-minute scoping call. Scope varies with your tools, integrations and complexity — that's why we write a quote rather than a range.",
      ctaLabel: isFr ? "Voir les plateformes web" : "See web platforms",
    },
  ];

  // FAQ — `FaqAccordion` émet la FAQPage JSON-LD À PARTIR DE CES MÊMES ITEMS :
  // le balisage est identique au texte visible par construction.
  const faqItems = isFr
    ? [
        {
          id: "prix-journee-ia",
          question: "Combien coûte La Journée IA ?",
          answer: `${prixJournee}, prix unique. ${DEROULE_JOURNEE_IA} ${RAPPORT_COMPLET} ${GARANTIE_PHRASE} ${CONDITION_GARANTIE}`,
        },
        {
          id: "prix-formation-ia",
          question: "Combien coûte une formation IA en entreprise ?",
          answer: `Le prix d'une formation est établi sur devis écrit, hors taxes, par groupe (${EFFECTIF_PLAGE_FR}) — jamais par personne. Il dépend de la formation retenue (offre générale, métier ou secteur), de sa durée (4 h à 2 jours) et du format (sur site ou à distance). Les conditions de paiement et d'annulation figurent dans nos conditions générales.`,
        },
        {
          id: "tarifs-publics",
          question: "Pourquoi un devis plutôt qu'une grille ?",
          answer: `Parce que deux entreprises n'ont jamais le même besoin : taille de l'équipe, outils en place, objectifs. Le devis écrit part de votre situation et arrive sous 48 h ouvrées, sans engagement. Une seule prestation a un prix affiché : La Journée IA, ${prixJournee}.`,
        },
        {
          id: "tva",
          question: "Les tarifs incluent-ils la TVA ?",
          answer:
            "Non. Nos prix et nos devis sont établis hors taxes. La TVA au taux en vigueur s'ajoute sur toutes nos factures.",
        },
        {
          id: "engagement",
          question: "Y a-t-il un engagement dans la durée ?",
          answer:
            "Aucun engagement annuel : chaque prestation est un livrable autonome. Les conditions de règlement sont précisées au devis et dans les CGV. Maintenance optionnelle après la période de support incluse.",
        },
        {
          id: "devis-personnalise",
          question: "Puis-je avoir un devis personnalisé ?",
          answer:
            "Oui. Décrivez votre besoin via la page Contact : nous vous répondons sous 48 h ouvrées. Pour un projet de mise en place, nous proposons aussi un cadrage gratuit de 45 minutes avant le devis détaillé.",
        },
      ]
    : [
        {
          id: "prix-journee-ia",
          question: "How much does the AI Day cost?",
          answer: `${prixJournee}, single price. A 2 to 4 h audit in the morning on your premises, 4 h of team training in the afternoon. Full report within 3 business days. ${GARANTIE_PHRASE}`,
        },
        {
          id: "prix-formation-ia",
          question: "How much does corporate AI training cost?",
          answer: `Training is quoted excl. VAT, per group (${EFFECTIF_PLAGE_EN}) — never per person. The price depends on the training (general, role or industry), its duration (4 h to 2 days) and the format (on site or remote). The payment and cancellation terms are set out in our terms and conditions.`,
        },
        {
          id: "tarifs-publics",
          question: "Why a quote rather than a price grid?",
          answer: `Because no two companies have the same need: team size, tools in place, goals. The written quote starts from your situation and arrives within 48 business hours, with no commitment. Only one engagement has a displayed price: the AI Day, ${prixJournee}.`,
        },
        {
          id: "tva",
          question: "Are prices VAT-included?",
          answer:
            "No. Our prices and quotes are excl. VAT. VAT at the applicable rate is added on invoices, except non-EU customers (B2B EU reverse-charge).",
        },
        {
          id: "engagement",
          question: "Is there a long-term commitment?",
          answer:
            "No annual commitment: each engagement is a standalone deliverable. Payment terms are detailed in the quote and Terms. Optional maintenance after the included support window.",
        },
        {
          id: "devis-personnalise",
          question: "Can I get a custom quote?",
          answer:
            "Yes — describe your need via the Contact page, personalised reply within 48 business hours. For deployment projects, we also offer a free 45-minute scoping call before the detailed quote.",
        },
      ];

  // ---- JSON-LD --------------------------------------------------------
  // BreadcrumbList JSON-LD est émis automatiquement par <Breadcrumbs />
  // (emitJsonLd=true default). On NE le ré-émet PAS ici pour éviter le doublon.

  // ItemList : La Journée IA en tête, puis les prestations sur devis écrit.
  const itemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: "/tarifs",
    name: isFr ? "Catalogue tarifaire Axion-IA" : "Axion-IA pricing catalogue",
    items: [
      {
        url: `${SITE_URL}/${loc}${CHEMIN_JOURNEE_IA}`,
        name: isFr ? "La Journée IA" : "The AI Day",
        description: isFr ? JOURNEE_IA_TIER.descriptionFr : JOURNEE_IA_TIER.descriptionEn,
        position: 1,
      },
      ...cartes.map((s, i) => ({
        url: `${SITE_URL}/${loc}${s.href}`,
        name: s.title,
        description: s.description,
        position: i + 2,
      })),
    ],
  });

  // Nœud CollectionPage — page catalogue. Porte le speakable (cible h1).
  const collectionPageJsonLd = buildCollectionPageJsonLd({
    locale: loc,
    path: "/tarifs",
    name: metaTitle,
    description: metaDescription,
    speakable: true,
  });

  const breadcrumbItems = [{ href: "/tarifs", label: isFr ? "Tarifs" : "Pricing" }];

  return (
    <>
      <JsonLd data={collectionPageJsonLd} scriptId="webpage-pricing" />
      <JsonLd data={itemListJsonLd} scriptId="itemlist-pricing" />

      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO — La Journée IA en tête : son prix, son rapport, sa garantie ; puis
          « tout le reste sur devis écrit » (audit SEO/GEO du 11/11/2026). */}
      <ServiceHero
        eyebrow={isFr ? "Tarifs" : "Pricing"}
        title={isFr ? "La Journée IA :" : "The AI Day:"}
        titleEm={prixJournee}
        description={heroDesc}
        ctas={
          <div className="flex flex-wrap gap-3">
            <Cta href={CHEMIN_JOURNEE_IA} variant="primary" shape="pill" size="md">
              {isFr ? ANCRE_JOURNEE_IA : "Discover the AI Day"}
              <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
            </Cta>
            <Cta
              href={lienDiagnostic("tarifs-heros")}
              variant="secondary"
              shape="pill"
              size="md"
              track="tarifs-heros-rendez-vous"
            >
              {isFr ? LIBELLE_RENDEZ_VOUS_RENVOI : "Book a call"}
            </Cta>
          </div>
        }
        schemaCenterLabel={isFr ? "La Journée IA" : "The AI Day"}
        schemaAriaLabel={
          isFr
            ? `Schéma : La Journée IA au centre, seul prix affiché (${prixJournee}) ; autour, les prestations sur devis écrit (formations, audit approfondi, accompagnement individuel, mise en place, plateforme web).`
            : `Diagram: the AI Day at the centre, the only displayed price (${prixJournee}); around it, the services on written quote (trainings, in-depth audit, 1-to-1 support, deployment, web platform).`
        }
        schemaNodes={[
          {
            label: isFr ? "Journée IA" : "AI Day",
            // Le seul prix public (ordre de Williams du 08/11/2026).
            benefit: prixJournee,
            accent: "terracotta",
          },
          { label: "Formations", benefit: surDevis, accent: "sage" },
          {
            label: isFr ? "Audit approfondi" : "In-depth audit",
            benefit: surDevis,
            accent: "primary",
          },
          { label: "1-to-1", benefit: surDevis, accent: "primary" },
          { label: isFr ? "Mise en place" : "Deployment", benefit: surDevis, accent: "sage" },
          { label: isFr ? "Plateforme web" : "Web platform", benefit: surDevis, accent: "mocha" },
        ]}
      />

      {/* JOURNÉE IA — le seul prix public (ordre de Williams du 08/11/2026). */}
      <Section
        id="journee-ia"
        eyebrow={isFr ? "Prix unique" : "Single price"}
        title={isFr ? "La Journée IA" : "The AI Day"}
        description={isFr ? JOURNEE_IA_TIER.descriptionFr : JOURNEE_IA_TIER.descriptionEn}
        tone="canvas"
      >
        <Container>
          <article className="border-terracotta/40 bg-paper rounded-2xl border-2 p-8 sm:p-10">
            <p className="text-terracotta-deep text-3xl leading-none font-bold tabular-nums">
              {prixJournee}
            </p>
            {isFr ? (
              <>
                <p className="text-fg-soft mt-4 max-w-2xl text-sm leading-relaxed">
                  {DEROULE_JOURNEE_IA} {RAPPORT_COMPLET}
                </p>
                <p className="text-fg-soft mt-3 max-w-2xl text-sm leading-relaxed">
                  {GARANTIE_PHRASE} {CONDITION_GARANTIE}
                </p>
              </>
            ) : (
              <p className="text-fg-soft mt-4 max-w-2xl text-sm leading-relaxed">
                {`${JOURNEE_IA_TIER.durationEn} on your premises, with your team: a single price, known upfront.`}
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <Cta href={CHEMIN_JOURNEE_IA} variant="primary" shape="pill" size="md">
                {isFr ? ANCRE_JOURNEE_IA : "Discover the AI Day"}
                <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
              </Cta>
              <Cta
                href={lienDiagnostic("tarifs-journee-ia")}
                variant="secondary"
                shape="pill"
                size="md"
                track="tarifs-journee-ia-rendez-vous"
              >
                {isFr ? LIBELLE_RENDEZ_VOUS_RENVOI : "Book a call"}
              </Cta>
            </div>
          </article>
        </Container>
      </Section>

      {/* TOUT LE RESTE — sur devis écrit, aucun montant. */}
      {cartes.map((c) => (
        <Section
          key={c.id}
          id={c.id}
          eyebrow={c.eyebrow}
          title={c.title}
          description={c.description}
          tone="canvas"
        >
          <Container>
            {c.tiers ? (
              <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {c.tiers.map((tier) => (
                  <TierCard key={tier.id} tier={tier} locale={loc} />
                ))}
              </div>
            ) : null}
            <article className="border-border-strong/40 bg-paper rounded-2xl border p-8 sm:p-10">
              <p className="text-terracotta-deep text-3xl leading-none font-bold">{surDevis}</p>
              <p className="text-fg-soft mt-4 max-w-2xl text-sm leading-relaxed">{c.detail}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Cta href={c.href} variant="primary" shape="pill" size="md">
                  {c.ctaLabel}
                  <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
                </Cta>
                <Cta href="/contact" variant="secondary" shape="pill" size="md">
                  {isFr ? "Demander un devis écrit" : "Request a written quote"}
                </Cta>
              </div>
            </article>
          </Container>
        </Section>
      ))}

      {/* SECTION FAQ — FaqAccordion injecte buildFaqJsonLd (mêmes items) + Speakable */}
      <Section
        eyebrow={isFr ? "Questions fréquentes" : "Frequent questions"}
        title={isFr ? "Tarifs ·" : "Pricing ·"}
        titleEm={isFr ? "les vraies réponses" : "real answers"}
        titleTail="."
        description={
          isFr
            ? `Les ${faqItems.length} questions que nos clients posent le plus souvent sur nos tarifs.`
            : `The ${faqItems.length} questions our customers ask most often about our pricing.`
        }
        tone="sand"
      >
        <Container>
          <FaqAccordion emitJsonLd items={faqItems} className="mx-auto max-w-3xl" />
        </Container>
      </Section>

      {/* CTA final → Contact (point d'entrée commercial canonique post-refonte) */}
      <CtaBlock
        eyebrow={isFr ? "Prêt à démarrer ?" : "Ready to start?"}
        title={isFr ? "Un devis" : "A"}
        titleEm={isFr ? "écrit" : "written quote"}
        titleTail={isFr ? " sous 48 h ouvrées." : " within 48 business hours."}
        description={
          isFr
            ? "Décrivez votre besoin en 2 minutes — réponse argumentée, chiffrée, sans engagement."
            : "Describe your need in 2 minutes — argued, costed reply, no commitment."
        }
        cta={
          <Cta href="/contact" variant="primary" shape="pill" size="lg" track="pricing_cta_final">
            {isFr ? "Nous contacter" : "Contact us"}
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Cta>
        }
      />
    </>
  );
}
