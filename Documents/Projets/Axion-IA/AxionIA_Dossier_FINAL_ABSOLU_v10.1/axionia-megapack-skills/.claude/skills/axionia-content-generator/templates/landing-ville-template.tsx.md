# Template TSX gold standard — Landing ville

> Fichier à créer en Sprint 2 : `src/server/content-gen/templates/landing-ville-template.tsx` (Server Component Next 16).
> Rendu strict aux specs § 9.7 (60+ items checklist) + § 9.9.1 (skeleton) + § 9.10 (mobile + Web Vitals) du master prompt.
> Importé par la route SSG/ISR `src/app/[locale]/implantations/[region]/[ville]/page.tsx` quand `villeCopy` est présent en DB.

## Pré-requis (composants partagés à créer en parallèle)

- `src/components/ResponsiveImage.tsx` (AVIF/WebP/JPG + fetchpriority — cf. fichier séparé `responsive-image.tsx.md` ci-dessous)
- `src/components/AuthorByline.tsx` (cf. `references/manon-person.md`)
- `src/components/AuthorCard.tsx` (idem)
- `src/components/Breadcrumb.tsx` (existant peut-être — sinon créer simple)
- `src/lib/seo.ts` étendu avec les 10 factories JSON-LD (Sprint 1 Day 3)

## Fichier TSX complet

```tsx
// src/server/content-gen/templates/landing-ville-template.tsx
// Template gold standard landing ville — Server Component (pas 'use client')
// Rend une copy ville à partir de VilleCopy DB + Ville INSEE + Region SSOT.
// Doctrine § 9.7 + § 9.9.1 + § 9.10 + § 26 (intent=local).

import { JSX } from "react";
import { ResponsiveImage } from "@/components/ResponsiveImage";
import { AuthorByline } from "@/components/AuthorByline";
import { AuthorCard } from "@/components/AuthorCard";
import { Breadcrumb } from "@/components/Breadcrumb";
import {
  buildPersonManonJsonLd,
  buildPlaceJsonLd,
  buildLocalBusinessJsonLd,
  buildServiceJsonLd,
  buildFaqSpeakableJsonLd,
  buildItemListJsonLd,
  buildBreadcrumbJsonLd,
  buildOrganizationJsonLd,
  buildWebPageSpeakable,
} from "@/lib/seo";
import type { VilleCopy } from "@/content/villes/copy/types";
import type { VilleData, Region, AuthorProfile } from "@prisma/client";

type SimilarArticle = {
  slug: string;
  title: string;
  excerpt: string;
  heroImage: string;
  heroAlt: string;
  category: string;
  readingTimeMin: number;
};

type LandingVilleTemplateProps = {
  ville: VilleData;
  region: Region;
  copy: VilleCopy;          // contenu généré (sections, FAQ, etc.)
  manon: AuthorProfile;     // depuis DB AuthorProfile[slug=manon]
  neighbouringVilles: VilleData[];  // top 5-10 via Haversine
  heroImage: { src: string; alt: string; caption?: string; width: number; height: number };
  illustrationImage?: { src: string; alt: string; caption?: string; width: number; height: number };
  similarArticles: SimilarArticle[];  // 🆕 v2.2 — top 3-5 via cosine retrieve
};

export default function LandingVilleTemplate({
  ville,
  region,
  copy,
  manon,
  neighbouringVilles,
  heroImage,
  illustrationImage,
  similarArticles,  // 🆕 v2.2
}: LandingVilleTemplateProps): JSX.Element {
  // ─────────────────────────────────────────────────────────────────────
  // JSON-LD blocks (séparés — Google les préfère individuels)
  // ─────────────────────────────────────────────────────────────────────
  const jsonLdPerson = buildPersonManonJsonLd(manon);
  const jsonLdOrganization = buildOrganizationJsonLd();
  const jsonLdBreadcrumb = buildBreadcrumbJsonLd([
    { name: "Accueil", url: "/fr/" },
    { name: "Implantations", url: "/fr/implantations" },
    { name: region.nameFr, url: `/fr/implantations/${region.slug}` },
    { name: ville.name, url: `/fr/implantations/${region.slug}/${ville.slug}` },
  ]);
  const jsonLdPlace = buildPlaceJsonLd(ville, region);
  const jsonLdLocalBusiness = buildLocalBusinessJsonLd({ areaServed: ville.name, region });
  const jsonLdServices = [
    buildServiceJsonLd({ name: "Audit IA", areaServed: ville.name }),
    buildServiceJsonLd({ name: "Interventions IA", areaServed: ville.name }),
    buildServiceJsonLd({ name: "Implémentation IA", areaServed: ville.name }),
  ];
  const jsonLdFaq = buildFaqSpeakableJsonLd(copy.faq);
  const jsonLdItemList = buildItemListJsonLd(
    neighbouringVilles.map((v) => ({
      name: v.name,
      url: `/fr/implantations/${region.slug}/${v.slug}`,
    })),
    "Communes voisines accompagnées",
  );
  const jsonLdWebPage = buildWebPageSpeakable({
    canonicalUrl: `https://axion-ia.com/fr/implantations/${region.slug}/${ville.slug}`,
    speakableCssSelectors: ["[data-aeo=tldr]", "[data-aeo=answer]", ".faq details summary"],
    lastReviewed: copy.updatedAt ?? copy.publishedAt,
  });

  // ─────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* JSON-LD scripts séparés (1 par bloc — meilleur parsing Google) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdPerson) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrganization) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdPlace) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdLocalBusiness) }} />
      {jsonLdServices.map((svc, i) => (
        <script key={`svc-${i}`} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(svc) }} />
      ))}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdItemList) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdWebPage) }} />

      {/* Skip link a11y */}
      <a className="skip-link" href="#main">
        Aller au contenu
      </a>

      {/* Breadcrumb nav */}
      <nav aria-label="Fil d'Ariane" className="breadcrumb-nav">
        <Breadcrumb
          items={[
            { label: "Accueil", href: "/fr/" },
            { label: "Implantations", href: "/fr/implantations" },
            { label: region.nameFr, href: `/fr/implantations/${region.slug}` },
            { label: ville.name, current: true },
          ]}
        />
      </nav>

      <main id="main">
        <article itemScope itemType="https://schema.org/Article">
          {/* HERO */}
          <header className="hero">
            <h1 itemProp="headline">{copy.h1}</h1>
            <p className="hero-lede" itemProp="description">
              {copy.lede}
            </p>
            <figure className="hero-figure hero-schema">
              <ResponsiveImage
                src={heroImage.src}
                alt={heroImage.alt}
                width={heroImage.width}
                height={heroImage.height}
                priority
                fetchPriority="high"
                sizes="(min-width: 1024px) 1024px, 100vw"
              />
              {heroImage.caption && <figcaption>{heroImage.caption}</figcaption>}
            </figure>
            <AuthorByline manon={manon} publishedAt={copy.publishedAt} readingTimeMin={copy.readingTimeMin ?? 8} />
          </header>

          {/* TL;DR (Speakable AEO) */}
          <aside data-aeo="tldr" className="tldr" aria-labelledby="tldr-title">
            <strong id="tldr-title">En bref :</strong> {copy.tldr}
          </aside>

          {/* DIRECT ANSWER (Speakable AEO, 40-80 mots) */}
          <p data-aeo="answer" className="direct-answer">
            {copy.directAnswer}
          </p>

          {/* KEY FACTS */}
          <ul data-aeo="facts" className="key-facts">
            {copy.keyFacts.map((fact, i) => (
              <li key={`fact-${i}`}>{fact}</li>
            ))}
          </ul>

          {/* TOC */}
          <nav aria-label="Sommaire" className="toc">
            <h2>Sommaire</h2>
            <ol>
              {copy.sections.map((section) => (
                <li key={section.anchor}>
                  <a href={`#${section.anchor}`}>{section.h2}</a>
                </li>
              ))}
            </ol>
          </nav>

          {/* SECTIONS BODY */}
          {copy.sections.map((section) => (
            <section
              key={section.anchor}
              id={section.anchor}
              aria-labelledby={`heading-${section.anchor}`}
              className="content-section"
            >
              <h2 id={`heading-${section.anchor}`}>{section.h2}</h2>
              {/* bodyHtml est déjà sanitised DOMPurify avant insertion DB */}
              <div dangerouslySetInnerHTML={{ __html: section.bodyHtml }} />
              {section.h3Subsections?.map((sub, i) => (
                <div key={`sub-${i}`} className="subsection">
                  <h3>{sub.h3}</h3>
                  <div dangerouslySetInnerHTML={{ __html: sub.bodyHtml }} />
                </div>
              ))}
            </section>
          ))}

          {/* Illustration mid-content (optionnel) */}
          {illustrationImage && (
            <figure className="content-illustration">
              <ResponsiveImage
                src={illustrationImage.src}
                alt={illustrationImage.alt}
                width={illustrationImage.width}
                height={illustrationImage.height}
                loading="lazy"
                decoding="async"
                sizes="(min-width: 1024px) 768px, 100vw"
              />
              {illustrationImage.caption && <figcaption>{illustrationImage.caption}</figcaption>}
            </figure>
          )}

          {/* COMMUNES VOISINES */}
          <section
            id="communes-voisines"
            aria-labelledby="heading-voisines"
            className="content-section"
          >
            <h2 id="heading-voisines">Axion-IA accompagne aussi les communes voisines</h2>
            <ul className="communes-voisines">
              {neighbouringVilles.map((v) => (
                <li key={v.slug}>
                  <a href={`/fr/implantations/${region.slug}/${v.slug}`} rel="prev">
                    {v.name} <span className="commune-pop">({v.population.toLocaleString("fr-FR")} hab.)</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>

          {/* FAQ (Speakable + déclenche 8 pages /fr/faq/[slug] post-process v1.7) */}
          <section id="faq" aria-labelledby="heading-faq" className="faq">
            <h2 id="heading-faq">Questions fréquentes — Axion-IA à {ville.name}</h2>
            {copy.faq.map((item, i) => (
              <details key={`faq-${i}`} className="faq-item">
                <summary>
                  <h3>{item.q}</h3>
                </summary>
                <p>{item.a}</p>
                {item.linkedFaqSlug && (
                  <p className="faq-deep-link">
                    <a href={`/fr/faq/${item.linkedFaqSlug}`}>Voir la fiche détaillée de cette question →</a>
                  </p>
                )}
              </details>
            ))}
          </section>

          {/* CTA */}
          <section className="cta-final" aria-labelledby="cta-title">
            <h2 id="cta-title">Prêt à auditer votre IA à {ville.name} ?</h2>
            <p>{copy.ctaText}</p>
            <a href={`/fr/reserver?source=ville-${ville.slug}`} className="btn-primary">
              Réserver un audit Flash à {ville.name}
            </a>
          </section>

          {/* 🆕 v2.2 — Articles similaires (Lectures recommandées) */}
          <aside aria-labelledby="similar-articles-title" className="similar-articles">
            <h2 id="similar-articles-title">Lectures recommandées</h2>
            <ul className="similar-articles-list">
              {similarArticles.slice(0, 4).map((sim) => (
                <li key={sim.slug}>
                  <a href={`/fr/blog/${sim.slug}`} className="similar-article-link">
                    <img
                      src={sim.heroImage}
                      alt={sim.heroAlt}
                      width={160}
                      height={90}
                      loading="lazy"
                      decoding="async"
                    />
                    <div>
                      <h3>{sim.title}</h3>
                      <p>{sim.excerpt}</p>
                      <span className="similar-meta">
                        {sim.category} · {sim.readingTimeMin} min
                      </span>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </aside>

          {/* Bio Manon (fin article) */}
          <footer className="article-footer">
            <AuthorCard manon={manon} />
          </footer>
        </article>
      </main>
    </>
  );
}
```

## Composant `ResponsiveImage` (à créer en parallèle Sprint 2)

```tsx
// src/components/ResponsiveImage.tsx
// Composant Server React 19 / Next 16 — image AVIF/WebP/JPG fallback strict.
// Doctrine § 9.7.9 + § 9.10.

import { JSX } from "react";

type ResponsiveImageProps = {
  src: string;             // base path : "/illustrations/generated/content-gen/<jobId>/<slot>"
  alt: string;             // obligatoire
  width: number;           // anti-CLS — obligatoire
  height: number;          // anti-CLS — obligatoire
  sizes?: string;          // ex "(min-width: 1024px) 1024px, 100vw"
  loading?: "lazy" | "eager";
  decoding?: "async" | "sync" | "auto";
  fetchPriority?: "high" | "low" | "auto";
  priority?: boolean;      // true = LCP image (eager + high)
  className?: string;
};

export function ResponsiveImage({
  src,
  alt,
  width,
  height,
  sizes = "(min-width: 1024px) 1024px, 100vw",
  loading,
  decoding = "async",
  fetchPriority,
  priority = false,
  className,
}: ResponsiveImageProps): JSX.Element {
  // Convention naming : src = base path sans extension, ex "/foo/bar/hero"
  // 3 variantes générées par sharp : 320 / 768 / 1280
  const base = src.replace(/\.(avif|webp|jpg|jpeg|png)$/i, "");

  const finalLoading = loading ?? (priority ? "eager" : "lazy");
  const finalFetchPriority = fetchPriority ?? (priority ? "high" : "auto");

  return (
    <picture>
      <source
        type="image/avif"
        srcSet={`${base}-320.avif 320w, ${base}-768.avif 768w, ${base}-1280.avif 1280w`}
        sizes={sizes}
      />
      <source
        type="image/webp"
        srcSet={`${base}-320.webp 320w, ${base}-768.webp 768w, ${base}-1280.webp 1280w`}
        sizes={sizes}
      />
      <img
        src={`${base}-1280.jpg`}
        alt={alt}
        width={width}
        height={height}
        loading={finalLoading}
        decoding={decoding}
        fetchPriority={finalFetchPriority}
        className={className}
      />
    </picture>
  );
}
```

## Stratégie de rendu

| Type contenu | Stratégie | Raison |
|---|---|---|
| Landing villes (Pipeline 1) | **SSG build-time** + ISR `revalidate: 86400` (24 h) | ~2 150 routes, contenu stable, anti-doorway HCU |
| Articles blog (Pipeline 3) | **ISR `revalidate: 3600`** (1 h) | volume scale-friendly, freshness modéré |
| Actualités RSS (Pipeline 2) | **ISR `revalidate: 1800`** (30 min) | freshness élevée (news) |
| Pages Q/R `/fr/faq/[slug]` | **ISR `revalidate: 86400`** (24 h) | volume potentiel énorme, contenu stable |
| Comparatifs | **ISR `revalidate: 7200`** (2 h) | mise à jour pricing concurrents |
| Guides piliers | **SSG build-time** + ISR `revalidate: 604800` (7 j) | contenu très stable, autorité |

→ Documenter dans `docs/content-gen/rendering-strategy.md` (livré Sprint 6).

## Versioning template (V1 → V2 sans casser existing)

```ts
// src/server/content-gen/templates/index.ts — registry de templates
export const templateRegistry = {
  "landing-ville": {
    v1: () => import("./landing-ville-template.tsx"),
    v2: () => import("./landing-ville-template-v2.tsx"),  // futur
  },
  "blog-article": {
    v1: () => import("./blog-article-template.tsx"),
  },
  // ...
};

// Choisi selon ContentTemplate.version en DB
```

→ ADR 0012 documentera cette stratégie d'évolution.

## SLO de rendu

- TTFB ≤ 200 ms (cached CF) | ≤ 600 ms (ISR revalidate)
- LCP ≤ 1 800 ms p75
- INP ≤ 100 ms p75 (exception 150 ms pour landings villes cachées)
- CLS = 0 strict
- First Load JS ≤ 75 KB gz/route

Test pré-promote tier-1 : `pnpm content-gen:lighthouse <url>` doit PASSER budget § 9.10.5.
