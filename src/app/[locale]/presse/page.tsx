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
import { Illustration } from "@/components/visual/Illustration";
import { FaqBlock } from "@/components/sections/FaqBlock";
import { PressFacts } from "@/components/sections/PressFacts";
import { PressKit } from "@/components/sections/PressKit";
import { PressReleases } from "@/components/sections/PressReleases";
import { MediaCoverage } from "@/components/sections/MediaCoverage";
import { PressSpokesperson } from "@/components/sections/PressSpokesperson";
import { PressContact } from "@/components/sections/PressContact";
import {
  PRESS_PITCH,
  PRESS_FACTS,
  PRESS_KIT_ASSETS,
  PRESS_RELEASES,
  PRESS_MEDIA_COVERAGE,
  PRESS_SPOKESPERSONS,
  PRESS_FAQ,
} from "@/content/press";
import {
  buildProductMetadata,
  buildBreadcrumbJsonLd,
  buildFaqSpeakableJsonLd,
  SITE_URL,
} from "@/lib/seo";

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

export default async function PressePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const t = await getTranslations({ locale: loc, namespace: "press" });
  const pitch = PRESS_PITCH[loc];

  const facts = PRESS_FACTS.map((f) => ({
    id: f.id,
    label: f[loc].label,
    value: f[loc].value,
  }));

  const kitItems = PRESS_KIT_ASSETS.map((k) => ({
    id: k.id,
    kind: k.kind,
    fileUrl: k.fileUrl,
    format: k.format,
    title: k[loc].title,
    description: k[loc].description,
  }));

  const releases = PRESS_RELEASES.map((r) => ({
    slug: r.slug,
    publishedAt: r.publishedAt,
    tag: r.tag,
    title: r[loc].title,
    dek: r[loc].dek,
  }));

  const coverage = PRESS_MEDIA_COVERAGE.map((m) => ({
    id: m.id,
    outlet: m.outlet,
    url: m.url,
    publishedAt: m.publishedAt,
    title: m[loc].title,
  }));

  const spokespersons = PRESS_SPOKESPERSONS.map((p) => ({
    id: p.id,
    name: p[loc].name,
    role: p[loc].role,
    bio: p[loc].bio,
    linkedinUrl: p.linkedinUrl,
    languagesLabel: p.languages.map((l) => l.toUpperCase()).join(" · "),
  }));

  const faqItems = PRESS_FAQ.map((f) => ({
    id: f.id,
    question: f[loc].question,
    answer: f[loc].answer,
  }));

  const pressPath = isFr ? "/presse" : "/press";
  const pageUrl = `${SITE_URL}/${loc}${pressPath}`;

  const breadcrumb = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: isFr ? "Espace presse" : "Press room", href: "/presse" },
    ],
  });

  // WebPage + NewsroomPage signal — speakable on the boilerplate paragraph
  // (citable LLM block) and the AEO direct-answer pitch.
  const pressJsonLd = {
    "@context": "https://schema.org",
    "@type": ["WebPage", "NewsroomPage"],
    "@id": pageUrl,
    url: pageUrl,
    name: t("metaTitle"),
    description: t("metaDescription"),
    inLanguage: isFr ? "fr-FR" : "en-US",
    isPartOf: { "@type": "WebSite", "@id": `${SITE_URL}/#website` },
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["#press-pitch", "#press-boilerplate"],
    },
    about: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "AxionIA OÜ",
      url: SITE_URL,
      foundingDate: "2024",
      address: {
        "@type": "PostalAddress",
        addressCountry: "EE",
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

  const personsJsonLd = PRESS_SPOKESPERSONS.map((p) => ({
    "@context": "https://schema.org",
    "@type": "Person",
    name: p[loc].name,
    jobTitle: p[loc].role,
    description: p[loc].bio,
    sameAs: [p.linkedinUrl],
    knowsAbout: [...p.knowsAbout],
    knowsLanguage: p.languages.map((l) => (l === "fr" ? "French" : "English")),
    worksFor: { "@type": "Organization", name: "AxionIA OÜ", url: SITE_URL },
  }));

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
              inLanguage: isFr ? "fr-FR" : "en-US",
              author: { "@type": "Organization", name: "AxionIA OÜ" },
              publisher: { "@type": "Organization", name: "AxionIA OÜ", url: SITE_URL },
              image: `${SITE_URL}/og/og-axionia.png`,
            },
          })),
        }
      : null;

  const faqJsonLd = buildFaqSpeakableJsonLd({ items: faqItems });

  return (
    <>
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

      {/* HERO ILLUSTRATION — placeholder Sprint Visual Rhythm 2026 */}
      <Section>
        <Container>
          <div className="mx-auto max-w-4xl">
            <Illustration
              slot="PRESSE-01-hero"
              aspectRatio="16:9"
              filenameTarget="public/illustrations/presse-hero.avif"
              caption={
                isFr
                  ? "Vitrine éditoriale magazine — Une de presse premium"
                  : "Editorial magazine front — premium press cover"
              }
              alt={
                isFr
                  ? "Illustration éditoriale d'une vitrine de magazine premium symbolisant l'espace presse AxionIA."
                  : "Editorial illustration of a premium magazine front symbolizing the AxionIA press room."
              }
              priority
            />
          </div>
        </Container>
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
          <div className="max-w-2xl space-y-6">
            <p
              id="press-pitch"
              className="text-fg text-lg leading-relaxed sm:text-xl"
              style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
            >
              {pitch.short}
            </p>
            <p id="press-boilerplate" className="text-fg-soft text-base leading-relaxed">
              {pitch.boilerplate}
            </p>
          </div>
          <PressFacts eyebrow={t("factsEyebrow")} facts={facts} />
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
        <PressKit
          items={kitItems}
          labels={{
            download: t("kitDownload"),
            comingSoon: t("kitComingSoon"),
          }}
        />
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
          }}
        />
      </Section>

      {/* PORTE-PAROLE */}
      <Section
        id="porte-parole"
        tone="paper"
        eyebrow={t("spokespersonEyebrow")}
        title={t("spokespersonTitle")}
        titleEm={t("spokespersonTitleEm")}
        titleTail={t("spokespersonTitleTail")}
        description={t("spokespersonDescription")}
      >
        <PressSpokesperson
          spokespersons={spokespersons}
          labels={{
            available: t("spokespersonAvailable"),
            responseTime: t("spokespersonResponseTime"),
            linkedin: t("spokespersonLinkedin"),
            languagesLabel: t("spokespersonLanguages"),
          }}
        />
      </Section>

      {/* COUVERTURE MÉDIAS */}
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
      <JsonLd data={breadcrumb} />
      <JsonLd data={faqJsonLd} />
      {personsJsonLd.map((p, idx) => (
        <JsonLd key={`person-${idx}`} data={p} />
      ))}
      {releasesItemList ? <JsonLd data={releasesItemList} /> : null}
    </>
  );
}
