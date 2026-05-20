// Server Component — template partagé pour les 3 pages ville × service
// (Sprint 14.10.1, Commit B). Réutilise VilleServiceDetailSection en mode
// pleine page, ajoute hero spécifique service, breadcrumb 4 niveaux,
// stack JSON-LD complet, FAQ Speakable, maillage interne.
//
// Décision Will 2026-05-08 : « toutes les villes indexables ».
//   - Si copy.services.<service> présent : tier-1 indexable + sitemap inclus.
//   - Sinon : stub minimal noindex follow (anti-doorway HCU 2024).

import type { Metadata } from "next";
import { ArrowUpRight, Briefcase, Building2, MapPin, Users, Wrench } from "lucide-react";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { type Locale, routing } from "@/i18n/routing";
import { fmtPopulation } from "@/lib/intl";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { JsonLdGraph } from "@/components/marketing/JsonLdGraph";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Link } from "@/i18n/navigation";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { FaqBlock } from "@/components/sections/FaqBlock";
import { VilleServiceDetailSection } from "@/components/sections/VilleServiceDetailSection";

import { getRegion } from "@/content/regions";
import { VILLES, getIndexableVilles, getVille } from "@/content/villes";
import { getNearbyVilles } from "@/lib/geo";
import {
  AUDIT_TIERS,
  INTERVENTION_TIERS,
  IMPLEMENTATION_TIERS,
  UN_A_UN_TIERS,
  formatPrice,
  getEntryPriceEur,
  getEntryTier,
  type PricingTier,
} from "@/content/pricing";
import { buildProductMetadata } from "@/lib/seo";
import { buildVilleServiceJsonLdGraph } from "@/lib/seo/ville-service-jsonld";

// Sprint S+2 City Domination — 4e verticale `un-a-un` (décision Will Option A
// 2026-05-18). Naming brand "un-a-un" en URL canonique ; sémantique = coaching
// dirigeant 1-to-1, tarif d'entrée 990 € HT (tier intervention-dirigeants
// réutilisé via UN_A_UN_TIERS).
type ServiceKey = "audit" | "interventions" | "implementation" | "un-a-un";

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
  interventions: {
    canonical: "/interventions",
    pathFr: "/interventions/par-ville",
    pathEn: "/interventions/by-city",
    nameFr: "Interventions IA en entreprise",
    nameEn: "Corporate AI sessions",
    eyebrowFr: "Interventions IA en entreprise",
    eyebrowEn: "Corporate AI sessions",
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
      };
    };
  },
  service: ServiceKey,
) {
  if (service === "un-a-un") return ville.copy?.services?.unAUn;
  return ville.copy?.services?.[service];
}

interface PageProps {
  params: Promise<{ locale: string; ville: string }>;
}

/**
 * `generateStaticParams` partagé par les 3 services.
 *
 * Audit deploy-unstuck 2026-05-18 (D4-QW1) — quand `BUILD_SSG_VILLES_INDEXABLE_ONLY=true`
 * (set au build GH Actions runner ubuntu-latest 16 GB), retourne uniquement
 * les villes avec `copy.services.<svc>` (Paris seul pour l'instant). Les autres
 * villes restent accessibles via `dynamicParams=true` + `revalidate=86400` ISR
 * (premier hit slow puis cached 24h). Cohérent SEO : les villes sans copy sont
 * déjà `noindex` côté metadata (anti-doorway HCU 2024), donc pas de perte
 * d'indexation. Réduit ~6 450 pages SSG (3 × 2 150) → peak RAM build divisé
 * par ~2. À retirer quand pipeline stable + larger runners activés.
 */
export function buildStaticParams(): Array<{ ville: string }> {
  const indexableOnly = process.env.BUILD_SSG_VILLES_INDEXABLE_ONLY === "true";
  const source = indexableOnly ? getIndexableVilles() : VILLES;
  return source.map((v) => ({ ville: v.slug }));
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

  // Anti-doorway HCU 2024 : noindex tant qu'aucun copy substantiel.
  if (!hasCopy) {
    return { ...result, robots: { index: false, follow: true } };
  }
  return {
    ...result,
    other: {
      abstract: isFr
        ? (serviceCopy?.fr.hero.slice(0, 155) ?? description)
        : (serviceCopy?.en.hero.slice(0, 155) ?? description),
    },
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
  const entryPriceEur = getEntryPriceEur(meta.tiers);
  const entryTier: PricingTier = getEntryTier(meta.tiers);
  const formattedEntryPrice = formatPrice(entryTier, isFr ? "fr" : "en");

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

  // ---- STUB MINIMAL noindex pour villes sans copy ----
  if (!hasCopy) {
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
            isFr
              ? `Axion-IA délivre ${meta.nameFr.toLowerCase()} dans toute la France métropolitaine, y compris à ${ville.nameFr} (${ville.departementLabel ?? ville.departement}, ${region.nameFr}). Page locale détaillée en préparation — réservation directe via la page régionale ou contact.`
              : `Axion-IA delivers ${meta.nameEn.toLowerCase()} across metropolitan France, including ${ville.nameFr} (${ville.departementLabel ?? ville.departement}, ${region.nameFr}). Detailed local page in preparation — direct booking via the regional page or contact.`
          }
        >
          <div className="flex flex-wrap items-center gap-3">
            <Cta href={meta.canonical} variant="primary" size="lg" shape="pill">
              {isFr ? `Voir ${meta.nameFr}` : `See ${meta.nameEn}`}
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
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* Direct-answer AEO : citable verbatim par Perplexity / Claude / Google AI Overviews.
          id="axion-direct-answer" = cible du Speakable JSON-LD. */}
      {(ville.copy?.directAnswerFr ?? null) ? (
        <div className="border-border bg-paper border-b">
          <Container className="max-w-3xl py-5">
            <p
              id="axion-direct-answer"
              className="text-fg-soft text-sm leading-relaxed"
              aria-label={isFr ? "Réponse directe" : "Direct answer"}
            >
              {ville.copy!.directAnswerFr}
            </p>
          </Container>
        </div>
      ) : null}

      {/* Hero compact spécifique ville × service */}
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
            href={`/reserver?ville=${ville.slug}&service=${service}` as never}
            variant={meta.accent === "terracotta" ? "terracotta" : "primary"}
            size="lg"
            shape="pill"
            track={`ville_service_${service}_book`}
            data-source-ville={ville.slug}
            data-source-region={ville.region}
          >
            {isFr ? `Réserver · ${formattedEntryPrice}` : `Book · ${formattedEntryPrice}`}
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

      {/* Contexte économique local — signal GEO (entités nommées secteurs/groupes locaux).
          Renforce la pertinence topique pour les requêtes "IA à [Ville]" dans les LLMs. */}
      {ville.copy?.ecosystemFr ? (
        <div className="bg-paper border-border border-b">
          <Container className="max-w-3xl py-4">
            <p className="text-fg-muted text-xs leading-relaxed italic">
              {isFr ? "Contexte local · " : "Local context · "}
              <span data-ecosystem="true">{ville.copy.ecosystemFr}</span>
            </p>
          </Container>
        </div>
      ) : null}

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

      {/* Cross-services à la même ville — maillage 4 services × ville
          (audit / interventions / implementation / un-a-un) — patch C4
          cert 2026-05-08 + extension Sprint S+2 City Domination (4e verticale).
          Renforce maillage interne sans avoir à parcourir 4 niveaux depuis home.
          NB : on lit le copy ville pour audit/interventions/implementation
          (clés alignées) et `unAUn` pour la 4e (mapping séparé car ServiceKey
          contient un tiret invalide en propriété TS littérale). */}
      {(() => {
        const otherServices: ServiceKey[] = (
          ["audit", "interventions", "implementation", "un-a-un"] as const
        ).filter((s) => {
          if (s === service) return false;
          if (s === "un-a-un") return !!ville.copy?.services?.unAUn;
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
                ? `Axion-IA délivre 3 prestations IA à ${ville.nameFr}. Découvrez les autres formats disponibles localement.`
                : `Axion-IA delivers 3 AI services in ${ville.nameFr}. Discover the other formats available locally.`
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

      {/* Villes proches même service — maillage interne */}
      {nearbyVilles.length > 0 ? (
        <Section
          eyebrow={isFr ? "Villes proches" : "Nearby cities"}
          title={isFr ? `${meta.nameFr} dans` : `${meta.nameEn} in`}
          titleEm={isFr ? "votre région" : "your region"}
          description={
            isFr
              ? `Communes éligibles à ${meta.nameFr.toLowerCase()} dans un rayon proche de ${ville.nameFr}, triées par distance.`
              : `Communes eligible for ${meta.nameEn.toLowerCase()} within a close radius of ${ville.nameFr}, sorted by distance.`
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
          isFr ? `Réservez ${meta.nameFr.toLowerCase()}` : `Book ${meta.nameEn.toLowerCase()}`
        }
        description={
          isFr
            ? `Calendrier réel temps réel. Acompte 50 % à la confirmation. Champ « ville » pré-rempli avec ${ville.nameFr}, champ « service » pré-rempli avec ${meta.nameFr}.`
            : `Real-time calendar. 50% deposit on confirmation. "City" field pre-filled with ${ville.nameFr}, "service" field pre-filled with ${meta.nameEn}.`
        }
        cta={
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Cta
              href={`/reserver?ville=${ville.slug}&service=${service}` as never}
              variant="terracotta"
              size="lg"
              shape="pill"
              track={`ville_service_${service}_book_final`}
              data-source-ville={ville.slug}
            >
              {isFr
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
              {isFr ? "Parler à un consultant" : "Speak with a consultant"}
            </Cta>
          </div>
        }
      />

      {/* JSON-LD posé en fin de page (audit Web Vitals 2026-05-15 §1.6) — Phase C
          2026-05-20 : 7 schémas combinés (Service + LocalBusiness + BreadcrumbList
          + FAQPage Speakable + HowTo + Person E-E-A-T + ItemList villes proches)
          via buildVilleServiceJsonLdGraph. Cumul ~4 services × 2 150 villes = ~17 200 SSG. */}
      <JsonLdGraph schemas={jsonLdSchemas} />
    </>
  );
}
