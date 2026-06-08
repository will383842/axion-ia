// Page recrutement commerciaux × ville (HUB). Modèle hub-and-spoke (Will
// 2026-06-08) : ~40 pages gold (villes T1+T2, pop ≥ 100k). Les villes T3/T4
// sont des SATELLITES → 301 vers leur hub le plus proche (zéro 404) ET affichées
// sur la page du hub (« et alentours ») + portées par le JobPosting multi-lieux
// (Google for Jobs couvre les villes voisines).
//
// Contenu VARIABLE (territoire, secteurs, grands comptes, satellites, FAQ locale)
// = données INSEE/economic-data RÉELLES → page unique (anti-doorway). Gate
// d'indexation indépendant : indexable seulement si données locales riches.

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { JsonLd } from "@/components/marketing/JsonLd";
import {
  CommercialPageBody,
  buildCommercialFaqItems,
  type CommercialVilleContext,
} from "@/components/services/devenir-commercial/CommercialPageBody";
import { getVille } from "@/content/villes";
import { getRegion } from "@/content/regions";
import { buildCommercialKeywords } from "@/content/recrutement/commercial-offer";
import {
  getHubSlugs,
  getDisplayedSatellites,
  getSiblingHubs,
} from "@/content/recrutement/satellites";
import { CommercialOtherHubs } from "@/components/services/devenir-commercial/CommercialOtherHubs";
import { buildProductMetadata, buildFaqJsonLd, SITE_URL, BUILD_DATE } from "@/lib/seo";

export const revalidate = 86400;
// Seuls les 40 hubs rendent. Les villes satellites sont 301-redirigées vers leur
// hub par le middleware (proxy.ts) AVANT d'atteindre la page → dynamicParams=false
// (tout autre slug = 404).
export const dynamicParams = false;

export function generateStaticParams(): Array<{ ville: string }> {
  return getHubSlugs().map((ville) => ({ ville }));
}

/** Construit le contexte local d'un HUB. Les communes voisines = satellites calculés. */
function buildVilleContext(slug: string): {
  ctx: CommercialVilleContext;
  indexable: boolean;
} | null {
  const ville = getVille(slug);
  if (!ville) return null;
  const eco = ville.economicData;
  const satellites = getDisplayedSatellites(slug);
  const ctx: CommercialVilleContext = {
    name: ville.nameFr,
    departementLabel: ville.departementLabel,
    region: getRegion(ville.region)?.nameFr,
    etablissementsActifs: eco?.statsInsee?.etablissementsActifs,
    creationsEntreprises: eco?.statsInsee?.creationsEntreprises,
    anneeReference: eco?.statsInsee?.anneeReference,
    topSectors: (eco?.topSectorsNaf ?? []).map((s) => ({
      label: s.label,
      count: s.etablissementsCount,
    })),
    grandsGroupes: (eco?.grandsGroupesImplantes ?? []).map((g) => ({
      nom: g.nom,
      secteur: g.secteur,
    })),
    // Communes voisines = satellites calculés (couvre les 40 hubs uniformément).
    communesBassin: satellites.map((s) => ({ nameFr: s.nameFr, distanceKm: s.distanceKm })),
    specificite: eco?.specificitesLocales?.[0]?.description,
  };
  // Indexable = secteurs locaux réels présents (anti-doorway). Le compteur
  // d'établissements (V3) est un bonus visuel, pas un prérequis : les fichiers
  // V2 (bordeaux, nantes…) ont les secteurs sans le compteur → restent gold.
  const indexable = ctx.topSectors.length > 0;
  return { ctx, indexable };
}

interface Props {
  params: Promise<{ locale: string; ville: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, ville } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const built = buildVilleContext(ville);
  if (!built) return {};
  const isFr = locale === "fr";
  const { ctx, indexable } = built;
  const place = ctx.departementLabel ? `${ctx.name} (${ctx.departementLabel})` : ctx.name;
  const title = isFr
    ? `Devenir commercial IA à ${ctx.name} et alentours · revenus déplafonnés · Axion-IA`
    : `Become an AI sales rep in ${ctx.name} & nearby · uncapped income · Axion-IA`;
  // Keywords enrichis des villes satellites (longue traîne T3/T4).
  const satKeywords = getDisplayedSatellites(ville)
    .slice(0, 8)
    .flatMap((s) => [`emploi commercial ${s.nameFr}`, `commercial IA ${s.nameFr}`]);
  const base: Metadata = {
    ...buildProductMetadata({
      locale,
      path: `/devenir-commercial-ia/${ville}`,
      title,
      description: isFr
        ? `Emploi commercial dans l'IA à ${place} et ses alentours : devenez commercial indépendant (agent commercial, VRP, apporteur d'affaires) et vendez formations, audits et intégrations IA aux TPE, PME, ETI, artisans, commerçants et grandes entreprises locales. Revenus déplafonnés, emploi du temps libre — démarrer ne coûte rien.`
        : `Sales job in AI in ${place} and surroundings: become an independent sales rep selling AI trainings, audits and integrations to local companies of all sizes. Uncapped income — getting started costs nothing.`,
    }),
    title: { absolute: title },
    keywords: [
      ...buildCommercialKeywords(ctx.name, ctx.departementLabel, ctx.region),
      ...satKeywords,
    ],
  };
  return indexable ? base : { ...base, robots: { index: false, follow: true } };
}

export default async function DevenirCommercialVillePage({ params }: Props) {
  const { locale, ville } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const built = buildVilleContext(ville);
  if (!built) notFound();
  const { ctx } = built;
  const satellites = getDisplayedSatellites(ville);
  const siblingHubs = getSiblingHubs(ville);

  const faqItems = buildCommercialFaqItems(ctx);
  const faqJsonLd = buildFaqJsonLd({
    items: faqItems.map((it) => ({
      question: isFr ? it.q.fr : it.q.en,
      answer: isFr ? it.a.fr : it.a.en,
    })),
  });

  // JobPosting MULTI-LIEUX (hub + satellites) → Google for Jobs couvre aussi les
  // villes voisines T3/T4 sans page dédiée.
  const placeOf = (locality: string) => ({
    "@type": "Place",
    address: {
      "@type": "PostalAddress",
      addressLocality: locality,
      ...(ctx.region ? { addressRegion: ctx.region } : {}),
      addressCountry: "FR",
    },
  });
  const jobJsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: isFr
      ? `Commercial IA indépendant à ${ctx.name} et alentours`
      : `Independent AI sales representative in ${ctx.name} & nearby`,
    description: isFr
      ? `Axion-IA recrute un commercial indépendant à ${ctx.name}, son agglomération et toute sa région pour vendre ses formations, audits, accompagnements 1-to-1 et intégrations IA aux entreprises locales. Statut indépendant accompagné par notre équipe, produits souvent finançables, commissions déplafonnées.`
      : `Axion-IA is hiring an independent sales rep in ${ctx.name}, its metro area and region to sell its AI trainings, audits, 1-on-1 support and integrations to local companies. Self-employed and supported by our team, often-fundable products, uncapped commissions.`,
    datePosted: BUILD_DATE,
    employmentType: "CONTRACTOR",
    occupationalCategory: isFr
      ? "Commercial · Agent commercial · VRP · Apporteur d'affaires"
      : "Sales representative · Independent agent",
    industry: isFr
      ? "Intelligence artificielle · Formation · Services aux entreprises"
      : "Artificial intelligence · Training · Business services",
    skills: isFr
      ? "Prospection commerciale, vente B2B, relation client, sens du contact"
      : "Sales prospecting, B2B selling, client relationship, communication",
    qualifications: isFr
      ? "Fibre commerciale et motivation. Débutants acceptés : nous formons à l'offre IA."
      : "Sales instinct and motivation. Beginners welcome: we train you on the AI offer.",
    responsibilities: isFr
      ? "Démarcher les entreprises locales, présenter l'offre IA, suivre les comptes sur un dashboard, conclure des ventes."
      : "Prospect local companies, present the AI offer, track accounts on a dashboard, close sales.",
    jobBenefits: isFr
      ? "Statut indépendant accompagné, revenus déplafonnés, emploi du temps libre, démarrage sans coût, portefeuille conservé, formation et supports fournis."
      : "Supported self-employed status, uncapped income, flexible schedule, no-cost start, keep your portfolio, training and materials provided.",
    incentiveCompensation: isFr
      ? "Rémunération 100 % à la commission : montant fixe par formation vendue, pourcentage de la facture sur les audits et intégrations. Revenus non plafonnés."
      : "100% commission-based pay: flat amount per training sold, percentage of the invoice on audits and integrations. Uncapped income.",
    hiringOrganization: { "@type": "Organization", name: "Axion-IA", sameAs: SITE_URL },
    jobLocation: [placeOf(ctx.name), ...satellites.slice(0, 10).map((s) => placeOf(s.nameFr))],
    applicantLocationRequirements: { "@type": "Country", name: "France" },
    directApply: true,
    url: `${SITE_URL}/${loc}/devenir-commercial-ia/candidature`,
  } as const;

  const webpageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${SITE_URL}/${loc}/devenir-commercial-ia/${ville}#webpage`,
    url: `${SITE_URL}/${loc}/devenir-commercial-ia/${ville}`,
    name: isFr
      ? `Devenir commercial IA à ${ctx.name} et alentours · Axion-IA`
      : `Become an AI sales rep in ${ctx.name} & nearby · Axion-IA`,
    inLanguage: loc,
    speakable: { "@type": "SpeakableSpecification", cssSelector: ["h1", "[data-speakable]"] },
  } as const;

  const breadcrumbItems = [
    { href: "/devenir-commercial-ia", label: isFr ? "Devenir commercial" : "Become a rep" },
    { href: `/devenir-commercial-ia/${ville}`, label: ctx.name },
  ];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      <CommercialPageBody isFr={isFr} ville={ctx} />

      <CommercialOtherHubs isFr={isFr} hubs={siblingHubs} />

      <JsonLd data={jobJsonLd} />
      <JsonLd
        data={webpageJsonLd}
        strategy="afterInteractive"
        scriptId="jsonld-commercial-webpage-ville"
      />
      <JsonLd data={faqJsonLd} strategy="afterInteractive" scriptId="jsonld-commercial-faq-ville" />
    </>
  );
}
