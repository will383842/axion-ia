/**
 * Public page — gallery image detail `/galerie/[slug]`.
 * Server Component, ISR revalidate 3600. JSON-LD @graph chained 6 entités.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { buildImageDetailGraph } from "@/server/image-bank/services/image-jsonld-graph.service";
import { imageBankService } from "@/server/image-bank/services/image-bank.service";
import { resolveCopyrightHolder } from "@/server/image-bank/constants";
import { GalleryGrid } from "@/components/galerie/GalleryGrid";
import { isEnLocaleDisabled } from "@/lib/i18n/en-to-fr-redirect";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const tr = await prisma.imageAssetTranslation.findFirst({
    where: { slug, languageCode: locale, isPublished: true },
    include: {
      image: {
        include: {
          translations: {
            where: { isPublished: true },
            select: { languageCode: true, slug: true },
          },
        },
      },
    },
  });
  if (!tr || !tr.image) return { robots: { index: false } };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const cdnUrl = process.env.IMAGE_BANK_CDN_URL ?? siteUrl;
  const segment = locale === "fr" ? "galerie" : "gallery";

  const otherLocale: "fr" | "en" = locale === "fr" ? "en" : "fr";
  const otherTr = tr.image.translations.find((t) => t.languageCode === otherLocale);
  const otherSlug = otherTr?.slug ?? tr.slug;
  // Canonical FR (toujours) — EN désactivé, FR seul indexable.
  const frHreflang = `${siteUrl}/fr/galerie/${locale === "fr" ? tr.slug : otherSlug}`;

  // OG image: slug-based → public image, UUID-based → CDN og variant
  const isSlugBased = tr.image.filePath && !tr.image.filePath.startsWith("/image-bank");
  const ogImageUrl = isSlugBased
    ? `${siteUrl}/${tr.image.filePath.replace(/^\//, "")}`
    : `${cdnUrl}/image-bank/${tr.image.id}/og.webp`;

  // Keywords (E-E-A-T / pertinence) — primary + secondary enrichis.
  const metaKeywords: string[] = [];
  if (tr.image.keywordsPrimary) metaKeywords.push(tr.image.keywordsPrimary);
  if (Array.isArray(tr.image.keywordsSecondary)) {
    metaKeywords.push(
      ...tr.image.keywordsSecondary.filter((k): k is string => typeof k === "string"),
    );
  }

  return {
    title: tr.metaTitle ?? `${tr.title} | Axion-IA`,
    description: tr.metaDescription ?? tr.caption ?? tr.alt,
    authors: [{ name: "Axion-IA", url: siteUrl }],
    creator: "Axion-IA",
    publisher: "Axion-IA",
    ...(metaKeywords.length > 0 ? { keywords: metaKeywords } : {}),
    ...(tr.image.module ? { category: tr.image.module } : {}),
    alternates: {
      // Fix 2026-07-31 (audit indexation GSC) — le commentaire l.48 promet
      // « Canonical FR (toujours) » mais le code déclarait chaque locale
      // auto-canonique : une page /en/gallery/* se disait canonique d'elle-même
      // alors que proxy.ts la 301 vers FR (signal contradictoire, impressions
      // résiduelles /en/gallery/* en GSC). EN désactivé → canonique FR ;
      // EN réactivé → chaque locale redevient auto-canonique (symétrique du
      // gating `languages` ci-dessous).
      canonical: isEnLocaleDisabled() ? frHreflang : `${siteUrl}/${locale}/${segment}/${tr.slug}`,
      // EN désactivé (301→FR) : ne PAS émettre l'alternate `en-US` — sinon on
      // signale à Google ~133 URLs /en/gallery/* qui ne font que 301, gaspillant
      // du crawl-budget (audit GSC A-04). Aligné sur le hub + le sitemap images.
      // Togglable : si EN_LOCALE_ENABLED=true, l'alternate EN est ré-émis.
      languages: {
        "fr-FR": frHreflang,
        ...(isEnLocaleDisabled()
          ? {}
          : { "en-US": `${siteUrl}/en/gallery/${locale === "en" ? tr.slug : otherSlug}` }),
        "x-default": frHreflang,
      },
    },
    openGraph: {
      title: tr.ogTitle ?? tr.title,
      description: tr.ogDescription ?? tr.caption ?? tr.alt,
      type: "article",
      locale: locale === "fr" ? "fr_FR" : "en_US",
      url: `${siteUrl}/${locale}/${segment}/${tr.slug}`,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: tr.alt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: tr.ogTitle ?? tr.title,
      description: tr.ogDescription ?? tr.caption ?? tr.alt,
      images: [ogImageUrl],
    },
    // Garde-fou anti-doorway / anti-thin : on n'expose à l'index Google QUE les
    // pages qui portent un contenu unique et substantiel (description OU résumé
    // IA enrichi par Claude Vision). Une image au stade « seed » (alt = caption =
    // titre, sans description ni aiSummary) reste `follow` mais `noindex` tant que
    // l'enrichissement ne l'a pas remplie — évite que Google classe la galerie en
    // pages dupliquées / doorway. Après enrichissement, la page repasse `index`.
    robots: {
      // RÈGLE STRICTE : seul le FR est indexable. EN est désactivé (301→FR) ; on
      // force `noindex` sur toute locale ≠ fr en filet de sécurité (au cas où un
      // /en/* échapperait au 301 proxy). + garde anti-thin/doorway côté FR.
      index: locale === "fr" && hasSubstantiveContent(tr),
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  };
}

/**
 * Vrai si la traduction porte assez de contenu unique pour mériter l'indexation
 * (anti-doorway). Bar volontairement basse : toute image correctement enrichie
 * la franchit ; seules les images encore au stade placeholder sont exclues.
 */
function hasSubstantiveContent(tr: {
  description?: string | null;
  aiSummary?: string | null;
}): boolean {
  return (tr.description?.trim().length ?? 0) >= 100 || (tr.aiSummary?.trim().length ?? 0) >= 100;
}

export default async function ImageDetailPublicPage({ params }: PageProps) {
  const { locale, slug } = await params;

  const tr = await prisma.imageAssetTranslation.findFirst({
    where: { slug, languageCode: locale, isPublished: true },
    include: {
      image: {
        include: {
          category: { include: { translations: true } },
          tags: { include: { tag: { include: { translations: true } } } },
        },
      },
    },
  });

  if (!tr || !tr.image) notFound();
  const image = tr.image;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const cdnUrl = process.env.IMAGE_BANK_CDN_URL ?? siteUrl;
  const segment = locale === "fr" ? "galerie" : "gallery";
  const pageUrl = `${siteUrl}/${locale}/${segment}/${tr.slug}`;
  const downloadSegment = locale === "fr" ? "telecharger" : "download";

  const graph = buildImageDetailGraph({
    image,
    translation: tr,
    locale,
    cdnUrl,
    pageUrl,
    breadcrumb: [
      { name: locale === "fr" ? "Accueil" : "Home", url: `${siteUrl}/${locale}` },
      {
        name: locale === "fr" ? "Banque d'images" : "Image bank",
        url: `${siteUrl}/${locale}/${segment}`,
      },
      { name: tr.title, url: pageUrl },
    ],
  });

  // Resolve image URL (slug-based vs UUID-based)
  const isSlugBased = image.filePath && !image.filePath.startsWith("/image-bank");
  const imgSrc = isSlugBased
    ? image.filePath.startsWith("/")
      ? image.filePath
      : `/${image.filePath}`
    : `${cdnUrl}/image-bank/${image.id}/image-lg.webp`;

  // Download URLs
  const dlBase = `/${locale}/${segment}/${tr.slug}/${downloadSegment}`;
  const dlWebp = `${dlBase}`;
  const dlJpeg = `${dlBase}?format=jpeg`;

  // Sidebar metadata
  const orientation =
    !image.width || !image.height
      ? "—"
      : image.width > image.height
        ? locale === "fr"
          ? "Paysage"
          : "Landscape"
        : image.width < image.height
          ? "Portrait"
          : locale === "fr"
            ? "Carré"
            : "Square";

  const ratioStr = image.width && image.height ? calcRatio(image.width, image.height) : "—";

  const isFr = locale === "fr";

  // Dates lisibles (E-E-A-T fraîcheur) — formatées côté serveur (Server Component,
  // pas de risque d'hydration mismatch).
  const dateFmt: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" };
  const dateLocale = isFr ? "fr-FR" : "en-US";
  const publishedLabel = image.publishedAt
    ? image.publishedAt.toLocaleDateString(dateLocale, dateFmt)
    : null;
  const updatedLabel = image.updatedAt
    ? image.updatedAt.toLocaleDateString(dateLocale, dateFmt)
    : null;

  // Images liées (même module en priorité) — maillage interne + différenciation
  // anti-duplicate. Lecture best-effort : au build stub.invalid → [] (ISR runtime).
  const related = await imageBankService.findRelatedImages({
    imageId: image.id,
    lang: locale,
    module: image.module,
    limit: 10,
  });

  const moduleCtx = getModuleContext(image.module, locale);
  const secondaryKeywords = Array.isArray(image.keywordsSecondary)
    ? (image.keywordsSecondary.filter((k) => typeof k === "string" && k.length > 0) as string[])
    : [];
  const attribution = `© ${resolveCopyrightHolder(image.copyrightHolder)} — « ${tr.title} ». Licence CC BY 4.0. Source : ${pageUrl}`;

  return (
    <main className="container mx-auto max-w-6xl px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
      />

      {/* Breadcrumb visible — complète le BreadcrumbList JSON-LD + maillage. */}
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-gray-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href={`/${locale}`} className="hover:text-terracotta transition-colors">
              {isFr ? "Accueil" : "Home"}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={`/${locale}/${segment}`}
              className="hover:text-terracotta transition-colors"
            >
              {isFr ? "Banque d'images" : "Image bank"}
            </Link>
          </li>
          {moduleCtx && (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link
                  href={`/${locale}/${segment}?module=${image.module}`}
                  className="hover:text-terracotta transition-colors"
                >
                  {moduleCtx.label}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden="true">/</li>
          <li className="text-gray-700" aria-current="page">
            {tr.title}
          </li>
        </ol>
      </nav>

      <article className="grid grid-cols-1 gap-10 lg:grid-cols-[2fr_1fr]">
        {/* Colonne principale — visuel + contenu unique (anti-thin) */}
        <div className="flex flex-col gap-8">
          <figure className="relative">
            <div className="bg-bg relative overflow-hidden rounded-xl border border-gray-100">
              <Image
                src={imgSrc}
                alt={tr.alt ?? tr.title ?? ""}
                width={image.width ?? 1280}
                height={image.height ?? 720}
                sizes="(min-width: 1024px) 66vw, 100vw"
                priority
                fetchPriority="high"
                {...(image.lqipDataUri
                  ? { placeholder: "blur" as const, blurDataURL: image.lqipDataUri }
                  : {})}
                className="h-auto w-full"
              />
              {/* Badge CC BY 4.0 */}
              <span className="absolute right-3 bottom-3 rounded bg-black/60 px-2 py-1 text-[11px] font-semibold text-white">
                CC BY 4.0
              </span>
            </div>
            {tr.caption && (
              <figcaption className="mt-3 text-sm text-gray-500 italic">{tr.caption}</figcaption>
            )}
          </figure>

          <header>
            <h1 className="text-2xl leading-snug font-bold text-gray-900 lg:text-3xl">
              {tr.title}
            </h1>
            {/* Byline E-E-A-T : autorité (qui ?) + fraîcheur (quand ?) visibles. */}
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
              <Link
                href={`/${locale}/a-propos`}
                className="hover:text-terracotta font-medium text-gray-600"
              >
                {isFr ? "Par Axion-IA" : "By Axion-IA"}
              </Link>
              {publishedLabel && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    {isFr ? "Publié le " : "Published "}
                    <time dateTime={image.publishedAt?.toISOString()}>{publishedLabel}</time>
                  </span>
                </>
              )}
              {updatedLabel && updatedLabel !== publishedLabel && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    {isFr ? "Mis à jour le " : "Updated "}
                    <time dateTime={image.updatedAt?.toISOString()}>{updatedLabel}</time>
                  </span>
                </>
              )}
            </p>
            {tr.description && (
              <p className="image-description mt-3 text-base leading-relaxed text-gray-700">
                {tr.description}
              </p>
            )}
          </header>

          {/* Résumé IA — promu en section à part entière (citabilité AEO/GEO). */}
          {tr.aiSummary && (
            <section>
              <h2 className="mb-2 text-lg font-semibold text-gray-900">
                {isFr ? "À propos de cette image" : "About this image"}
              </h2>
              <p className="image-about text-sm leading-relaxed text-gray-600">{tr.aiSummary}</p>
            </section>
          )}

          {/* Contexte métier + lien interne vers la page service correspondante. */}
          {moduleCtx && (
            <section className="bg-bg rounded-xl border border-gray-100 p-5">
              <h2 className="mb-2 text-sm font-semibold text-gray-900">
                {isFr ? "En lien avec ce visuel" : "Related to this visual"}
              </h2>
              <p className="text-sm leading-relaxed text-gray-600">{moduleCtx.blurb}</p>
              <Link
                href={moduleCtx.href}
                className="text-terracotta mt-3 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
              >
                {moduleCtx.cta} <span aria-hidden="true">→</span>
              </Link>
            </section>
          )}

          {/* Sujets (keywords secondaires enrichis) — densité sémantique. */}
          {secondaryKeywords.length > 0 && (
            <section>
              <h2 className="mb-2 text-[11px] font-semibold tracking-widest text-gray-400 uppercase">
                {isFr ? "Sujets" : "Topics"}
              </h2>
              <ul className="flex flex-wrap gap-2">
                {secondaryKeywords.map((k) => (
                  <li key={k} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                    {k}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Sidebar métadonnées */}
        <aside
          className="flex flex-col gap-6"
          aria-label={isFr ? "Métadonnées de l'image" : "Image metadata"}
        >
          {/* Boutons téléchargement.

              🔴 GEO-035 (audit GEO/AEO 2026-08-14) — `rel="nofollow"` OBLIGATOIRE.
              Ces deux ancres sont crawlables : sur ~288 pages galerie, elles
              exposent 576 URLs dont CHAQUE visite déclenche une transformation
              Sharp et deux écritures en base. Un robot qui suit les liens fait
              donc travailler l'origine pour rien, et faisait au passage remonter
              le `lastmod` du sitemap images (GEO-036, corrigé dans la route).

              `nofollow` dit aux moteurs de ne pas suivre ; la règle `Disallow`
              posée sur le segment `telecharger` dans `robots.ts` le double côté crawl, et le
              `X-Robots-Tag: noindex, nofollow` de la route ferme le troisième
              chemin. Les trois sont volontaires : un seul suffirait à un robot
              respectueux, les trois couvrent les autres. */}
          <div className="flex flex-col gap-2.5">
            <a
              href={dlJpeg}
              download
              rel="nofollow"
              className="bg-terracotta focus-visible:ring-terracotta flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              <DownloadIcon className="h-4 w-4" />
              {isFr ? "Télécharger JPG" : "Download JPG"}
            </a>
            <a
              href={dlWebp}
              download
              rel="nofollow"
              className="hover:border-terracotta hover:text-terracotta focus-visible:ring-terracotta flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              <DownloadIcon className="h-4 w-4" />
              {isFr ? "Télécharger WebP" : "Download WebP"}
            </a>
          </div>

          {/* Séparateur */}
          <hr className="border-gray-100" />

          {/* Détails */}
          <section>
            <h2 className="mb-3 text-[11px] font-semibold tracking-widest text-gray-400 uppercase">
              {isFr ? "Détails" : "Details"}
            </h2>
            <dl className="space-y-2">
              {image.width && image.height && (
                <DetailRow
                  label={isFr ? "Dimensions" : "Dimensions"}
                  value={`${image.width} × ${image.height} px`}
                />
              )}
              <DetailRow label={isFr ? "Orientation" : "Orientation"} value={orientation} />
              <DetailRow label="Format" value={image.fileFormat?.toUpperCase() ?? "WebP"} />
              <DetailRow label="Ratio" value={ratioStr} />
              <DetailRow
                label={isFr ? "Licence" : "License"}
                value={
                  <a
                    href="https://creativecommons.org/licenses/by/4.0/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-terracotta hover:underline"
                  >
                    {image.licenseType ?? "CC BY 4.0"}
                  </a>
                }
              />
              {image.copyrightHolder && (
                <DetailRow
                  label="© Copyright"
                  value={resolveCopyrightHolder(image.copyrightHolder)}
                />
              )}
              {image.photographerName && (
                <DetailRow
                  label={isFr ? "Photographe" : "Photographer"}
                  value={image.photographerName}
                />
              )}
            </dl>
          </section>

          {/* Localisation */}
          {image.geoPlacename && (
            <section>
              <h2 className="mb-2 text-[11px] font-semibold tracking-widest text-gray-400 uppercase">
                {isFr ? "Lieu" : "Location"}
              </h2>
              <p className="flex items-center gap-1.5 text-sm text-gray-700">
                <PinIcon className="text-terracotta h-4 w-4 flex-shrink-0" />
                {image.geoPlacename}
              </p>
            </section>
          )}

          {/* Module / sous-module — wrappé en <section> + h2 pour la cohérence
              sémantique avec les autres blocs métadonnées (Détails/Lieu/Tags). */}
          {image.module && (
            <section>
              <h2 className="mb-2 text-[11px] font-semibold tracking-widest text-gray-400 uppercase">
                Module
              </h2>
              <div className="flex flex-wrap gap-2">
                <span className="bg-bg rounded-full border border-gray-200 px-3 py-1 text-[11px] text-gray-600">
                  {image.module}
                </span>
                {image.subModule && (
                  <span className="bg-bg rounded-full border border-gray-200 px-3 py-1 text-[11px] text-gray-500">
                    {image.subModule}
                  </span>
                )}
              </div>
            </section>
          )}

          {/* Tags */}
          {image.tags.length > 0 && (
            <section>
              <h2 className="mb-2 text-[11px] font-semibold tracking-widest text-gray-400 uppercase">
                Tags
              </h2>
              <ul className="flex flex-wrap gap-2">
                {image.tags.map(({ tag }) => (
                  <li
                    key={tag.id}
                    className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700"
                  >
                    {tag.translations.find((t) => t.languageCode === locale)?.name ?? tag.slug}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Attribution CC BY 4.0 — utilité réelle pour la réutilisation. */}
          <section>
            <h2 className="mb-2 text-[11px] font-semibold tracking-widest text-gray-400 uppercase">
              {isFr ? "Attribution (CC BY 4.0)" : "Attribution (CC BY 4.0)"}
            </h2>
            <p className="mb-2 text-xs text-gray-500">
              {isFr
                ? "Réutilisez cette image librement en créditant :"
                : "Reuse this image freely with credit:"}
            </p>
            <code className="bg-bg block rounded-lg border border-gray-100 p-3 text-[11px] leading-relaxed text-gray-700 select-all">
              {attribution}
            </code>
          </section>
        </aside>
      </article>

      {/* Images similaires — maillage interne + différenciation anti-duplicate. */}
      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-5 text-xl font-bold text-gray-900">
            {isFr ? "Images similaires" : "Related images"}
          </h2>
          <GalleryGrid
            images={related}
            locale={locale}
            cdnUrl={cdnUrl}
            firstImagePriority={false}
          />
          <div className="mt-6">
            <Link
              href={`/${locale}/${segment}`}
              className="text-terracotta inline-flex items-center gap-1 text-sm font-semibold hover:underline"
            >
              {isFr ? "Voir toute la banque d'images" : "Browse the full image bank"}{" "}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}

/**
 * Contexte métier d'une image selon son `module` → bloc informatif + lien interne
 * vers la page service correspondante. Renvoie `null` pour les modules sans page
 * service dédiée (logo, graphique, proposition…) afin d'éviter tout bloc générique
 * « doorway ». Le texte décrit ce que le visuel illustre — pas du remplissage SEO.
 */
function getModuleContext(
  module: string | null,
  locale: "fr" | "en",
): { label: string; blurb: string; href: string; cta: string } | null {
  if (!module) return null;
  const isFr = locale === "fr";
  const map: Record<
    string,
    {
      href: string;
      label: { fr: string; en: string };
      blurb: { fr: string; en: string };
      cta: { fr: string; en: string };
    }
  > = {
    audits: {
      href: `/${locale}/audit`,
      label: { fr: "Audits IA", en: "AI Audits" },
      blurb: {
        fr: "Ce visuel illustre la démarche d'audit IA d'Axion-IA : cartographier vos processus, repérer les tâches automatisables et chiffrer le ROI avant tout déploiement.",
        en: "This visual illustrates Axion-IA's AI audit approach: mapping your processes, spotting automatable tasks and quantifying ROI before any deployment.",
      },
      cta: { fr: "Découvrir l'audit IA", en: "Explore AI audit" },
    },
    implementations: {
      href: `/${locale}/implementation`,
      label: { fr: "Implémentations IA", en: "AI Implementations" },
      blurb: {
        fr: "Ce visuel illustre une implémentation IA opérationnelle : des automatisations concrètes greffées sur vos outils, mesurées en heures et en euros gagnés.",
        en: "This visual illustrates an operational AI implementation: concrete automations grafted onto your tools, measured in hours and euros saved.",
      },
      cta: { fr: "Voir les implémentations", en: "See implementations" },
    },
    interventions: {
      href: `/${locale}/interventions`,
      label: { fr: "Interventions & formations", en: "Interventions & training" },
      blurb: {
        fr: "Ce visuel illustre les interventions et formations IA d'Axion-IA : monter vos équipes en compétence sur Claude et l'IA opérationnelle, en présentiel ou à distance.",
        en: "This visual illustrates Axion-IA's AI interventions and training: upskilling your teams on Claude and operational AI, on-site or remote.",
      },
      cta: { fr: "Voir les interventions", en: "See interventions" },
    },
    "un-a-un": {
      href: `/${locale}/interventions/individuel`,
      label: { fr: "Accompagnement un-à-un", en: "One-to-one coaching" },
      blurb: {
        fr: "Ce visuel illustre l'accompagnement individuel : un expert Axion-IA à vos côtés pour intégrer l'IA dans votre métier, à votre rythme.",
        en: "This visual illustrates one-to-one coaching: an Axion-IA expert by your side to embed AI into your work, at your pace.",
      },
      cta: { fr: "Accompagnement individuel", en: "One-to-one coaching" },
    },
  };
  const entry = map[module];
  if (!entry) return null;
  return {
    label: isFr ? entry.label.fr : entry.label.en,
    blurb: isFr ? entry.blurb.fr : entry.blurb.en,
    href: entry.href,
    cta: isFr ? entry.cta.fr : entry.cta.en,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function calcRatio(w: number, h: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(w, h);
  const rw = w / d;
  const rh = h / d;
  if (rw > 20 || rh > 20) return `${(w / h).toFixed(2)}:1`;
  return `${rw}:${rh}`;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray-100 py-1.5">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-right text-xs font-medium text-gray-800">{value}</dd>
    </div>
  );
}

function DownloadIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function PinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
