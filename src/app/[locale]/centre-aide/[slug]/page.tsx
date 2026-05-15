import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Compass, Clock, RefreshCw, Quote } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { AnswerCard } from "@/components/marketing/AnswerCard";
import { AiContentDisclaimer } from "@/components/marketing/AiContentDisclaimer";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { getHelpArticle, getAllHelpSlugs, HELP_ARTICLES, slugify } from "@/content/transversal";
import { buildProductMetadata, BUILD_DATE } from "@/lib/seo";
import { buildArticleJsonLd } from "@/lib/seo-content-gen-factories";
import { splitTitleEm } from "@/lib/title";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

/**
 * Dérive le texte TL;DR (Canonical Answer pattern AEO/GEO 2026 § 3.5).
 * Priorité : `excerpt` (curé éditorialement) → fallback 2 premières phrases
 * du body. Retourne `null` si rien d'exploitable.
 */
function deriveTldr(excerpt: string | null | undefined, body: string): string | null {
  const trimmed = (excerpt ?? "").trim();
  if (trimmed.length > 0) return trimmed;
  const sentences = body
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-ZÀÉÈÔÎÊ])/)
    .filter((s) => s.length > 0)
    .slice(0, 2)
    .join(" ");
  return sentences.length > 0 ? sentences : null;
}

export function generateStaticParams() {
  return getAllHelpSlugs().flatMap((slug) => routing.locales.map((locale) => ({ locale, slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const article = getHelpArticle(slug);
  if (!article) return {};
  const copy = article[locale as Locale];
  return buildProductMetadata({
    locale,
    path: `/centre-aide/${slug}`,
    title: `${copy.title} · ${locale === "fr" ? "Aide Axion-IA" : "Axion-IA help"}`,
    description: copy.excerpt,
    alternates: { fr: `/centre-aide/${slug}`, en: `/help/${slug}` },
  });
}

export default async function HelpArticlePage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const article = getHelpArticle(slug);
  if (!article) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const copy = article[loc];

  // Article Schema — generic help article (HowTo would be possible if step-based).
  // datePublished + dateModified ajoutés (audit AEO/GEO 2026-05-15 §3.4) :
  // signal fraîcheur AEO Google + Perplexity. `BUILD_DATE` est stable par build
  // (vs new Date() runtime qui mentirait sur chaque cold-start worker).
  //
  // Méta-cert 2026-05-15 AGENT 20 P0 — passage par `buildArticleJsonLd` factory
  // pour injecter creator + disambiguatingDescription + usageInfo + speakable
  // (AI Act EU art. 50 machine-readable disclosure).
  const articleJsonLd = buildArticleJsonLd({
    title: copy.title,
    description: copy.excerpt,
    slug,
    locale: loc,
    publishedAt: BUILD_DATE,
    updatedAt: BUILD_DATE,
    urlSegment: "centre-aide",
    section: article.category,
  });

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [
    { href: "/centre-aide", label: isFr ? "Centre d'aide" : "Help center" },
    { href: `/centre-aide/${slug}`, label: copy.title },
  ];

  // Suggested neighbours — same category first.
  const others = HELP_ARTICLES.filter((a) => a.slug !== article.slug)
    .sort((a) => (slugify(a.category) === slugify(article.category) ? -1 : 1))
    .slice(0, 4);

  // TL;DR Canonical Answer (audit AEO/GEO 2026-05-15 § 3.5).
  const tldrText = deriveTldr(copy.excerpt, copy.body);

  return (
    <>
      {/* P1-17 — alternate format markdown brut pour LLM ingestion. */}
      <link rel="alternate" type="text/markdown" href={`/api/markdown/centre-aide/${slug}`} />
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      {(() => {
        const t = splitTitleEm(copy.title);
        const wordCount = copy.body.trim().split(/\s+/).length;
        const readMin = Math.max(1, Math.ceil(wordCount / 200));
        return (
          <Section
            titleAs="h1"
            eyebrow={article.category}
            title={t.lead}
            titleEm={t.em}
            description={copy.excerpt}
          >
            <Container className="mt-8 max-w-2xl">
              <ul className="flex flex-wrap gap-x-5 gap-y-2.5">
                {[
                  { icon: Compass, label: article.category },
                  { icon: Clock, label: isFr ? `Lecture ${readMin} min` : `${readMin} min read` },
                  { icon: Quote, label: isFr ? "Réponse courte" : "Short answer" },
                  { icon: RefreshCw, label: isFr ? "MAJ trimestrielle" : "Quarterly updates" },
                ].map((pill) => {
                  const Icon = pill.icon;
                  return (
                    <li
                      key={pill.label}
                      className="text-fg-soft inline-flex items-center gap-2 text-sm"
                    >
                      <Icon
                        aria-hidden="true"
                        className="text-terracotta h-4 w-4"
                        strokeWidth={2}
                      />
                      <span>{pill.label}</span>
                    </li>
                  );
                })}
              </ul>
            </Container>
          </Section>
        );
      })()}

      {tldrText ? (
        <Section>
          <Container className="max-w-3xl">
            <AnswerCard locale={loc} question={copy.title}>
              {tldrText}
            </AnswerCard>
          </Container>
        </Section>
      ) : null}

      <Section>
        <Container className="max-w-3xl">
          <div className="prose prose-slate text-fg-soft max-w-none space-y-5 text-base leading-relaxed">
            {/* Body multi-paragraphes (cohérent /blog[slug]/comparaisons[slug]) :
                split par phrase pour densité éditoriale. Single sentence = 1 <p>. */}
            {copy.body
              .trim()
              .split(/(?<=\.)\s+(?=[A-ZÀÉÈÔÎ])/)
              .filter(Boolean)
              .map((p, i) => (
                <p key={`b-${i}`}>{p}</p>
              ))}
          </div>
        </Container>
      </Section>

      <Section>
        <Container className="max-w-3xl">
          <AiContentDisclaimer locale={loc} />
        </Container>
      </Section>

      <Section eyebrow={isFr ? "Voir aussi" : "See also"}>
        <Container className="max-w-3xl">
          <ul className="border-border divide-border divide-y border-y">
            {others.map((o) => (
              <li key={o.slug}>
                <a
                  href={`/${locale}/centre-aide/${o.slug}`}
                  className="text-fg hover:text-primary block py-4 text-base font-medium"
                >
                  {o[loc].title} →
                </a>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <CtaBlock
        title={isFr ? "Question pas couverte ?" : "Question not covered?"}
        description={
          isFr
            ? "Contactez-nous — réponse sous 48 h ouvrées."
            : "Contact us — reply within 48 business hours."
        }
        cta={
          <Cta href="/contact" size="lg">
            Contact →
          </Cta>
        }
      />

      <JsonLd data={articleJsonLd} />
    </>
  );
}
