// Server Component — template partagé pour les 3 pages ville × service
// (Sprint 14.10.1, Commit B). Réutilise VilleServiceDetailSection en mode
// pleine page, ajoute hero spécifique service, breadcrumb 4 niveaux,
// stack JSON-LD complet, FAQ Speakable, maillage interne.
//
// Décision Will 2026-05-08 : « toutes les villes indexables ».
//   - Si copy.services.<service> présent : tier-1 indexable + sitemap inclus.
//   - Sinon : stub minimal noindex follow (anti-doorway HCU 2024).

import type { Metadata } from "next";
import {
  ArrowUpRight,
  Briefcase,
  Building2,
  MapPin,
  MonitorSmartphone,
  Users,
  Wrench,
} from "lucide-react";
import { notFound, permanentRedirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { type Locale, routing } from "@/i18n/routing";
import { fmtPopulation } from "@/lib/intl";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { AiContentDisclaimer } from "@/components/marketing/AiContentDisclaimer";
import { JsonLdGraph } from "@/components/marketing/JsonLdGraph";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Link } from "@/i18n/navigation";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { FaqBlock } from "@/components/sections/FaqBlock";
import { VilleServiceDetailSection } from "@/components/sections/VilleServiceDetailSection";

import { getRegion } from "@/content/regions";
import { VILLES, getIndexableVilles, getVille, isVilleIndexable } from "@/content/villes";
import { getNearbyVilles, haversineKm } from "@/lib/geo";
import { getBlogArticlesByVille } from "@/server/content-gen/blog/get-articles-by-ville";
import {
  AUDIT_TIERS,
  INTERVENTION_TIERS,
  IMPLEMENTATION_TIERS,
  UN_A_UN_TIERS,
  CODAGE_TIERS,
  formatAmount,
  formatPrice,
  getEntryPriceEur,
  getEntryTier,
  getFormationCatalogPriceRange,
} from "@/content/pricing";
import { buildProductMetadata } from "@/lib/seo";
import { buildVilleServiceJsonLdGraph } from "@/lib/seo/ville-service-jsonld";

// Sprint S+2 City Domination — 4e verticale `un-a-un` (décision Will Option A
// 2026-05-18). Naming brand "un-a-un" en URL canonique ; sémantique = coaching
// dirigeant 1-to-1, tarif d'entrée 990 € HT (tier intervention-dirigeants
// réutilisé via UN_A_UN_TIERS).
type ServiceKey = "audit" | "interventions" | "implementation" | "un-a-un" | "sites-web-augmentes";

// Tarifs centralisés dans `src/content/pricing.ts` (source de vérité unique).
// `priceEur` n'est pas hardcodé ici — il est dérivé du tier d'entrée via
// `getEntryPriceEur(<TIERS>)` quand on a besoin du chiffre brut (Service
// JSON-LD), et `formatPrice(getEntryTier(<TIERS>))` pour l'affichage CTA.
const SERVICE_META = {
  audit: {
    canonical: "/audit",
    pathFr: "/audit/par-ville",
    pathEn: "/audit/by-city",
    nameFr: "Audit IA",
    nameEn: "AI audit",
    eyebrowFr: "Audit IA opérationnel",
    eyebrowEn: "Operational AI audit",
    icon: Briefcase,
    accent: "primary" as const,
    tiers: AUDIT_TIERS,
  },
  // Refonte 2026-06-11 — la verticale « interventions » (offre collective) est
  // devenue « Formation IA en entreprise » à l'URL /formations. La CLÉ interne
  // reste "interventions" (copy ville `copy.services.interventions`, tiers, gate,
  // drip réutilisés) ; seuls les URL/naming publics passent à /formations.
  interventions: {
    canonical: "/formations",
    pathFr: "/formations/par-ville",
    pathEn: "/formations/by-city",
    nameFr: "Formation IA en entreprise",
    nameEn: "Corporate AI training",
    eyebrowFr: "Formation IA en entreprise (intra)",
    eyebrowEn: "Corporate AI training (in-house)",
    icon: Building2,
    accent: "terracotta" as const,
    tiers: INTERVENTION_TIERS,
  },
  implementation: {
    canonical: "/implementation",
    pathFr: "/implementation/par-ville",
    pathEn: "/implementation/by-city",
    nameFr: "Implémentation IA opérationnelle",
    nameEn: "Operational AI implementation",
    eyebrowFr: "Implémentation IA opérationnelle",
    eyebrowEn: "Operational AI implementation",
    icon: Wrench,
    accent: "sage" as const,
    tiers: IMPLEMENTATION_TIERS,
  },
  // Sprint S+2 City Domination — 4e verticale.
  // Naming canonique "un-a-un" décision Will Option A 2026-05-18.
  // Sémantique brand : "Accompagnement IA 1-to-1 dirigeant". Le mot "formation"
  // est autorisé en copy descriptif (P1-2 lever ban), mais le nom canonique
  // reste "intervention/accompagnement". Cohérent avec UN_A_UN_TIERS
  // (tier intervention-dirigeants 990 € HT réutilisé).
  "un-a-un": {
    canonical: "/un-a-un",
    pathFr: "/un-a-un/par-ville",
    pathEn: "/one-to-one/by-city",
    nameFr: "Accompagnement IA 1-to-1 dirigeant",
    nameEn: "1-to-1 AI coaching for executives",
    eyebrowFr: "Accompagnement IA 1-to-1 (dirigeant)",
    eyebrowEn: "1-to-1 AI coaching (executive)",
    icon: Users,
    accent: "mocha" as const,
    tiers: UN_A_UN_TIERS,
  },
  // 2026-06-04 (Will) — 5e verticale City Domination : sites web & plateformes
  // SaaS augmentés par l'IA. Tarif d'entrée dérivé de CODAGE_TIERS. Sémantique
  // = création / refonte / augmentation IA de sites web, applications, SaaS,
  // e-commerce, mobile — visibilité locale « agence web IA à <ville> ».
  "sites-web-augmentes": {
    canonical: "/sites-web-augmentes",
    pathFr: "/sites-web-augmentes/par-ville",
    pathEn: "/ai-augmented-websites/by-city",
    nameFr: "Création de site web & SaaS augmentés par l'IA",
    nameEn: "AI-augmented website & SaaS creation",
    eyebrowFr: "Agence web & IA",
    eyebrowEn: "Web & AI agency",
    icon: MonitorSmartphone,
    accent: "terracotta" as const,
    tiers: CODAGE_TIERS,
  },
} as const;

/**
 * Sprint S+2 — mapping ServiceKey → propriété de `ville.copy?.services`.
 * Nécessaire car ServiceKey contient "un-a-un" (tiret) qui ne peut pas
 * matcher directement la propriété TS `unAUn` (camelCase). Pour les 3
 * verticales historiques, la clé est identique.
 */
function getVilleServiceCopy(
  ville: {
    copy?: {
      services?: {
        audit?: unknown;
        interventions?: unknown;
        implementation?: unknown;
        unAUn?: unknown;
        sitesWeb?: unknown;
      };
    };
  },
  service: ServiceKey,
) {
  if (service === "un-a-un") return ville.copy?.services?.unAUn;
  if (service === "sites-web-augmentes") return ville.copy?.services?.sitesWeb;
  return ville.copy?.services?.[service as "audit" | "interventions" | "implementation"];
}

/**
 * Hub-and-spoke satellite (2026-06-04, décision Will) — pour une ville SANS copy
 * substantielle sur ce service (satellite T3/T4), renvoie le slug de la ville-hub
 * la plus proche AYANT la copy gold-standard. Sert à poser un canonical
 * satellite → hub (concentre le SEO sur les ~40 métropoles, anti-doorway HCU).
 * `undefined` si aucun hub n'a encore de copy → on garde le self-canonical noindex.
 */
function nearestHubSlugWithCopy(
  origin: { geo: { lat: number; lon: number }; slug: string },
  service: ServiceKey,
): string | undefined {
  let bestSlug: string | undefined;
  let bestKm = Infinity;
  for (const v of VILLES) {
    if (v.slug === origin.slug) continue;
    if (!getVilleServiceCopy(v, service)) continue;
    const km = haversineKm(origin.geo, v.geo);
    if (km < bestKm) {
      bestKm = km;
      bestSlug = v.slug;
    }
  }
  return bestSlug;
}

interface PageProps {
  params: Promise<{ locale: string; ville: string }>;
}

/**
 * `generateStaticParams` partagé par les 4 services par-ville.
 *
 * 2026-05-27 (sprint audit Will villes T4) — depuis que les 2157 villes ont
 * toutes un `copy` éditorial (sprint VilleCopy T4 100%), `getIndexableVilles()`
 * retourne 2157 villes → 4 services × 2157 = 8628 routes SSG, ce qui sature
 * le disk GH Actions runner (« No space left on device » sur 3 derniers
 * deploys consécutifs). On limite désormais le SSG aux villes pop ≥ 20 000
 * (T1+T2 ~430 villes → 1720 routes), les T3+T4 sont rendues en ISR on-demand
 * (`dynamicParams=true` + `revalidate=86400`). Trade-off : 1er hit T3/T4 =
 * ~500ms latence, mais build passe ; sitemap continue à inclure toutes les
 * villes indexables, donc Google les crawle = ISR génère = cachée.
 */
export function buildStaticParams(): Array<{ ville: string }> {
  const indexableOnly = process.env.BUILD_SSG_VILLES_INDEXABLE_ONLY === "true";
  if (indexableOnly) {
    return getIndexableVilles()
      .filter((v) => v.population >= 20_000)
      .map((v) => ({ ville: v.slug }));
  }
  return VILLES.map((v) => ({ ville: v.slug }));
}

export async function buildPageMetadata(
  service: ServiceKey,
  { params }: PageProps,
): Promise<Metadata> {
  const { locale, ville: villeSlug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const ville = getVille(villeSlug);
  if (!ville) return {};
  const meta = SERVICE_META[service];
  const isFr = locale === "fr";
  const hasCopy = !!getVilleServiceCopy(ville, service);

  const title = hasCopy
    ? isFr
      ? `${meta.nameFr} à ${ville.nameFr} (${ville.departementLabel ?? ville.departement})`
      : `${meta.nameEn} in ${ville.nameFr} (${ville.departementLabel ?? ville.departement})`
    : isFr
      ? `${meta.nameFr} à ${ville.nameFr} — disponible sur devis`
      : `${meta.nameEn} in ${ville.nameFr} — available on quote`;

  const serviceCopy = getVilleServiceCopy(ville, service) as
    | { fr: { hero: string }; en: { hero: string } }
    | undefined;
  const description = serviceCopy
    ? isFr
      ? serviceCopy.fr.hero.slice(0, 157) + (serviceCopy.fr.hero.length > 157 ? "…" : "")
      : serviceCopy.en.hero.slice(0, 157) + (serviceCopy.en.hero.length > 157 ? "…" : "")
    : isFr
      ? `Axion-IA délivre ${meta.nameFr.toLowerCase()} à ${ville.nameFr} sur site. Tarifs publics affichés, calendrier en temps réel, vous gardez la main sur vos données.`
      : `Axion-IA delivers ${meta.nameEn.toLowerCase()} in ${ville.nameFr} on site. Public pricing displayed, real-time calendar, you keep control of your data.`;

  const result = buildProductMetadata({
    locale,
    path: `${meta.pathFr}/${ville.slug}`,
    title,
    description,
    alternates: {
      fr: `${meta.pathFr}/${ville.slug}`,
      en: `${meta.pathEn}/${ville.slug}`,
    },
  });

  // Anti-doorway HCU 2024 : noindex tant qu'aucun copy substantiel + canonical
  // satellite → ville-hub la plus proche ayant la copy (concentre le SEO, modèle
  // hub-and-spoke décision Will 2026-06-04). Fallback : self-canonical si aucun hub.
  if (!hasCopy) {
    const hubSlug = nearestHubSlugWithCopy(ville, service);
    const canonical = hubSlug
      ? `/${locale}${isFr ? meta.pathFr : meta.pathEn}/${hubSlug}`
      : undefined;
    return {
      ...result,
      ...(canonical ? { alternates: { ...result.alternates, canonical } } : {}),
      robots: { index: false, follow: true },
    };
  }
  return {
    ...result,
    other: {
      abstract: isFr
        ? (serviceCopy?.fr.hero.slice(0, 155) ?? description)
        : (serviceCopy?.en.hero.slice(0, 155) ?? description),
    },
    // VIS-07 (audit visibilité 2026-06-05) — applique le drip d'indexation aussi
    // aux pages service×ville. Avant : gate seulement sur hasCopy → une ville
    // avec copy mais hors cohorte du jour émettait robots:index TOUT en étant
    // absente du sitemap (qui, lui, gate sur isVilleIndexable) → incohérence,
    // Google pouvait l'indexer via le maillage. Aligne page ↔ sitemap ↔ hub.
    ...(isVilleIndexable(ville.slug) ? {} : { robots: { index: false, follow: true } }),
  };
}

interface RenderProps {
  service: ServiceKey;
  locale: string;
  villeSlug: string;
}

export async function renderVilleServicePage({
  service,
  locale,
  villeSlug,
}: RenderProps): Promise<React.ReactNode> {
  if (!hasLocale(routing.locales, locale)) notFound();
  const ville = getVille(villeSlug);
  if (!ville) notFound();
  const region = getRegion(ville.region);
  if (!region) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const meta = SERVICE_META[service];
  const hasCopy = !!getVilleServiceCopy(ville, service);
  // Refonte Formations V2 — le service "interventions" (= Formation IA en entreprise)
  // dérive son prix d'entrée de la matrice formation (FORMATION_PRICE_MATRIX), PAS
  // d'INTERVENTION_TIERS (legacy). Les 3 autres verticales gardent leurs tiers.
  const isFormationService = service === "interventions";
  const formationEntryEur = getFormationCatalogPriceRange().minEur;
  const entryPriceEur = isFormationService ? formationEntryEur : getEntryPriceEur(meta.tiers);
  const formattedEntryPrice = isFormationService
    ? formatAmount(formationEntryEur, isFr ? "fr" : "en", { compact: true })
    : formatPrice(getEntryTier(meta.tiers), isFr ? "fr" : "en");
  // sites-web = prestation sur devis/projet (pas de réservation agenda ni
  // d'acompte) → CTA alignés sur le header : « Réserver un appel » (/appel) +
  // « Nous écrire » (/contact). Les autres verticales gardent le flux calendrier.
  const isSitesWeb = service === "sites-web-augmentes";

  const breadcrumbItems = [
    {
      href: meta.canonical,
      label: isFr ? meta.nameFr : meta.nameEn,
    },
    {
      href: `${meta.pathFr}/${ville.slug}` as never,
      label: isFr ? `${meta.nameFr} à ${ville.nameFr}` : `${meta.nameEn} in ${ville.nameFr}`,
    },
  ];

  // ---- VILLE-SATELLITE (sans copy) → redirection vers le hub ----
  // Modèle hub-and-spoke (Will 2026-06-04) : pas de page maigre « faible valeur ».
  // La commune satellite (T3/T4) redirige en permanent (308) vers sa ville-hub
  // T1/T2 la plus proche AYANT la copy → le visiteur atterrit sur du contenu
  // riche, SEO consolidé sur le hub. La couverture des communes reste montrée
  // sur le hub (section « On intervient aussi autour de … »). Fallback : stub
  // minimal noindex si aucun hub n'a encore de copy sur ce service.
  if (!hasCopy) {
    const hubSlug = nearestHubSlugWithCopy(ville, service);
    // Redirection satellite→hub LIMITÉE à sites-web (5e verticale, neuve). Les 4
    // verticales historiques (audit/interventions/implementation/un-a-un) gardent
    // leur stub noindex actuel — elles sont sous la décision drip gelée [[faq-villes-doorway]],
    // on ne change pas leur comportement sans décision dédiée. Zéro régression.
    if (hubSlug && service === "sites-web-augmentes") {
      permanentRedirect(`/${loc}${isFr ? meta.pathFr : meta.pathEn}/${hubSlug}`);
    }
    const hub = hubSlug ? getVille(hubSlug) : undefined;
    const hubHref = hub
      ? (`${isFr ? meta.pathFr : meta.pathEn}/${hub.slug}` as never)
      : meta.canonical;
    return (
      <>
        <Container className="border-border border-b py-3">
          <Breadcrumbs items={breadcrumbItems} />
        </Container>
        <Section
          titleAs="h1"
          eyebrow={isFr ? meta.eyebrowFr : meta.eyebrowEn}
          title={isFr ? `${meta.nameFr} à` : `${meta.nameEn} in`}
          titleEm={ville.nameFr}
          description={
            hub
              ? isFr
                ? `Axion-IA délivre ${meta.nameFr.toLowerCase()} à ${ville.nameFr} (${ville.departementLabel ?? ville.departement}, ${region.nameFr}) et dans tout le secteur. La page de référence la plus proche est ${hub.nameFr} : vous y trouverez le détail complet de la prestation, applicable à l'identique pour ${ville.nameFr}.`
                : `Axion-IA delivers ${meta.nameEn.toLowerCase()} in ${ville.nameFr} (${ville.departementLabel ?? ville.departement}, ${region.nameFr}) and across the area. The nearest reference page is ${hub.nameFr}: it details the full offer, applicable identically to ${ville.nameFr}.`
              : isFr
                ? `Axion-IA délivre ${meta.nameFr.toLowerCase()} dans toute la France métropolitaine, y compris à ${ville.nameFr} (${ville.departementLabel ?? ville.departement}, ${region.nameFr}). Réservation directe via la page régionale ou contact.`
                : `Axion-IA delivers ${meta.nameEn.toLowerCase()} across metropolitan France, including ${ville.nameFr} (${ville.departementLabel ?? ville.departement}, ${region.nameFr}). Direct booking via the regional page or contact.`
          }
        >
          <div className="flex flex-wrap items-center gap-3">
            <Cta href={hubHref} variant="primary" size="lg" shape="pill">
              {hub
                ? isFr
                  ? `Voir ${meta.nameFr} à ${hub.nameFr}`
                  : `See ${meta.nameEn} in ${hub.nameFr}`
                : isFr
                  ? `Voir ${meta.nameFr}`
                  : `See ${meta.nameEn}`}
              <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta
              href={`/implantations/${region.slug}/${ville.slug}` as never}
              variant="ghost"
              size="lg"
              shape="pill"
            >
              {isFr ? `Voir ${ville.nameFr} (page locale)` : `See ${ville.nameFr} (local page)`}
            </Cta>
          </div>
        </Section>
      </>
    );
  }

  // ---- RENDU GOLD STANDARD pour villes avec copy substantiel ----
  // Type cast via VilleServicesLong["audit"] (signature identique pour les
  // 4 verticales : { fr: VilleServiceCopyLocale; en: VilleServiceCopyLocale })
  const serviceCopy = getVilleServiceCopy(ville, service) as
    | NonNullable<NonNullable<typeof ville.copy>["services"]>["audit"]
    | undefined;
  if (!serviceCopy) notFound();
  const localeCopy = serviceCopy[loc];
  const nearbyVilles = getNearbyVilles(ville.geo, 6, {
    excludeSlug: ville.slug,
    sameRegion: ville.region,
  });

  // V-01 P0d (Sprint Correctif 2026-05-22) — articles factory mentionnant la
  // ville (Article DB + champ `mentionedCities[]`). Fail-soft : tableau vide
  // si DB down / table absente bootstrap (cf. fonction helper).
  const cityArticles = await getBlogArticlesByVille(ville.slug, loc, 3);

  // === JSON-LD stack — Phase C 2026-05-20 (centralisé via buildVilleServiceJsonLdGraph) ===
  // Les 5 variables individuelles ont été remplacées par le graph builder centralisé
  // (`src/lib/seo/ville-service-jsonld.ts`) qui émet 7 schémas :
  //   1. Service  2. LocalBusiness/ProfessionalService  3. BreadcrumbList
  //   4. FAQPage + Speakable  5. HowTo  6. Person (Manon E-E-A-T)  7. ItemList villes proches
  const jsonLdSchemas = buildVilleServiceJsonLdGraph({
    locale: loc,
    isFr,
    service,
    serviceNameFr: meta.nameFr,
    serviceNameEn: meta.nameEn,
    serviceCanonical: meta.canonical,
    servicePathFr: meta.pathFr,
    ville: {
      nameFr: ville.nameFr,
      slug: ville.slug,
      ...(ville.postalCode ? { postalCode: ville.postalCode } : {}),
      geo: { lat: ville.geo.lat, lon: ville.geo.lon },
      region: ville.region,
    },
    region: { nameFr: region.nameFr, slug: region.slug },
    hero: localeCopy.hero,
    ...(ville.copy?.directAnswerFr ? { directAnswer: ville.copy.directAnswerFr } : {}),
    faqItems: localeCopy.faq.map((f) => ({ question: f.q, answer: f.a })),
    methodologySteps: localeCopy.methodology,
    nearbyVilles,
    ...(typeof entryPriceEur === "number" ? { priceEur: entryPriceEur } : {}),
    priceRange: typeof entryPriceEur === "number" && entryPriceEur >= 1000 ? "€€€" : "€€",
  });

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} emitJsonLd={false} />
      </Container>

      {/* Hero compact spécifique ville × service. Le direct-answer AEO et le
          contexte local sont repositionnés plus bas (section « À propos »
          avant les villes proches) — décision Will 2026-06-04 : trop haut =
          mur de texte avant le H1, pas pro. */}
      <Section
        titleAs="h1"
        eyebrow={
          isFr ? `${meta.eyebrowFr} · ${region.nameFr}` : `${meta.eyebrowEn} · ${region.nameFr}`
        }
        title={isFr ? `${meta.nameFr} à` : `${meta.nameEn} in`}
        titleEm={`${ville.nameFr}${ville.departementLabel ? ` (${ville.departementLabel})` : ""}`}
        description={localeCopy.hero}
      >
        <div className="text-fg-muted mb-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-2">
            <Users className="h-4 w-4" aria-hidden="true" />
            {fmtPopulation(ville.population, isFr ? "fr" : "en")}{" "}
            {isFr ? "habitants" : "inhabitants"}
          </span>
          <span className="inline-flex items-center gap-2">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            {region.nameFr}
          </span>
          {ville.postalCode ? (
            <span className="inline-flex items-center gap-2 tabular-nums">{ville.postalCode}</span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Cta
            href={
              isSitesWeb ? "/appel" : (`/reserver?ville=${ville.slug}&service=${service}` as never)
            }
            variant={meta.accent === "terracotta" ? "terracotta" : "primary"}
            size="lg"
            shape="pill"
            track={`ville_service_${service}_book`}
            data-source-ville={ville.slug}
            data-source-region={ville.region}
          >
            {isSitesWeb
              ? isFr
                ? "Réserver un appel"
                : "Book a call"
              : isFr
                ? `Réserver · ${formattedEntryPrice}`
                : `Book · ${formattedEntryPrice}`}
            <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
          </Cta>
          <Cta
            href={meta.canonical}
            variant="ghost"
            size="lg"
            shape="pill"
            track={`ville_service_${service}_canonical`}
          >
            {isFr ? `Voir tout sur ${meta.nameFr}` : `See all on ${meta.nameEn}`}
          </Cta>
        </div>
      </Section>

      {/* Section détaillée du service à la ville — 4 verticales. */}
      <VilleServiceDetailSection
        isFr={isFr}
        service={service}
        villeNameFr={ville.nameFr}
        villeSlug={ville.slug}
        regionSlug={ville.region}
        copy={localeCopy}
        tone="paper"
      />

      {/* FAQ embed Speakable JSON-LD émise séparément ci-dessus.
          id="axion-faq-wrapper" = backup Speakable cssSelector (#axion-faq est
          sur le <section> interne de FaqBlock — Phase C 2026-05-20). */}
      {localeCopy.faq.length > 0 ? (
        <div id="axion-faq-wrapper">
          <FaqBlock
            eyebrow={
              isFr ? `FAQ · ${meta.nameFr} ${ville.nameFr}` : `FAQ · ${meta.nameEn} ${ville.nameFr}`
            }
            title={
              isFr
                ? `Questions fréquentes — ${meta.nameFr.toLowerCase()} à ${ville.nameFr}`
                : `Frequently asked questions — ${meta.nameEn.toLowerCase()} in ${ville.nameFr}`
            }
            description={
              isFr
                ? "Réponses précises calibrées à votre ville et à votre type d'entreprise (TPE, PME, ETI, grande entreprise)."
                : "Precise answers calibrated to your city and company size (micro, SME, mid-cap, large enterprise)."
            }
            items={localeCopy.faq.map((f, idx) => ({
              id: `${ville.slug}-${service}-${idx}`,
              question: f.q,
              answer: f.a,
            }))}
            emitJsonLd={false}
            tone="sand"
          />
        </div>
      ) : null}

      {/* V-01 P0d (Sprint Correctif 2026-05-22) — Articles factory mentionnant
          la ville. Affichés sur les 4 hubs services (audit / interventions /
          implementation / un-a-un) pour exposer les contenus factory aux pages
          ville-spécifiques (résolution gap V-01 multi-targets de l'audit). */}
      {cityArticles.length > 0 ? (
        <Section
          eyebrow={isFr ? "Articles & ressources" : "Articles & resources"}
          title={isFr ? "Articles mentionnant" : "Articles mentioning"}
          titleEm={ville.nameFr}
          description={
            isFr
              ? `Lecture complémentaire sur ${meta.nameFr.toLowerCase()} et l'écosystème IA à ${ville.nameFr}.`
              : `Further reading on ${meta.nameEn.toLowerCase()} and the AI ecosystem in ${ville.nameFr}.`
          }
          tone="paper"
        >
          <ul className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {cityArticles.map((article) => (
              <li key={article.slug}>
                <Link
                  href={`/blog/${article.slug}` as never}
                  data-cta-tracking={`ville_service_${service}_article`}
                  data-source-ville={ville.slug}
                  className="group bg-bg hover:border-terracotta focus-visible:ring-terracotta border-border-strong/40 shadow-subtle hover:shadow-card block h-full rounded-2xl border-2 p-6 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <p className="text-fg-muted text-[11px] font-semibold tracking-[0.16em] uppercase">
                    {isFr ? "Article" : "Article"}
                    {article.publishedAt
                      ? ` · ${new Date(article.publishedAt).toLocaleDateString(isFr ? "fr-FR" : "en-GB", { year: "numeric", month: "short" })}`
                      : ""}
                  </p>
                  <p
                    className="text-fg mt-2 text-lg leading-tight font-semibold"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {article.title}
                  </p>
                  {article.excerpt ? (
                    <p className="text-fg-soft mt-3 line-clamp-3 text-sm leading-relaxed">
                      {article.excerpt}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* Cross-services à la même ville — maillage 4 services × ville
          (audit / interventions / implementation / un-a-un) — patch C4
          cert 2026-05-08 + extension Sprint S+2 City Domination (4e verticale).
          Renforce maillage interne sans avoir à parcourir 4 niveaux depuis home.
          NB : on lit le copy ville pour audit/interventions/implementation
          (clés alignées) et `unAUn` pour la 4e (mapping séparé car ServiceKey
          contient un tiret invalide en propriété TS littérale). */}
      {(() => {
        const otherServices: ServiceKey[] = (
          ["audit", "interventions", "implementation", "un-a-un", "sites-web-augmentes"] as const
        ).filter((s) => {
          if (s === service) return false;
          if (s === "un-a-un") return !!ville.copy?.services?.unAUn;
          if (s === "sites-web-augmentes") return !!ville.copy?.services?.sitesWeb;
          return !!ville.copy?.services?.[s];
        });
        if (otherServices.length === 0) return null;
        return (
          <Section
            eyebrow={isFr ? "Autres services à" : "Other services in"}
            title={ville.nameFr}
            titleEm={isFr ? "même ville" : "same city"}
            description={
              isFr
                ? `Axion-IA délivre plusieurs prestations IA à ${ville.nameFr}. Découvrez les autres formats disponibles localement.`
                : `Axion-IA delivers several AI services in ${ville.nameFr}. Discover the other formats available locally.`
            }
            tone="paper"
          >
            <ul className="grid gap-4 lg:grid-cols-2">
              {otherServices.map((s) => {
                const otherMeta = SERVICE_META[s];
                const Icon = otherMeta.icon;
                return (
                  <li key={s}>
                    <Link
                      href={`${otherMeta.pathFr}/${ville.slug}` as never}
                      data-source-region={ville.region}
                      data-source-ville={ville.slug}
                      data-cta-tracking={`ville_sister_service_${s}`}
                      className="border-border bg-paper hover:border-terracotta-deep focus-visible:ring-terracotta group block rounded-2xl border-2 p-6 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                      <Icon
                        aria-hidden="true"
                        className="text-terracotta-deep mb-4 h-6 w-6"
                        strokeWidth={2}
                      />
                      <h3
                        className="text-fg group-hover:text-terracotta text-xl font-semibold tracking-tight transition"
                        style={{ fontFamily: "var(--font-serif)" }}
                      >
                        {isFr ? otherMeta.nameFr : otherMeta.nameEn}{" "}
                        <span className="italic">
                          {isFr ? `à ${ville.nameFr}` : `in ${ville.nameFr}`}
                        </span>
                      </h3>
                      <p className="text-fg-muted mt-2 text-sm leading-relaxed">
                        {isFr ? otherMeta.eyebrowFr : otherMeta.eyebrowEn}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Section>
        );
      })()}

      {/* À propos + contexte local — repositionné plus bas (UX + AEO).
          directAnswer garde id="axion-direct-answer" (cible Speakable JSON-LD). */}
      {ville.copy?.directAnswerFr || ville.copy?.ecosystemFr ? (
        <Section
          tone="paper"
          eyebrow={isFr ? `À propos · ${ville.nameFr}` : `About · ${ville.nameFr}`}
          title={isFr ? "Axion-IA à" : "Axion-IA in"}
          titleEm={ville.nameFr}
        >
          <div className="max-w-3xl space-y-5">
            {ville.copy?.directAnswerFr ? (
              <p
                id="axion-direct-answer"
                className="text-fg-soft text-base leading-relaxed"
                aria-label={isFr ? "Réponse directe" : "Direct answer"}
              >
                {ville.copy.directAnswerFr}
              </p>
            ) : null}
            {ville.copy?.ecosystemFr ? (
              <p className="text-fg-muted text-sm leading-relaxed">
                <span className="text-fg font-semibold">
                  {isFr ? "Contexte local — " : "Local context — "}
                </span>
                <span data-ecosystem="true">{ville.copy.ecosystemFr}</span>
              </p>
            ) : null}
          </div>
        </Section>
      ) : null}

      {/* Villes proches même service — maillage interne (hub → satellites) */}
      {nearbyVilles.length > 0 ? (
        <Section
          eyebrow={isFr ? "On intervient aussi autour" : "We also serve around"}
          title={isFr ? `${meta.nameFr} près de` : `${meta.nameEn} near`}
          titleEm={ville.nameFr}
          description={
            isFr
              ? `On se déplace aussi dans les communes proches de ${ville.nameFr}, triées par distance — cliquez pour la page locale.`
              : `We also travel to the communes near ${ville.nameFr}, sorted by distance — click for the local page.`
          }
          tone="canvas"
        >
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {nearbyVilles.map(({ ville: v, distanceKm }) => (
              <li key={v.slug}>
                <Link
                  href={`${meta.pathFr}/${v.slug}` as never}
                  data-source-region={v.region}
                  data-source-ville={v.slug}
                  data-cta-tracking={`ville_service_${service}_nearby`}
                  className="group hover:bg-sand focus-visible:ring-terracotta block rounded-lg px-3 py-2.5 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <span
                    className="text-fg group-hover:text-terracotta block text-sm font-semibold tracking-tight transition"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {v.nameFr}
                  </span>
                  <span className="text-fg-muted mt-0.5 block text-[11px] tabular-nums">
                    {Math.round(distanceKm)} km · {fmtPopulation(v.population, isFr ? "fr" : "en")}{" "}
                    {isFr ? "hab." : "inhab."}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* Maillage thématique interne — autorité topique GEO/AEO.
          Liens vers glossaire, guides, stack pour reinforcer le Knowledge Graph Axion-IA. */}
      <div className="border-border bg-paper border-y py-8">
        <Container className="max-w-3xl">
          <p className="text-fg-muted mb-4 text-xs font-medium tracking-widest uppercase">
            {isFr ? "Pour aller plus loin" : "Further reading"}
          </p>
          <ul className="flex flex-wrap gap-3">
            <li>
              <Link
                href="/guides"
                className="text-terracotta-deep text-sm hover:underline"
                data-cta-tracking="ville_service_thematic_guides"
              >
                {isFr ? "→ Guides IA 2026" : "→ AI guides 2026"}
              </Link>
            </li>
            <li>
              <Link
                href="/glossaire"
                className="text-terracotta-deep text-sm hover:underline"
                data-cta-tracking="ville_service_thematic_glossaire"
              >
                {isFr ? "→ Glossaire IA" : "→ AI glossary"}
              </Link>
            </li>
            <li>
              <Link
                href="/stack-ia"
                className="text-terracotta-deep text-sm hover:underline"
                data-cta-tracking="ville_service_thematic_stack"
              >
                {isFr ? "→ Stack outils IA" : "→ AI tools stack"}
              </Link>
            </li>
          </ul>
        </Container>
      </div>

      {/* CTA final pré-rempli ville × service */}
      <CtaBlock
        eyebrow={isFr ? "Démarrer concrètement" : "Start concretely"}
        title={isFr ? `Vous êtes à ${ville.nameFr} ?` : `You're in ${ville.nameFr}?`}
        titleEm={
          isSitesWeb
            ? isFr
              ? "parlons de votre projet"
              : "let's talk about your project"
            : isFr
              ? `Réservez ${meta.nameFr.toLowerCase()}`
              : `Book ${meta.nameEn.toLowerCase()}`
        }
        description={
          isSitesWeb
            ? isFr
              ? `Un appel pour cadrer votre site ou plateforme à ${ville.nameFr} : on identifie les briques IA à plus fort ROI, puis devis ferme à partir de 24-48 h selon la complexité du projet. Code et données à vous.`
              : `A call to scope your site or platform in ${ville.nameFr}: we identify the highest-ROI AI bricks, then a firm quote from 24-48 h depending on project complexity. Code and data yours.`
            : isFr
              ? `Calendrier réel temps réel. Acompte 50 % à la confirmation. Champ « ville » pré-rempli avec ${ville.nameFr}, champ « service » pré-rempli avec ${meta.nameFr}.`
              : `Real-time calendar. 50% deposit on confirmation. "City" field pre-filled with ${ville.nameFr}, "service" field pre-filled with ${meta.nameEn}.`
        }
        cta={
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Cta
              href={
                isSitesWeb
                  ? "/appel"
                  : (`/reserver?ville=${ville.slug}&service=${service}` as never)
              }
              variant="terracotta"
              size="lg"
              shape="pill"
              track={`ville_service_${service}_book_final`}
              data-source-ville={ville.slug}
            >
              {isSitesWeb
                ? isFr
                  ? "Réserver un appel"
                  : "Book a call"
                : isFr
                  ? `Voir le calendrier · ${formattedEntryPrice}`
                  : `View the calendar · ${formattedEntryPrice}`}
            </Cta>
            <Cta
              href="/contact"
              variant="outline"
              size="lg"
              shape="pill"
              track={`ville_service_${service}_contact_final`}
            >
              {isSitesWeb
                ? isFr
                  ? "Nous écrire"
                  : "Email us"
                : isFr
                  ? "Parler à un consultant"
                  : "Speak with a consultant"}
            </Cta>
          </div>
        }
      />

      {/* V-07 P0f (Sprint Correctif 2026-05-22) — AI Act art. 50 disclosure.
          Couvre les pages tier-1 indexables ville × service (4 verticales × 39
          pilotes = 156 pages effectives + extensions futures). Wording exact D4
          consolidé dans `AiContentDisclaimer`. */}
      <AiContentDisclaimer locale={loc} />

      {/* JSON-LD posé en fin de page (audit Web Vitals 2026-05-15 §1.6) — Phase C
          2026-05-20 : 7 schémas combinés (Service + LocalBusiness + BreadcrumbList
          + FAQPage Speakable + HowTo + Person E-E-A-T + ItemList villes proches)
          via buildVilleServiceJsonLdGraph. Cumul ~4 services × 2 150 villes = ~17 200 SSG.
          V-04 P0i (Sprint Correctif 2026-05-22) — strategy="afterInteractive"
          défère l'injection 7-schema (~3 KB JSON sur villes pilotes) après
          hydratation, retire du parsing HTML initial (-300 à -500 ms TBT). */}
      <JsonLdGraph
        schemas={jsonLdSchemas}
        strategy="afterInteractive"
        scriptId={`jsonld-ville-service-${villeSlug}-${service}`}
      />
    </>
  );
}
