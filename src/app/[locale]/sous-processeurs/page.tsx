// Page transparence sous-processeurs RGPD — refonte visuelle + AEO/GEO/Speakable
// (2026-06-22, branche feat/sous-processeurs-perfection).
//
// RGPD art. 28 — transparence vis-à-vis des sous-traitants. Liste exhaustive
// avec finalité / localisation / DPA / cadre transfert. Données 100 % issues de
// la SSOT `@/content/subprocessors` (aucune donnée inventée).
//
// Harmonisation visuelle : hero canonique `<Section>` (tone halo-warm +
// décoration + accent terracotta tokens) comme tout le site ; cartes éditoriales
// `bg-paper` + badges color-codés sur tokens existants (sage / primary /
// terracotta-soft / sand). 100 % server component (zéro JS client → budget Web
// Vitals : First Load JS ≤ 75 KB gz, CLS 0).

import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Link } from "@/i18n/navigation";
import { JsonLdGraph } from "@/components/marketing/JsonLdGraph";
import {
  SUBPROCESSORS,
  SUBPROCESSORS_LAST_UPDATED,
  type Subprocessor,
} from "@/content/subprocessors";
import {
  buildProductMetadata,
  buildFaqSpeakableJsonLd,
  buildCollectionPageJsonLd,
  buildBreadcrumbJsonLd,
  SITE_URL,
} from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

const PATH_FR = "/sous-processeurs";
const PATH_EN = "/subprocessors";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  return buildProductMetadata({
    locale,
    path: isFr ? PATH_FR : PATH_EN,
    title: isFr
      ? "Sous-traitants & sous-processeurs RGPD"
      : "Subprocessors & GDPR data sub-processing",
    description: isFr
      ? "Liste exhaustive et tenue à jour des sous-traitants ayant accès aux données traitées par Axion-IA : finalité, localisation, statut DPA et cadre de transfert (RGPD art. 28)."
      : "Exhaustive, up-to-date list of subprocessors with access to data handled by Axion-IA: purpose, location, DPA status and transfer framework (GDPR art. 28).",
    alternates: { fr: PATH_FR, en: PATH_EN },
  });
}

// ─────────────────────────────────────────── libellés localisés (SSOT-driven)

const LABELS_LEGAL_BASIS_FR: Record<Subprocessor["legalBasis"], string> = {
  "6.1.b_contract": "Exécution du contrat (art. 6.1.b)",
  "6.1.f_legitimate_interest": "Intérêt légitime (art. 6.1.f)",
  "6.1.a_consent": "Consentement (art. 6.1.a)",
};
const LABELS_LEGAL_BASIS_EN: Record<Subprocessor["legalBasis"], string> = {
  "6.1.b_contract": "Contract performance (art. 6.1.b)",
  "6.1.f_legitimate_interest": "Legitimate interest (art. 6.1.f)",
  "6.1.a_consent": "Consent (art. 6.1.a)",
};

const LABELS_DPA_FR: Record<Subprocessor["dpaStatus"], string> = {
  signed: "DPA signé",
  auto_signable_dashboard: "DPA auto-signable",
  self_hosted_no_dpa: "Auto-hébergé — sans DPA externe",
  pending: "DPA en cours",
};
const LABELS_DPA_EN: Record<Subprocessor["dpaStatus"], string> = {
  signed: "DPA signed",
  auto_signable_dashboard: "DPA auto-signable",
  self_hosted_no_dpa: "Self-hosted — no external DPA",
  pending: "DPA pending",
};

const LABELS_TRANSFER_FR: Record<Subprocessor["transferFramework"], string> = {
  intra_eu: "Intra-UE",
  scc: "Clauses contractuelles types (SCC)",
  adequacy_decision: "Décision d'adéquation",
  self_hosted_eu: "Auto-hébergé UE — aucun transfert",
};
const LABELS_TRANSFER_EN: Record<Subprocessor["transferFramework"], string> = {
  intra_eu: "Intra-EU",
  scc: "Standard Contractual Clauses (SCC)",
  adequacy_decision: "Adequacy decision",
  self_hosted_eu: "Self-hosted EU — no transfer",
};

const LABELS_CATEGORY_FR: Record<Subprocessor["category"], string> = {
  core_infra: "Infrastructure principale",
  payments: "Paiements & contrats",
  communications: "Communications & géolocalisation",
  analytics_obs: "Analytics & observabilité",
  content_gen_ai: "Génération de contenu par IA",
};
const LABELS_CATEGORY_EN: Record<Subprocessor["category"], string> = {
  core_infra: "Core infrastructure",
  payments: "Payments & contracts",
  communications: "Communications & geolocation",
  analytics_obs: "Analytics & observability",
  content_gen_ai: "AI content generation",
};

const CATEGORY_INTRO_FR: Record<Subprocessor["category"], string> = {
  core_infra:
    "Hébergement, CDN et sécurité réseau — le socle technique qui fait tourner l'application.",
  payments: "Encaissement des paiements et signature électronique des contrats et devis.",
  communications:
    "Notifications d'exploitation au gérant, prise de rendez-vous en ligne et géocodage des villes saisies.",
  analytics_obs: "Mesure d'audience sans cookie, supervision des erreurs et analyse UX.",
  content_gen_ai:
    "Modèles d'IA mobilisés pour la génération éditoriale — prompts uniquement, jamais de données client.",
};
const CATEGORY_INTRO_EN: Record<Subprocessor["category"], string> = {
  core_infra: "Hosting, CDN and network security — the technical backbone running the application.",
  payments: "Payment collection and e-signature of contracts and quotes.",
  communications:
    "Operational notifications to the manager, online appointment booking and geocoding of submitted cities.",
  analytics_obs: "Cookie-less audience measurement, error monitoring and UX analysis.",
  content_gen_ai: "AI models used for editorial generation — prompts only, never any client data.",
};

const CATEGORY_ORDER: ReadonlyArray<Subprocessor["category"]> = [
  "core_infra",
  "payments",
  "communications",
  "analytics_obs",
  "content_gen_ai",
];

// Accent par catégorie (tokens existants uniquement) — barre verticale.
const CATEGORY_ACCENT: Record<Subprocessor["category"], string> = {
  core_infra: "bg-primary",
  payments: "bg-terracotta",
  communications: "bg-sage",
  analytics_obs: "bg-primary-400",
  content_gen_ai: "bg-terracotta-deep",
};

// ─────────────────────────────────────────── badges color-codés

interface Badge {
  label: string;
  className: string;
  dot: string;
}

function transferBadge(s: Subprocessor, isFr: boolean): Badge {
  const label = (isFr ? LABELS_TRANSFER_FR : LABELS_TRANSFER_EN)[s.transferFramework];
  switch (s.transferFramework) {
    case "intra_eu":
    case "self_hosted_eu":
      return { label, className: "bg-sage-soft text-sage", dot: "bg-sage" };
    case "adequacy_decision":
      return { label, className: "bg-primary-soft text-primary", dot: "bg-primary" };
    case "scc":
    default:
      return { label, className: "bg-sand text-fg-soft", dot: "bg-border-strong" };
  }
}

function dpaBadge(s: Subprocessor, isFr: boolean): Badge {
  const label = (isFr ? LABELS_DPA_FR : LABELS_DPA_EN)[s.dpaStatus];
  switch (s.dpaStatus) {
    case "signed":
      return { label, className: "bg-sage-soft text-sage", dot: "bg-sage" };
    case "auto_signable_dashboard":
      return { label, className: "bg-primary-soft text-primary", dot: "bg-primary" };
    case "pending":
      return { label, className: "bg-terracotta-soft text-terracotta-deep", dot: "bg-terracotta" };
    case "self_hosted_no_dpa":
    default:
      return { label, className: "bg-sand text-fg-soft", dot: "bg-border-strong" };
  }
}

// Code pays ISO 3166-1 alpha-2 dérivé du champ `location` réel de la SSOT
// (aucune donnée inventée, aucune duplication de la liste prestataires). Ordre
// spécifique → générique. Alimente `address.addressCountry` des nœuds
// Organization de l'ItemList (signal entité/GEO).
const COUNTRY_NAME_TO_ISO: ReadonlyArray<readonly [RegExp, string]> = [
  [/Allemagne|Germany/i, "DE"],
  [/Irlande|Ireland/i, "IE"],
  [/Royaume-Uni|United Kingdom/i, "GB"],
  [/Canada/i, "CA"],
  [/Émirats|Emirates/i, "AE"],
  [/USA|United States|États-Unis/i, "US"],
];

function isoCountry(location: string): string | undefined {
  for (const [re, iso] of COUNTRY_NAME_TO_ISO) {
    if (re.test(location)) return iso;
  }
  return undefined;
}

function formatLastUpdated(iso: string, isFr: boolean): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString(isFr ? "fr-FR" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

// ─────────────────────────────────────────── petits composants présentationnels

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-paper border-border shadow-subtle rounded-2xl border p-5 sm:p-6">
      <p
        className="text-terracotta-deep text-4xl leading-none font-semibold tracking-tight"
        data-answer
      >
        {value}
      </p>
      <p className="text-fg-soft mt-2 text-sm leading-snug">{label}</p>
    </div>
  );
}

function Pill({ badge }: { badge: Badge }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ${badge.className}`}
    >
      <span aria-hidden="true" className={`inline-block h-1.5 w-1.5 rounded-full ${badge.dot}`} />
      {badge.label}
    </span>
  );
}

export default async function SubprocessorsPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const lbLegal = isFr ? LABELS_LEGAL_BASIS_FR : LABELS_LEGAL_BASIS_EN;
  const lbCategory = isFr ? LABELS_CATEGORY_FR : LABELS_CATEGORY_EN;
  const lbCatIntro = isFr ? CATEGORY_INTRO_FR : CATEGORY_INTRO_EN;
  const lastUpdatedDisplay = formatLastUpdated(SUBPROCESSORS_LAST_UPDATED, isFr);

  // ── Statistiques dérivées de la SSOT (jamais hardcodées)
  const total = SUBPROCESSORS.length;
  const activeCount = SUBPROCESSORS.filter((s) => s.activationStatus === "active").length;
  const pendingCount = SUBPROCESSORS.filter(
    (s) => s.activationStatus === "pending_activation",
  ).length;
  const euNoTransfer = SUBPROCESSORS.filter(
    (s) => s.transferFramework === "intra_eu" || s.transferFramework === "self_hosted_eu",
  ).length;

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: SUBPROCESSORS.filter((s) => s.category === cat),
  })).filter((g) => g.items.length > 0);

  // ── FAQ (réponses ancrées sur la SSOT + RGPD art. 28/30/13 — aucune donnée inventée)
  const faqItems: ReadonlyArray<{ question: string; answer: string }> = isFr
    ? [
        {
          question: "Qu'est-ce qu'un sous-traitant (ou sous-processeur) au sens du RGPD ?",
          answer:
            "Un sous-traitant est un tiers qui traite des données pour le compte d'Axion-IA (art. 28 RGPD). Cette page recense l'intégralité des tiers ayant accès à des données personnelles, techniques ou éditoriales de l'application, avec leur finalité, leur localisation, leur statut DPA et leur cadre de transfert.",
        },
        {
          question: "Comment suis-je informé d'un changement de sous-traitant ?",
          answer:
            "Toute évolution de cette liste est notifiée par email aux clients actifs au moins 30 jours avant sa prise d'effet, conformément à notre engagement de transparence (art. 28.2 RGPD).",
        },
        {
          question: "Mes données de carte bancaire sont-elles transmises à un sous-traitant ?",
          answer:
            "Non. Les numéros de carte sont hébergés directement par Stripe (Stripe-hosted) : Axion-IA ne les voit jamais et ne les stocke jamais. Seuls l'email, le nom, les montants et les métadonnées de réservation transitent.",
        },
        {
          question: "Mes données quittent-elles l'Union européenne ?",
          answer:
            "L'hébergement principal (Hetzner) et les outils auto-hébergés (DocuSeal, Plausible) sont en Allemagne, dans l'UE. Les transferts vers des prestataires hors UE sont encadrés par des Clauses contractuelles types (SCC) ou une décision d'adéquation. Les modèles d'IA ne reçoivent que des prompts éditoriaux, jamais de données client.",
        },
        {
          question: "Que signifie le statut « activation en attente » ?",
          answer:
            "L'intégration technique est codée, mais la clé API n'est pas encore présente dans l'environnement de production et le DPA n'est pas signé : aucun flux de données réel n'a lieu aujourd'hui avec ces prestataires.",
        },
        {
          question: "Une IA générative a-t-elle accès à mes données personnelles ?",
          answer:
            "Non. Les modèles d'IA ne reçoivent que des prompts éditoriaux et des contenus publics de la base de connaissances. Une barrière logicielle refuse les contenus confidentiels ou secrets, et aucune donnée personnelle client n'est transmise. L'option « zéro rétention » / opt-out d'entraînement est activée.",
        },
      ]
    : [
        {
          question: "What is a subprocessor under the GDPR?",
          answer:
            "A subprocessor is a third party processing data on behalf of Axion-IA (GDPR art. 28). This page lists every third party with access to personal, technical or editorial data of the application, with its purpose, location, DPA status and transfer framework.",
        },
        {
          question: "How am I informed of a change of subprocessor?",
          answer:
            "Any change to this list is notified by email to active clients at least 30 days before it takes effect, in line with our transparency commitment (GDPR art. 28.2).",
        },
        {
          question: "Is my card data shared with a subprocessor?",
          answer:
            "No. Card numbers are hosted directly by Stripe (Stripe-hosted): Axion-IA never sees or stores them. Only email, name, amounts and booking metadata are transmitted.",
        },
        {
          question: "Does my data leave the European Union?",
          answer:
            "Core hosting (Hetzner) and self-hosted tools (DocuSeal, Plausible) are in Germany, within the EU. Transfers to non-EU providers are framed by Standard Contractual Clauses (SCC) or an adequacy decision. AI models only receive editorial prompts, never client data.",
        },
        {
          question: "What does the “pending activation” status mean?",
          answer:
            "The technical integration is coded, but the API key is not yet present in the production environment and the DPA is not signed: no real data flow occurs with these providers today.",
        },
        {
          question: "Does a generative AI have access to my personal data?",
          answer:
            "No. AI models only receive editorial prompts and public knowledge-base content. A code-level gate refuses confidential or secret content, and no client personal data is sent. Zero-retention / training opt-out is enabled.",
        },
      ];

  // ── JSON-LD consolidé en un seul @graph (CollectionPage + ItemList + FAQPage +
  //    BreadcrumbList), cross-référencé par `@id`. Données 100 % SSOT.
  const pageUrl = `${SITE_URL}/${loc}${isFr ? PATH_FR : PATH_EN}`;
  const listId = `${pageUrl}#subprocessor-list`;
  const breadcrumbId = `${pageUrl}#breadcrumb`;

  const tBread = await getTranslations("breadcrumb");
  const breadcrumbJsonLd = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: tBread("home"), href: "/" },
      { name: isFr ? "Sous-traitants" : "Subprocessors", href: isFr ? PATH_FR : PATH_EN },
    ],
  });

  // ItemList enrichi : chaque sous-traitant = nœud Organization (nom + finalité +
  // pays + lien doc) → réponse entité/GEO précise pour « quels sous-traitants
  // utilise Axion-IA ? ». @id pour la cross-ref `mainEntity` de la CollectionPage.
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": listId,
    name: isFr ? "Sous-traitants d'Axion-IA" : "Axion-IA subprocessors",
    url: pageUrl,
    numberOfItems: SUBPROCESSORS.length,
    itemListElement: SUBPROCESSORS.map((s, i) => {
      const iso = isoCountry(s.location);
      return {
        "@type": "ListItem",
        position: i + 1,
        ...(s.documentationUrl ? { url: s.documentationUrl } : {}),
        item: {
          "@type": "Organization",
          name: s.name,
          description: isFr ? s.purposeFr : s.purposeEn,
          ...(s.documentationUrl ? { url: s.documentationUrl } : {}),
          ...(iso ? { address: { "@type": "PostalAddress", addressCountry: iso } } : {}),
        },
      };
    }),
  };

  const collectionPageJsonLd = buildCollectionPageJsonLd({
    locale: loc,
    path: isFr ? PATH_FR : PATH_EN,
    name: isFr
      ? "Sous-traitants & sous-processeurs RGPD d'Axion-IA"
      : "Axion-IA subprocessors & GDPR sub-processing",
    description: isFr
      ? "Liste exhaustive et tenue à jour des sous-traitants ayant accès aux données traitées par Axion-IA (RGPD art. 28)."
      : "Exhaustive, up-to-date list of subprocessors with access to data handled by Axion-IA (GDPR art. 28).",
    dateModified: SUBPROCESSORS_LAST_UPDATED,
    lastReviewed: SUBPROCESSORS_LAST_UPDATED,
    reviewedBy: { type: "Organization", name: "Axion-IA", url: SITE_URL },
    mainEntity: { "@id": listId },
    breadcrumb: { "@id": breadcrumbId },
    about: {
      "@type": "Thing",
      name: isFr
        ? "Sous-traitance des données (RGPD art. 28)"
        : "Data sub-processing (GDPR art. 28)",
    },
    speakable: { selectors: ["h1", "h2", "[data-answer]", "[data-faq-a]"] },
  });

  const faqJsonLd = buildFaqSpeakableJsonLd({
    items: faqItems,
    dateModified: SUBPROCESSORS_LAST_UPDATED,
  });

  return (
    <>
      {/* JSON-LD consolidé : 1 seul <script> @graph (parse 1 passe, cross-refs @id).
          Inline = lisible par les bots non-JS (ClaudeBot/GPTBot/Googlebot 1er pass). */}
      <JsonLdGraph schemas={[collectionPageJsonLd, itemListJsonLd, faqJsonLd, breadcrumbJsonLd]} />

      <Container className="border-border border-b py-3">
        {/* emitJsonLd=false : le BreadcrumbList est déjà dans le @graph ci-dessus. */}
        <Breadcrumbs
          emitJsonLd={false}
          items={[{ href: PATH_FR, label: isFr ? "Sous-traitants" : "Subprocessors" }]}
        />
      </Container>

      {/* Hero canonique — harmonisé avec tous les hero du site (tone halo-warm
          + décoration + accent terracotta tokens). */}
      <Section
        titleAs="h1"
        eyebrow={isFr ? "Transparence RGPD · art. 28" : "GDPR transparency · art. 28"}
        title={isFr ? "Sous-traitants & sous-processeurs" : "Subprocessors &"}
        titleEm={isFr ? "RGPD" : "GDPR sub-processing"}
        description={
          isFr
            ? "La liste exhaustive et tenue à jour des sous-traitants ayant accès aux données traitées par Axion-IA dans le cadre de ses prestations — finalité, localisation, statut DPA et cadre de transfert."
            : "The exhaustive, up-to-date list of subprocessors with access to data handled by Axion-IA as part of its services — purpose, location, DPA status and transfer framework."
        }
      >
        <p className="text-fg-muted text-sm">
          {isFr ? "Dernière mise à jour" : "Last updated"} :{" "}
          <time dateTime={SUBPROCESSORS_LAST_UPDATED} className="text-fg font-medium">
            {lastUpdatedDisplay}
          </time>
        </p>
      </Section>

      {/* En bref — statistiques visuelles dérivées de la SSOT */}
      <Section tone="paper" titleAs="h2" title={isFr ? "En bref" : "At a glance"}>
        <p className="text-fg-soft -mt-6 mb-10 max-w-2xl text-base leading-relaxed" data-answer>
          {isFr
            ? `Axion-IA fait appel à ${total} sous-traitants pour héberger, sécuriser et exploiter son application. ${activeCount} sont actifs en production aujourd'hui et ${pendingCount} restent en attente d'activation (DPA non signé ou clé API absente). Aucune donnée personnelle client n'est transmise aux modèles d'IA.`
            : `Axion-IA relies on ${total} subprocessors to host, secure and run its application. ${activeCount} are active in production today and ${pendingCount} remain pending activation (unsigned DPA or missing API key). No client personal data is sent to AI models.`}
        </p>
        <dl className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
          <StatCard
            value={String(total)}
            label={isFr ? "sous-traitants référencés" : "subprocessors listed"}
          />
          <StatCard
            value={String(activeCount)}
            label={isFr ? "actifs en production" : "active in production"}
          />
          <StatCard
            value={String(pendingCount)}
            label={isFr ? "en attente d'activation" : "pending activation"}
          />
          <StatCard
            value={String(euNoTransfer)}
            label={isFr ? "hébergés en UE, sans transfert" : "EU-hosted, no transfer"}
          />
        </dl>

        {/* Sommaire — ancres internes (deep-linking AEO, 0 JS). */}
        <nav aria-label={isFr ? "Sommaire" : "Table of contents"} className="mt-10">
          <p className="text-fg-muted mb-3 text-[11px] tracking-[0.16em] uppercase">
            {isFr ? "Aller à" : "Jump to"}
          </p>
          <ul className="flex flex-wrap gap-2">
            {[
              ...grouped.map((g) => ({ href: `#sp-${g.category}`, label: lbCategory[g.category] })),
              {
                href: "#cadre-reglementaire",
                label: isFr ? "Cadre réglementaire" : "Regulatory framework",
              },
              { href: "#faq", label: isFr ? "Questions fréquentes" : "FAQ" },
            ].map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="border-border text-fg-soft hover:border-terracotta hover:text-terracotta-deep inline-block rounded-full border px-3 py-1.5 text-sm transition-colors"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </Section>

      {/* Comment lire cette liste — légende des badges */}
      <Section
        tone="sand"
        titleAs="h2"
        title={isFr ? "Comment lire cette liste" : "How to read this list"}
        description={
          isFr
            ? "Chaque sous-traitant est qualifié par trois repères de conformité, signalés par des badges color-codés."
            : "Each subprocessor is qualified by three compliance markers, shown as colour-coded badges."
        }
      >
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="bg-paper border-border shadow-subtle rounded-2xl border p-6">
            <h3 className="text-fg text-sm font-semibold tracking-tight">
              {isFr ? "Base légale" : "Legal basis"}
            </h3>
            <p className="text-fg-soft mt-2 text-sm leading-relaxed">
              {isFr
                ? "Le fondement du traitement au titre de l'article 6 du RGPD : exécution du contrat, intérêt légitime ou consentement."
                : "The lawful ground for processing under GDPR art. 6: contract performance, legitimate interest or consent."}
            </p>
          </div>
          <div className="bg-paper border-border shadow-subtle rounded-2xl border p-6">
            <h3 className="text-fg text-sm font-semibold tracking-tight">
              {isFr ? "Statut DPA" : "DPA status"}
            </h3>
            <p className="text-fg-soft mt-2 text-sm leading-relaxed">
              {isFr
                ? "L'état de l'accord de traitement (Data Processing Agreement). Les outils auto-hébergés n'en requièrent pas — Axion-IA en est seule responsable."
                : "The status of the Data Processing Agreement. Self-hosted tools need none — Axion-IA is solely responsible."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Pill
                badge={{
                  label: isFr ? "Signé" : "Signed",
                  className: "bg-sage-soft text-sage",
                  dot: "bg-sage",
                }}
              />
              <Pill
                badge={{
                  label: isFr ? "En cours" : "Pending",
                  className: "bg-terracotta-soft text-terracotta-deep",
                  dot: "bg-terracotta",
                }}
              />
            </div>
          </div>
          <div className="bg-paper border-border shadow-subtle rounded-2xl border p-6">
            <h3 className="text-fg text-sm font-semibold tracking-tight">
              {isFr ? "Cadre de transfert" : "Transfer framework"}
            </h3>
            <p className="text-fg-soft mt-2 text-sm leading-relaxed">
              {isFr
                ? "Le mécanisme qui sécurise un éventuel transfert hors UE : intra-UE (aucun transfert), SCC ou décision d'adéquation."
                : "The mechanism securing any non-EU transfer: intra-EU (no transfer), SCC or adequacy decision."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Pill
                badge={{
                  label: isFr ? "Intra-UE" : "Intra-EU",
                  className: "bg-sage-soft text-sage",
                  dot: "bg-sage",
                }}
              />
              <Pill
                badge={{ label: "SCC", className: "bg-sand text-fg-soft", dot: "bg-border-strong" }}
              />
              <Pill
                badge={{
                  label: isFr ? "Adéquation" : "Adequacy",
                  className: "bg-primary-soft text-primary",
                  dot: "bg-primary",
                }}
              />
            </div>
          </div>
        </div>
      </Section>

      {/* Liste des sous-traitants par catégorie */}
      <Section tone="canvas">
        <div className="space-y-16">
          {grouped.map((group) => (
            <div key={group.category} id={`sp-${group.category}`} className="scroll-mt-24">
              <div className="mb-8 flex items-start gap-4">
                <span
                  aria-hidden="true"
                  className={`mt-1.5 h-12 w-1.5 shrink-0 rounded-full ${CATEGORY_ACCENT[group.category]}`}
                />
                <div>
                  <h2
                    className="text-fg flex flex-wrap items-baseline gap-x-3 text-2xl leading-tight font-semibold tracking-tight"
                    data-speakable
                  >
                    {lbCategory[group.category]}
                    <span className="text-fg-muted text-sm font-normal">
                      {group.items.length}{" "}
                      {isFr
                        ? group.items.length > 1
                          ? "sous-traitants"
                          : "sous-traitant"
                        : group.items.length > 1
                          ? "subprocessors"
                          : "subprocessor"}
                    </span>
                  </h2>
                  <p className="text-fg-soft mt-2 max-w-2xl text-sm leading-relaxed">
                    {lbCatIntro[group.category]}
                  </p>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {group.items.map((s) => (
                  <article
                    key={s.name}
                    className="bg-paper border-border shadow-subtle flex flex-col rounded-2xl border p-6 sm:p-7"
                  >
                    <header className="mb-4">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-fg text-lg leading-tight font-semibold">{s.name}</h3>
                        {s.activationStatus === "pending_activation" ? (
                          <span
                            className="bg-terracotta-soft text-terracotta-deep inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
                            title={
                              isFr
                                ? "Intégration codée ; activation en prod conditionnée à la signature du DPA et à l'ajout de la clé API en environnement."
                                : "Integration coded; prod activation pending DPA signature and API key addition to env."
                            }
                          >
                            <span
                              aria-hidden="true"
                              className="bg-terracotta h-1.5 w-1.5 rounded-full"
                            />
                            {isFr ? "Activation en attente" : "Pending activation"}
                          </span>
                        ) : (
                          <span className="bg-sage-soft text-sage inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium">
                            <span aria-hidden="true" className="bg-sage h-1.5 w-1.5 rounded-full" />
                            {isFr ? "Actif" : "Active"}
                          </span>
                        )}
                      </div>
                      <p className="text-fg-muted mt-1 text-sm">{s.location}</p>
                    </header>

                    <div className="mb-5 flex flex-wrap gap-2">
                      <Pill badge={dpaBadge(s, isFr)} />
                      <Pill badge={transferBadge(s, isFr)} />
                    </div>

                    <dl className="grid flex-1 gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <dt className="text-fg-muted text-[11px] font-semibold tracking-[0.12em] uppercase">
                          {isFr ? "Finalité" : "Purpose"}
                        </dt>
                        <dd className="text-fg mt-1 text-sm leading-relaxed">
                          {isFr ? s.purposeFr : s.purposeEn}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-fg-muted text-[11px] font-semibold tracking-[0.12em] uppercase">
                          {isFr ? "Données traitées" : "Data processed"}
                        </dt>
                        <dd className="text-fg mt-1 text-sm leading-relaxed">
                          {isFr ? s.dataCategoriesFr : s.dataCategoriesEn}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-fg-muted text-[11px] font-semibold tracking-[0.12em] uppercase">
                          {isFr ? "Serveurs" : "Servers"}
                        </dt>
                        <dd className="text-fg mt-1 text-sm">{s.serversLocation}</dd>
                      </div>
                      <div>
                        <dt className="text-fg-muted text-[11px] font-semibold tracking-[0.12em] uppercase">
                          {isFr ? "Base légale" : "Legal basis"}
                        </dt>
                        <dd className="text-fg mt-1 text-sm">{lbLegal[s.legalBasis]}</dd>
                      </div>
                    </dl>

                    {s.documentationUrl ? (
                      <p className="mt-5 text-sm">
                        <a
                          href={s.documentationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-terracotta hover:text-terracotta-deep font-medium underline-offset-4 hover:underline"
                        >
                          {isFr
                            ? "Documentation & DPA du prestataire →"
                            : "Provider documentation & DPA →"}
                        </a>
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Cadre réglementaire */}
      <Section
        id="cadre-reglementaire"
        tone="sand"
        titleAs="h2"
        title={isFr ? "Le cadre réglementaire" : "The regulatory framework"}
        description={
          isFr
            ? "Cette page matérialise plusieurs obligations du Règlement général sur la protection des données (RGPD)."
            : "This page fulfils several obligations under the General Data Protection Regulation (GDPR)."
        }
      >
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="bg-paper border-border shadow-subtle rounded-2xl border p-6">
            <h3 className="text-fg text-base font-semibold tracking-tight">
              {isFr ? "Article 28 — sous-traitance" : "Article 28 — processing"}
            </h3>
            <p className="text-fg-soft mt-2 text-sm leading-relaxed">
              {isFr
                ? "Le recours à un sous-traitant est encadré par un contrat de traitement (DPA). Chaque sous-traitant ci-dessus présente des garanties suffisantes au regard du RGPD."
                : "Engaging a subprocessor is governed by a data processing agreement (DPA). Each subprocessor above offers sufficient guarantees under the GDPR."}
            </p>
          </div>
          <div className="bg-paper border-border shadow-subtle rounded-2xl border p-6">
            <h3 className="text-fg text-base font-semibold tracking-tight">
              {isFr ? "Article 13 — information" : "Article 13 — information"}
            </h3>
            <p className="text-fg-soft mt-2 text-sm leading-relaxed">
              {isFr
                ? "Les destinataires des données personnelles doivent être communiqués de façon transparente. La date de dernière mise à jour figure en tête de page."
                : "Recipients of personal data must be communicated transparently. The last-updated date is shown at the top of the page."}
            </p>
          </div>
          <div className="bg-paper border-border shadow-subtle rounded-2xl border p-6">
            <h3 className="text-fg text-base font-semibold tracking-tight">
              {isFr ? "Transferts hors UE" : "Non-EU transfers"}
            </h3>
            <p className="text-fg-soft mt-2 text-sm leading-relaxed">
              {isFr
                ? "Tout transfert hors de l'Union européenne s'appuie sur l'un des mécanismes prévus au chapitre V du RGPD :"
                : "Any transfer outside the European Union relies on one of the mechanisms in GDPR chapter V:"}
            </p>
            <h4 className="text-fg mt-4 text-sm font-semibold">
              {isFr ? "Clauses contractuelles types (SCC)" : "Standard Contractual Clauses (SCC)"}
            </h4>
            <p className="text-fg-soft mt-1 text-sm leading-relaxed">
              {isFr
                ? "Clauses validées par la Commission européenne, signées avec le prestataire."
                : "Clauses approved by the European Commission, signed with the provider."}
            </p>
            <h4 className="text-fg mt-3 text-sm font-semibold">
              {isFr ? "Décision d'adéquation" : "Adequacy decision"}
            </h4>
            <p className="text-fg-soft mt-1 text-sm leading-relaxed">
              {isFr
                ? "Pays reconnu par l'UE comme offrant un niveau de protection adéquat (ex. Canada, Royaume-Uni)."
                : "A country recognised by the EU as offering an adequate level of protection (e.g. Canada, United Kingdom)."}
            </p>
          </div>
        </div>
      </Section>

      {/* FAQ — AEO / Speakable */}
      <Section
        id="faq"
        tone="canvas"
        titleAs="h2"
        title={isFr ? "Questions fréquentes" : "Frequently asked questions"}
      >
        <div className="divide-border border-border max-w-3xl divide-y border-t">
          {faqItems.map((item) => (
            <div key={item.question} className="py-6">
              <h3 className="text-fg text-lg leading-snug font-semibold tracking-tight" data-faq-q>
                {item.question}
              </h3>
              <p className="text-fg-soft mt-2 leading-relaxed" data-faq-a>
                {item.answer}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Maillage interne */}
      <Section tone="paper">
        <nav aria-label={isFr ? "Voir aussi" : "See also"} className="border-border border-t pt-8">
          <p className="text-fg-muted mb-4 text-[11px] tracking-[0.16em] uppercase">
            {isFr ? "Voir aussi" : "See also"}
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {[
              {
                href: "/politique-confidentialite",
                label: isFr ? "Politique de confidentialité" : "Privacy policy",
              },
              {
                href: "/preferences-cookies",
                label: isFr ? "Préférences cookies" : "Cookie preferences",
              },
              { href: "/transparence", label: isFr ? "Transparence IA" : "AI transparency" },
              { href: "/mes-donnees", label: isFr ? "Exercer mes droits" : "Exercise my rights" },
              { href: "/contact", label: "Contact" },
            ].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href as never}
                  className="text-terracotta hover:text-terracotta-deep text-sm font-medium underline-offset-4 hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Section>
    </>
  );
}
