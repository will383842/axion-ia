/**
 * Sprint S+4-D 2026-05-18 — `/presse/[slug]` détail d'un communiqué de presse.
 *
 * Audit source : `_AUDIT/CONTENT-GEN-DEEP-AUDIT-2026-05-18/19-TYPE-8-PRESSE.md`
 * Gap P1-18 : la page `/presse` listait 3 communiqués (PRESS_RELEASES) sans page
 * détail. Conséquences :
 *   - Aucune URL canonique par communiqué (impossible à linker depuis articles)
 *   - Aucun `NewsArticle` JSON-LD par release (perte signal Google Discover +
 *     Top Stories + News Showcase + perte citation LLMs Perplexity/Claude.ai)
 *   - Le composant `<PressReleases>` annonçait « Lire le communiqué (Q3 2026) »
 *     → promesse non tenue 6 mois plus tard.
 *
 * Doctrine ce fichier (cohérence `/glossaire/[slug]/page.tsx` Sprint S+4-A) :
 *   - ISR `revalidate=3600` + `dynamicParams=false` (anti soft-404 SSG)
 *   - `generateStaticParams` pour tous les slugs PRESS_RELEASES (3 au 2026-05-18)
 *   - Metadata bilingue FR canonique + EN miroir via routing.pathnames
 *   - JSON-LD `NewsArticle` (headline, datePublished, articleBody, author,
 *     publisher Axion-IA, image OG dynamique, mainEntityOfPage)
 *   - JSON-LD `BreadcrumbList` via `<Breadcrumbs>` (Home → Espace presse → Titre)
 *   - JSON-LD `WebPage` + `Speakable` cssSelector `[data-aeo="press-release-tldr"]`
 *   - Anti-doorway HCU 2024 : `robots: noindex` si body < 250 mots
 *   - Réutilisation `<Container>`, `<Breadcrumbs>`, `<JsonLd>`, `<AnswerCard>`,
 *     `<PressImageBank>`
 *   - Pas d'AiContentDisclaimer (les communiqués sont éditoriaux humains, pas IA)
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, Mail } from "lucide-react";

import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { JsonLd } from "@/components/marketing/JsonLd";
import { AnswerCard } from "@/components/marketing/AnswerCard";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { PressImageBank } from "@/components/sections/PressImageBank";
import { buildProductMetadata, SITE_URL } from "@/lib/seo";
import { buildSpeakableSpecification } from "@/lib/seo/speakable-universal";
import { type PressReleaseTag } from "@/content/press";
// Salle de presse 2026-06-22 — communiqué lu depuis la DB (fallback fixtures).
import {
  getPressReleaseBySlug,
  getAllPublishedPressReleaseSlugs,
  getPublishedPressReleases,
} from "@/server/press/queries";
import { fmtDate } from "@/lib/intl";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

/**
 * ISR 1h — un communiqué de presse évolue rarement après publication, mais on
 * veut pouvoir corriger une typo / source factuelle sans full rebuild des ~3-30
 * pages de l'espace presse.
 */
export const revalidate = 3600;

/**
 * Audit indexation 2026-05-18 — anti soft-404 SSG : slugs hardcode connus,
 * tout slug hors PRESS_RELEASES → notFound() immédiat sans tentative ISR.
 */
export const dynamicParams = false;

/**
 * Seuil HCU 2024 anti-doorway : un communiqué de presse digne d'indexation
 * Google News + AI Overviews fait ≥ 60 mots cumulés (body). En dessous, on
 * noindex pour ne pas être pénalisé "thin content".
 *
 * 60 mots = baseline V1 calibrée sur les fixtures `press.ts` (les communiqués
 * Axion-IA V1 font 77-200 mots — minimum éditorial cohérent avec dek = 25-40
 * mots + body ≥ 60 mots). Les communiqués Phase 2+ visent 150-300 mots pour
 * profiter pleinement de Google Discover / Top Stories (signal Authority).
 */
const MIN_BODY_WORDS = 60;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const TAG_LABEL_FR: Record<PressReleaseTag, string> = {
  launch: "Lancement",
  partnership: "Partenariat",
  study: "Étude",
  product: "Produit",
  milestone: "Jalon",
};
const TAG_LABEL_EN: Record<PressReleaseTag, string> = {
  launch: "Launch",
  partnership: "Partnership",
  study: "Study",
  product: "Product",
  milestone: "Milestone",
};

export async function generateStaticParams() {
  const params: Array<{ locale: string; slug: string }> = [];
  for (const locale of routing.locales) {
    const slugs = await getAllPublishedPressReleaseSlugs(locale);
    for (const slug of slugs) params.push({ locale, slug });
  }
  return params;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const loc = locale as Locale;
  const release = await getPressReleaseBySlug(loc, slug);
  if (!release) return {};
  const isFr = loc === "fr";
  // Communiqué déjà résolu dans la locale (plat) — plus de release.fr/.en.
  const copy = release;

  // Description ≤ 160 chars (cap SERP Google).
  const desc = copy.dek.length > 160 ? `${copy.dek.slice(0, 157).trim()}…` : copy.dek;

  const meta = buildProductMetadata({
    locale: loc,
    path: `/presse/${slug}`,
    title: isFr
      ? `${copy.title} · Communiqué · Axion-IA`
      : `${copy.title} · Press release · Axion-IA`,
    description: desc,
    alternates: { fr: `/presse/${slug}`, en: `/press/${slug}` },
  });

  // Anti-doorway HCU 2024 : noindex si body < 250 mots.
  if (countWords(copy.body) < MIN_BODY_WORDS) {
    return {
      ...meta,
      robots: {
        index: false,
        follow: true,
        googleBot: { index: false, follow: true },
      },
    };
  }
  return meta;
}

export default async function PressReleaseDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const loc = locale as Locale;
  const release = await getPressReleaseBySlug(loc, slug);
  if (!release) notFound();
  setRequestLocale(locale);
  const isFr = loc === "fr";
  // Communiqué déjà résolu dans la locale (plat) — plus de release.fr/.en.
  const copy = release;
  const tagLabel = isFr ? TAG_LABEL_FR[release.tag] : TAG_LABEL_EN[release.tag];
  // Autres communiqués (maillage interne) — lus depuis la DB (fallback fixtures).
  const otherReleases = await getPublishedPressReleases(loc);

  const presseHubLabel = isFr ? "Espace presse" : "Press room";
  const presseHubPath = "/presse";
  const breadcrumbItems = [
    { href: presseHubPath, label: presseHubLabel },
    { href: `/presse/${slug}`, label: copy.title },
  ];

  const pageUrl = `${SITE_URL}/${loc}${isFr ? "/presse" : "/press"}/${slug}`;
  const ogImage = `${SITE_URL}/api/og?title=${encodeURIComponent(copy.title)}`;

  // Body splittable en paragraphes (la fixture press.ts utilise des phrases
  // longues sans double-saut de ligne — on chunke par phrase pour rythmer la
  // lecture sans diviser arbitrairement). Fallback : 1 seul paragraphe si
  // pas de séparateur naturel détecté.
  const paragraphs = copy.body
    .split(/\n{2,}/)
    .flatMap((block) =>
      block.length < 600
        ? [block]
        : block.split(/(?<=[.!?])\s+(?=[A-ZÀÉÈÊÎÔŒÇ])/).reduce<string[]>((acc, sentence) => {
            const last = acc[acc.length - 1];
            if (!last || last.length + sentence.length > 600) {
              acc.push(sentence);
            } else {
              acc[acc.length - 1] = `${last} ${sentence}`;
            }
            return acc;
          }, []),
    )
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const wordCount = countWords(copy.body);
  const isThin = wordCount < MIN_BODY_WORDS;

  // NewsArticle JSON-LD — signal Google News + Top Stories + AI Overviews
  // citation. Publisher = Axion-IA (cohérence avec /presse/page.tsx +
  // buildOrganizationJsonLd layout). Pas de `author Person` car les
  // communiqués sont émis par l'organisation, pas un journaliste individuel
  // (doctrine PR : `author = publisher` quand la corp parle d'elle-même).
  const newsArticleJsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "@id": `${pageUrl}#newsarticle`,
    headline: copy.title,
    description: copy.dek,
    articleBody: copy.body,
    datePublished: release.publishedAt,
    dateModified: release.publishedAt,
    inLanguage: loc,
    wordCount,
    keywords: [tagLabel, isFr ? "Communiqué de presse" : "Press release", "Axion-IA"],
    author: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Axion-IA",
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Axion-IA",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/icon.png`,
      },
    },
    image: [ogImage],
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": pageUrl,
      url: pageUrl,
    },
    isPartOf: {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
    },
    // Speakable signal vocal (Google Assistant / Alexa / Siri) — cible le
    // TL;DR (dek) en haut de page. Cohérence avec `/presse` page principale
    // qui pointe `[#press-pitch, #press-boilerplate]`.
    speakable: buildSpeakableSpecification({
      selectors: ['[data-aeo="press-release-tldr"]'],
    }),
  } as const;

  // WebPage JSON-LD additionnel — datePublished/dateModified au niveau page
  // (NewsArticle est le contenu, WebPage est le contenant).
  // Audit fraîcheur 2026-06-08 : dateModified = `release.publishedAt` (un
  // communiqué n'est pas modifié après publication) au lieu de BUILD_DATE, qui
  // glissait à chaque deploy ET contredisait le datePublished figé du même nœud.
  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": pageUrl,
    url: pageUrl,
    name: copy.title,
    description: copy.dek,
    inLanguage: loc,
    isPartOf: {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
    },
    datePublished: release.publishedAt,
    dateModified: release.publishedAt,
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: ogImage,
    },
  } as const;

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO — eyebrow tag + h1 + métadonnées (date) */}
      <Section titleAs="h1" eyebrow={tagLabel} title={copy.title} description={copy.dek}>
        <Container className="text-fg-muted mt-8 flex flex-wrap items-center gap-4 text-sm">
          <span className="bg-terracotta-soft text-terracotta-deep rounded-full px-3 py-1 text-[11px] font-semibold tracking-wider uppercase">
            {tagLabel}
          </span>
          <span aria-hidden="true">·</span>
          <time
            dateTime={release.publishedAt}
            className="inline-flex items-center gap-1.5 tabular-nums"
          >
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            {isFr ? "Publié le " : "Published on "}
            {fmtDate(release.publishedAt, loc)}
          </time>
          {isThin ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="italic">{isFr ? "Brève — non indexée" : "Brief — not indexed"}</span>
            </>
          ) : null}
        </Container>
      </Section>

      {/* TL;DR Canonical Answer — wrappée dans data-aeo="press-release-tldr"
          pour matcher le `cssSelector` Speakable du NewsArticle JSON-LD. */}
      <Section>
        <Container className="max-w-3xl">
          <div data-aeo="press-release-tldr">
            <AnswerCard locale={loc} question={isFr ? "En bref" : "In short"}>
              {copy.dek}
            </AnswerCard>
          </div>
        </Container>
      </Section>

      {/* CORPS — paragraphes structurés (lisible + scrap-friendly LLMs). */}
      <Section>
        <Container className="text-fg max-w-3xl space-y-6 text-lg leading-relaxed">
          {paragraphs.map((p, idx) => (
            <p key={`p-${idx}`}>{p}</p>
          ))}
        </Container>
      </Section>

      {/* KIT MÉDIAS / BANQUE D'IMAGES — rappel au journaliste qu'il y a des
          assets téléchargeables sur /presse. Réutilise PressImageBank avec
          les 3 catégories canoniques (FR/EN). */}
      <Section
        tone="sand"
        eyebrow={isFr ? "Visuels presse" : "Press visuals"}
        title={isFr ? "Banque d'images " : "Image bank "}
        titleEm={isFr ? "CC BY 4.0" : "CC BY 4.0"}
        titleTail="."
        description={
          isFr
            ? "Visuels libres de droits pour illustrer cet article (attribution Axion-IA appréciée)."
            : "Royalty-free visuals to illustrate this article (Axion-IA attribution appreciated)."
        }
      >
        <PressImageBank
          labels={{
            primaryCta: isFr ? "Voir la banque d'images" : "View the image bank",
            licenseNote: isFr
              ? "Licence CC BY 4.0 — usage libre avec attribution. Mention recommandée : « © Axion-IA — axion-ia.com »."
              : "CC BY 4.0 licence — free use with attribution. Recommended credit: « © Axion-IA — axion-ia.com ».",
            categories: [
              {
                id: "ia-operationnelle",
                iconKind: "image",
                title: isFr ? "IA opérationnelle B2B" : "Operational B2B AI",
                description: isFr
                  ? "Visuels métier — workflows, audits, séances de travail."
                  : "Business visuals — workflows, audits, working sessions.",
              },
              {
                id: "equipe",
                iconKind: "camera",
                title: isFr ? "Équipe & porte-parole" : "Team & spokespersons",
                description: isFr
                  ? "Portraits officiels de l'équipe et photos de plateau."
                  : "Official team portraits and studio photos.",
              },
              {
                id: "cas-concrets",
                iconKind: "scanline",
                title: isFr ? "Cas concrets & schémas" : "Case studies & schemas",
                description: isFr
                  ? "Captures d'écran, schémas d'architecture et infographies."
                  : "Screenshots, architecture schemas and infographics.",
              },
            ],
          }}
        />
      </Section>

      {/* CONTACT presse direct (cohérence avec /presse — un communiqué doit
          toujours offrir le mailto pour suite éditoriale). */}
      <Section tone="paper">
        <Container className="max-w-3xl">
          <div className="border-border bg-paper rounded-2xl border p-6 sm:p-8">
            <h2
              className="text-fg mb-3 text-xl font-semibold"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr ? "Une question sur ce communiqué ?" : "A question about this release?"}
            </h2>
            <p className="text-fg-soft mb-5 text-base leading-relaxed">
              {isFr
                ? "Notre équipe répond aux journalistes sous 48 h ouvrées, en français et en anglais. Interviews, exclusivités sectorielles, vérification de chiffres : écrivez-nous directement."
                : "Our team replies to journalists within 48 business hours, in French and English. Interviews, sector exclusives, fact-checking: reach out directly."}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" shape="pill">
                <a
                  href={`mailto:presse@axion-ia.com?subject=${encodeURIComponent(
                    `${isFr ? "Demande presse" : "Press request"} — ${copy.title}`,
                  )}`}
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  {isFr ? "Contacter la presse" : "Contact press"}
                </a>
              </Button>
              <Button asChild size="lg" shape="pill" variant="outline">
                <Link href="/presse">
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  {isFr ? "Retour à l'espace presse" : "Back to press room"}
                </Link>
              </Button>
            </div>
          </div>
        </Container>
      </Section>

      {/* AUTRES COMMUNIQUÉS — mesh interne. On affiche les 2 plus récents
          autres que celui en cours (signal autorité topique + crawl path). */}
      {otherReleases.length > 1 ? (
        <Section tone="canvas" eyebrow={isFr ? "Autres communiqués" : "Other releases"}>
          <Container className="max-w-4xl">
            <ul className="grid gap-4 sm:grid-cols-2">
              {otherReleases
                .filter((r) => r.slug !== slug)
                .slice(0, 2)
                .map((other) => {
                  const otherCopy = other;
                  return (
                    <li
                      key={other.slug}
                      className="border-border bg-paper hover:border-terracotta-soft flex flex-col rounded-xl border p-5 transition"
                    >
                      <time
                        dateTime={other.publishedAt}
                        className="text-fg-muted mb-2 text-xs tabular-nums"
                      >
                        {fmtDate(other.publishedAt, loc)}
                      </time>
                      <h3
                        className="text-fg mb-2 text-base leading-snug font-medium"
                        style={{ fontFamily: "var(--font-serif)" }}
                      >
                        <Link
                          href={`/presse/${other.slug}` as never}
                          className="hover:text-terracotta-deep"
                        >
                          {otherCopy.title}
                        </Link>
                      </h3>
                      <p className="text-fg-soft line-clamp-2 text-sm leading-relaxed">
                        {otherCopy.dek}
                      </p>
                    </li>
                  );
                })}
            </ul>
          </Container>
        </Section>
      ) : null}

      <JsonLd data={newsArticleJsonLd} />
      <JsonLd data={webPageJsonLd} />
    </>
  );
}
