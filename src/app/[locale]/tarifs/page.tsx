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
  AUDIT_TIERS,
  INTERVENTION_TIERS,
  UN_A_UN_TIERS,
  UN_A_UN_RECURRING_TIER,
  IMPLEMENTATION_TIERS,
  MAINTENANCE_TIERS,
  formatPrice,
  formatAmount,
  getFormationCatalogPriceRange,
  getTierById,
  getEntryPriceEur,
  type PricingTier,
  formatTierPrice,
} from "@/content/pricing";
import { getFormationsV2 } from "@/content/formations/catalog-v2";
import { SERVICE_BY_ID, serviceOfficial } from "@/content/services";

// Sprint Header refonte 2026-05-24 (Will). Page récap tarifs multi-modules.
// Source de vérité unique = `pricing.ts` — aucun prix hardcodé ici. Tout
// changement dans `pricing.ts` se propage automatiquement.
//
// Cette page est un récap éditorial : elle agrège les tiers existants et
// renvoie vers les pages module dédiées (`/audit`, `/interventions/...`,
// `/implementation`, `/un-a-un`, `/codage-developpement`) pour les détails.
// Pas de duplication du JSON-LD Service (déjà émis par chaque page module).
// Ici uniquement BreadcrumbList + ItemList (modules) + FAQPage.
//
// ISR : revalidate 1 h pour que les changements `pricing.ts` se propagent
// sous l'heure suivante en prod sans rebuild complet.
export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  return buildProductMetadata({
    locale,
    path: "/tarifs",
    title: isFr
      ? "Tarifs IA · Audits, Formations, Implémentations · Axion-IA"
      : "AI pricing · Audits, Training, Implementations · Axion-IA",
    description: isFr
      ? "Combien coûte l'IA pour votre entreprise ? Formations, audits, coaching 1-to-1, implémentation et sites IA — tous nos tarifs transparents au même endroit, sans engagement."
      : `All our AI pricing, transparent: Audits from ${formatAmount(getTierById(AUDIT_TIERS, "audit-flash").priceFlat!, "en", { compact: true })} ex. VAT, Trainings from ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-4h").priceFlat!, "en", { compact: true })}, Implementations from ${formatAmount(getTierById(IMPLEMENTATION_TIERS, "impl-poc").priceMin!, "en", { compact: true })}, 1-to-1 from ${formatAmount(getEntryPriceEur(UN_A_UN_TIERS)!, "en", { compact: true })}, Web platform/SaaS on quote.`,
    alternates: { fr: "/tarifs", en: "/pricing" },
  });
}

// ---- Helpers locaux (page-only) ----------------------------------------

interface PricingSectionDef {
  id: string;
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  tiers: ReadonlyArray<PricingTier>;
  ctaLabel: string;
  /** Note optionnelle sous la grille (ex: frais déplacement Interventions). */
  note?: string;
}

function TierCard({ tier, locale }: { tier: PricingTier; locale: "fr" | "en" }) {
  const label = locale === "fr" ? tier.labelFr : tier.labelEn;
  const description = locale === "fr" ? tier.descriptionFr : tier.descriptionEn;
  const duration = locale === "fr" ? tier.durationFr : tier.durationEn;
  const groupSize = locale === "fr" ? tier.groupSizeFr : tier.groupSizeEn;
  const isFeatured = tier.subTiers?.some((s) => s.isFeatured);
  return (
    <article
      className="border-border-strong/40 bg-paper hover:border-terracotta/40 hover:shadow-card relative flex h-full flex-col rounded-2xl border p-6 transition"
      data-tier-id={tier.id}
    >
      {isFeatured ? (
        <span className="bg-terracotta/10 text-terracotta-deep absolute top-4 right-4 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] uppercase">
          ★
        </span>
      ) : null}
      <h3 className="text-fg text-lg leading-tight font-semibold">{label}</h3>
      <p className="text-terracotta-deep mt-3 text-2xl leading-none font-bold tabular-nums">
        {formatPrice(tier, locale)}
      </p>
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

  // Titre/description meta réutilisés à l'identique (SSOT avec generateMetadata)
  // pour le nœud CollectionPage ci-dessous.
  const metaTitle = isFr
    ? "Tarifs IA · Audits, Formations, Implémentations · Axion-IA"
    : "AI pricing · Audits, Training, Implementations · Axion-IA";
  const metaDescription = isFr
    ? "Combien coûte l'IA pour votre entreprise ? Formations, audits, coaching 1-to-1, implémentation et sites IA — tous nos tarifs transparents au même endroit, sans engagement."
    : `All our AI pricing, transparent: Audits from ${formatAmount(getTierById(AUDIT_TIERS, "audit-flash").priceFlat!, "en", { compact: true })} ex. VAT, Trainings from ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-4h").priceFlat!, "en", { compact: true })}, Implementations from ${formatAmount(getTierById(IMPLEMENTATION_TIERS, "impl-poc").priceMin!, "en", { compact: true })}, 1-to-1 from ${formatAmount(getEntryPriceEur(UN_A_UN_TIERS)!, "en", { compact: true })}, Web platform/SaaS on quote.`;

  const heroEyebrow = isFr ? "Tarifs · transparence totale" : "Pricing · full transparency";
  const heroTitle = isFr ? "Nos tarifs IA en" : "Our AI pricing in";
  const heroTitleEm = isFr ? "clair" : "plain sight";
  const heroDesc = isFr
    ? "Formations, Audits, Implémentations et 1-to-1 à prix publics HT, sans étoile ni surprise. Les formations sont tarifées par groupe (2 à 15 participants), jamais par personne."
    : "Trainings, Audits, Implementations and 1-to-1 at public prices excl. VAT, no asterisk, no surprise. Trainings are priced per group (2-15 people), never per person.";

  // — Séparation nette collectif vs 1-to-1 (parité /fr/formations vs /fr/un-a-un).
  // `INTERVENTION_TIERS` mélange les formats collectifs ET le coaching 1-to-1
  // individuel (Dirigeant, Collaborateur, Vision IA, variantes 2 j). Sur /tarifs
  // on ne garde QUE le collectif dans la section Formations ; tout le 1-to-1 est
  // porté par la section dédiée ci-dessous. Évite la duplication des cartes.
  // Section 1-to-1 : Collaborateur & Dirigeant × 1 jour + coaching régulier.
  // Les formats 2 jours ont été RETIRÉS de la vente (décision Will 2026-07-17) :
  // les kits d'intervention 16/17 (catalogue AXION) ne couvrent qu'une journée —
  // aucun déroulé n'existe pour un jour 2. Ne pas les réafficher sans kits.
  const unAUnDisplayTiers: ReadonlyArray<PricingTier> = [
    getTierById(INTERVENTION_TIERS, "intervention-membre-equipe"),
    getTierById(INTERVENTION_TIERS, "intervention-dirigeants"),
    UN_A_UN_RECURRING_TIER,
  ];

  // 5 modules tarifés. Plateforme web/SaaS = section custom (sur devis pur).
  // Ordre voulu par Will (2026-06-23) : Formations et interventions → 1-to-1 →
  // Audit → Intégration d'agents IA sur-mesure → Plateforme web & SaaS.
  const sections: ReadonlyArray<PricingSectionDef> = [
    {
      id: "un-a-un",
      href: "/un-a-un",
      eyebrow: isFr ? "Coaching premium" : "Premium coaching",
      title: serviceOfficial(SERVICE_BY_ID.unAUn, isFr),
      description: isFr
        ? "Journée 1-to-1 avec le dirigeant ou un collaborateur clé. Structuration et chiffrage précis des gains IA."
        : "1-on-1 day with the executive or a key team member. Structuring and precise quantification of AI gains.",
      tiers: unAUnDisplayTiers,
      ctaLabel: isFr ? "Voir le coaching 1-to-1" : "See 1-to-1 coaching",
    },
    {
      id: "audits",
      href: "/audit",
      eyebrow: isFr ? "Diagnostic" : "Diagnostic",
      title: serviceOfficial(SERVICE_BY_ID.audit, isFr),
      description: isFr
        ? "4 niveaux, de la PME au grand groupe. Cartographie de vos opportunités IA chiffrées action par action."
        : "4-level pyramid SME → large group. Map of your AI opportunities, costed action by action.",
      tiers: AUDIT_TIERS,
      ctaLabel: isFr ? "Voir les 4 audits" : "See the 4 audits",
    },
    {
      id: "implementations",
      href: "/implementation",
      eyebrow: isFr ? "Mise en production" : "Production deployment",
      title: serviceOfficial(SERVICE_BY_ID.implementation, isFr),
      description: isFr
        ? "Pilote, chatbot RAG, agents IA, automatisations, IA custom. Production en 4 à 12 semaines, support 30 j inclus."
        : "Pilot, RAG chatbot, AI agents, automations, custom AI. In production in 4 to 12 weeks, 30-day support included.",
      tiers: IMPLEMENTATION_TIERS,
      ctaLabel: isFr ? "Voir les 5 chantiers" : "See the 5 builds",
    },
  ];

  // Module formations — PRIX PUBLICS depuis la refonte catalogue 2026-07-19
  // (décision Will) : prix fixes par groupe (2 à 15 participants), dérivés de
  // la matrice catégorie × durée (getFormationCatalogPriceRange — jamais en dur).
  const formationsRange = getFormationCatalogPriceRange();
  const formationsCount = getFormationsV2().length;
  const formationsSection = {
    id: "formations",
    href: "/formations",
    eyebrow: isFr ? "Montée en compétence" : "Upskilling",
    title: isFr ? "Formations IA en entreprise" : "Corporate AI trainings",
    description: isFr
      ? `${formationsCount} formations, de 4 h à 2 jours — offres générales, par métier et par secteur d'activité. Intra-entreprise, dans vos locaux ou à distance, jusqu'à 15 participants (séminaire : 50).`
      : `${formationsCount} trainings, 4 h to 2 days — general, role-specific and industry-specific. In-house, on site or remote, up to 15 participants (seminar: 50).`,
    // `formatAmount` non-compact porte déjà « € HT » — ne pas resuffixer.
    quoteLabel: isFr
      ? `De ${formatAmount(formationsRange.minEur, "fr")} à ${formatAmount(formationsRange.maxEur, "fr")} · par groupe`
      : `From ${formatAmount(formationsRange.minEur, "en")} to ${formatAmount(formationsRange.maxEur, "en")} · per group`,
    detail: isFr
      ? "Prix fixes et publics, par groupe de 2 à 15 participants — jamais par personne. La grille complète (générales, métiers, secteurs) est sur la page tarifs formations ; le séminaire (jusqu'à 50 personnes) est sur devis."
      : "Fixed public prices, per group of 2-15 participants — never per person. The full grid (general, roles, industries) is on the training pricing page; the seminar (up to 50 people) is on quote.",
    ctaLabel: isFr
      ? `Voir les ${formationsCount} formations`
      : `See the ${formationsCount} trainings`,
  };

  // Module plateforme web/SaaS — sur devis pur (pas de tiers pricing.ts).
  // Géré séparément avec une card unique descriptive.
  const platformSection = {
    id: "plateforme",
    href: "/sites-web-augmentes",
    eyebrow: isFr ? "Plateforme custom" : "Custom platform",
    // Titre local (override de nav.platform) : ajout « augmentée à l'IA » (Will 2026-06-23).
    title: isFr ? "Plateforme web & SaaS augmentée à l'IA" : "AI-augmented web platform & SaaS",
    description: isFr
      ? "Plateforme web IA-native sur mesure ou greffe IA sur votre stack existante (chatbot RAG, search sémantique, automatisations, agents). Toute stack moderne."
      : "AI-native custom web platform or AI graft on your existing stack (RAG chatbot, semantic search, automations, agents). Any modern stack.",
    quoteLabel: isFr ? "Sur devis · cadrage offert" : "On quote · free scoping",
    detail: isFr
      ? "Devis détaillé sous 48 h après cadrage 30 min. Périmètre variable selon stack, intégrations et complexité — c'est pourquoi nous publions un devis personnalisé plutôt qu'une fourchette."
      : "Detailed quote within 48 h after 30-min scoping. Variable scope based on stack, integrations and complexity — that's why we publish a personalised quote rather than a range.",
    ctaLabel: isFr ? "Voir la plateforme web/SaaS" : "See the web platform/SaaS",
  };

  // FAQ Speakable — 5 questions communes (AEO 2026 critical : Google AI
  // Overviews + Perplexity + Claude citent les FAQPage schemas pour répondre
  // à « combien coûte un audit IA ? », « comment se déroule une formation IA ? »
  // etc. `FaqAccordion` injecte automatiquement `buildFaqJsonLd` (Speakable
  // inclus). Marqueurs `data-faq-q` / `data-faq-a` à appliquer pour Speakable
  // précis sont gérés par le composant.
  // Tier d'entrée de gamme formation — source unique du prix ET du libellé de
  // durée injectés dans la FAQ (jamais figés dans la prose) : si le tier change
  // de prix ou de durée, la réponse suit (audit FAQ prix dynamique 2026-07-06).
  const faqItems = isFr
    ? [
        {
          id: "prix-formation-ia",
          question: "Combien coûte une formation IA en entreprise ?",
          answer: `Nos prix formations sont publics et fixes, par groupe de 2 à 15 participants — jamais par personne : de ${formatAmount(getFormationCatalogPriceRange().minEur, "fr")} (offre générale 4 h) à ${formatAmount(getFormationCatalogPriceRange().maxEur, "fr")} (formation sectorielle 2 jours). La grille complète par catégorie est sur la page tarifs formations ; le séminaire (jusqu'à 50 personnes) est sur devis.`,
        },
        {
          id: "tarifs-publics",
          question: "Pourquoi vos tarifs sont-ils publics ?",
          answer:
            "Parce que la transparence accélère le bon match. Si nos tarifs ne correspondent pas à votre budget, vous le savez en 30 secondes — pas après 3 calls et un devis. Plus de respect du temps de chacun.",
        },
        {
          id: "tva",
          question: "Les tarifs incluent-ils la TVA ?",
          answer:
            "Non. Tous nos tarifs publics sont HT (hors taxes). La TVA française à 20 % s'ajoute sur les factures, sauf clients hors UE (auto-liquidation B2B intra-UE).",
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
            "Oui — décrivez votre besoin via la page Contact, réponse personnalisée sous 48 h ouvrées. Pour les formats > 5 000 € HT, nous proposons aussi un cadrage 30 min gratuit avant devis détaillé." /* price-exempt: seuil qualification devis */,
        },
      ]
    : [
        {
          id: "prix-formation-ia",
          question: "How much does corporate AI training cost?",
          answer: `Our training prices are public and fixed, per group of 2-15 participants — never per person: from ${formatAmount(getFormationCatalogPriceRange().minEur, "en")} (general 4 h offer) to ${formatAmount(getFormationCatalogPriceRange().maxEur, "en")} (2-day industry training). The full grid is on the training pricing page; the seminar (up to 50 people) is on quote.`,
        },
        {
          id: "tarifs-publics",
          question: "Why are your prices public?",
          answer:
            "Because transparency speeds up the right match. If our prices don't match your budget, you know in 30 seconds — not after 3 calls and a quote. More respect for everyone's time.",
        },
        {
          id: "tva",
          question: "Are prices VAT-included?",
          answer:
            "No. All our public prices are excl. VAT. French 20 % VAT is added on invoices, except non-EU customers (B2B EU reverse-charge).",
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
            "Yes — describe your need via the Contact page, personalised reply within 48 business hours. For formats > €5,000 ex. VAT, we also offer a free 30-min scoping call before detailed quote." /* price-exempt: seuil qualification devis */,
        },
      ];

  // ---- JSON-LD --------------------------------------------------------
  // BreadcrumbList JSON-LD est émis automatiquement par <Breadcrumbs />
  // (emitJsonLd=true default). On NE le ré-émet PAS ici pour éviter le doublon.

  // ItemList des 5 modules — utilisé par Google AI Overviews / Perplexity
  // pour énumérer les modules quand un utilisateur demande « quels services
  // Axion-IA propose ? ».
  const itemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: "/tarifs",
    name: isFr ? "Catalogue tarifaire Axion-IA" : "Axion-IA pricing catalogue",
    items: [formationsSection, ...sections, platformSection].map((s, i) => ({
      url: `${SITE_URL}/${loc}${s.href}`,
      name: s.title,
      description: s.description,
      position: i + 1,
    })),
  });

  // Nœud CollectionPage — page catalogue (listing des modules tarifés). Porte
  // le speakable (cible h1). Pas d'images manifeste → pas de primaryImageOfPage.
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

      {/* HERO 2 colonnes — Sprint Uniformisation héros 2026-05-24 (Will) */}
      <ServiceHero
        eyebrow={heroEyebrow}
        title={heroTitle.trim()}
        titleEm={heroTitleEm}
        description={heroDesc}
        ctas={
          <nav
            aria-label={isFr ? "Aller à un module" : "Jump to module"}
            className="flex flex-wrap gap-2"
          >
            {[formationsSection, ...sections, platformSection].map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="border-border bg-paper text-fg hover:border-terracotta hover:text-terracotta inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium transition"
              >
                {s.title}
              </a>
            ))}
          </nav>
        }
        schemaCenterLabel={isFr ? "Tarifs publics" : "Public pricing"}
        schemaAriaLabel={
          isFr
            ? `Schéma : tarifs publics au centre, entourés des prestations Axion-IA (formations sur devis) Axion-IA (Audit sur place ${formatAmount(getTierById(AUDIT_TIERS, "audit-flash").priceFlat!, "fr", { compact: true })}, Audit Ciblé ${formatAmount(getTierById(AUDIT_TIERS, "audit-cible").priceMin!, "fr", { compact: true })}, Formations sur devis, 1-to-1 ${formatAmount(getEntryPriceEur(UN_A_UN_TIERS)!, "fr", { compact: true })}, Pilote IA ${formatAmount(getTierById(IMPLEMENTATION_TIERS, "impl-poc").priceMin!, "fr", { compact: true })}, Maintenance ${formatAmount(getTierById(MAINTENANCE_TIERS, "maintenance-standard").priceFlat!, "fr", { compact: true })}${getTierById(MAINTENANCE_TIERS, "maintenance-standard").recurrenceFr}).`
            : `Diagram: public pricing at the center, surrounded by Axion-IA services (trainings on quote) (on-site audit ${formatAmount(getTierById(AUDIT_TIERS, "audit-flash").priceFlat!, "en", { compact: true })}, Targeted audit ${formatAmount(getTierById(AUDIT_TIERS, "audit-cible").priceMin!, "en", { compact: true })}, trainings on quote, 1-to-1 ${formatAmount(getEntryPriceEur(UN_A_UN_TIERS)!, "en", { compact: true })}, AI Pilot ${formatAmount(getTierById(IMPLEMENTATION_TIERS, "impl-poc").priceMin!, "en", { compact: true })}, Maintenance ${formatAmount(getTierById(MAINTENANCE_TIERS, "maintenance-standard").priceFlat!, "en", { compact: true })}${getTierById(MAINTENANCE_TIERS, "maintenance-standard").recurrenceEn}).`
        }
        schemaNodes={[
          {
            label: "Sur place",
            // formatTierPrice → respecte `isFromPrice` (audits toujours en
            // « à partir de », Will 2026-07-17).
            benefit: formatTierPrice(getTierById(AUDIT_TIERS, "audit-flash"), "fr"),
            accent: "terracotta",
          },
          {
            label: isFr ? "Ciblé" : "Targeted",
            benefit: formatAmount(getTierById(AUDIT_TIERS, "audit-cible").priceMin!, "fr"),
            accent: "primary",
          },
          {
            label: "Formations",
            benefit: isFr ? "Sur devis" : "On quote",
            accent: "sage",
          },
          {
            label: "1-to-1",
            benefit: formatAmount(getEntryPriceEur(UN_A_UN_TIERS)!, "fr"),
            accent: "primary",
          },
          {
            label: isFr ? "Pilote IA" : "AI Pilot",
            benefit: formatAmount(getTierById(IMPLEMENTATION_TIERS, "impl-poc").priceMin!, "fr"),
            accent: "sage",
          },
          {
            label: "Maintenance",
            benefit: formatPrice(getTierById(MAINTENANCE_TIERS, "maintenance-standard"), "fr"),
            accent: "mocha",
          },
        ]}
      />

      {/* SECTION FORMATIONS — sur devis pur (cohérence fiches AXION), card unique */}
      <Section
        id={formationsSection.id}
        eyebrow={formationsSection.eyebrow}
        title={formationsSection.title}
        description={formationsSection.description}
        tone="canvas"
      >
        <Container>
          <article className="border-border-strong/40 bg-paper rounded-2xl border p-8 sm:p-10">
            <p className="text-terracotta-deep text-3xl leading-none font-bold">
              {formationsSection.quoteLabel}
            </p>
            <p className="text-fg-soft mt-4 max-w-2xl text-sm leading-relaxed">
              {formationsSection.detail}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Cta href={formationsSection.href} variant="primary" shape="pill" size="md">
                {formationsSection.ctaLabel}
                <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
              </Cta>
              <Cta href="/appel" variant="secondary" shape="pill" size="md">
                {isFr ? "Demander un devis" : "Request a quote"}
              </Cta>
            </div>
          </article>
        </Container>
      </Section>

      {/* 3 SECTIONS pricing.ts (1-to-1 → Audits → Implémentations) */}
      {sections.map((s) => (
        <Section
          key={s.id}
          id={s.id}
          eyebrow={s.eyebrow}
          title={s.title}
          description={s.description}
          tone="canvas"
        >
          <Container>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {s.tiers.map((tier) => (
                <TierCard key={tier.id} tier={tier} locale={loc} />
              ))}
            </div>
            {s.note ? (
              <p className="text-fg-muted mt-6 max-w-3xl text-xs leading-relaxed italic">
                {s.note}
              </p>
            ) : null}
            <div className="mt-8 flex justify-start">
              <Cta href={s.href} variant="primary" shape="pill" size="md">
                {s.ctaLabel}
                <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
              </Cta>
            </div>
          </Container>
        </Section>
      ))}

      {/* SECTION 5 — Plateforme web/SaaS (sur devis pur, card unique) */}
      <Section
        id={platformSection.id}
        eyebrow={platformSection.eyebrow}
        title={platformSection.title}
        description={platformSection.description}
        tone="canvas"
      >
        <Container>
          <article className="border-border-strong/40 bg-paper rounded-2xl border p-8 sm:p-10">
            <p className="text-terracotta-deep text-3xl leading-none font-bold">
              {platformSection.quoteLabel}
            </p>
            <p className="text-fg-soft mt-4 max-w-2xl text-sm leading-relaxed">
              {platformSection.detail}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Cta href={platformSection.href} variant="primary" shape="pill" size="md">
                {platformSection.ctaLabel}
                <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
              </Cta>
              <Cta href="/contact" variant="secondary" shape="pill" size="md">
                {isFr ? "Demander un devis" : "Request a quote"}
              </Cta>
            </div>
          </article>
        </Container>
      </Section>

      {/* SECTION FAQ — FaqAccordion inject buildFaqJsonLd + Speakable auto */}
      <Section
        eyebrow={isFr ? "Questions fréquentes" : "Frequent questions"}
        title={isFr ? "Tarifs ·" : "Pricing ·"}
        titleEm={isFr ? "les vraies réponses" : "real answers"}
        titleTail="."
        description={
          isFr
            ? "Les 5 questions que nos clients posent le plus souvent sur nos tarifs."
            : "The 5 questions our customers ask most often about our pricing."
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
        titleEm={isFr ? "personnalisé" : "personalised quote"}
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
