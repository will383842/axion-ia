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
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Link } from "@/i18n/navigation";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { FaqBlock } from "@/components/sections/FaqBlock";
import { VilleServiceDetailSection } from "@/components/sections/VilleServiceDetailSection";

import { getRegion } from "@/content/regions";
import { VILLES, getVille } from "@/content/villes";
import { getNearbyVilles } from "@/lib/geo";
import {
  buildProductMetadata,
  buildServiceJsonLd,
  buildLocalBusinessJsonLd,
  buildBreadcrumbJsonLd,
  buildFaqSpeakableJsonLd,
  buildItemListJsonLd,
  SITE_URL,
} from "@/lib/seo";

type ServiceKey = "audit" | "interventions" | "implementation";

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
    priceEur: 490,
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
    priceEur: 490,
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
    priceEur: 990,
  },
} as const;

interface PageProps {
  params: Promise<{ locale: string; ville: string }>;
}

/**
 * `generateStaticParams` partagé par les 3 services. Retourne TOUTES les
 * villes (anti-doorway géré par `noindex` côté metadata si copy absent).
 */
export function buildStaticParams(): Array<{ ville: string }> {
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
  const hasCopy = !!ville.copy?.services?.[service];

  const title = hasCopy
    ? isFr
      ? `${meta.nameFr} à ${ville.nameFr} (${ville.departementLabel ?? ville.departement})`
      : `${meta.nameEn} in ${ville.nameFr} (${ville.departementLabel ?? ville.departement})`
    : isFr
      ? `${meta.nameFr} à ${ville.nameFr} — disponible sur devis`
      : `${meta.nameEn} in ${ville.nameFr} — available on quote`;

  const serviceCopy = ville.copy?.services?.[service];
  const description = serviceCopy
    ? isFr
      ? serviceCopy.fr.hero.slice(0, 200)
      : serviceCopy.en.hero.slice(0, 200)
    : isFr
      ? `AxionIA délivre ${meta.nameFr.toLowerCase()} à ${ville.nameFr} sur site, dès ${meta.priceEur} € HT. Tarifs publics, frais de déplacement intégrés, calendrier en temps réel.`
      : `AxionIA delivers ${meta.nameEn.toLowerCase()} in ${ville.nameFr} on site, from €${meta.priceEur}. Public pricing, travel fees included, real-time calendar.`;

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
  return result;
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
  const hasCopy = !!ville.copy?.services?.[service];

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
              ? `AxionIA délivre ${meta.nameFr.toLowerCase()} dans toute la France métropolitaine, y compris à ${ville.nameFr} (${ville.departementLabel ?? ville.departement}, ${region.nameFr}). Page locale détaillée en préparation — réservation directe via la page régionale ou contact.`
              : `AxionIA delivers ${meta.nameEn.toLowerCase()} across metropolitan France, including ${ville.nameFr} (${ville.departementLabel ?? ville.departement}, ${region.nameFr}). Detailed local page in preparation — direct booking via the regional page or contact.`
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
  const serviceCopy = ville.copy!.services![service]!;
  const localeCopy = serviceCopy[loc];
  const nearbyVilles = getNearbyVilles(ville.geo, 6, {
    excludeSlug: ville.slug,
    sameRegion: ville.region,
  });

  // === JSON-LD stack (4 schemas + BreadcrumbList auto via Breadcrumbs) ===

  // 1. Service JSON-LD avec areaServed City précis
  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path: `${meta.pathFr}/${ville.slug}`,
    name: isFr
      ? `${meta.nameFr} à ${ville.nameFr} · AxionIA`
      : `${meta.nameEn} in ${ville.nameFr} · AxionIA`,
    description: localeCopy.hero,
    serviceType: meta.nameEn,
    priceEur: meta.priceEur,
    areasServed: [
      {
        type: "City",
        name: ville.nameFr,
        url: `${SITE_URL}/${loc}/implantations/${ville.region}/${ville.slug}`,
      },
      {
        type: "AdministrativeArea",
        name: region.nameFr,
        url: `${SITE_URL}/${loc}/${isFr ? "implantations" : "locations"}/${region.slug}`,
      },
      { type: "Country", name: "France" },
    ],
  });

  // 2. LocalBusiness JSON-LD avec address spécifique ville
  const localBusinessJsonLd = buildLocalBusinessJsonLd({
    locale: loc,
    path: `${meta.pathFr}/${ville.slug}`,
    name: isFr
      ? `AxionIA · ${meta.nameFr} à ${ville.nameFr}`
      : `AxionIA · ${meta.nameEn} in ${ville.nameFr}`,
    description: localeCopy.hero,
    areaServed: { type: "City", name: ville.nameFr },
    address: {
      city: ville.nameFr,
      region: region.nameFr,
      country: "FR",
      ...(ville.postalCode ? { postalCode: ville.postalCode } : {}),
    },
    geo: { latitude: ville.geo.lat, longitude: ville.geo.lon },
    priceRange: meta.priceEur >= 1000 ? "€€€" : "€€",
  });

  // 3. BreadcrumbList JSON-LD (4 niveaux)
  const breadcrumbJsonLd = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: isFr ? meta.nameFr : meta.nameEn, href: meta.canonical },
      {
        name: isFr ? `${meta.nameFr} à ${ville.nameFr}` : `${meta.nameEn} in ${ville.nameFr}`,
        href: `${meta.pathFr}/${ville.slug}` as never,
      },
    ],
  });

  // 4. FAQPage Speakable JSON-LD (FAQ ville × service)
  const faqSpeakableJsonLd = localeCopy.faq.length
    ? buildFaqSpeakableJsonLd({
        items: localeCopy.faq.map((f) => ({ question: f.q, answer: f.a })),
      })
    : null;

  // 5. ItemList JSON-LD villes proches même service
  const nearbyItemList =
    nearbyVilles.length > 0
      ? buildItemListJsonLd({
          locale: loc,
          path: `${meta.pathFr}/${ville.slug}`,
          name: isFr
            ? `Villes proches couvertes pour ${meta.nameFr.toLowerCase()}`
            : `Nearby cities covered for ${meta.nameEn.toLowerCase()}`,
          items: nearbyVilles.map(({ ville: v }, idx) => ({
            position: idx + 1,
            name: v.nameFr,
            url: `${SITE_URL}/${loc}${meta.pathFr}/${v.slug}`,
          })),
        })
      : null;

  return (
    <>
      <JsonLd data={serviceJsonLd} />
      <JsonLd data={localBusinessJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      {faqSpeakableJsonLd ? <JsonLd data={faqSpeakableJsonLd} /> : null}
      {nearbyItemList ? <JsonLd data={nearbyItemList} /> : null}

      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

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
            {ville.population.toLocaleString(isFr ? "fr-FR" : "en-US")}{" "}
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
            {isFr ? `Réserver · ${meta.priceEur} €` : `Book · €${meta.priceEur}`}
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

      {/* Section détaillée du service à la ville (réutilise composant) */}
      <VilleServiceDetailSection
        isFr={isFr}
        service={service}
        villeNameFr={ville.nameFr}
        villeSlug={ville.slug}
        regionSlug={ville.region}
        copy={localeCopy}
        tone="paper"
      />

      {/* FAQ embed Speakable JSON-LD émise séparément ci-dessus */}
      {localeCopy.faq.length > 0 ? (
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
      ) : null}

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
                    {Math.round(distanceKm)} km ·{" "}
                    {v.population.toLocaleString(isFr ? "fr-FR" : "en-US")}{" "}
                    {isFr ? "hab." : "inhab."}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

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
                ? `Voir le calendrier · ${meta.priceEur} €`
                : `View the calendar · €${meta.priceEur}`}
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
    </>
  );
}
