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
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { ContactBand } from "@/components/sections/ContactBand";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { JsonLd } from "@/components/marketing/JsonLd";
import { AiContentDisclaimer } from "@/components/marketing/AiContentDisclaimer";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { buildProductMetadata, buildBreadcrumbJsonLd, SITE_URL } from "@/lib/seo";
import { buildArticleJsonLd, buildPersonManonJsonLd } from "@/lib/seo-content-gen-factories";
import { fetchPublicKbBySlug } from "@/lib/knowledge/public-fetch";
import { getServiceForEntrySlug } from "@/lib/knowledge/readers";
import { ServiceOfferBlock } from "@/components/services/ServiceOfferBlock";
import { sanitizeTiptapHtml } from "@/lib/knowledge/tiptap-sanitize";
import { SuggestedContent } from "@/components/suggested/SuggestedContent";
import { findRelatedArticles } from "@/server/content-gen/links/related-articles";
import {
  extractKeyFact,
  extractSources,
  sourcesToCitations,
  buildToc,
} from "@/lib/knowledge/article-enrich";
import { KeyFactCard } from "@/components/knowledge/KeyFactCard";
import { KbSources } from "@/components/knowledge/KbSources";
import { KbToc } from "@/components/knowledge/KbToc";
import { KbRelatedEntries } from "@/components/knowledge/KbRelatedEntries";
import { findRelatedKbEntries } from "@/lib/knowledge/related-entries";

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
    ogType: "article", // VIS-05/SEO-05
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

  // E-E-A-T (doctrine v2.1) — attribution à Manon (persona éditoriale IA
  // disclosed), JAMAIS Will (anti-trompeur). Le byline visible + le node
  // Person JSON-LD résolvent l'`@id` author/creator posé par buildArticleJsonLd.
  // Stub-safe : au build (stub.invalid) → null → byline fallback "Manon" + pas
  // de node Person (l'ISR runtime le réhydrate).
  const author = await prisma.authorProfile
    .findUnique({ where: { slug: "manon" } })
    .catch(() => null);
  const personJsonLd = author?.slug === "manon" ? buildPersonManonJsonLd(author) : null;
  const authorName = author?.displayName ?? "Manon";
  const authorTitle = author?.jobTitle ?? null;

  const publishedStr = formatDate(entry.publishedAt);
  const updatedStr = formatDate(entry.updatedAt);
  const typeLabel = TYPE_LABEL[String(entry.type)] ?? "Ressource";
  // Évite la répétition titre = excerpt (fréquent sur les entrées "fact").
  const ex = entry.excerpt?.trim();
  const showExcerpt = Boolean(
    ex && !ex.toLowerCase().startsWith(entry.title.trim().slice(0, 24).toLowerCase()),
  );
  // Titre-phrase (entrées "fait") → H1 plus petit pour ne pas être absurde.
  const titleLong = entry.title.length > 90;

  // Encart chiffre-clé (fact / industry_use_case) — null si aucun chiffre
  // détecté → carte non rendue (anti-doorway : pas de richesse fabriquée).
  const keyFact = extractKeyFact({
    type: entry.type,
    title: entry.title,
    excerpt: entry.excerpt,
  });

  // Sources/références — extraites du body BRUT (sanitizeTiptapHtml strippe les
  // href). Liste vide → section non rendue. Les sources liées alimentent aussi
  // Article.citation[] (Perplexity reprend mot-à-mot les sources citées).
  const sources = extractSources(entry.body);
  const citations = sourcesToCitations(sources);

  // Sommaire — détecte les h2 du body SANITISÉ, injecte ancres + data-speakable.
  // < 3 h2 → bodyHtml inchangé + toc vide (pas de sommaire sur entrée courte).
  const { html: bodyHtml, toc } = buildToc(sanitizeTiptapHtml(entry.body));

  // Maillage KB→KB (cluster topique) — relations éditoriales → tags → domaine.
  // Levier d'autorité topique. Masqué si < 2 voisins (composant).
  const relatedKb = await findRelatedKbEntries(slug, { limit: 6 });

  // Image Article = carte OG dynamique (même image que le partage social) →
  // éligibilité rich result Article + Google Discover, à coût LCP nul (l'image
  // n'est pas chargée dans la page, seulement déclarée pour les crawlers).
  const ogImageUrl = `${SITE_URL}/api/og?title=${encodeURIComponent(entry.metaTitle ?? entry.title)}`;

  const articleJsonLd = buildArticleJsonLd({
    title: entry.title,
    description: entry.excerpt ?? entry.title,
    slug: entry.slug,
    locale: "fr",
    publishedAt: entry.publishedAt ?? entry.updatedAt,
    updatedAt: entry.updatedAt,
    section: "Connaissances IA",
    urlSegment: "connaissances",
    imageUrl: ogImageUrl,
    imageAlt: entry.title,
    ...(entry.readingTime ? { readingTimeMinutes: entry.readingTime } : {}),
    ...(entry.wordCount ? { wordCount: entry.wordCount } : {}),
    ...(citations.length > 0 ? { citations } : {}),
  });

  return (
    <>
      {/* HÉRO éditorial — fond halo-warm + eyebrow terracotta + H1 serif
          (taille adaptative) + réponse directe (AEO) + meta + CTA contextuel.
          Modèle « contenu premium », PAS un hub service (intention informationnelle). */}
      <section className="bg-halo-warm relative overflow-hidden pt-8 pb-14 sm:pt-10 lg:pt-14 lg:pb-20">
        {/* halo terracotta diffus à droite */}
        <div
          aria-hidden="true"
          className="bg-terracotta/15 pointer-events-none absolute -top-24 right-0 h-80 w-80 rounded-full blur-3xl"
        />
        <Container className="relative">
          <Breadcrumbs
            items={[
              { href: "/connaissances", label: "Connaissances" },
              { href: `/connaissances/${entry.slug}`, label: entry.title },
            ]}
          />
          <div className="mt-8 max-w-3xl">
            <p className="text-terracotta-deep mb-5 flex items-center gap-2 text-[13px] font-medium tracking-[0.16em] uppercase">
              <span
                aria-hidden="true"
                className="bg-terracotta inline-block h-1.5 w-1.5 rounded-full"
              />
              {typeLabel}
            </p>
            <h1
              className={`text-fg font-semibold tracking-tight ${
                titleLong
                  ? "text-[clamp(1.5rem,2.6vw,2.125rem)] leading-[1.25]"
                  : "text-[clamp(2rem,3.6vw,3rem)] leading-[1.12]"
              }`}
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {entry.title}
            </h1>
            {showExcerpt ? (
              <p
                className="text-fg-soft mt-6 text-lg leading-relaxed sm:text-xl"
                data-aeo="answer"
                data-speakable="true"
              >
                {entry.excerpt}
              </p>
            ) : null}
            <p className="text-fg-muted mt-6 text-[13px]">
              <>
                Par{" "}
                <Link
                  href={{ pathname: "/equipe/[slug]", params: { slug: "manon" } }}
                  className="text-terracotta-deep font-medium underline-offset-2 hover:underline"
                >
                  {authorName}
                </Link>
                {authorTitle ? <>, {authorTitle}</> : null}
              </>
              {publishedStr ? <> · publié le {publishedStr}</> : null}
              {updatedStr && updatedStr !== publishedStr ? (
                <> · mis à jour le {updatedStr}</>
              ) : null}
              {entry.readingTime ? <> · {entry.readingTime} min de lecture</> : null}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Cta href="/appel" size="lg">
                Réserver un appel
              </Cta>
              <Cta href="/contact" variant="outline" size="lg">
                Nous écrire
              </Cta>
            </div>
          </div>
        </Container>
      </section>

      {/* Corps de l'article */}
      <Section tone="paper" className="pt-12 pb-16 lg:pt-16 lg:pb-24">
        <Container>
          <article className="max-w-3xl">
            {keyFact ? <KeyFactCard fact={keyFact} /> : null}
            <KbToc items={toc} />
            <div
              className="prose prose-axionia max-w-none"
              // P0 audit KB 2026-05-29 : sanitize SSR anti-XSS (whitelist Tiptap).
              // `bodyHtml` = sortie sanitize + ancres h2 injectées par buildToc.
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
            <KbSources sources={sources} />
            <AiContentDisclaimer locale="fr" className="mt-10" />
          </article>
        </Container>
      </Section>

      {/* Cluster topique KB→KB — maillage interne d'autorité (masqué si < 2). */}
      <KbRelatedEntries items={relatedKb} />

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

      <ContactBand
        eyebrow="Un sujet IA à creuser ?"
        title="Parlons de votre projet IA,"
        titleEm="concrètement"
        description="Un échange pour comprendre votre besoin et vous dire ce qui est réalisable — du quick-win à l'agent connecté à vos outils. Sans engagement."
        track="-connaissances"
      />

      <JsonLd data={articleJsonLd} />
      {/* AEO/GEO 2026 — BreadcrumbList (chaîne d'attribution Claude/Perplexity/SGE). */}
      <JsonLd
        data={buildBreadcrumbJsonLd({
          locale: locale as Locale,
          items: [
            { name: "Connaissances", href: "/connaissances" },
            { name: entry.title, href: `/connaissances/${entry.slug}` },
          ],
        })}
        scriptId="jsonld-breadcrumb-connaissance"
      />
      {personJsonLd ? <JsonLd data={personJsonLd} /> : null}
    </>
  );
}
