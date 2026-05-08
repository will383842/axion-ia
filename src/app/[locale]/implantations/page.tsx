import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowUpRight, MapPin, Users } from "lucide-react";

import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Link } from "@/i18n/navigation";
import { CtaBlock } from "@/components/sections/CtaBlock";

import { REGIONS, getIndexableRegions, getTopRegionsByPib } from "@/content/regions";
import { getIndexableVilles, VILLES } from "@/content/villes";
import { buildProductMetadata, buildItemListJsonLd, SITE_URL } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  return buildProductMetadata({
    locale,
    path: "/implantations",
    title: isFr
      ? "Implantations · Cabinet IA opérationnel partout en France"
      : "Locations · Operational AI consultancy across France",
    description: isFr
      ? "AxionIA intervient sur site dans 12 régions et plus de 2 150 communes françaises. Trouvez votre métropole, vos villes proches et votre cabinet IA opérationnel local."
      : "AxionIA operates on site across 12 regions and 2,150+ French communes. Find your metropolitan area, nearby cities and your local operational AI consultancy.",
    alternates: { fr: "/implantations", en: "/locations" },
  });
}

export default async function ImplantationsHub({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const indexableRegions = getIndexableRegions();
  const indexableVilles = getIndexableVilles();
  const topRegions = getTopRegionsByPib(6);
  const totalVilles = VILLES.length;

  const breadcrumbItems = [{ href: "/implantations", label: isFr ? "Implantations" : "Locations" }];

  // ItemList JSON-LD régions — signal AEO/GEO : LLMs énumèrent les 12 régions
  // couvertes quand un utilisateur demande « où intervient AxionIA ? ».
  const regionsItemList = buildItemListJsonLd({
    locale: loc,
    path: "/implantations",
    name: isFr ? "Régions couvertes par AxionIA" : "Regions covered by AxionIA",
    items: indexableRegions.map((region, idx) => ({
      position: idx + 1,
      name: region.nameFr,
      url: `${SITE_URL}/${loc}/${isFr ? "implantations" : "locations"}/${region.slug}`,
      description: isFr ? region.pitchFr : region.pitchEn,
    })),
  });

  // BreadcrumbList JSON-LD : émis automatiquement par <Breadcrumbs items={…} />
  // (cf. src/components/nav/Breadcrumbs.tsx) — pas de double émission ici.

  return (
    <>
      <JsonLd data={regionsItemList} />

      {/* Hero — Section h1 (auto halo-warm + décoration) */}
      <Section
        titleAs="h1"
        eyebrow={isFr ? "Implantations" : "Locations"}
        title={isFr ? "Cabinet IA opérationnel" : "Operational AI consultancy"}
        titleEm={isFr ? "près de chez vous" : "near you"}
        titleTail={isFr ? "." : "."}
        description={
          isFr
            ? `AxionIA intervient sur site dans 12 régions de France métropolitaine — ${totalVilles.toLocaleString("fr-FR")} communes éligibles, des chefs-lieux aux PME locales. Choisissez votre région ou votre métropole pour découvrir notre couverture.`
            : `AxionIA delivers on-site engagements across 12 metropolitan French regions — ${totalVilles.toLocaleString("en-US")} eligible communes, from prefectures to local SMEs. Pick your region or metropolitan area to explore our coverage.`
        }
      >
        <div className="mb-10">
          <Breadcrumbs items={breadcrumbItems} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Cta href="/audit" variant="primary" size="lg" shape="pill" track="hub_cta_audit">
            {isFr ? "Demander un audit Flash · 490 €" : "Request a Flash audit · €490"}
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Cta>
          <Cta href="/contact" variant="ghost" size="lg" shape="pill" track="hub_cta_contact">
            {isFr ? "Parler à un consultant" : "Speak with a consultant"}
          </Cta>
        </div>
      </Section>

      {/* Top régions par PIB — point d'entrée 80/20 */}
      <Section
        eyebrow={isFr ? "Top métropoles" : "Top metropolitan areas"}
        title={isFr ? "Les 6 régions les plus" : "The 6 regions most"}
        titleEm={isFr ? "demandées" : "requested"}
        titleTail={isFr ? "." : "."}
        description={
          isFr
            ? "Nos pôles d'intervention prioritaires en 2026 — classement par PIB régional Eurostat. Chaque page liste vos villes proches, le tissu B2B local et nos cas concrets."
            : "Our priority engagement hubs for 2026 — ranked by Eurostat regional GDP. Each page lists nearby cities, the local B2B fabric and our case studies."
        }
        tone="paper"
      >
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {topRegions.map((region) => (
            <li key={region.slug}>
              <Link
                href={`/implantations/${region.slug}` as never}
                data-cta-tracking="hub_region_top"
                data-source-region={region.slug}
                className="group bg-paper hover:border-terracotta focus-visible:ring-terracotta border-border-strong/40 shadow-subtle hover:shadow-card block h-full rounded-2xl border-2 p-6 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-fg-muted text-[11px] font-semibold tracking-[0.16em] uppercase">
                      <span
                        aria-hidden="true"
                        className="bg-terracotta mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle"
                      />
                      {region.prefecture}
                      {typeof region.pibBillionsEur === "number"
                        ? ` · ${region.pibBillionsEur} Md€ PIB`
                        : ""}
                    </p>
                    <p
                      className="text-fg mt-3 text-2xl leading-tight font-semibold"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {region.nameFr}
                    </p>
                  </div>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="text-fg-muted group-hover:text-terracotta h-5 w-5 shrink-0 transition"
                  />
                </div>
                <p className="text-fg-soft mt-4 line-clamp-3 text-sm leading-relaxed">
                  {isFr ? region.pitchFr : region.pitchEn}
                </p>
                <div className="text-fg-muted mt-5 flex items-center gap-4 text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    {region.population.toLocaleString(isFr ? "fr-FR" : "en-US")}{" "}
                    {isFr ? "hab." : "inhab."}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    {region.departements.length} {isFr ? "départements" : "departments"}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* Toutes les régions */}
      <Section
        eyebrow={isFr ? "Toutes les régions" : "All regions"}
        title={isFr ? "12 régions de France" : "12 French regions"}
        titleEm={isFr ? "toutes couvertes" : "all covered"}
        description={
          isFr
            ? "France métropolitaine intégralement couverte. Les DROM ne sont pas dans notre périmètre V1 (décision 2026-05-08, voir ADR 0006)."
            : "Continental France fully covered. Overseas regions are not in our V1 scope (decision 2026-05-08, see ADR 0006)."
        }
      >
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {REGIONS.map((region) => {
            const isIndexable = !region.noindex;
            return (
              <li key={region.slug}>
                <Link
                  href={`/implantations/${region.slug}` as never}
                  data-source-region={region.slug}
                  className="group hover:bg-sand focus-visible:ring-terracotta block rounded-lg px-3 py-2.5 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <span
                    className="text-fg group-hover:text-terracotta block text-sm font-semibold tracking-tight transition"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {region.nameFr}
                  </span>
                  <span className="text-fg-muted mt-0.5 block text-[11px]">
                    {region.prefecture}
                    {!isIndexable ? (isFr ? " · à venir" : " · coming soon") : ""}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* Villes pilotes (V1 = Paris seul) */}
      {indexableVilles.length > 0 ? (
        <Section
          eyebrow={isFr ? "Villes pilotes" : "Pilot cities"}
          title={isFr ? "Pages villes" : "Cities with"}
          titleEm={isFr ? "gold standard" : "gold standard"}
          titleTail={isFr ? " 2026" : " content"}
          description={
            isFr
              ? "Premières pages ville livrées avec un contenu éditorial complet (FAQ géolocalisée, écosystème, cas clients proches)."
              : "First city pages delivered with full editorial content (geolocalized FAQ, ecosystem, nearby case studies)."
          }
          tone="sand"
        >
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {indexableVilles.map((ville) => (
              <li key={ville.slug}>
                <Link
                  href={`/implantations/${ville.region}/${ville.slug}` as never}
                  data-cta-tracking="hub_ville_pilot"
                  data-source-ville={ville.slug}
                  data-source-region={ville.region}
                  className="group bg-paper hover:border-terracotta focus-visible:ring-terracotta border-border-strong/40 shadow-subtle hover:shadow-card block rounded-2xl border-2 p-5 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-fg-muted text-[11px] font-semibold tracking-[0.16em] uppercase">
                        {ville.departementLabel ?? ville.departement}
                      </p>
                      <p
                        className="text-fg mt-2 text-xl leading-tight font-semibold"
                        style={{ fontFamily: "var(--font-serif)" }}
                      >
                        {ville.nameFr}
                      </p>
                    </div>
                    <ArrowUpRight
                      aria-hidden="true"
                      className="text-fg-muted group-hover:text-terracotta h-5 w-5 shrink-0 transition"
                    />
                  </div>
                  {ville.copy ? (
                    <p className="text-fg-soft mt-3 line-clamp-2 text-[13px] leading-relaxed">
                      {isFr ? ville.copy.pitchFr : ville.copy.pitchEn}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* CTA final */}
      <CtaBlock
        eyebrow={isFr ? "Réservation directe" : "Direct booking"}
        title={isFr ? "Vous démarrez où ?" : "Where do you start?"}
        titleEm={isFr ? "Réservez en ligne" : "Book online"}
        description={
          isFr
            ? "Calendrier réel temps réel. Acompte 50 % à la confirmation. Frais de déplacement inclus en intra-Paris et capitales régionales."
            : "Real-time calendar. 50% deposit on confirmation. Travel fees included in inner-Paris and regional capitals."
        }
        cta={
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Cta href="/reserver" variant="terracotta" size="lg" shape="pill" track="hub_cta_book">
              {isFr ? "Voir le calendrier · 490 €" : "View the calendar · €490"}
            </Cta>
            <Cta href="/audit" variant="outline" size="lg" shape="pill" track="hub_cta_audit_final">
              {isFr ? "Audit IA détaillé" : "Detailed AI audit"}
            </Cta>
          </div>
        }
      />
    </>
  );
}
