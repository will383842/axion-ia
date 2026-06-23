import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, Download, Mail } from "lucide-react";

import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/button";
import { JsonLd } from "@/components/marketing/JsonLd";
import { FaqBlock } from "@/components/sections/FaqBlock";
import { PressFacts } from "@/components/sections/PressFacts";
import { PressImages } from "@/components/sections/PressImages";
import { PressImageBank } from "@/components/sections/PressImageBank";
import { PressReleases } from "@/components/sections/PressReleases";
import { MediaCoverage } from "@/components/sections/MediaCoverage";
import { PressContact } from "@/components/sections/PressContact";
import { PressActivitiesStrip } from "@/components/sections/PressActivitiesStrip";
import { PressWhatsReallyHappening } from "@/components/sections/PressWhatsReallyHappening";
import { type ServiceId } from "@/content/services";
import { UnifiedContactForm } from "@/components/forms/UnifiedContactForm";
import { PRESS_PITCH, PRESS_FACTS, PRESS_FAQ } from "@/content/press";
// Salle de presse 2026-06-22 — communiqués + kit média lus depuis la DB
// (fallback fixtures si DB vide / build stub). Édités via la console admin.
import {
  getPublishedPressReleases,
  getPublishedPressMedia,
  getPressGalleryImages,
} from "@/server/press/queries";
// Couverture médias — retombées presse externes gérées depuis la console admin
// (section masquée tant qu'il n'y a aucune entrée publiée).
import { getPublishedMediaCoverage } from "@/server/press/media-coverage-queries";
import { PressImageCarousel } from "@/components/sections/PressImageCarousel";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import {
  buildProductMetadata,
  buildFaqSpeakableJsonLd,
  buildImageGraphJsonLd,
  SITE_URL,
} from "@/lib/seo";
import { buildSpeakableSpecification } from "@/lib/seo/speakable-universal";
import { getRealTestimonialsOnly } from "@/server/actions/content-gen/real-testimonials";
import { Link } from "@/i18n/navigation";
import { readLatestSnapshot } from "@/server/observatoire/snapshot";
import {
  STUDY_LICENSE_LABEL,
  STUDY_LICENSE_URL,
  BAROMETER_INSIGHT_KEYS,
} from "@/content/observatoire/study";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "press" });
  return buildProductMetadata({
    locale: locale as Locale,
    path: "/presse",
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { fr: "/presse", en: "/press" },
  });
}

// ISR — la page lit des données DB (témoignages réels, observatoire) + le layout
// partagé (bandeau + JSON-LD Qualiopi). 1h : corrige aussi le contenu DB figé
// vide au build stub (témoignages/chiffres), repeuplé au runtime.
export const revalidate = 3600;

export default async function PressePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const t = await getTranslations({ locale: loc, namespace: "press" });
  const pitch = PRESS_PITCH[loc];

  // Sprint v7 Phase 15 (F5) — consumer real testimonials.
  // Section invisible si aucun real testimonial (return null plus bas).
  // Build-time stub-aware : `getRealTestimonialsOnly` retourne [] si
  // DATABASE_URL=stub.invalid (cf. `real-testimonials.ts`).
  const realTestimonials = await getRealTestimonialsOnly();

  // Observatoire IA 2026 — snapshot avec fallback honnête (pas de faux chiffre
  // si l'enquête n'a pas encore d'échantillon ; build/stub → null).
  const tObs = await getTranslations({ locale: loc, namespace: "observatoire" });
  const obsSnapshot = await readLatestSnapshot();
  const obsTotal = obsSnapshot?.totalResponses ?? 0;
  const obsHasData = obsTotal > 0;
  const obsCsvUrl = `${SITE_URL}/api/observatoire/export-csv`;

  const facts = PRESS_FACTS.map((f) => ({
    id: f.id,
    label: f[loc].label,
    value: f[loc].value,
  }));

  const kitItems = await getPublishedPressMedia(loc);

  // Banque d'images — vrais visuels (vide au build stub → fallback promo).
  const pressGalleryImages = await getPressGalleryImages(loc, 10);

  const releases = await getPublishedPressReleases(loc);

  // Couverture médias réelle (DB admin) — la section est masquée si vide.
  const coverage = await getPublishedMediaCoverage(loc);

  const faqItems = PRESS_FAQ.map((f) => ({
    id: f.id,
    question: f[loc].question,
    answer: f[loc].answer,
  }));

  // Strip « 5 activités » — blurbs i18n mappés par id de service (SSOT services.ts).
  const activityBlurbs: Record<ServiceId, string> = {
    formations: t("activitiesBlurbFormations"),
    unAUn: t("activitiesBlurbUnAUn"),
    audit: t("activitiesBlurbAudit"),
    implementation: t("activitiesBlurbImplementation"),
    sitesWeb: t("activitiesBlurbSitesWeb"),
  };

  // Section « Que se passe-t-il vraiment » — 3 points d'entrée (ancres internes).
  const whatsReallyLinks = [
    {
      href: "#communiques",
      iconKind: "releases" as const,
      title: t("whatsReallyReleasesTitle"),
      description: t("whatsReallyReleasesDesc"),
      cta: t("whatsReallyReleasesCta"),
    },
    {
      href: "#press-kit",
      iconKind: "media" as const,
      title: t("whatsReallyMediaTitle"),
      description: t("whatsReallyMediaDesc"),
      cta: t("whatsReallyMediaCta"),
    },
    {
      href: "#presse-form",
      iconKind: "contact" as const,
      title: t("whatsReallyContactTitle"),
      description: t("whatsReallyContactDesc"),
      cta: t("whatsReallyContactCta"),
    },
  ];

  const pressPath = isFr ? "/presse" : "/press";
  const pageUrl = `${SITE_URL}/${loc}${pressPath}`;

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [{ href: "/presse", label: isFr ? "Espace presse" : "Press room" }];

  // WebPage + NewsroomPage signal — speakable on the boilerplate paragraph
  // (citable LLM block) and the AEO direct-answer pitch.
  const pressJsonLd = {
    "@context": "https://schema.org",
    "@type": ["WebPage", "NewsroomPage"],
    "@id": pageUrl,
    url: pageUrl,
    name: t("metaTitle"),
    description: t("metaDescription"),
    inLanguage: loc,
    isPartOf: { "@type": "WebSite", "@id": `${SITE_URL}/#website` },
    speakable: buildSpeakableSpecification({
      selectors: ["#press-pitch"],
    }),
    about: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Axion-IA",
      url: SITE_URL,
      address: {
        "@type": "PostalAddress",
        addressCountry: "FR",
      },
      contactPoint: [
        {
          "@type": "ContactPoint",
          contactType: "customer service",
          email: "contact@axion-ia.com",
          availableLanguage: ["French", "English"],
        },
        {
          "@type": "ContactPoint",
          contactType: "media inquiry",
          email: t("contactEmail"),
          availableLanguage: ["French", "English"],
        },
      ],
      sameAs: ["https://www.linkedin.com/company/axion-ia"],
    },
  };

  const releasesItemList =
    releases.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: t("releasesTitle"),
          url: `${pageUrl}#communiques`,
          numberOfItems: releases.length,
          itemListElement: releases.map((r, idx) => ({
            "@type": "ListItem",
            position: idx + 1,
            item: {
              "@type": "NewsArticle",
              "@id": `${pageUrl}#release-${r.slug}`,
              headline: r.title,
              description: r.dek,
              datePublished: r.publishedAt,
              dateModified: r.publishedAt,
              inLanguage: loc,
              author: {
                "@type": "Organization",
                name: "Axion-IA",
                "@id": `${SITE_URL}/#organization`,
              },
              // publisher.logo (ImageObject) requis par les guidelines Google
              // Article 2026 — aligné sur le builder canonique `buildArticleJsonLd`
              // (seo.ts). `@id` consolide vers le nœud Organization global.
              publisher: {
                "@type": "Organization",
                "@id": `${SITE_URL}/#organization`,
                name: "Axion-IA",
                legalName: "Axion-IA SAS",
                url: SITE_URL,
                logo: { "@type": "ImageObject", url: `${SITE_URL}/opengraph-image` },
              },
              image: `${SITE_URL}/api/og?title=${encodeURIComponent(r.title)}`,
            },
          })),
        }
      : null;

  const faqJsonLd = buildFaqSpeakableJsonLd({ items: faqItems });

  // ImageObject @graph — Sprint AEO Phase 4 2026-05-28 (Will). Photo
  // équipe + portrait fondateur pour exposition Google Images + AI Overviews
  // sur requêtes « presse Axion-IA », « interview fondateur cabinet IA »,
  // « press kit IA opérationnelle France ».
  const pressImagesJsonLd = buildImageGraphJsonLd({
    locale: loc,
    images: [
      {
        src: "/illustrations/home-founder-william.avif",
        name: isFr
          ? "Williams — Fondateur Axion-IA disponible pour interviews"
          : "Williams — Axion-IA founder available for interviews",
        alt: isFr
          ? "Portrait haute résolution de Williams, fondateur d'Axion-IA. Disponible pour interviews presse, podcasts, conférences sur l'IA opérationnelle pour TPE, PME, ETI et grandes entreprises françaises."
          : "High-resolution portrait of Williams, Axion-IA founder. Available for press interviews, podcasts, conferences on operational AI for French SMEs, mid-caps and large enterprises.",
        width: 800,
        height: 1000,
        encodingFormat: "image/avif",
      },
      {
        src: "/illustrations/home-bandeau-team.avif",
        name: isFr
          ? "Équipe Axion-IA — press kit visuels cabinet IA"
          : "Axion-IA team — AI consultancy press kit visuals",
        alt: isFr
          ? "Bandeau équipe Axion-IA — visuels press kit cabinet IA opérationnel français. 4 scènes : démo écran IA, échange canapé, session laptop binôme, portrait souriant."
          : "Axion-IA team banner — French operational AI consultancy press kit visuals. 4 scenes: AI screen demo, sofa exchange, paired laptop session, smiling portrait.",
        width: 1961,
        height: 802,
        encodingFormat: "image/avif",
      },
    ],
  });

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      {/* HERO — h1, halo-warm + page hero decoration (anneaux + halos) */}
      <Section
        titleAs="h1"
        eyebrow={t("heroEyebrow")}
        title={t("heroTitle")}
        titleEm={t("heroTitleEm")}
        titleTail={t("heroTitleTail")}
        description={t("heroDescription")}
      >
        <div className="flex flex-wrap gap-4">
          <Button asChild size="lg" shape="pill">
            <a href="#press-kit">
              <Download className="h-4 w-4" aria-hidden="true" />
              {t("heroCtaPrimary")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </Button>
          <Button asChild size="lg" shape="pill" variant="outline">
            <a
              href={`mailto:${t("contactEmail")}?subject=${encodeURIComponent(t("contactSubject"))}`}
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              {t("heroCtaSecondary")}
            </a>
          </Button>
        </div>
      </Section>

      {/* 5 ACTIVITÉS — strip compact (SSOT services.ts), liens hubs canoniques */}
      <Section
        id="activites"
        eyebrow={t("activitiesEyebrow")}
        title={t("activitiesTitle")}
        titleEm={t("activitiesTitleEm")}
        titleTail={t("activitiesTitleTail")}
        description={t("activitiesDescription")}
      >
        <PressActivitiesStrip
          isFr={isFr}
          blurbs={activityBlurbs}
          discoverLabel={t("activitiesDiscover")}
        />
      </Section>

      {/* PITCH — boilerplate citable + faits clés en aside */}
      <Section
        tone="paper"
        eyebrow={t("pitchEyebrow")}
        title={t("pitchTitle")}
        titleEm={t("pitchTitleEm")}
        titleTail={t("pitchTitleTail")}
      >
        <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr] lg:items-start">
          <div className="max-w-2xl">
            {/* Un seul paragraphe (citable AEO/Speakable) — fini le doublon
                pitch.short + boilerplate (décision Will 2026-06-23). */}
            <p
              id="press-pitch"
              className="text-fg text-lg leading-relaxed sm:text-xl"
              style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
            >
              {pitch.short}
            </p>
          </div>
          <PressFacts eyebrow={t("factsEyebrow")} facts={facts} />
        </div>
      </Section>

      {/* QUE SE PASSE-T-IL VRAIMENT — section pont (ton sobre), ancres internes */}
      <Section
        id="whats-really"
        tone="sand"
        eyebrow={t("whatsReallyEyebrow")}
        title={t("whatsReallyTitle")}
        titleEm={t("whatsReallyTitleEm")}
        titleTail={t("whatsReallyTitleTail")}
      >
        <PressWhatsReallyHappening intro={t("whatsReallyIntro")} links={whatsReallyLinks} />
      </Section>

      {/* STATISTIQUES IA — étude indépendante Axion-IA. Honnête : aucun chiffre
          fabriqué (ni « 30 secteurs / 13 régions » présentés comme des
          résultats). On n'affiche des KPI que si l'enquête a un échantillon
          réel ; sinon, cadrage sobre + lien vers l'étude. (Will 2026-06-23) */}
      <Section
        id="observatoire"
        tone="sand"
        eyebrow={isFr ? "Étude indépendante" : "Independent study"}
        title={tObs("press.sectionTitle")}
        description={
          isFr
            ? "Axion-IA mène l'Observatoire de l'IA dans les entreprises françaises, une étude indépendante en données ouvertes (CC BY 4.0) sur la maturité, les usages, les budgets et les freins à l'IA. Les résultats chiffrés sont publiés au fil de l'enquête, une fois l'échantillon significatif."
            : "Axion-IA runs the AI in French Companies Observatory, an independent open-data study (CC BY 4.0) on AI maturity, use cases, budgets and barriers. Figures are released as the survey progresses, once the sample is significant."
        }
      >
        {obsHasData ? (
          <div className="flex flex-col gap-6">
            {/* KPI en gros chiffres — calculés sur le snapshot RÉEL. Le grand
                nombre vient de `value` ; la légende réutilise la phrase i18n
                existante dont on retire le « X % » de tête (pas de doublon, pas
                de nouvelle clé EN à traduire). */}
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {BAROMETER_INSIGHT_KEYS.map((key) => {
                const value = obsSnapshot?.insights?.[key];
                if (value == null || value <= 0) return null;
                const caption = tObs(`insights.${key}`, { value }).replace(/^\s*\d+\s*%\s*/, "");
                return (
                  <li
                    key={key}
                    className="border-border bg-paper flex flex-col rounded-2xl border p-6"
                  >
                    <span className="text-terracotta font-serif text-5xl leading-none font-semibold tabular-nums">
                      {value}
                      <span className="align-top text-2xl">%</span>
                    </span>
                    <p className="text-fg-soft mt-3 text-sm leading-snug">{caption}</p>
                  </li>
                );
              })}
            </ul>
            <p className="text-fg-muted text-sm">
              {isFr ? "Sur un échantillon de " : "Based on a sample of "}
              <span className="text-fg font-semibold tabular-nums">{obsTotal}</span>{" "}
              {tObs("press.sampleLabel")}.
            </p>
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a
            href={STUDY_LICENSE_URL}
            target="_blank"
            rel="license noopener"
            className="border-border text-fg-soft inline-flex items-center rounded-full border px-4 py-1.5 text-xs font-medium"
          >
            {STUDY_LICENSE_LABEL}
          </a>
          <Button asChild shape="pill">
            <Link href="/observatoire-ia">
              {tObs("press.seeAll")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
          {obsHasData ? (
            <Button asChild shape="pill" variant="outline">
              <a href={obsCsvUrl}>
                <Download className="h-4 w-4" aria-hidden="true" />
                {tObs("press.downloadData")}
              </a>
            </Button>
          ) : null}
        </div>
      </Section>

      {/* PRESS KIT — assets téléchargeables (placeholders Phase 1) */}
      <Section
        id="press-kit"
        tone="sand"
        eyebrow={t("kitEyebrow")}
        title={t("kitTitle")}
        titleEm={t("kitTitleEm")}
        titleTail={t("kitTitleTail")}
        description={t("kitDescription")}
      >
        <PressImages
          items={kitItems}
          labels={{
            download: t("kitDownload"),
            comingSoon: t("kitComingSoon"),
            logosTitle: t("imagesLogosTitle"),
            paletteTitle: t("imagesPaletteTitle"),
            paletteNote: t("imagesPaletteNote"),
            documentsTitle: t("imagesDocumentsTitle"),
          }}
        />
      </Section>

      {/* BANQUE D'IMAGES — promo galerie CC BY 4.0 (axionia-image-bank skill v1.0).
         Lien interne sitewide vers /galerie depuis l'espace presse : boost autorité
         topique galerie + maillage Googlebot. */}
      <Section
        id="banque-images"
        tone="canvas"
        eyebrow={t("imageBankEyebrow")}
        title={t("imageBankTitle")}
        titleEm={t("imageBankTitleEm")}
        titleTail={t("imageBankTitleTail")}
        description={t("imageBankDescription")}
      >
        {pressGalleryImages.length > 0 ? (
          <div className="flex flex-col gap-10">
            <PressImageCarousel images={pressGalleryImages} locale={loc} />
            <div className="border-border-strong bg-paper flex flex-col items-start gap-4 rounded-xl border p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <p className="text-fg-soft max-w-xl text-sm leading-relaxed">
                {t("imageBankLicenseNote")}
              </p>
              <Link
                href="/galerie"
                className="border-terracotta bg-terracotta text-paper hover:bg-terracotta-deep focus-visible:ring-terracotta inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-full border px-5 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {t("imageBankCta")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        ) : (
          <PressImageBank
            labels={{
              primaryCta: t("imageBankCta"),
              licenseNote: t("imageBankLicenseNote"),
              categories: [
                {
                  id: "ia-operationnelle",
                  iconKind: "image",
                  title: t("imageBankCat1Title"),
                  description: t("imageBankCat1Description"),
                  previewUrl:
                    "/images/axion-ia-graphique-ia-imperatif-performance-fosse-concurrentiel-dataviz.webp",
                  previewAlt: isFr
                    ? "Graphique IA — impératif de performance et fossé concurrentiel 2024"
                    : "AI chart — performance imperative and competitive gap 2024",
                },
                {
                  id: "equipe",
                  iconKind: "camera",
                  title: t("imageBankCat2Title"),
                  description: t("imageBankCat2Description"),
                  previewUrl:
                    "/images/axion-ia-equipe-ia-service-humain-12-personnes-photo-groupe.webp",
                  previewAlt: isFr
                    ? "Équipe Axion-IA — cabinet IA opérationnel France"
                    : "Axion-IA team — operational AI consultancy France",
                },
                {
                  id: "cas-concrets",
                  iconKind: "scanline",
                  title: t("imageBankCat3Title"),
                  description: t("imageBankCat3Description"),
                  previewUrl:
                    "/images/axion-ia-comparatif-actions-humaines-vs-automatisation-ia-7-etapes-infographie.webp",
                  previewAlt: isFr
                    ? "Comparatif actions humaines vs automatisation IA — 7 étapes"
                    : "Comparison human actions vs AI automation — 7 steps",
                },
              ],
            }}
          />
        )}
      </Section>

      {/* COMMUNIQUÉS — releases cards */}
      <Section
        id="communiques"
        tone="canvas"
        eyebrow={t("releasesEyebrow")}
        title={t("releasesTitle")}
        titleEm={t("releasesTitleEm")}
        titleTail={t("releasesTitleTail")}
        description={t("releasesDescription")}
      >
        <PressReleases
          releases={releases}
          locale={loc}
          labels={{
            tagLaunch: t("tagLaunch"),
            tagPartnership: t("tagPartnership"),
            tagStudy: t("tagStudy"),
            tagProduct: t("tagProduct"),
            tagMilestone: t("tagMilestone"),
            read: t("releasesRead"),
            empty: t("releasesEmpty"),
            downloadPdf: isFr ? "Télécharger le PDF" : "Download PDF",
          }}
        />
      </Section>

      {/* TÉMOIGNAGES VÉRIFIÉS (Sprint v7 Phase 15 / F5) — section invisible
          si aucun real testimonial n'a été marqué côté admin. Affiche
          uniquement les testimonials avec source vérifiable + consentement
          RGPD documenté (cf. `markAsRealTestimonial`). */}
      {realTestimonials.length > 0 ? (
        <Section
          id="temoignages-verifies"
          tone="paper"
          title={isFr ? "Témoignages vérifiés" : "Verified testimonials"}
          description={
            isFr
              ? "Témoignages clients dont la source est identifiable et le consentement RGPD documenté."
              : "Client testimonials with identifiable source and documented GDPR consent."
          }
        >
          <Container>
            <ul className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2">
              {realTestimonials.map((rt) => (
                <li key={rt.id} className="border-border bg-canvas rounded-lg border p-6 shadow-sm">
                  <blockquote className="text-fg text-base leading-relaxed">
                    “{rt.shortQuoteFr}”
                  </blockquote>
                  <footer className="text-fg-soft mt-4 text-sm">
                    <div className="font-medium">
                      {rt.firstName} {rt.lastName}
                    </div>
                    {rt.role || rt.company ? (
                      <div>
                        {rt.role ?? ""}
                        {rt.role && rt.company ? " · " : ""}
                        {rt.company ?? ""}
                      </div>
                    ) : null}
                    <a
                      href={rt.realMeta.source}
                      target="_blank"
                      rel="noopener nofollow"
                      className="text-terracotta mt-2 inline-block underline"
                    >
                      {isFr ? "Source vérifiable →" : "Verifiable source →"}
                    </a>
                  </footer>
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}

      {/* COUVERTURE MÉDIAS — section ENTIÈREMENT masquée tant qu'aucune retombée
          n'est publiée depuis la console admin (décision Will 2026-06-23 :
          pas de bloc « à venir » vide). Gérée dans Admin → Salle de presse →
          Couverture médias. */}
      {coverage.length > 0 ? (
        <Section
          id="couverture"
          tone="canvas"
          eyebrow={t("coverageEyebrow")}
          title={t("coverageTitle")}
          titleEm={t("coverageTitleEm")}
          titleTail={t("coverageTitleTail")}
          description={t("coverageDescription")}
        >
          <MediaCoverage
            items={coverage}
            locale={loc}
            labels={{
              empty: t("coverageEmpty"),
              readArticle: t("coverageReadArticle"),
            }}
          />
        </Section>
      ) : null}

      {/* DEMANDE PRESSE — formulaire unifié (defaultType=presse, lockType).
          Form v2 2026-05-28 : remplace le mailto historique par une demande
          structurée trackée en Submission + Telegram canal presse. Le bandeau
          PressContact ci-dessous garde l'email visible + délais SLA pour les
          journalistes qui préfèrent le raw email. */}
      <Section
        id="presse-form"
        tone="paper"
        eyebrow={isFr ? "Contactez la rédaction Axion-IA" : "Contact Axion-IA newsroom"}
        title={isFr ? "Envoyer une" : "Send a"}
        titleEm={isFr ? "demande presse" : "press request"}
        description={
          isFr
            ? "Interview, presskit, citation, podcast, fact-check — décrivez votre demande, on revient sous 48 h ouvrées avec une réponse personnalisée."
            : "Interview, presskit, quote, podcast, fact-check — describe your request and we get back within 48 business hours with a personalized reply."
        }
      >
        <Container>
          <div className="mx-auto max-w-3xl">
            <UnifiedContactForm defaultType="presse" lockType source="/presse" />
          </div>
        </Container>
      </Section>

      {/* CONTACT presse — bandeau mocha avec mailto + 3 facts */}
      <PressContact
        labels={{
          eyebrow: t("contactEyebrow"),
          title: t("contactTitle"),
          titleEm: t("contactTitleEm"),
          titleTail: t("contactTitleTail"),
          description: t("contactDescription"),
          cta: t("contactCta"),
          email: t("contactEmail"),
          subjectLabel: t("contactSubject"),
          responseTimeLabel: t("contactResponseTimeLabel"),
          responseTimeValue: t("contactResponseTimeValue"),
          languagesLabel: t("contactLanguagesLabel"),
          languagesValue: t("contactLanguagesValue"),
        }}
      />

      {/* FAQ presse — réutilise FaqBlock (auto FAQPage JSON-LD) — désactivé ici
         car nous émettons notre propre FAQPage via `faqJsonLd` plus bas. */}
      <FaqBlock
        eyebrow={t("faqEyebrow")}
        title={
          <>
            {t("faqTitle")}
            <span
              className="text-terracotta mx-2 italic"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {t("faqTitleEm")}
            </span>
            {t("faqTitleTail")}
          </>
        }
        description={t("faqDescription")}
        items={faqItems}
        emitJsonLd={false}
        tone="canvas"
      />

      {/* JSON-LD payloads — émis une seule fois, en bas de page */}
      <JsonLd data={pressJsonLd} />
      <JsonLd data={faqJsonLd} />
      {releasesItemList ? <JsonLd data={releasesItemList} /> : null}
      <JsonLd data={pressImagesJsonLd} />
    </>
  );
}
