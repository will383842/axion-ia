/**
 * Detail `/fr/connaissances/[slug]` — KB V4 publique.
 *
 * P1-18 audit E2E NAV+CTA 2026-05-15 — toute lecture passe par
 * `fetchPublicKbBySlug` qui applique triple filtre strict (status=published
 * + audience=public + confidentiality=public + deletedAt=null + publishedAt
 * <= now + embargo respect). Si slug inconnu OU entry non-publique → 404
 * (jamais de leak draft).
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { JsonLd } from "@/components/marketing/JsonLd";
import { AiContentDisclaimer } from "@/components/marketing/AiContentDisclaimer";
import { buildProductMetadata } from "@/lib/seo";
import { buildArticleJsonLd } from "@/lib/seo-content-gen-factories";
import { fetchPublicKbBySlug } from "@/lib/knowledge/public-fetch";
import { getServiceForEntrySlug } from "@/lib/knowledge/readers";
import { ServiceOfferBlock } from "@/components/services/ServiceOfferBlock";
import { sanitizeTiptapHtml } from "@/lib/knowledge/tiptap-sanitize";
import { SuggestedContent } from "@/components/suggested/SuggestedContent";
import { findRelatedArticles } from "@/server/content-gen/links/related-articles";

export const revalidate = 3600;
export const dynamicParams = true;

// Libellés FR propres pour le type d'entrée KB (au lieu du slug brut
// "industry_use_case" → "industry use case"). Défaut sobre « Ressource ».
const TYPE_LABEL: Readonly<Record<string, string>> = {
  fact: "Donnée clé",
  industry_use_case: "Cas d'usage",
  case_study: "Cas concret",
  guide: "Guide",
  comparison: "Comparatif",
  faq: "Question fréquente",
  glossary_term: "Définition",
  tool_review: "Outils",
  automation_recipe: "Automatisation",
  roi_calculator_template: "ROI",
  implementation_playbook: "Méthode",
  secteur_brief: "Secteur",
  dept_brief: "Fonction",
  metier_brief: "Métier",
  competence_boost: "Compétence",
};

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  if (locale !== "fr") return { robots: { index: false, follow: false } };
  const entry = await fetchPublicKbBySlug(slug);
  if (!entry) return { robots: { index: false, follow: false } };
  return buildProductMetadata({
    locale,
    path: `/connaissances/${slug}`,
    title: entry.metaTitle ?? `${entry.title} · Axion-IA`,
    description:
      entry.metaDescription ??
      entry.excerpt ??
      `Article de la base de connaissances Axion-IA — ${entry.title}.`,
    alternates: { fr: `/connaissances/${slug}`, en: `/connaissances/${slug}` },
  });
}

function formatDate(date: Date | null): string | undefined {
  if (!date) return undefined;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default async function ConnaissanceDetail({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  if (locale !== "fr") notFound();
  setRequestLocale(locale);

  const entry = await fetchPublicKbBySlug(slug);
  if (!entry) notFound();

  // KB V4.1 Service Binding — service rattaché (tag service:*) → CTA + Offer.
  const service = await getServiceForEntrySlug(slug);

  const publishedStr = formatDate(entry.publishedAt);
  const updatedStr = formatDate(entry.updatedAt);
  const typeLabel = TYPE_LABEL[String(entry.type)] ?? "Ressource";
  // Évite la répétition titre = excerpt (fréquent sur les entrées "fact").
  const ex = entry.excerpt?.trim();
  const showExcerpt = Boolean(
    ex && !ex.toLowerCase().startsWith(entry.title.trim().slice(0, 24).toLowerCase()),
  );

  const articleJsonLd = buildArticleJsonLd({
    title: entry.title,
    description: entry.excerpt ?? entry.title,
    slug: entry.slug,
    locale: "fr",
    publishedAt: entry.publishedAt ?? entry.updatedAt,
    updatedAt: entry.updatedAt,
    section: "Connaissances IA",
    urlSegment: "connaissances",
    ...(entry.readingTime ? { readingTimeMinutes: entry.readingTime } : {}),
  });

  return (
    <>
      <Section tone="paper" className="pt-8 lg:pt-12">
        <Container>
          <Breadcrumbs
            items={[
              { href: "/connaissances", label: "Connaissances" },
              { href: `/connaissances/${entry.slug}`, label: entry.title },
            ]}
          />
        </Container>
      </Section>

      <Section tone="paper" className="pt-6 pb-16 lg:pt-10 lg:pb-24">
        <Container>
          <article className="mx-auto max-w-3xl">
            <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
              <span className="text-terracotta-deep inline-flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="bg-terracotta inline-block h-1.5 w-1.5 rounded-full"
                />
                {typeLabel}
              </span>
            </p>
            <h1
              className="text-fg text-[clamp(1.875rem,3.4vw,2.75rem)] leading-[1.12] font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {entry.title}
            </h1>
            <p className="text-fg-muted mt-5 text-[13px]">
              {publishedStr ? <>Publié le {publishedStr}</> : null}
              {updatedStr && updatedStr !== publishedStr ? (
                <> · mis à jour le {updatedStr}</>
              ) : null}
              {entry.readingTime ? <> · {entry.readingTime} min de lecture</> : null}
            </p>
            <div aria-hidden="true" className="bg-terracotta mt-8 h-0.5 w-16" />
            {showExcerpt ? (
              <p className="text-fg-soft mt-8 text-lg leading-relaxed sm:text-xl">
                {entry.excerpt}
              </p>
            ) : null}
            <div
              className="prose prose-axionia mt-10 max-w-none"
              // P0 audit KB 2026-05-29 : sanitize SSR anti-XSS (whitelist Tiptap).
              // Le commentaire d'origine promettait DOMPurify mais aucun sanitize n'était appliqué.
              dangerouslySetInnerHTML={{ __html: sanitizeTiptapHtml(entry.body) }}
            />
            <AiContentDisclaimer locale="fr" className="mt-10" />
          </article>
        </Container>
      </Section>

      {/* Articles connexes — évite le dead-end + réduit le bounce sur /connaissances/[slug]. */}
      <SuggestedContent
        variant="articles"
        items={(await findRelatedArticles({ currentSlug: slug, locale: "fr", limit: 4 })).map(
          (r) => ({
            href: `/blog/${r.slug}`,
            title: r.title,
            excerpt: r.excerpt,
            publishedAt: r.publishedAt,
            readingTime: r.readingTime,
          }),
        )}
        eyebrow="Articles connexes"
        title="À lire aussi"
        tone="sand"
        emitJsonLd
      />

      {/* KB V4.1 Service Binding — CTA contextuel + Offer JSON-LD (masqué si
          l'entrée n'est rattachée à aucun service via tag service:*). */}
      {service ? <ServiceOfferBlock service={service} /> : null}

      <CtaBlock
        title="Vous voulez en discuter"
        titleEm="en équipe"
        description="Réservez un audit IA flash terrain — diagnostic ROI sur vos vraies données."
        cta={
          <Cta href="/reserver" size="lg">
            Réserver →
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={articleJsonLd} />
    </>
  );
}
