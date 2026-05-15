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
import { SITE_URL, buildProductMetadata } from "@/lib/seo";
import { fetchPublicKbBySlug } from "@/lib/knowledge/public-fetch";

export const revalidate = 3600;
export const dynamicParams = true;

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

  const publishedStr = formatDate(entry.publishedAt);
  const updatedStr = formatDate(entry.updatedAt);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${SITE_URL}/fr/connaissances/${entry.slug}#article`,
    headline: entry.title,
    url: `${SITE_URL}/fr/connaissances/${entry.slug}`,
    inLanguage: "fr-FR",
    isPartOf: { "@id": `${SITE_URL}/fr/connaissances#collection` },
    ...(entry.publishedAt ? { datePublished: entry.publishedAt.toISOString() } : {}),
    dateModified: entry.updatedAt.toISOString(),
    ...(entry.excerpt ? { description: entry.excerpt } : {}),
    author: { "@type": "Organization", name: "Axion-IA" },
  };

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
            <p className="text-fg-muted mb-4 text-xs tracking-[0.16em] uppercase">
              {entry.type.replaceAll("_", " ")}
              {publishedStr ? <> · publié le {publishedStr}</> : null}
              {updatedStr && updatedStr !== publishedStr ? (
                <> · mis à jour le {updatedStr}</>
              ) : null}
              {entry.readingTime ? <> · {entry.readingTime} min</> : null}
            </p>
            <h1 className="display-editorial text-fg">{entry.title}</h1>
            {entry.excerpt ? (
              <p className="text-fg-soft mt-6 text-lg leading-relaxed sm:text-xl">
                {entry.excerpt}
              </p>
            ) : null}
            <div
              className="prose prose-axionia mt-10 max-w-none"
              // par le pipeline éditorial (Tiptap rendered + DOMPurify). Source : KB-3 alts validation.
              dangerouslySetInnerHTML={{ __html: entry.body }}
            />
          </article>
        </Container>
      </Section>

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
