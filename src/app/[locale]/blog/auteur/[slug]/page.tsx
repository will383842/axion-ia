import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, FileText, BookOpenCheck, Briefcase, Clock } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { ArticleCard } from "@/components/marketing/ArticleCard";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import {
  getAllBlogAuthorSlugs,
  getBlogPostsByAuthor,
  getBlogAuthorLabel,
} from "@/content/transversal";
import { buildProductMetadata, buildPersonJsonLd, SITE_URL } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

// Audit indexation 2026-05-18 P0-7 — anti-soft 404 (slugs FS-only).
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllBlogAuthorSlugs().flatMap((slug) =>
    routing.locales.map((locale) => ({ locale, slug })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const author = getBlogAuthorLabel(slug);
  if (!author) return {};
  const isFr = locale === "fr";
  return buildProductMetadata({
    locale,
    path: `/blog/auteur/${slug}`,
    title: isFr ? `Articles de ${author} · Axion-IA` : `Articles by ${author} · Axion-IA`,
    description: isFr
      ? `Articles publiés par ${author} sur le blog Axion-IA.`
      : `Articles by ${author} on the Axion-IA blog.`,
  });
}

// Sprint S6.3 P1-3 (2026-05-15) — denylist personas IA. Manon (et tout futur
// persona AuthorProfile.isPersona:true) doit utiliser sa page dédiée
// `/equipe/<slug>` qui consomme `buildPersonManonJsonLd` DB-driven, et JAMAIS
// `/blog/auteur/<slug>` qui leak le sameAs LinkedIn de Will via le default
// de `buildPersonJsonLd`. Défense-en-profondeur : `buildPersonJsonLd` throw
// déjà sur ces slugs, mais on 404 ici pour ne pas dépendre d'un throw.
const PERSONA_AUTHOR_SLUGS = new Set(["manon"]);

export default async function BlogAuthorPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  if (PERSONA_AUTHOR_SLUGS.has(slug)) notFound();
  const author = getBlogAuthorLabel(slug);
  if (!author) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const posts = getBlogPostsByAuthor(slug);

  // ProfilePage Schema + Person enrichi — E-E-A-T 2026 signal fort (audit
  // perfection 2026-05-12). Le Person via factory centralisée porte jobTitle,
  // sameAs LinkedIn, knowsAbout (expertises IA), knowsLanguage.
  const personJsonLd = buildPersonJsonLd({
    locale: loc,
    slug,
    name: author,
  });
  const profileJsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: `${SITE_URL}/${locale}/blog/auteur/${slug}`,
    inLanguage: locale,
    mainEntity: personJsonLd,
  } as const;

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [
    { href: "/blog", label: "Blog" },
    { href: `/blog/auteur/${slug}`, label: author },
  ];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <Section
        titleAs="h1"
        eyebrow={isFr ? "Auteur" : "Author"}
        title={isFr ? "Articles de" : "Articles by"}
        titleEm={author}
        description={
          isFr
            ? `${posts.length} article${posts.length > 1 ? "s" : ""} publié${posts.length > 1 ? "s" : ""} par ${author}. Retours terrain et méthodologie issus de missions réelles.`
            : `${posts.length} article${posts.length > 1 ? "s" : ""} published by ${author}. Field reports and methodology from real engagements.`
        }
      >
        <Container className="mt-8 max-w-2xl">
          <ul className="flex flex-wrap gap-x-5 gap-y-2.5">
            {[
              { icon: FileText, label: `${posts.length} ${isFr ? "articles" : "articles"}` },
              { icon: BookOpenCheck, label: isFr ? "Méthodologie testée" : "Field-tested method" },
              { icon: Briefcase, label: "Axion-IA" },
              { icon: Clock, label: isFr ? "Lecture 6-12 min" : "6-12 min read" },
            ].map((pill) => {
              const Icon = pill.icon;
              return (
                <li
                  key={pill.label}
                  className="text-fg-soft inline-flex items-center gap-2 text-sm"
                >
                  <Icon aria-hidden="true" className="text-terracotta h-4 w-4" strokeWidth={2} />
                  <span>{pill.label}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <Cta href="/blog" size="lg">
              {isFr ? "Voir tous les articles" : "See all articles"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Cta>
            <Cta href="/a-propos" variant="outline" size="lg">
              {isFr ? "À propos d'Axion-IA" : "About Axion-IA"}
            </Cta>
          </div>
        </Container>
      </Section>
      <Section>
        <Container>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <li key={p.slug}>
                <ArticleCard
                  href={`/blog/${p.slug}`}
                  title={p[loc].title}
                  excerpt={p[loc].excerpt}
                  publishedAt={p.publishedAt}
                  readingTime={p.readingTime}
                />
              </li>
            ))}
          </ul>
        </Container>
      </Section>
      <JsonLd data={profileJsonLd} />
    </>
  );
}
