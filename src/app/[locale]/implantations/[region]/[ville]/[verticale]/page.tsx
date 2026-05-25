/**
 * Page publique landing-ville × verticale (Sprint v7 Phase 5 commit 2).
 *
 * Route : `/[locale]/implantations/[region]/[ville]/[verticale]`
 * Verticales acceptées : `interventions` | `audits` | `implementations` | `un-a-un` | `sites-web-ia`
 *
 * ⚠️ Edge case E5 anti-saturation build GH Actions (10 750 routes = 2150 villes × 5
 * verticales) : `generateStaticParams` retourne uniquement les ~100 villes pilotes
 * (top par population + villes avec copy éditorial). `dynamicParams = true`
 * permet la génération ISR-on-demand pour les ~10 250 routes restantes au
 * premier hit utilisateur. `revalidate = 86400` (24h) puis re-fetch.
 *
 * Fetch Article via `getLandingVilleArticleByVertical(villeSlug, verticale, locale)`.
 * Si Article absent (pas encore généré par worker) : stub minimal `noindex`
 * conforme HCU 2024 (anti-doorway) + lien de retour vers le hub ville parent.
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowUpRight, ArrowRight, MapPin, Shield, ClipboardCheck } from "lucide-react";

import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { JsonLdGraph } from "@/components/marketing/JsonLdGraph";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Link } from "@/i18n/navigation";
import { AiContentDisclaimer } from "@/components/marketing/AiContentDisclaimer";
import { FadeInOnView } from "@/components/motion/FadeInOnView";
import { LogosMarquee } from "@/components/home/LogosMarquee";
import { CaseStudyMarquee } from "@/components/ville/CaseStudyMarquee";
import { AiToolsStack } from "@/components/ville/AiToolsStack";
import { OrangeContactBanner } from "@/components/ville/OrangeContactBanner";
import { FaqBlock } from "@/components/sections/FaqBlock";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { getRegion } from "@/content/regions";
import { VILLES, getVille } from "@/content/villes";
import { CLIENT_LOGOS } from "@/content/home-data";
import {
  buildProductMetadata,
  buildBreadcrumbJsonLd,
  buildServiceJsonLd,
  buildFaqSpeakableJsonLd,
  SITE_URL,
} from "@/lib/seo";
import { LANDING_VILLE_VERTICAL_SLUGS } from "@/server/content-gen/generators/landing-ville-shared";
import { REALISATIONS_BY_VERTICALE, VERTICALES_META } from "@/content/ville-realisations";
import { VERTICALE_META } from "@/content/verticale-meta";
import {
  AUDIT_TIERS,
  INTERVENTION_TIERS,
  IMPLEMENTATION_TIERS,
  UN_A_UN_TIERS,
  formatAmount,
  getEntryPriceEur,
  getTierById,
} from "@/content/pricing";
import type { LandingVilleVerticalSlug } from "@/server/content-gen/generators/landing-ville-shared";
import { getLandingVilleArticleByVertical } from "@/server/content-gen/landing-ville/get-article-by-vertical";

interface Props {
  params: Promise<{ locale: string; region: string; ville: string; verticale: string }>;
}

// Edge case E5 — top ~100 villes pilotes par population.
// Empêche le build GH Actions de saturer à 10 750 routes SSG (cf. ADR 0026).
// Les villes restantes (2050+) sont rendues en ISR-on-demand via dynamicParams=true.
const VERTICAL_SLUGS_FOR_STATIC = LANDING_VILLE_VERTICAL_SLUGS;

export function generateStaticParams(): Array<{
  region: string;
  ville: string;
  verticale: string;
}> {
  const top100 = [...VILLES].sort((a, b) => b.population - a.population).slice(0, 100);
  return top100.flatMap((v) =>
    VERTICAL_SLUGS_FOR_STATIC.map((vertical) => ({
      region: v.region,
      ville: v.slug,
      verticale: vertical,
    })),
  );
}

// ISR : revalidate quotidien + dynamicParams autorise les 10 250 routes
// restantes en lazy ISR.
export const revalidate = 86400;
export const dynamicParams = true;

const VERTICAL_LABEL_FR: Record<LandingVilleVerticalSlug, string> = {
  interventions: "Interventions terrain",
  audits: "Audit IA d'optimisation",
  implementations: "Implémentation IA",
  "un-a-un": "Accompagnement 1-to-1",
  "sites-web-ia": "Sites web & digital IA",
};

/** Label CTA "voir la page produit principale" — adapté au type (Will 2026-05-25). */
const SEE_MAIN_PAGE_LABEL_FR: Record<LandingVilleVerticalSlug, string> = {
  interventions: "Voir les formations IA",
  audits: "Voir les audits IA",
  implementations: "Voir les implémentations & automatisations",
  "un-a-un": "Voir le coaching 1-to-1",
  "sites-web-ia": "Voir nos plateformes web & SaaS IA",
};
const SEE_MAIN_PAGE_LABEL_EN: Record<LandingVilleVerticalSlug, string> = {
  interventions: "See AI training offers",
  audits: "See AI audit offers",
  implementations: "See implementations & automations",
  "un-a-un": "See 1-to-1 coaching",
  "sites-web-ia": "See AI web & SaaS platforms",
};

// CTA hrefs vers les pages principales — vérifiées matchent les vrais path Next.js
// (Will 2026-05-25 : /1-to-1 n'existe pas, c'est /un-a-un. Codage et sites-web tous 2 existent.)
const VERTICAL_CTA_HREF: Record<LandingVilleVerticalSlug, string> = {
  interventions: "/interventions",
  audits: "/audit",
  implementations: "/implementation",
  "un-a-un": "/un-a-un",
  "sites-web-ia": "/sites-web-augmentes",
};

function isValidVertical(value: string): value is LandingVilleVerticalSlug {
  return (LANDING_VILLE_VERTICAL_SLUGS as ReadonlyArray<string>).includes(value);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, region: regionSlug, ville: villeSlug, verticale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  if (!isValidVertical(verticale)) return {};
  const ville = getVille(villeSlug);
  if (!ville || ville.region !== regionSlug) return {};
  const region = getRegion(regionSlug);
  if (!region) return {};
  const isFr = locale === "fr";

  const article = await getLandingVilleArticleByVertical(ville.slug, verticale, locale as Locale);

  const verticalLabel = VERTICAL_LABEL_FR[verticale];
  // Le layout root applique `template: "%s · Axion-IA"` — donc on N'AJOUTE PAS
  // "· Axion-IA" ici sinon le title devient "... · Axion-IA · Axion-IA".
  const title = article?.metaTitle
    ? article.metaTitle.replace(/\s*·\s*Axion-IA\s*$/i, "") // strip si LLM l'a ajouté
    : isFr
      ? `${verticalLabel} à ${ville.nameFr}`
      : `${verticalLabel} in ${ville.nameFr}`;
  const description = article?.metaDescription
    ? article.metaDescription
    : isFr
      ? `Axion-IA propose ${verticalLabel.toLowerCase()} à ${ville.nameFr} (${region.nameFr}). Tarifs publics, intervention rapide, ROI chiffré.`
      : `Axion-IA delivers ${verticalLabel.toLowerCase()} in ${ville.nameFr} (${region.nameFr}). Public pricing, fast intervention, costed ROI.`;

  const meta = buildProductMetadata({
    locale,
    path: `/implantations/${region.slug}/${ville.slug}/${verticale}`,
    title,
    description,
  });

  // Override title en mode `absolute` pour bypass le `template: "%s · Axion-IA"` du layout.
  // Sinon, si le metaTitle du LLM contient déjà "Axion-IA" (cas fréquent : "... Cabinet Axion-IA ..."),
  // le title final devient "... · Axion-IA · Axion-IA" (doublon).
  const titleWithBrand = /axion[- ]?ia/i.test(title) ? title : `${title} · Axion-IA`;
  const metaWithAbsoluteTitle: Metadata = { ...meta, title: { absolute: titleWithBrand } };

  // Anti-doorway HCU 2024 — si pas d'Article DB OU si l'Article est tier_3,
  // forcer noindex pour ne pas polluer le crawl avec du stub vide.
  const shouldNoindex = !article || article.indexationTier === "tier_3_noindex_nofollow";
  if (shouldNoindex) {
    return { ...metaWithAbsoluteTitle, robots: { index: false, follow: true } };
  }
  return metaWithAbsoluteTitle;
}

export default async function VilleVerticalePage({ params }: Props) {
  const { locale, region: regionSlug, ville: villeSlug, verticale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  if (!isValidVertical(verticale)) notFound();
  const ville = getVille(villeSlug);
  if (!ville || ville.region !== regionSlug) notFound();
  const region = getRegion(regionSlug);
  if (!region) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const verticalLabel = VERTICAL_LABEL_FR[verticale];
  const ctaHref = VERTICAL_CTA_HREF[verticale];

  const breadcrumbItems = [
    { href: "/implantations", label: isFr ? "Implantations" : "Locations" },
    { href: `/implantations/${region.slug}`, label: region.nameFr },
    { href: `/implantations/${region.slug}/${ville.slug}`, label: ville.nameFr },
    {
      href: `/implantations/${region.slug}/${ville.slug}/${verticale}`,
      label: verticalLabel,
    },
  ];

  const article = await getLandingVilleArticleByVertical(ville.slug, verticale, loc);

  const path = `/implantations/${region.slug}/${ville.slug}/${verticale}` as `/${string}`;
  const url = `${SITE_URL}/${loc}${path}`;

  // ─── Stub minimal noindex si Article absent ───────────────────────────────
  if (!article) {
    return (
      <Section
        eyebrow={isFr ? `Implantations · ${region.nameFr}` : `Locations · ${region.nameFr}`}
        title={isFr ? `${verticalLabel} à` : `${verticalLabel} in`}
        titleEm={ville.nameFr}
        description={
          isFr
            ? `La page locale détaillée pour ${verticalLabel.toLowerCase()} à ${ville.nameFr} est en cours de génération. En attendant, retrouvez tous nos services via la page ville.`
            : `The detailed local page for ${verticalLabel.toLowerCase()} in ${ville.nameFr} is being generated. Meanwhile, find all our services via the city page.`
        }
        titleAs="h1"
      >
        <div className="mb-8">
          <Breadcrumbs items={breadcrumbItems} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Cta
            href={`/implantations/${region.slug}/${ville.slug}` as never}
            variant="primary"
            size="lg"
            shape="pill"
            track="ville_vertical_stub_back_ville"
          >
            {isFr
              ? `Voir tous les services à ${ville.nameFr}`
              : `See all services in ${ville.nameFr}`}
            <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
          </Cta>
          <Cta
            href={ctaHref as never}
            variant="ghost"
            size="lg"
            shape="pill"
            track="ville_vertical_stub_cta_global"
          >
            {isFr ? `Découvrir ${verticalLabel}` : `Discover ${verticalLabel}`}
          </Cta>
        </div>
        <AiContentDisclaimer locale={loc} className="mt-8" />
      </Section>
    );
  }

  // ─── Article publié : rendu complet ──────────────────────────────────────
  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path,
    name: isFr
      ? `${verticalLabel} à ${ville.nameFr} · Axion-IA`
      : `${verticalLabel} in ${ville.nameFr} · Axion-IA`,
    description: article.directAnswer ?? article.excerpt ?? article.title,
    serviceType: isFr
      ? `Cabinet IA opérationnel · ${verticalLabel}`
      : `Operational AI · ${verticalLabel}`,
    areasServed: [
      { type: "City", name: ville.nameFr, url },
      {
        type: "AdministrativeArea",
        name: region.nameFr,
        url: `${SITE_URL}/${loc}/implantations/${region.slug}`,
      },
      { type: "Country", name: "France" },
    ],
  });

  const breadcrumbJsonLd = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Implantations" : "Locations", href: "/implantations" },
      { name: region.nameFr, href: `/implantations/${region.slug}` },
      { name: ville.nameFr, href: `/implantations/${region.slug}/${ville.slug}` },
      { name: verticalLabel, href: path },
    ],
  });

  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: article.metaTitle ?? article.title,
    description: (article.metaDescription ?? article.directAnswer ?? "").slice(0, 300),
    inLanguage: loc,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    breadcrumb: { "@id": `${url}#breadcrumb` },
    datePublished: article.publishedAt?.toISOString(),
  } as const;

  // 🆕 Sprint Quality 2026 V2 — parse article.faqJson supportant 2 formats :
  //   - V1 (legacy) : array `[{q, a}, ...]`
  //   - V2 (Sprint Quality 2026) : objet `{ version: 2, faq: [...], whyHere: [...],
  //     methodology: [...], pricingTable: [...], guarantees: "..." }`
  type RawFaq = { q?: string; question?: string; a?: string; answer?: string };
  type StructuredV2 = {
    readonly version?: number;
    readonly faq?: ReadonlyArray<RawFaq>;
    readonly whyHere?: ReadonlyArray<string>;
    readonly methodology?: ReadonlyArray<{ step?: string; detail?: string }>;
    readonly pricingTable?: ReadonlyArray<{ size?: string; price?: string; detail?: string }>;
    readonly guarantees?: string;
  };
  const rawFaqJson = article.faqJson as unknown;
  const structuredV2: StructuredV2 | null =
    rawFaqJson && typeof rawFaqJson === "object" && !Array.isArray(rawFaqJson)
      ? (rawFaqJson as StructuredV2)
      : null;
  const rawFaqArray: ReadonlyArray<RawFaq> = structuredV2?.faq
    ? structuredV2.faq
    : Array.isArray(rawFaqJson)
      ? (rawFaqJson as ReadonlyArray<RawFaq>)
      : [];
  const faqItems = rawFaqArray
    .map((f, idx) => {
      const q = (f.q ?? f.question ?? "").trim();
      const a = (f.a ?? f.answer ?? "").trim();
      if (!q || !a) return null;
      return { id: `${ville.slug}-${verticale}-faq-${idx}`, question: q, answer: a };
    })
    .filter((x): x is { id: string; question: string; answer: string } => x !== null)
    .slice(0, 8);

  // Extraction sections structurées (V2 only — backward compat OK si null)
  const whyHereItems = structuredV2?.whyHere ?? [];
  const methodologySteps = (structuredV2?.methodology ?? [])
    .map((m) => ({ step: (m.step ?? "").trim(), detail: (m.detail ?? "").trim() }))
    .filter((m) => m.step && m.detail);
  // Note : pricingTable LLM ignoré au profit de PRICING_SSOT_BY_VERTICALE (cohérence prix).
  const guaranteesText = (structuredV2?.guarantees ?? "").trim();
  // Speakable JSON-LD pour les FAQ — AI Overviews + voice assistants
  const faqSpeakableJsonLd =
    faqItems.length > 0
      ? buildFaqSpeakableJsonLd({
          items: faqItems.map((f) => ({ question: f.question, answer: f.answer })),
        })
      : null;

  // 4 autres verticales pour internal linking en bas de page
  const OTHER_VERTICALES = VERTICALES_META.filter((v) => v.slug !== verticale);

  // Réalisations FILTRÉES par verticale (Sprint Quality 2026 Will 2026-05-25 —
  // les 10 images génériques étaient hors sujet pour audit/formations/1-to-1).
  const CASE_STUDY_MARQUEE_ITEMS = REALISATIONS_BY_VERTICALE[verticale];

  // External links — sources d'autorité par verticale (E-E-A-T 2026)
  const EXTERNAL_LINKS_BY_VERTICALE: Record<
    typeof verticale,
    ReadonlyArray<{ label: string; url: string; org: string }>
  > = {
    audits: [
      {
        label: "CNIL — Intelligence artificielle",
        url: "https://www.cnil.fr/fr/intelligence-artificielle",
        org: "CNIL",
      },
      { label: "ANSSI — Sécurité IA générative", url: "https://cyber.gouv.fr/", org: "ANSSI" },
      {
        label: "AI Act EU — Règlement 2024/1689",
        url: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj",
        org: "Eur-Lex",
      },
    ],
    interventions: [
      {
        label: "France Num — Formations IA",
        url: "https://www.francenum.gouv.fr/",
        org: "France Num",
      },
      { label: "AFNOR — Référentiels IA", url: "https://www.afnor.org/", org: "AFNOR" },
      {
        label: "BPI France — IA dans les PME",
        url: "https://www.bpifrance.fr/",
        org: "BPI France",
      },
    ],
    implementations: [
      {
        label: "INSEE — Statistiques entreprises",
        url: "https://www.insee.fr/fr/statistiques",
        org: "INSEE",
      },
      {
        label: "AI Act EU — Conformité IA",
        url: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj",
        org: "Eur-Lex",
      },
      {
        label: "BPI France — Aide implémentation IA",
        url: "https://www.bpifrance.fr/",
        org: "BPI France",
      },
    ],
    "un-a-un": [
      {
        label: "France Num — Dirigeants et IA",
        url: "https://www.francenum.gouv.fr/",
        org: "France Num",
      },
      {
        label: "INSEE — Démographie entreprises",
        url: "https://www.insee.fr/fr/statistiques",
        org: "INSEE",
      },
    ],
    "sites-web-ia": [
      { label: "CNIL — Données personnelles & IA", url: "https://www.cnil.fr/", org: "CNIL" },
      { label: "ANSSI — Sécurité web", url: "https://cyber.gouv.fr/", org: "ANSSI" },
      {
        label: "AI Act EU — Plateformes IA",
        url: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj",
        org: "Eur-Lex",
      },
    ],
  };
  const externalLinks = EXTERNAL_LINKS_BY_VERTICALE[verticale];

  // Section "Nos experts" — adaptée par verticale (Sprint Quality 2026 — pas William seul)
  const EXPERTS_INTRO_BY_VERTICALE: Record<
    typeof verticale,
    { titleFr: string; bodyFr: string; titleEn: string; bodyEn: string }
  > = {
    // Sprint Quality 2026 Will 2026-05-25 — retrait des claims INVENTÉS (Big 4, CTO/CDO, AFNOR).
    // Ne rien affirmer qu'on ne peut prouver. Focus : seniorité, terrain, sans junior.
    audits: {
      titleFr: "Nos experts auditeurs interviennent",
      titleEn: "Our expert auditors intervene",
      bodyFr: `Une équipe d'experts d'auditeurs IA seniors expérimentés — praticiens terrain, jamais junior sur vos missions. Chaque audit à ${ville.nameFr} est conduit avec la même rigueur méthodologique, du diagnostic Flash 4h au cadrage complet bout-en-bout de votre structure.`,
      bodyEn: `An expert team of senior AI auditors — field practitioners, never a junior on your engagements. Every audit in ${ville.nameFr} is conducted with the same methodological rigor, from Flash 4h diagnosis to a complete end-to-end scope review of your structure.`,
    },
    interventions: {
      titleFr: "Nos formateurs IA interviennent",
      titleEn: "Our AI trainers intervene",
      bodyFr: `William J. assure la majorité des formations à ${ville.nameFr}. Une équipe d'experts de formateurs IA seniors expérimentés le seconde — praticiens IA terrain, jamais théoriciens. Vos collaborateurs montent en compétence sur vos outils réels avec un premier livrable opérationnel dès le lendemain.`,
      bodyEn: `William J. personally delivers most training in ${ville.nameFr}. An expert team of senior AI trainers supports him — field practitioners, never theorists. Your teams build skills on your real tools with a first operational deliverable by the next day.`,
    },
    implementations: {
      titleFr: "Nos experts implémenteurs interviennent",
      titleEn: "Our expert implementers intervene",
      bodyFr: `Une équipe d'experts d'ingénieurs IA seniors expérimentés — full-stack, agents IA, intégrations CRM/ERP. Aucun consultant junior sur vos missions à ${ville.nameFr}. Architecture livrée en production, documentée, transférable. Support 90 jours inclus.`,
      bodyEn: `An expert team of senior AI engineers — full-stack, AI agents, CRM/ERP integration. Never a junior consultant on your engagements in ${ville.nameFr}. Production-grade architecture, documented, transferable. 90-day support included.`,
    },
    "un-a-un": {
      titleFr: "William J. et nos coachs IA interviennent",
      titleEn: "William J. and our AI coaches intervene",
      // Will 2026-05-25 : un-a-un n'est pas QUE pour dirigeants — c'est pour TOUT poste qui
      // a besoin d'un accompagnement individuel (collaborateur, secrétaire, manager, etc.)
      bodyFr: `William J., fondateur d'Axion-IA, conduit lui-même la majorité des sessions 1-to-1 à ${ville.nameFr}. Une équipe d'experts de coachs IA seniors expérimentés le seconde — accompagnement individuel adapté à TOUT profil : dirigeant, manager, commercial, secrétaire, opérationnel… Pas de coach junior, pas de méthode pré-mâchée : chaque session est calibrée sur votre poste, vos enjeux quotidiens, votre maturité IA.`,
      bodyEn: `William J., Axion-IA founder, personally leads most 1-to-1 sessions in ${ville.nameFr}. An expert team of senior AI coaches supports him — individual coaching for ANY role: executive, manager, sales, assistant, operational… No junior coach, no off-the-shelf method: each session is calibrated to your role, daily challenges, AI maturity.`,
    },
    "sites-web-ia": {
      titleFr: "Nos développeurs IA interviennent",
      titleEn: "Our AI developers intervene",
      bodyFr: `Une équipe d'experts de développeurs full-stack IA seniors expérimentés — architectes plateformes web, search sémantique, chatbots RAG. Aucun junior sur vos projets à ${ville.nameFr}. Stack moderne, RGPD hébergement UE, code documenté et transférable.`,
      bodyEn: `An expert team of senior full-stack AI developers — web platform architects, semantic search, RAG chatbots. Never a junior on your projects in ${ville.nameFr}. Modern stack, EU GDPR hosting, documented and transferable code.`,
    },
  };
  const expertsIntro = EXPERTS_INTRO_BY_VERTICALE[verticale];

  // Sprint Quality 2026 visual perfection — bénéfices/avant-après par verticale
  const verticaleMeta = VERTICALE_META[verticale];

  // Sprint Quality 2026 V5 — parse body LLM en cards visuelles distinctes.
  // Split par <h2> pour transformer le wall of text en sections rythmées avec
  // background alternant et padding aéré. Le premier bloc avant H2 = intro.
  interface BodyBlock {
    readonly title: string | null; // null pour le bloc d'intro
    readonly html: string;
  }
  function splitBodyByH2(rawHtml: string): BodyBlock[] {
    if (!rawHtml?.trim()) return [];
    // Split par <h2> ... </h2> mais en gardant le contenu après chaque H2
    const parts = rawHtml.split(/<h2[^>]*>(.+?)<\/h2>/i);
    const blocks: BodyBlock[] = [];
    // parts[0] = contenu AVANT le premier h2 (intro)
    // parts[1] = titre h2 #1
    // parts[2] = contenu après h2 #1
    // parts[3] = titre h2 #2
    // ...
    const intro = (parts[0] ?? "").trim();
    if (intro.length > 30) {
      // Filtre les blocs vides ou trop courts
      blocks.push({ title: null, html: intro });
    }
    for (let i = 1; i < parts.length; i += 2) {
      const title = (parts[i] ?? "").trim();
      const html = (parts[i + 1] ?? "").trim();
      if (title && html.length > 30) {
        blocks.push({ title, html });
      }
    }
    return blocks;
  }
  const bodyBlocks = splitBodyByH2(article.body);

  // Sprint Quality 2026 — pricing depuis SSOT pricing.ts (ignore LLM pricingTable qui
  // pouvait produire des incohérences PME > ETI). 4 cards par taille TPE/PME/ETI/GE.
  function fmt(n: number | undefined | null): string {
    if (!n || n === 0) return isFr ? "Sur mesure" : "Custom";
    return formatAmount(n, loc, { compact: true });
  }
  const PRICING_SSOT_BY_VERTICALE: Record<
    typeof verticale,
    ReadonlyArray<{
      sizeFr: string;
      sizeEn: string;
      price: string;
      detailFr: string;
      detailEn: string;
    }>
  > = {
    audits: [
      {
        sizeFr: "TPE (1-10 collab.)",
        sizeEn: "Micro (1-10)",
        price: `À partir de ${fmt(getTierById(AUDIT_TIERS, "audit-flash").priceFlat)}`,
        detailFr: "Audit Flash 4h, diagnostic + 3 chantiers chiffrés.",
        detailEn: "Flash audit 4h, diagnosis + 3 costed projects.",
      },
      {
        sizeFr: "PME (10-250)",
        sizeEn: "SMB (10-250)",
        price: `À partir de ${fmt(getTierById(AUDIT_TIERS, "audit-cible").priceMin)}`,
        detailFr: "Audit Ciblé, plongée fine 1 processus, entretiens métiers.",
        detailEn: "Targeted audit, deep dive 1 process, operations interviews.",
      },
      {
        sizeFr: "ETI (250-4 999)",
        sizeEn: "Mid-market (250-4,999)",
        price: `À partir de ${fmt(getTierById(AUDIT_TIERS, "audit-strategique-pme").priceMin)}`,
        detailFr: "Audit Stratégique PME ou Stratégique ETI selon périmètre.",
        detailEn: "SME Strategic or Mid-cap Strategic audit per scope.",
      },
      {
        sizeFr: "Grande entreprise (5 000+)",
        sizeEn: "Large enterprise (5,000+)",
        price: isFr ? "Sur mesure" : "Custom scope",
        detailFr: "Audit transverse multi-départements, gouvernance IA, AI Act.",
        detailEn: "Transverse multi-department audit, AI governance, AI Act.",
      },
    ],
    interventions: [
      {
        sizeFr: "TPE (1-10 collab.)",
        sizeEn: "Micro (1-10)",
        price: `À partir de ${fmt(getEntryPriceEur(INTERVENTION_TIERS))}`,
        detailFr: "Sensibilisation ½ journée, premier livrable opérationnel J+1.",
        detailEn: "Half-day awareness, first operational deliverable D+1.",
      },
      {
        sizeFr: "PME (10-250)",
        sizeEn: "SMB (10-250)",
        price: `À partir de ${fmt(getEntryPriceEur(INTERVENTION_TIERS))}`,
        detailFr: "Atelier pratique 1 jour sur vos outils, livrable J+1.",
        detailEn: "1-day hands-on workshop on your tools, deliverable D+1.",
      },
      {
        sizeFr: "ETI (250-4 999)",
        sizeEn: "Mid-market (250-4,999)",
        price: `À partir de ${fmt(getEntryPriceEur(INTERVENTION_TIERS))}`,
        detailFr: "Programme sur mesure 2 jours+, formation managers + opérationnels.",
        detailEn: "Custom program 2 days+, manager + operational training.",
      },
      {
        sizeFr: "Grande entreprise (5 000+)",
        sizeEn: "Large enterprise (5,000+)",
        price: isFr ? "Sur mesure" : "Custom scope",
        detailFr: "Déploiement progressif multi-sites, parcours adapté par métier.",
        detailEn: "Progressive multi-site deployment, role-adapted paths.",
      },
    ],
    implementations: [
      {
        sizeFr: "TPE (1-10 collab.)",
        sizeEn: "Micro (1-10)",
        price: `À partir de ${fmt(getEntryPriceEur(IMPLEMENTATION_TIERS))}`,
        detailFr: "Première automatisation back-office, ROI sous 4 semaines.",
        detailEn: "First back-office automation, ROI under 4 weeks.",
      },
      {
        sizeFr: "PME (10-250)",
        sizeEn: "SMB (10-250)",
        price: `À partir de ${fmt(getEntryPriceEur(IMPLEMENTATION_TIERS))}`,
        detailFr: "3 chantiers prioritaires livrés clés en main, support 90 j inclus.",
        detailEn: "3 priority projects delivered turnkey, 90-day support included.",
      },
      {
        sizeFr: "ETI (250-4 999)",
        sizeEn: "Mid-market (250-4,999)",
        price: `À partir de ${fmt(getEntryPriceEur(IMPLEMENTATION_TIERS))}`,
        detailFr: "Intégration CRM/ERP existants, déploiement multi-sites.",
        detailEn: "Existing CRM/ERP integration, multi-site deployment.",
      },
      {
        sizeFr: "Grande entreprise (5 000+)",
        sizeEn: "Large enterprise (5,000+)",
        price: isFr ? "Sur mesure" : "Custom scope",
        detailFr: "Architecture agents IA gouvernée, conformité AI Act, partenaire indépendant.",
        detailEn: "Governed AI agent architecture, AI Act compliance, independent partner.",
      },
    ],
    "un-a-un": [
      {
        sizeFr: "TPE (1-10 collab.)",
        sizeEn: "Micro (1-10)",
        price: `À partir de ${fmt(getEntryPriceEur(UN_A_UN_TIERS))}`,
        detailFr: "Session dirigeant 1-to-1, feuille de route IA personnalisée.",
        detailEn: "1-to-1 executive session, personalized AI roadmap.",
      },
      {
        sizeFr: "PME (10-250)",
        sizeEn: "SMB (10-250)",
        price: `À partir de ${fmt(getEntryPriceEur(UN_A_UN_TIERS))}`,
        detailFr: "Accompagnement DG, cadrage stratégique IA, 3 chantiers chiffrés.",
        detailEn: "CEO coaching, AI strategic scoping, 3 costed projects.",
      },
      {
        sizeFr: "ETI (250-4 999)",
        sizeEn: "Mid-market (250-4,999)",
        price: `À partir de ${fmt(getEntryPriceEur(UN_A_UN_TIERS))}`,
        detailFr: "Coaching Dir.Transformation, gouvernance IA multi-équipes.",
        detailEn: "Transformation Director coaching, multi-team AI governance.",
      },
      {
        sizeFr: "Grande entreprise (5 000+)",
        sizeEn: "Large enterprise (5,000+)",
        price: isFr ? "Sur mesure" : "Custom scope",
        detailFr: "Coaching DSI / CAIO, conformité AI Act, gouvernance IA.",
        detailEn: "CIO / CAIO coaching, AI Act compliance, AI governance.",
      },
    ],
    "sites-web-ia": [
      {
        sizeFr: "TPE (1-10 collab.)",
        sizeEn: "Micro (1-10)",
        price: isFr ? "Sur devis" : "On quote",
        detailFr: "Site vitrine IA-native, lead-capture intelligent.",
        detailEn: "AI-native showcase site, smart lead capture.",
      },
      {
        sizeFr: "PME (10-250)",
        sizeEn: "SMB (10-250)",
        price: isFr ? "Sur devis" : "On quote",
        detailFr: "Plateforme métier avec search IA + chatbot RAG.",
        detailEn: "Business platform with AI search + RAG chatbot.",
      },
      {
        sizeFr: "ETI (250-4 999)",
        sizeEn: "Mid-market (250-4,999)",
        price: isFr ? "Sur devis" : "On quote",
        detailFr: "SaaS multi-tenants augmenté IA, dashboards temps réel.",
        detailEn: "Multi-tenant AI-augmented SaaS, real-time dashboards.",
      },
      {
        sizeFr: "Grande entreprise (5 000+)",
        sizeEn: "Large enterprise (5,000+)",
        price: isFr ? "Sur mesure" : "Custom scope",
        detailFr: "Architecture plateforme intelligente, RGPD UE, AI Act.",
        detailEn: "Intelligent platform architecture, EU GDPR, AI Act.",
      },
    ],
  };
  const ssotPricingRows = PRICING_SSOT_BY_VERTICALE[verticale];

  return (
    <>
      <section className="bg-halo-warm relative overflow-hidden pt-12 pb-16 sm:pt-14 sm:pb-20 lg:pt-20 lg:pb-24">
        <Container>
          <div className="mb-8">
            <Breadcrumbs items={breadcrumbItems} emitJsonLd={false} />
          </div>
          <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
            <span
              aria-hidden="true"
              className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
            />
            {isFr ? `${verticalLabel} · ${region.nameFr}` : `${verticalLabel} · ${region.nameFr}`}
          </p>
          {/* H1 — override template (Will 2026-05-25) : le H1 LLM était souvent trop long.
              Format court SEO-optimisé : "[Type] IA à [Ville]" avec accent terracotta sur ville. */}
          {(() => {
            const H1_LABEL_FR: Record<typeof verticale, string> = {
              interventions: "Formations IA",
              audits: "Audit IA d'optimisation",
              implementations: "Implémentations & automatisations IA",
              "un-a-un": "Coaching 1-to-1 dirigeants IA",
              "sites-web-ia": "Sites web & SaaS augmentés IA",
            };
            const H1_LABEL_EN: Record<typeof verticale, string> = {
              interventions: "AI training",
              audits: "AI optimization audit",
              implementations: "AI implementations & automations",
              "un-a-un": "Executive 1-to-1 AI coaching",
              "sites-web-ia": "AI-augmented websites & SaaS",
            };
            const label = isFr ? H1_LABEL_FR[verticale] : H1_LABEL_EN[verticale];
            return (
              <h1 className="display-editorial text-fg max-w-4xl">
                {label} {isFr ? "à " : "in "}
                <span
                  className="text-terracotta italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {ville.nameFr}
                </span>
                .
              </h1>
            );
          })()}
          {article.directAnswer ? (
            <p className="text-fg-soft mt-6 max-w-3xl text-lg leading-relaxed sm:text-xl">
              {article.directAnswer}
            </p>
          ) : null}
          <div className="text-fg-muted mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {ville.nameFr} · {region.nameFr}
            </span>
            {article.readingTime != null ? (
              <span>
                {isFr ? `${article.readingTime} min de lecture` : `${article.readingTime} min read`}
              </span>
            ) : null}
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Cta
              href="/appel"
              variant="primary"
              size="lg"
              shape="pill"
              track="ville_vertical_cta_book"
            >
              {isFr ? "Réserver un appel" : "Book a call"}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Cta>
            <Cta
              href="/contact"
              variant="ghost"
              size="lg"
              shape="pill"
              track="ville_vertical_cta_contact"
            >
              {isFr ? "Nous contacter" : "Contact us"}
            </Cta>
            <Cta
              href="/cas-concrets"
              variant="ghost"
              size="lg"
              shape="pill"
              track="ville_vertical_cta_realisations"
            >
              {isFr ? "Voir nos réalisations" : "Our case studies"}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Cta>
          </div>
        </Container>
      </section>

      {/* ── 1b. BÉNÉFICES VISUELS — 4 cards icon + chiffre (Sprint Quality 2026 perfection) ── */}
      <section
        aria-label={isFr ? "Bénéfices clés" : "Key benefits"}
        className="bg-bg border-border border-t border-b py-10 sm:py-12"
      >
        <Container>
          <ul role="list" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {verticaleMeta.benefits.map((b, idx) => (
              <FadeInOnView key={idx} delay={idx * 50}>
                <li className="bg-paper border-border-strong/30 flex items-start gap-3 rounded-2xl border p-4 sm:p-5">
                  <span className="bg-terracotta-soft text-terracotta-deep flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                    <b.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-fg text-lg leading-tight font-bold tracking-tight"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {b.number}
                    </p>
                    <p className="text-fg-muted mt-1 text-xs leading-snug">
                      {isFr ? b.labelFr : b.labelEn}
                    </p>
                  </div>
                </li>
              </FadeInOnView>
            ))}
          </ul>
        </Container>
      </section>

      {/* ── 2. LOGOS CLIENTS — continuité brand depuis le hub ── */}
      <section
        aria-label={isFr ? "Ils nous font confiance" : "They trust us"}
        className="bg-bg border-border border-b py-10 sm:py-12"
      >
        <Container>
          <LogosMarquee logos={CLIENT_LOGOS} />
        </Container>
      </section>

      {/* ── 3. RÉALISATIONS CAROUSEL — preuve sociale visuelle ── */}
      <section className="bg-paper py-16 sm:py-20">
        <Container>
          <FadeInOnView>
            <div className="mx-auto mb-10 max-w-3xl text-center">
              <p className="text-fg-muted mb-4 text-[13px] font-medium tracking-[0.16em] uppercase">
                <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                {isFr ? "Réalisations · impact mesuré" : "Case studies · measured impact"}
              </p>
              <h2
                className="text-fg text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.1] font-semibold tracking-tight"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr ? "Des " : "Best-in-class "}
                <span className="italic-editorial text-terracotta">
                  {isFr
                    ? `${verticalLabel.toLowerCase()} qui font la différence`
                    : `${verticalLabel.toLowerCase()}`}
                </span>
              </h2>
            </div>
          </FadeInOnView>
          <FadeInOnView>
            <CaseStudyMarquee
              isFr={isFr}
              items={CASE_STUDY_MARQUEE_ITEMS}
              lightboxEnabled={false}
            />
          </FadeInOnView>
        </Container>
      </section>

      {/* ── 3b. AVANT / APRÈS — impact concret visuel (Sprint Quality 2026 perfection) ── */}
      <section
        aria-label={isFr ? "Avant et après Axion-IA" : "Before and after Axion-IA"}
        className="bg-bg border-border border-t py-16 sm:py-20"
      >
        <Container>
          <div className="mx-auto max-w-5xl">
            <FadeInOnView>
              <div className="mb-10 text-center">
                <p className="text-fg-muted mb-4 text-[13px] font-medium tracking-[0.16em] uppercase">
                  <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                  {isFr ? "Impact concret" : "Concrete impact"}
                </p>
                <h2
                  className="text-fg text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.1] font-semibold tracking-tight"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "Avant et " : "Before and "}
                  <span className="italic-editorial text-terracotta">
                    {isFr ? "après Axion-IA" : "after Axion-IA"}
                  </span>
                </h2>
              </div>
            </FadeInOnView>
            <ul role="list" className="grid gap-3 sm:gap-4 md:grid-cols-2">
              {verticaleMeta.beforeAfter.map((ba, idx) => (
                <FadeInOnView key={idx} delay={idx * 60}>
                  <li className="bg-paper border-border overflow-hidden rounded-2xl border">
                    <p className="text-fg-muted bg-bg border-border border-b px-4 py-2 text-xs font-semibold tracking-[0.14em] uppercase">
                      {isFr ? ba.labelFr : ba.labelEn}
                    </p>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center divide-x">
                      <div className="p-4 text-center sm:p-5">
                        <p className="text-fg-muted mb-1 text-[10px] font-semibold tracking-[0.2em] uppercase">
                          {isFr ? "Avant" : "Before"}
                        </p>
                        <p
                          className="text-fg-soft text-lg font-semibold"
                          style={{ fontFamily: "var(--font-serif)" }}
                        >
                          {ba.before}
                        </p>
                      </div>
                      <div className="text-terracotta px-2">
                        <ArrowRight className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="bg-terracotta-soft p-4 text-center sm:p-5">
                        <p className="text-terracotta-deep mb-1 text-[10px] font-semibold tracking-[0.2em] uppercase">
                          {isFr ? "Après" : "After"}
                        </p>
                        <p
                          className="text-terracotta-deep text-lg font-bold"
                          style={{ fontFamily: "var(--font-serif)" }}
                        >
                          {ba.after}
                        </p>
                      </div>
                    </div>
                  </li>
                </FadeInOnView>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {/* ── 4. CONTENU ÉDITORIAL — body LLM en CARDS VISUELLES (Sprint Quality 2026 V5)
           Plus de wall of text : chaque H2 du body devient une card distincte avec
           background, padding aéré et numéro de section. ── */}
      {bodyBlocks.length > 0 ? (
        <section className="bg-sand/30 border-border border-t py-16 sm:py-20 lg:py-24">
          <Container>
            <div className="mx-auto max-w-3xl">
              <FadeInOnView>
                <p className="text-fg-muted mb-8 text-[13px] font-medium tracking-[0.16em] uppercase">
                  <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                  {isFr
                    ? `À propos · ${verticalLabel} à ${ville.nameFr}`
                    : `About · ${verticalLabel} in ${ville.nameFr}`}
                </p>
              </FadeInOnView>
              <div className="space-y-5 sm:space-y-6">
                {bodyBlocks.map((block, idx) => (
                  <FadeInOnView key={idx} delay={idx * 60}>
                    <article
                      className={`bg-paper border-border-strong/40 shadow-subtle hover:shadow-card rounded-2xl border p-6 transition-all sm:p-8 ${
                        block.title === null ? "border-l-terracotta border-l-4" : ""
                      }`}
                    >
                      {block.title ? (
                        <div className="mb-4 flex items-baseline gap-3">
                          <span className="bg-terracotta-soft text-terracotta-deep flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
                            {idx + 1}
                          </span>
                          <h2
                            className="text-fg text-[clamp(1.25rem,2.5vw,1.625rem)] leading-tight font-semibold tracking-tight"
                            style={{ fontFamily: "var(--font-serif)" }}
                          >
                            {block.title}
                          </h2>
                        </div>
                      ) : null}
                      <div
                        className="prose prose-base text-fg-soft prose-a:text-terracotta prose-a:font-medium prose-strong:text-fg prose-p:my-3 prose-p:leading-relaxed prose-li:my-1 max-w-none"
                        style={{ fontFamily: "var(--font-sans)" }}
                        dangerouslySetInnerHTML={{ __html: block.html }}
                      />
                    </article>
                  </FadeInOnView>
                ))}
              </div>
              {/* AiToolsStack uniquement pour verticale interventions (formations) */}
              {verticale === "interventions" ? (
                <FadeInOnView>
                  <AiToolsStack isFr={isFr} />
                </FadeInOnView>
              ) : null}
            </div>
          </Container>
        </section>
      ) : null}

      {/* ── 4a. WHY HERE — raisons clés (Sprint Quality 2026 V2 structured) ── */}
      {whyHereItems.length > 0 ? (
        <section
          aria-label={
            isFr ? "Pourquoi cette intervention dans votre ville" : "Why this service in your city"
          }
          className="bg-bg border-border border-t py-16 sm:py-20"
        >
          <Container>
            <div className="mx-auto max-w-5xl">
              <FadeInOnView>
                <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                  <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                  {isFr ? `Pourquoi à ${ville.nameFr}` : `Why in ${ville.nameFr}`}
                </p>
                <h2
                  className="text-fg text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.1] font-semibold tracking-tight"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "Les raisons clés " : "Key reasons "}
                  <span className="italic-editorial text-terracotta">
                    {isFr
                      ? `de choisir ${verticalLabel.toLowerCase()} ici`
                      : `to choose ${verticalLabel.toLowerCase()} here`}
                  </span>
                </h2>
              </FadeInOnView>
              <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {whyHereItems.map((reason, idx) => (
                  <FadeInOnView key={idx} delay={idx * 60}>
                    <li className="bg-paper border-border hover:border-terracotta flex h-full items-start gap-3 rounded-2xl border p-5 transition sm:p-6">
                      <span className="bg-terracotta-soft text-terracotta-deep mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                        {idx + 1}
                      </span>
                      <p className="text-fg text-base leading-relaxed">{reason}</p>
                    </li>
                  </FadeInOnView>
                ))}
              </ul>
            </div>
          </Container>
        </section>
      ) : null}

      {/* ── 4c-bis. POUR QUI ? — TPE / PME / ETI / Grande Entreprise (Sprint Quality 2026 perfection) ── */}
      <section
        aria-label={isFr ? "Pour qui" : "For whom"}
        className="bg-paper border-border border-t py-16 sm:py-20"
      >
        <Container>
          <div className="mx-auto max-w-5xl">
            <FadeInOnView>
              <div className="mb-10">
                <p className="text-fg-muted mb-4 text-[13px] font-medium tracking-[0.16em] uppercase">
                  <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                  {isFr ? "Pour qui" : "For whom"}
                </p>
                <h2
                  className="text-fg text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.1] font-semibold tracking-tight"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "Toutes les " : "Every "}
                  <span className="italic-editorial text-terracotta">
                    {isFr ? "tailles d'entreprise" : "company size"}
                  </span>
                </h2>
                <p className="text-fg-soft mt-3 max-w-2xl text-base leading-relaxed">
                  {isFr
                    ? `Du dirigeant TPE solo à la grande entreprise multi-sites — chaque structure à ${ville.nameFr} bénéficie du même standard senior, calibré à sa taille et sa maturité IA.`
                    : `From solo TPE founder to multi-site enterprise — each structure in ${ville.nameFr} benefits from the same senior standard, sized to its scale and AI maturity.`}
                </p>
              </div>
            </FadeInOnView>
            <ul role="list" className="grid gap-3 sm:gap-4 lg:grid-cols-4">
              {(
                [
                  {
                    titleFr: "TPE & artisans",
                    titleEn: "Micro-businesses",
                    sizeFr: "1-10 collaborateurs",
                    sizeEn: "1-10 staff",
                    descFr:
                      "Démarrage rapide, sans DSI, focus tâches admin/devis/relances. Premier outil IA rentable sous 4 semaines.",
                    descEn:
                      "Quick start, no IT department, focus on admin/quotes/follow-ups. First profitable AI tool within 4 weeks.",
                  },
                  {
                    titleFr: "PME",
                    titleEn: "SMBs",
                    sizeFr: "10-250 collaborateurs",
                    sizeEn: "10-250 staff",
                    descFr:
                      "Cartographie des processus métier, 3 chantiers prioritaires chiffrés, implémentation clés en main. ROI mesuré au trimestre.",
                    descEn:
                      "Process mapping, 3 priority projects costed, turnkey implementation. Measured quarterly ROI.",
                  },
                  {
                    titleFr: "ETI",
                    titleEn: "Mid-market",
                    sizeFr: "250-4 999 collaborateurs",
                    sizeEn: "250-4,999 staff",
                    descFr:
                      "Diagnostic transverse multi-sites, intégration CRM/ERP existants, formation managers + opérationnels. Déploiement progressif.",
                    descEn:
                      "Multi-site transverse diagnosis, existing CRM/ERP integration, manager + operational training. Progressive deployment.",
                  },
                  {
                    titleFr: "Grandes entreprises",
                    titleEn: "Large enterprises",
                    sizeFr: "5 000+ collaborateurs",
                    sizeEn: "5,000+ staff",
                    descFr:
                      "Gouvernance IA, conformité AI Act, pilotes cadrés sur cas métier précis. Partenaire indépendant sans conflit éditeur.",
                    descEn:
                      "AI governance, AI Act compliance, scoped pilots on specific business cases. Independent partner with no vendor conflict.",
                  },
                ] as const
              ).map((p, idx) => (
                <FadeInOnView key={p.titleFr} delay={idx * 70}>
                  <li className="bg-bg border-border hover:border-terracotta flex h-full flex-col gap-3 rounded-2xl border p-5 transition sm:p-6">
                    <div>
                      <h3
                        className="text-fg text-lg leading-tight font-semibold tracking-tight"
                        style={{ fontFamily: "var(--font-serif)" }}
                      >
                        {isFr ? p.titleFr : p.titleEn}
                      </h3>
                      <p className="text-terracotta mt-1 text-xs font-semibold">
                        {isFr ? p.sizeFr : p.sizeEn}
                      </p>
                    </div>
                    <p className="text-fg-soft text-sm leading-relaxed">
                      {isFr ? p.descFr : p.descEn}
                    </p>
                  </li>
                </FadeInOnView>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {/* ── 4d. MÉTHODOLOGIE — timeline étapes (Sprint Quality 2026 V2) ── */}
      {methodologySteps.length > 0 ? (
        <section
          aria-label={isFr ? "Notre méthode" : "Our method"}
          className="bg-paper border-border border-t py-16 sm:py-20"
        >
          <Container>
            <div className="mx-auto max-w-5xl">
              <FadeInOnView>
                <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                  <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                  {isFr ? "Notre méthode" : "Our method"}
                </p>
                <h2
                  className="text-fg text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.1] font-semibold tracking-tight"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "Comment ça " : "How it "}
                  <span className="italic-editorial text-terracotta">
                    {isFr ? "fonctionne" : "works"}
                  </span>
                </h2>
                <p className="text-fg-soft mt-3 max-w-2xl text-base leading-relaxed">
                  {isFr
                    ? "Chaque mission est au cas par cas, calibrée à votre demande : intervention one-shot ponctuelle ou accompagnement récurrent dans le temps. Voici les étapes-type."
                    : "Every engagement is case-by-case, calibrated to your request: one-shot intervention or ongoing recurring support. Here are the typical steps."}
                </p>
              </FadeInOnView>
              <ol className="mt-10 grid gap-4 md:grid-cols-3 lg:gap-6">
                {methodologySteps.map((step, idx) => {
                  const StepIcon =
                    verticaleMeta.methodStepIcons[idx % verticaleMeta.methodStepIcons.length] ??
                    ClipboardCheck;
                  return (
                    <FadeInOnView key={idx} delay={idx * 80}>
                      <li className="bg-bg border-border-strong/40 relative flex h-full flex-col gap-3 rounded-2xl border-2 p-6">
                        <div className="flex items-center gap-3">
                          <span className="bg-terracotta-soft text-terracotta-deep flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                            <StepIcon className="h-5 w-5" aria-hidden="true" />
                          </span>
                          <span className="text-terracotta text-xs font-bold tracking-[0.16em] uppercase">
                            {isFr ? `Étape ${idx + 1}` : `Step ${idx + 1}`}
                          </span>
                        </div>
                        <h3
                          className="text-fg text-lg leading-tight font-semibold tracking-tight"
                          style={{ fontFamily: "var(--font-serif)" }}
                        >
                          {step.step}
                        </h3>
                        <p className="text-fg-soft text-sm leading-relaxed">{step.detail}</p>
                      </li>
                    </FadeInOnView>
                  );
                })}
              </ol>
            </div>
          </Container>
        </section>
      ) : null}

      {/* ── 4d-bis. BANDEAU ORANGE CONTACT (milieu de page — Sprint Quality 2026 Will 2026-05-25) ── */}
      <OrangeContactBanner isFr={isFr} villeSlug={ville.slug} />

      {/* ── 4e. TARIFS — pricing SSOT depuis pricing.ts (Sprint Quality 2026 V3 — Will 2026-05-25)
           Ignore le pricingTable LLM (incohérences). Source = pricing.ts SSOT, mapping
           4 cards TPE/PME/ETI/GE par verticale, "À partir de X €" cohérent.
           ⚠️ Sites web & SaaS : section MASQUÉE (devis sur mesure, pas de prix affichés
           pour éviter d'effrayer prospects — chaque projet a son propre budget). ── */}
      {verticale !== "sites-web-ia" ? (
        <section
          aria-label={isFr ? "Tarifs" : "Pricing"}
          className="bg-bg border-border border-t py-16 sm:py-20"
        >
          <Container>
            <div className="mx-auto max-w-5xl">
              <FadeInOnView>
                <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                  <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                  {isFr ? "Tarifs publics" : "Public pricing"}
                </p>
                <h2
                  className="text-fg text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.1] font-semibold tracking-tight"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "Calibré selon la " : "Sized for your "}
                  <span className="italic-editorial text-terracotta">
                    {isFr ? "taille de votre entreprise" : "company size"}
                  </span>
                </h2>
                <p className="text-fg-soft mt-3 text-base leading-relaxed">
                  {isFr
                    ? "Quelle que soit votre structure, un engagement Axion-IA peut commencer à l'entrée de gamme et s'étendre selon votre périmètre. Tarifs publics, sans devis opaque."
                    : "Whatever your structure, an Axion-IA engagement can start at entry level and scale to your scope. Public pricing, no opaque quotes."}
                </p>
              </FadeInOnView>
              <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {ssotPricingRows.map((p, idx) => (
                  <FadeInOnView key={idx} delay={idx * 60}>
                    <li className="bg-paper border-border-strong/40 shadow-subtle flex h-full flex-col gap-3 rounded-2xl border-2 p-6">
                      <p
                        className="text-fg text-lg leading-tight font-semibold"
                        style={{ fontFamily: "var(--font-serif)" }}
                      >
                        {isFr ? p.sizeFr : p.sizeEn}
                      </p>
                      <p className="text-terracotta text-base font-bold">{p.price}</p>
                      <p className="text-fg-soft text-sm leading-relaxed">
                        {isFr ? p.detailFr : p.detailEn}
                      </p>
                    </li>
                  </FadeInOnView>
                ))}
              </ul>
            </div>
          </Container>
        </section>
      ) : null}

      {/* ── 4e-bis. STACK ADAPTÉE — affiché UNIQUEMENT pour sites-web-ia (remplace Tarifs) ── */}
      {verticale === "sites-web-ia" ? (
        <section
          aria-label={isFr ? "Stack technique adaptée" : "Adapted tech stack"}
          className="bg-bg border-border border-t py-16 sm:py-20"
        >
          <Container>
            <div className="mx-auto max-w-5xl">
              <FadeInOnView>
                <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                  <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                  {isFr ? "Stack & approche sur mesure" : "Custom stack & approach"}
                </p>
                <h2
                  className="text-fg text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.1] font-semibold tracking-tight"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "La " : "The "}
                  <span className="italic-editorial text-terracotta">
                    {isFr ? "meilleure stack pour vos objectifs" : "best stack for your goals"}
                  </span>
                </h2>
                <p className="text-fg-soft mt-3 max-w-3xl text-base leading-relaxed">
                  {isFr
                    ? "Chaque projet web ou plateforme SaaS est devisé sur-mesure. Nous choisissons la stack technique la plus adaptée à vos objectifs business, votre périmètre fonctionnel, votre budget et vos contraintes IT. Pas de stack imposée, jamais : la stack choisie est toujours la meilleure possible pour VOTRE entreprise."
                    : "Every web or SaaS project is custom-quoted. We pick the tech stack best suited to your business goals, functional scope, budget and IT constraints. No stack ever imposed: the chosen stack is always the best possible for YOUR company."}
                </p>
              </FadeInOnView>
              <ul role="list" className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(
                  [
                    {
                      titleFr: "Frontend moderne",
                      titleEn: "Modern frontend",
                      descFr:
                        "Next.js, React, Vue, Svelte ou autre — selon vos équipes et besoins SEO/perf.",
                      descEn:
                        "Next.js, React, Vue, Svelte or other — based on your team and SEO/perf needs.",
                    },
                    {
                      titleFr: "Backend & API",
                      titleEn: "Backend & API",
                      descFr:
                        "Node.js, Python, Go, .NET, PHP — choix pragmatique selon écosystème existant.",
                      descEn:
                        "Node.js, Python, Go, .NET, PHP — pragmatic choice based on existing ecosystem.",
                    },
                    {
                      titleFr: "Couche IA",
                      titleEn: "AI layer",
                      descFr:
                        "OpenAI, Claude, Gemini, Mistral, modèles open-source self-hosted — selon RGPD et coûts.",
                      descEn:
                        "OpenAI, Claude, Gemini, Mistral, self-hosted open-source — based on GDPR and costs.",
                    },
                    {
                      titleFr: "Hébergement",
                      titleEn: "Hosting",
                      descFr:
                        "Vercel, AWS, GCP, OVH, Scaleway, self-hosted — UE pour RGPD critique.",
                      descEn:
                        "Vercel, AWS, GCP, OVH, Scaleway, self-hosted — EU for critical GDPR.",
                    },
                  ] as const
                ).map((s, idx) => (
                  <FadeInOnView key={s.titleFr} delay={idx * 60}>
                    <li className="bg-paper border-border-strong/30 flex h-full flex-col gap-2 rounded-2xl border p-5">
                      <h3
                        className="text-fg text-base leading-tight font-semibold tracking-tight"
                        style={{ fontFamily: "var(--font-serif)" }}
                      >
                        {isFr ? s.titleFr : s.titleEn}
                      </h3>
                      <p className="text-fg-soft text-xs leading-relaxed">
                        {isFr ? s.descFr : s.descEn}
                      </p>
                    </li>
                  </FadeInOnView>
                ))}
              </ul>
            </div>
          </Container>
        </section>
      ) : null}

      {/* ── 4f-bis. SÉCURITÉ & CONFORMITÉ — RGPD, AI Act, no vendor lock-in (Sprint Quality 2026 perfection) ── */}
      <section
        aria-label={isFr ? "Sécurité et conformité" : "Security and compliance"}
        className="bg-bg border-border border-t py-12 sm:py-16"
      >
        <Container>
          <div className="mx-auto max-w-5xl">
            <FadeInOnView>
              <p className="text-fg-muted mb-4 text-[13px] font-medium tracking-[0.16em] uppercase">
                <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                {isFr ? "Sécurité & conformité" : "Security & compliance"}
              </p>
              <h2
                className="text-fg text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.1] font-semibold tracking-tight"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr ? "Vos données " : "Your data "}
                <span className="italic-editorial text-terracotta">
                  {isFr ? "restent vos données" : "stays your data"}
                </span>
              </h2>
            </FadeInOnView>
            <ul role="list" className="mt-8 grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  {
                    icon: Shield,
                    titleFr: "RGPD Europe",
                    titleEn: "EU GDPR",
                    descFr:
                      "Hébergement UE, contrats DPA, registre Art. 30 disponible sur demande.",
                    descEn: "EU hosting, DPA contracts, Art. 30 registry available on request.",
                  },
                  {
                    icon: Shield,
                    titleFr: "AI Act 2024/1689",
                    titleEn: "AI Act 2024/1689",
                    descFr:
                      "Conformité au règlement européen sur l'IA. Audit trail des appels LLM (Art. 50).",
                    descEn: "EU AI Act compliance. LLM call audit trail (Art. 50).",
                  },
                  {
                    icon: Shield,
                    titleFr: "No vendor lock-in",
                    titleEn: "No vendor lock-in",
                    descFr:
                      "Vous restez propriétaire du code, des données, des modèles. Stack standard, transférable.",
                    descEn: "You own the code, data, models. Standard stack, transferable.",
                  },
                  {
                    icon: Shield,
                    titleFr: "ANSSI guidelines",
                    titleEn: "ANSSI guidelines",
                    descFr:
                      "Recommandations sécurité IA générative respectées. Volet sécurité dans chaque livrable.",
                    descEn:
                      "AI security recommendations followed. Security volume in every deliverable.",
                  },
                ] as const
              ).map((c, idx) => (
                <FadeInOnView key={c.titleFr} delay={idx * 60}>
                  <li className="bg-paper border-border flex h-full flex-col gap-3 rounded-2xl border p-5">
                    <span className="bg-terracotta-soft text-terracotta-deep flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                      <c.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="text-fg text-base leading-tight font-semibold tracking-tight">
                      {isFr ? c.titleFr : c.titleEn}
                    </h3>
                    <p className="text-fg-soft text-xs leading-relaxed">
                      {isFr ? c.descFr : c.descEn}
                    </p>
                  </li>
                </FadeInOnView>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {/* ── 4f. GARANTIES — engagement Axion-IA (Sprint Quality 2026 V2) ── */}
      {guaranteesText ? (
        <section
          aria-label={isFr ? "Nos garanties" : "Our guarantees"}
          className="bg-paper border-border border-t py-12 sm:py-16"
        >
          <Container>
            <div className="mx-auto max-w-3xl">
              <FadeInOnView>
                <div className="bg-terracotta-soft border-terracotta/30 flex items-start gap-4 rounded-2xl border p-6 sm:p-8">
                  <Shield
                    className="text-terracotta-deep mt-1 h-6 w-6 shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-terracotta-deep mb-2 text-[12px] font-bold tracking-[0.16em] uppercase">
                      {isFr ? "Nos engagements" : "Our commitments"}
                    </p>
                    <p className="text-fg text-base leading-relaxed">{guaranteesText}</p>
                  </div>
                </div>
              </FadeInOnView>
            </div>
          </Container>
        </section>
      ) : null}

      {/* ── 4b. NOS EXPERTS — équipe sénior par verticale (Sprint Quality 2026) ── */}
      <section
        aria-label={isFr ? "Nos experts" : "Our experts"}
        className="bg-bg border-border border-t py-16 sm:py-20"
      >
        <Container>
          <div className="mx-auto max-w-3xl">
            <FadeInOnView>
              <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                {isFr ? `Notre équipe · ${ville.nameFr}` : `Our team · ${ville.nameFr}`}
              </p>
              <h2
                className="text-fg text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.1] font-semibold tracking-tight"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr ? expertsIntro.titleFr : expertsIntro.titleEn}{" "}
                <span className="italic-editorial text-terracotta">
                  {isFr ? `à ${ville.nameFr}` : `in ${ville.nameFr}`}
                </span>
              </h2>
              <p className="text-fg-soft mt-6 text-lg leading-relaxed">
                {isFr ? expertsIntro.bodyFr : expertsIntro.bodyEn}
              </p>
              <div className="border-border-strong mt-8 grid grid-cols-3 divide-x border-t pt-8">
                <div className="px-3 first:pl-0">
                  <p
                    className="text-fg text-[clamp(1rem,2vw,1.5rem)] leading-tight font-semibold tracking-tight"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {isFr ? "Top 1 %" : "Top 1 %"}
                  </p>
                  <p className="text-fg-soft mt-1 text-xs leading-snug">
                    {isFr ? "experts IA B2B en France" : "AI B2B experts in France"}
                  </p>
                </div>
                <div className="px-3">
                  <p
                    className="text-fg text-[clamp(1rem,2vw,1.5rem)] leading-tight font-semibold tracking-tight"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {isFr ? "0 junior" : "0 junior"}
                  </p>
                  <p className="text-fg-soft mt-1 text-xs leading-snug">
                    {isFr ? "uniquement seniors expérimentés" : "experienced seniors only"}
                  </p>
                </div>
                <div className="px-3 last:pr-0">
                  <p
                    className="text-fg text-[clamp(1rem,2vw,1.5rem)] leading-tight font-semibold tracking-tight"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {isFr ? "Sur site" : "On-site"}
                  </p>
                  <p className="text-fg-soft mt-1 text-xs leading-snug">
                    {isFr ? "jamais en visio, chez vous" : "never video, at your premises"}
                  </p>
                </div>
              </div>
            </FadeInOnView>
          </div>
        </Container>
      </section>

      {/* ── 4c. SOURCES D'AUTORITÉ — external links E-E-A-T 2026 ── */}
      {externalLinks.length > 0 ? (
        <section
          aria-label={isFr ? "Sources d'autorité" : "Authority sources"}
          className="bg-paper border-border border-t py-12 sm:py-16"
        >
          <Container>
            <div className="mx-auto max-w-3xl">
              <p className="text-fg-muted mb-4 text-[13px] font-medium tracking-[0.16em] uppercase">
                <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                {isFr ? "Sources d'autorité" : "Authority sources"}
              </p>
              <h2
                className="text-fg text-[clamp(1.5rem,3vw,2rem)] leading-tight font-semibold tracking-tight"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr ? "Références institutionnelles" : "Institutional references"}
              </h2>
              <p className="text-fg-soft mt-3 text-base leading-relaxed">
                {isFr
                  ? "Notre méthodologie s'appuie sur les standards officiels et les recommandations institutionnelles françaises et européennes."
                  : "Our methodology relies on official standards and French/European institutional recommendations."}
              </p>
              <ul className="mt-6 space-y-2">
                {externalLinks.map((link) => (
                  <li key={link.url}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener nofollow"
                      className="bg-bg border-border hover:border-terracotta group flex items-center justify-between gap-3 rounded-xl border p-3 transition sm:p-4"
                    >
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-fg truncate text-sm font-semibold">{link.label}</span>
                        <span className="text-fg-muted truncate text-[11px]">{link.org}</span>
                      </span>
                      <ArrowUpRight
                        className="text-terracotta h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        aria-hidden="true"
                      />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </Container>
        </section>
      ) : null}

      {/* ── 5. FAQ géolocalisée extraite de l'Article — Speakable AI Overviews ── */}
      {faqItems.length > 0 ? (
        <FaqBlock
          eyebrow={isFr ? `FAQ · ${verticalLabel}` : `FAQ · ${verticalLabel}`}
          title={
            isFr
              ? `Questions fréquentes · ${verticalLabel} à ${ville.nameFr}`
              : `Frequently asked · ${verticalLabel} in ${ville.nameFr}`
          }
          description={
            isFr
              ? `Réponses adaptées aux entreprises de ${ville.nameFr} qui s'interrogent sur ${verticalLabel.toLowerCase()}.`
              : `Answers tailored to ${ville.nameFr} businesses considering ${verticalLabel.toLowerCase()}.`
          }
          items={faqItems}
          emitJsonLd={false}
          tone="sand"
        />
      ) : null}

      {/* ── 6. LIENS UTILES — internal linking vers hub + autres verticales ── */}
      <section className="bg-bg border-border border-t py-12 sm:py-16">
        <Container>
          <div className="mx-auto max-w-4xl">
            <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
              <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
              {isFr ? "Explorer aussi" : "Also explore"}
            </p>
            <h2
              className="text-fg text-[clamp(1.5rem,3vw,2rem)] leading-tight font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr
                ? `Nos autres services à ${ville.nameFr}`
                : `Our other services in ${ville.nameFr}`}
            </h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {/* Lien vers la page produit principale (SSOT du service) — label adapté au type */}
              <li>
                <a
                  href={ctaHref}
                  className="bg-terracotta-soft border-terracotta/40 hover:border-terracotta group flex items-center justify-between rounded-2xl border-2 p-4 transition hover:shadow-sm"
                >
                  <span className="text-terracotta-deep text-sm font-semibold">
                    {isFr ? SEE_MAIN_PAGE_LABEL_FR[verticale] : SEE_MAIN_PAGE_LABEL_EN[verticale]}
                  </span>
                  <ArrowRight
                    className="text-terracotta-deep h-4 w-4 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </a>
              </li>
              <li>
                <Link
                  href={`/implantations/${region.slug}/${ville.slug}` as never}
                  className="bg-paper border-border hover:border-terracotta group flex items-center justify-between rounded-2xl border p-4 transition hover:shadow-sm"
                >
                  <span className="text-fg text-sm font-semibold">
                    {isFr ? `Tous services à ${ville.nameFr}` : `All services in ${ville.nameFr}`}
                  </span>
                  <ArrowRight
                    className="text-terracotta h-4 w-4 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </Link>
              </li>
              {OTHER_VERTICALES.map((v) => (
                <li key={v.slug}>
                  <Link
                    href={`/implantations/${region.slug}/${ville.slug}/${v.slug}` as never}
                    className="bg-paper border-border hover:border-terracotta group flex items-center justify-between rounded-2xl border p-4 transition hover:shadow-sm"
                  >
                    <span className="text-fg text-sm font-semibold">
                      {isFr ? `${v.labelFr} à ${ville.nameFr}` : `${v.labelFr} in ${ville.nameFr}`}
                    </span>
                    <ArrowRight
                      className="text-terracotta h-4 w-4 transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {/* ── 7. CTA FINAL — réserver appel + nous contacter ── */}
      <CtaBlock
        eyebrow={isFr ? `Démarrer · ${verticalLabel}` : `Get started · ${verticalLabel}`}
        title={isFr ? `Prêt à démarrer à ${ville.nameFr} ?` : `Ready to start in ${ville.nameFr}?`}
        titleEm={
          isFr
            ? "Réservez un appel téléphonique ou par formulaire"
            : "Book a phone call or contact us by form"
        }
        cta={
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Cta
              href="/appel"
              variant="terracotta"
              size="lg"
              shape="pill"
              track="ville_vertical_cta_book_final"
            >
              {isFr ? "Réserver un appel" : "Book a call"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Cta>
            <Cta
              href="/contact"
              variant="outline"
              size="lg"
              shape="pill"
              track="ville_vertical_cta_contact_final"
            >
              {isFr ? "Nous contacter" : "Contact us"}
            </Cta>
          </div>
        }
      />

      <AiContentDisclaimer locale={loc} />

      <JsonLdGraph
        schemas={[serviceJsonLd, breadcrumbJsonLd, webPageJsonLd, faqSpeakableJsonLd ?? null]}
        strategy="afterInteractive"
        scriptId={`jsonld-ville-vertical-${ville.slug}-${verticale}`}
      />
    </>
  );
}
