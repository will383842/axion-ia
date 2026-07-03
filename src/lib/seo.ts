import type { Metadata } from "next";
import { routing, type Locale } from "@/i18n/routing";
import { env } from "@/env";
import { isEnLocaleDisabled } from "@/lib/i18n/en-to-fr-redirect";
// Cycle d'import autorisé : `service-coverage.ts` réimporte SITE_URL d'ici, mais
// SITE_URL est une const tier-0 résolue au top-level. Les fonctions sont
// appelées au runtime quand les 2 modules sont déjà évalués. ESM-safe.
import { buildServiceAreasServed } from "@/lib/service-coverage";
import { FOUNDER } from "@/lib/brand";
import { buildOrganizationSameAs } from "@/lib/seo/wikidata-sameas";
import { buildSpeakableSpecification } from "@/lib/seo/speakable-universal";
import { getPageImages, getRepresentativePageImage } from "@/lib/seo/page-images";

// SITE_URL — résolu via env validé (`src/env.ts`).
//
// Fallback safety net en prod : si `NEXT_PUBLIC_SITE_URL` n'est pas défini
// au build (env Coolify manquant), `env.NEXT_PUBLIC_SITE_URL` fallback sur
// `http://localhost:3000` ce qui casse `metadataBase` (og:image avec hôte
// localhost dans les SSG). Pour le canonique de prod, on force le bon
// domaine quand l'env var est manifestement le default localhost et qu'on
// est en build de prod (NODE_ENV=production).
//
// La source de vérité reste l'env var — c'est juste un filet de sécurité.
const RAW_SITE_URL = env.NEXT_PUBLIC_SITE_URL;
export const SITE_URL =
  process.env.NODE_ENV === "production" && RAW_SITE_URL.startsWith("http://localhost")
    ? "https://axion-ia.com"
    : RAW_SITE_URL;

// Build timestamp ISO — signal de fraîcheur AI Overviews 2026.
//
// Sprint SEO perfection 2026-05-14 : aligné sur `process.env.BUILD_TIME` injecté
// par `next.config.ts` (même source de vérité que `app/sitemap.ts`). Avant ce
// fix, `new Date()` runtime générait un timestamp différent à chaque cold-start
// du worker → `dateModified` Google/Perplexity/Claude.ai mentait à chaque
// redémarrage du process (~1× par jour en prod, plus en dev).
//
// Maintenant : 1 seul timestamp ISO partagé entre `sitemap.xml` <lastmod> +
// `dateModified` de TOUTES les pages metadata. Cohérence parfaite des signaux
// de fraîcheur, ce que Google/LLMs reconnaissent comme « site activement
// maintenu » plutôt que « site qui ment sur sa fraîcheur ».
//
// Ordre de fallback :
//   1. `process.env.BUILD_TIME` (set par CI/CD Coolify, prod)
//   2. `new Date().toISOString()` (dev local, cold-start)
//
// Pour override par page (article blog, cas concret), passer `dateModified`
// explicitement aux factories. Pour services canoniques (audit, interventions),
// la build-date est suffisante — elle marque que le site est actif et maintenu.
export const BUILD_DATE = process.env.BUILD_TIME ?? new Date().toISOString();

/**
 * Date éditoriale FIGÉE pour les `dateModified` des pages statiques/hubs
 * (audit fraîcheur 2026-06-08). Remplace `BUILD_DATE` partout où une page
 * evergreen affichait une « dernière modification » qui glissait à CHAQUE
 * deploy sans changement de contenu (date-gaming → gaspillage de crawl-budget
 * sur un site jeune). À bumper À LA MAIN lors d'une refonte de contenu large.
 *
 * ⚠️ Garder en sync avec `EDITORIAL_BASELINE` de `src/app/sitemap.ts` et
 * `EDITORIAL_BASELINE_ISO` de `src/app/sitemap-index.xml/route.ts`.
 * Cf. `_AUDIT/PLAN-FRESHNESS-EXHAUSTIF-2026-06-08.md`.
 */
export const SITE_EDITORIAL_DATE = "2026-06-08T00:00:00.000Z";

interface ProductSeoInput {
  locale: Locale;
  /** Localized pathname WITHOUT locale prefix, e.g. /interventions/essentielle. */
  path: string;
  title: string;
  description: string;
  /** Optional alternate path per-locale; defaults to `path`. */
  alternates?: Partial<Record<Locale, string>>;
  /**
   * Optional explicit OG image URL. If absent, falls back to dynamic
   * `/api/og?title=...` generated image. Always emitted in `openGraph.images`
   * + `twitter.images` for LinkedIn/Slack/Twitter/Facebook previews.
   */
  ogImage?: string;
  /**
   * Optional accent for `/api/og` dynamic image (purple/orange/green). Le défaut
   * (accent omis) = terracotta, signature de marque. `primary` (bleu) RETIRÉ
   * 2026-06-20 — la marque ne doit jamais émettre de carte OG bleue.
   */
  ogAccent?: "purple" | "orange" | "green";
  /**
   * VIS-05/SEO-05 — type OpenGraph. Défaut "website" (rétro-compat). Les pages
   * d'article (blog/actualites/guides/connaissances/centre-aide) passent
   * "article" pour un og:type correct (preview sociale + signal éditorial).
   */
  ogType?: "website" | "article";
}

/**
 * P0-7 audit E2E NAV+CTA 2026-05-15 — résout le slug localisé à partir du
 * chemin FR canonical en consultant `routing.pathnames` (next-intl). Match
 * exact + pattern matching pour les routes `[slug]` dynamiques. Si aucun
 * mapping trouvé, retourne le `path` inchangé (legacy behaviour).
 *
 * Avant ce helper, `buildProductMetadata` réutilisait le slug FR pour
 * l'alternate EN ⇒ ~40 pages annonçaient un `<link hreflang="en" href="...">`
 * pointant vers une URL EN inexistante (e.g. `/en/interventions/collectives`
 * au lieu de `/en/interventions/team-trainings`).
 */
function resolveLocalizedPath(path: string, locale: Locale): string {
  const pathnames = routing.pathnames as Record<string, string | Record<Locale, string>>;
  // 1) Match exact (cas fréquent : pages statiques non dynamiques)
  const exact = pathnames[path];
  if (exact !== undefined) {
    return typeof exact === "string" ? exact : exact[locale];
  }
  // 2) Pattern match (routes dynamiques `[slug]`, `[region]`, etc.). Compare
  //    segment par segment : un segment de la clé qui commence par `[` matche
  //    n'importe quel segment du chemin réel.
  const pathSegs = path.split("/").filter(Boolean);
  for (const [key, value] of Object.entries(pathnames)) {
    const keySegs = key.split("/").filter(Boolean);
    if (keySegs.length !== pathSegs.length) continue;
    const matches = keySegs.every((seg, i) => seg.startsWith("[") || seg === pathSegs[i]);
    if (!matches) continue;
    const template = typeof value === "string" ? value : value[locale];
    const tmplSegs = template.split("/").filter(Boolean);
    // Réinjecte les valeurs réelles aux positions des paramètres dynamiques
    return "/" + tmplSegs.map((seg, i) => (seg.startsWith("[") ? pathSegs[i] : seg)).join("/");
  }
  // 3) Fallback : path inchangé
  return path;
}

/**
 * Borne une meta description à 158 caractères (anti-troncature SERP Google).
 * Coupe au dernier mot complet sous la limite + ellipse. Perfection 2026 :
 * démontre un contrôle éditorial et évite les « … » imposés par le moteur.
 */
export function truncateMetaDescription(d: string, max = 158): string {
  if (d.length <= max) return d;
  const slice = d.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(" ");
  return `${(lastSpace > 60 ? slice.slice(0, lastSpace) : slice).trimEnd()}…`;
}

// ---------------------------------------------------------------------------
// Filet de sécurité longueur des métadonnées d'ARTICLES (P0 qualité 2026-06-25)
// ---------------------------------------------------------------------------
// L'audit a relevé des metaTitle/metaDescription chroniquement trop courts
// (metaTitle 33-50 car au lieu de 50-60 ; metaDescription 107-144 au lieu de
// 140-160). Les prompts ont été durcis côté generators ; ici on ajoute un
// garde-fou DÉTERMINISTE et PUR au rendu, qui ne s'applique QUE lorsque la
// valeur est manquante ou trop courte (zéro régression sur les valeurs déjà
// dans la fourchette). Volontairement conservateur : on n'allonge jamais
// artificiellement avec du remplissage creux — on s'appuie sur des données déjà
// présentes (title de l'article, suffixe de marque, excerpt/directAnswer).

const TITLE_BRAND_SUFFIX = " · Axion-IA";
/** En dessous, le metaTitle est considéré absent/cassé → fallback sur le title. */
const META_TITLE_MISSING_BELOW = 30;
/** En dessous (mais ≥ MISSING), on suffixe la marque tant que ≤ 60 car. */
const META_TITLE_SUFFIX_BELOW = 45;
const META_TITLE_MAX = 60;
/** En dessous, la metaDescription est considérée trop courte → fallback. */
const META_DESCRIPTION_MIN = 80;

/**
 * Garde-fou metaTitle au rendu (articles). Pur/déterministe.
 * - metaTitle absent ou < 30 car → on prend le `title` de l'article.
 * - titre retenu < 45 car → on suffixe «  · Axion-IA » SI ça reste ≤ 60 car
 *   (sinon on laisse tel quel : mieux vaut un titre court qu'un titre tronqué).
 * Ne touche jamais un metaTitle déjà ≥ 45 car (cas nominal).
 */
export function ensureArticleMetaTitle(
  metaTitle: string | null | undefined,
  title: string,
): string {
  const mt = (metaTitle ?? "").trim();
  const base = mt.length >= META_TITLE_MISSING_BELOW ? mt : title.trim();
  if (base.length >= META_TITLE_SUFFIX_BELOW) return base;
  if (base.endsWith(TITLE_BRAND_SUFFIX)) return base;
  const suffixed = `${base}${TITLE_BRAND_SUFFIX}`;
  return suffixed.length <= META_TITLE_MAX ? suffixed : base;
}

/**
 * Garde-fou metaDescription au rendu (articles). Pur/déterministe.
 * - metaDescription absente ou < 80 car → fallback sur le 1er candidat non vide
 *   ≥ 80 car parmi (excerpt, directAnswer), tronqué proprement par
 *   `truncateMetaDescription`. Si aucun candidat n'atteint 80 car, on renvoie le
 *   plus long disponible (jamais pire que l'existant).
 * Ne touche jamais une metaDescription déjà ≥ 80 car (cas nominal).
 */
export function ensureArticleMetaDescription(
  metaDescription: string | null | undefined,
  fallbacks: { excerpt?: string | null; directAnswer?: string | null },
): string {
  const md = (metaDescription ?? "").trim();
  if (md.length >= META_DESCRIPTION_MIN) return md;
  const candidates = [md, (fallbacks.excerpt ?? "").trim(), (fallbacks.directAnswer ?? "").trim()];
  const acceptable = candidates.find((c) => c.length >= META_DESCRIPTION_MIN);
  const best = acceptable ?? candidates.reduce((a, b) => (b.length > a.length ? b : a), "");
  return best ? truncateMetaDescription(best) : md;
}

export function buildProductMetadata({
  locale,
  path,
  title,
  description,
  alternates,
  ogImage,
  ogAccent,
  ogType = "website",
}: ProductSeoInput): Metadata {
  const fr = alternates?.fr ?? resolveLocalizedPath(path, "fr");
  const en = alternates?.en ?? resolveLocalizedPath(path, "en");
  // Default OG image : dynamic `/api/og` with title + optional accent.
  // For pages that need a custom static OG (homepage), pass `ogImage`.
  const resolvedOgImage =
    ogImage ??
    `${SITE_URL}/api/og?title=${encodeURIComponent(title)}${ogAccent ? `&accent=${ogAccent}` : ""}`;
  // EN locale désactivé (2026-05-16) → omettre hreflang="en" pour ne pas
  // signaler à Google une alternate EN qui répond 301. Quand EN sera
  // réactivé (EN_LOCALE_ENABLED=true), hreflang="en" revient automatique.
  const enDisabled = isEnLocaleDisabled();
  // title-double-suffix fix (2026-06-14) : le root layout déclare
  // `title.template = "%s · Axion-IA"`. Next.js l'applique à toute `title` string
  // renvoyée ici. Si le titre source contient DÉJÀ « · Axion-IA », le template
  // le ré-ajoute → « … · Axion-IA · Axion-IA ». On renvoie alors `{ absolute }`
  // (bypass template) ; sinon la string brute (le template appose le suffixe).
  const TITLE_SUFFIX = " · Axion-IA";
  // P0 qualité 2026-06-25 — filet de sécurité longueur titre pour les ARTICLES
  // uniquement (ogType="article"). Si le titre fourni est court (< 45 car), on le
  // suffixe «  · Axion-IA » sans dépasser 60 car. Déterministe, ne touche que les
  // titres courts ; les pages services (ogType="website") restent inchangées.
  const effectiveTitle = ogType === "article" ? ensureArticleMetaTitle(title, title) : title;
  const resolvedTitle: NonNullable<Metadata["title"]> = effectiveTitle.endsWith(TITLE_SUFFIX)
    ? { absolute: effectiveTitle }
    : effectiveTitle;
  // Sprint Web Vitals fix 2026-05-17 — normalize canonical (strip trailing
  // slash sauf root pour éviter Lighthouse `canonical` audit fail).
  // Next.js 16 defaults trailingSlash=false : `/fr/` doit pointer canonical
  // `/fr` (sans slash) pour matcher la canonical URL servie. Sinon Lighthouse
  // détecte un mismatch entre URL testée (sans slash) et canonical (avec).
  const normalizePath = (p: string): string => (p === "/" ? "" : p.replace(/\/+$/, ""));
  const frNorm = normalizePath(fr);
  const enNorm = normalizePath(en);
  const pathNorm = normalizePath(path);
  // Perfection 2026 — description bornée 158 car (SERP/OG/Twitter cohérents).
  const metaDescription = truncateMetaDescription(description);
  const languages: Record<string, string> = {
    fr: `/fr${frNorm}`,
    "x-default": `/fr${frNorm}`,
  };
  if (!enDisabled) {
    languages.en = `/en${enNorm}`;
  }
  return {
    title: resolvedTitle,
    description: metaDescription,
    alternates: {
      canonical: `/${locale}${pathNorm}`,
      languages,
    },
    openGraph: {
      type: ogType,
      locale: locale === "fr" ? "fr_FR" : "en_US",
      url: `${SITE_URL}/${locale}${pathNorm}`,
      title,
      description: metaDescription,
      siteName: "Axion-IA",
      images: [
        {
          url: resolvedOgImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: metaDescription,
      images: [resolvedOgImage],
    },
    // Refonte AEO 2026-06-22 — directives fines : snippets illimités (réponses
    // directes citées par Google/AI Overviews) + vignettes large (Discover/Images)
    // + previews vidéo. Sans ça Google peut tronquer le snippet et limiter l'image.
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-snippet": -1,
        "max-image-preview": "large",
        "max-video-preview": -1,
      },
    },
  };
}

interface ServiceJsonLdInput {
  locale: Locale;
  path: string;
  name: string;
  description: string;
  /** Price in EUR HT. Omit for "on-quote" services. */
  priceEur?: number;
  serviceType?: string;
  /**
   * ISO date string — signal de fraîcheur Google AI Overviews 2026. Default :
   * `BUILD_DATE` (cold-start du serveur Next). Passer explicitement pour
   * écraser (ex. service modifié à une date connue).
   */
  dateModified?: string;
  /** Single area served (legacy, string). Use `areasServed` for multi-region. */
  area?: string;
  /**
   * Multi-area coverage — Country + administrative regions + city channels.
   * Sprint 14.9 levier 2 : signal AEO/GEO « disponible partout en France »
   * pour pages services canoniques (`/audit`, `/interventions`, `/implementation`).
   * Chaque entrée typée en `Country` / `AdministrativeArea` / `City` selon
   * Schema.org. Optionnel `url` pour pointer vers la page locale dédiée
   * (ex. `/implantations/[region]`).
   */
  areasServed?: ReadonlyArray<{
    type: "Country" | "AdministrativeArea" | "City";
    name: string;
    url?: string;
  }>;
  /**
   * Canaux de service géolocalisés — top métropoles où Axion-IA délivre la
   * prestation sur site. Émis comme `availableChannel` Schema.org. Permet
   * aux LLMs d'énumérer les villes éligibles quand un utilisateur demande
   * « où est-ce que ce service est disponible ? ».
   */
  availableChannels?: ReadonlyArray<{ name: string; url: string }>;
  /**
   * Speakable specification — auto-injecte `speakable` (selectors CSS) sur
   * Service JSON-LD pour citation Google Assistant / Alexa / Claude voice.
   * Sprint perfection AEO 2026-05-28 (Will). Default désormais `true` :
   * toutes les ~26 pages services bénéficient automatiquement du signal
   * AEO vocal sans modification. Pour bypass (rare), passer
   * `speakable: false`. Custom selectors via `{ selectors: [...] }`.
   * Selectors par défaut : `h1`, `h2`, `[data-speakable]`.
   */
  speakable?: boolean | { selectors: ReadonlyArray<string> };
}

export function buildServiceJsonLd({
  locale,
  path,
  name,
  description,
  priceEur,
  serviceType,
  dateModified,
  area,
  areasServed,
  availableChannels,
  speakable,
}: ServiceJsonLdInput) {
  const url = `${SITE_URL}/${locale}${path}`;

  // Audit perfection 2026-05-12 : auto-injection `areasServed` par défaut
  // (France + 13 régions indexable + top villes) si la page n'a rien passé
  // explicitement. Élimine le boilerplate sur les ~25 pages services qui
  // utilisaient `buildServiceJsonLd` sans préciser leur couverture. Pour
  // bypass (ex. service hors France), passer explicitement `areasServed: []`.
  // Import-time dependency : `buildServiceAreasServed` est déclaré PLUS BAS
  // dans ce fichier pour éviter le cycle d'import avec service-coverage.ts.
  const resolvedAreasServed =
    areasServed === undefined ? buildServiceAreasServed(locale) : areasServed;

  // Schema.org : `areaServed` peut être un string OU un tableau d'objets
  // typés (Country/AdministrativeArea/City). On privilégie `areasServed`
  // (multi) et on retombe sur `area` (string legacy) seulement si non fourni.
  const areaServedNode =
    resolvedAreasServed && resolvedAreasServed.length > 0
      ? resolvedAreasServed.map((a) => ({
          "@type": a.type,
          name: a.name,
          ...(a.url ? { url: a.url } : {}),
        }))
      : area
        ? area
        : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    description,
    url,
    // dateModified : émis UNIQUEMENT si l'appelant fournit une vraie date.
    // Audit fraîcheur 2026-06-08 : on a retiré le défaut `?? BUILD_DATE` qui
    // faisait avancer la date de ~29 pages services à CHAQUE deploy sans
    // changement de contenu (date-gaming, mauvais pour un faible crawl-budget).
    // Mieux vaut OMETTRE le champ que mentir : Google tolère l'absence.
    // Cf. `_AUDIT/PLAN-FRESHNESS-EXHAUSTIF-2026-06-08.md`.
    ...(dateModified ? { dateModified } : {}),
    provider: {
      "@type": "Organization",
      name: "Axion-IA",
      url: SITE_URL,
    },
    ...(serviceType ? { serviceType } : {}),
    ...(areaServedNode !== undefined ? { areaServed: areaServedNode } : {}),
    ...(availableChannels && availableChannels.length > 0
      ? {
          availableChannel: availableChannels.map((c) => ({
            "@type": "ServiceChannel",
            name: c.name,
            serviceUrl: c.url,
          })),
        }
      : {}),
    ...(typeof priceEur === "number"
      ? {
          offers: {
            "@type": "Offer",
            price: priceEur.toString(),
            priceCurrency: "EUR",
            availability: "https://schema.org/InStock",
            url,
          },
        }
      : {}),
    // Speakable specification — OPT-IN depuis 2026-06-22 (révision AEO Will).
    // Speakable est pertinent pour le CONTENU-RÉPONSE (articles/news/FAQ), pas
    // pour les pages services/villes/tarifs où la valeur vocale est nulle et où
    // Google l'ignore de toute façon. Donc default OFF ici : on n'émet Speakable
    // que si le caller le demande explicitement (`speakable:true` ou selectors).
    ...(speakable === true || (typeof speakable === "object" && speakable.selectors)
      ? {
          speakable: buildSpeakableSpecification({
            selectors:
              typeof speakable === "object" && speakable.selectors
                ? speakable.selectors
                : ["h1", "h2", "[data-speakable]", "[data-answer]", "[data-faq-a]"],
          }),
        }
      : {}),
  } as const;
}

interface FaqJsonLdInput {
  items: ReadonlyArray<{ question: string; answer: string }>;
  /**
   * Sélecteur CSS pour Speakable AEO 2026 (Google Assistant + Alexa). Defaults
   * à `[data-faq-q],[data-faq-a]` — convention site Axion-IA pour marquer les
   * réponses lisibles à voix haute. Passer `false` pour désactiver speakable
   * (rare : ex. FAQ confidentielle technique).
   */
  speakable?: boolean | string;
  /**
   * Date de dernière révision éditoriale ISO. Émise seulement si fournie
   * (audit fraîcheur 2026-06-08 : plus de défaut `BUILD_DATE` qui glissait à
   * chaque deploy). Passer une vraie date stable, jamais un timestamp de build.
   */
  dateModified?: string;
}

export function buildFaqJsonLd({ items, speakable = true, dateModified }: FaqJsonLdInput) {
  // Auto-injection Speakable (audit perfection 2026-05-12) — chaque FAQ est
  // désormais éligible Google Assistant / Alexa quand un utilisateur demande
  // "Axion-IA, comment ça se passe une formation IA ?" via vocal. Sans
  // override, on cible les attributs data-faq-q et data-faq-a (à appliquer
  // dans les composants InterventionFaqList / FaqAccordion progressivement).
  const speakableSelector = typeof speakable === "string" ? speakable : "[data-faq-q],[data-faq-a]";
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    // Perfection 2026 — publisher/author rattachés (E-E-A-T pour Perplexity/Claude :
    // une FAQPage orpheline d'éditeur pèse moins en attribution).
    publisher: { "@id": `${SITE_URL}/#organization` },
    author: { "@id": `${SITE_URL}/fr/equipe/manon#person` },
    // dateModified émis seulement si fourni (audit fraîcheur 2026-06-08 : retrait
    // du défaut BUILD_DATE qui avançait à chaque deploy). FAQPage ⊂ WebPage ⊂
    // CreativeWork → dateModified valide quand on a une vraie date stable.
    ...(dateModified ? { dateModified } : {}),
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
    ...(speakable !== false
      ? {
          speakable: buildSpeakableSpecification({ selectors: [speakableSelector] }),
        }
      : {}),
  } as const;
}

interface BreadcrumbJsonLdInput {
  locale: Locale;
  items: ReadonlyArray<{ name: string; href: string }>;
}

export function buildBreadcrumbJsonLd({ locale, items }: BreadcrumbJsonLdInput) {
  // P2-24 audit E2E NAV+CTA 2026-05-15 — `@id` ajouté pour relier ce
  // BreadcrumbList aux schemas WebPage/Article via `isPartOf` (bonus AEO/GEO
  // 2026 : citations Claude.ai / Perplexity / SGE). L'id pointe sur l'URL
  // de la feuille (dernier item) + ancre `#breadcrumb`.
  const leafItem = items[items.length - 1];
  const leafUrl = leafItem
    ? `${SITE_URL}/${locale}${leafItem.href === "/" ? "" : leafItem.href}`
    : `${SITE_URL}/${locale}`;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "@id": `${leafUrl}#breadcrumb`,
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: `${SITE_URL}/${locale}${item.href === "/" ? "" : item.href}`,
    })),
  } as const;
}

// ============================================================
// WebPage / CollectionPage JSON-LD — factory centrale
// ============================================================
//
// Avant 2026-06-22, le nœud `WebPage`/`CollectionPage` était hand-rollé dans
// ~30 pages (chacune réécrivant @id/url/isPartOf/publisher/inLanguage/speakable…).
// Cette factory centralise la construction : 1 source de vérité pour les
// défauts (isPartOf #website, publisher #organization), le `speakable` (via
// `buildSpeakableSpecification`), la normalisation d'URL canonique, et les
// signaux de fraîcheur/E-E-A-T 2026 (`dateModified`, `lastReviewed`,
// `reviewedBy`). Tous les champs page-spécifiques restent passables en option
// (mainEntity, hasPart, about, mentions, breadcrumb, potentialAction, abstract,
// alternativeHeadline) → migration sans perte.
//
// Périmètre : nœuds page-level UNIQUEMENT. Les sous-nœuds minimalistes
// (`Article.mainEntityOfPage = {@id}`, `DefinedTerm.subjectOf`,
// `Product.subjectOf`) ne passent PAS par ici — ils restent des refs `{@id,url}`.

type WebPageType = "WebPage" | "CollectionPage" | "AboutPage" | "ContactPage" | "ProfilePage";

interface WebPageJsonLdInput {
  locale: Locale;
  /** Pathname localisé SANS préfixe de locale (ex. `/sous-processeurs`). */
  path: string;
  /** Titre de la page (name schema.org). */
  name: string;
  /** Sous-type schema.org. Défaut `WebPage` ; `CollectionPage` pour les listings. */
  type?: WebPageType;
  description?: string;
  /**
   * `@id` explicite. Défaut : `${url}#webpage` (ou `#collectionpage`). Sert de
   * point d'ancrage pour les cross-refs `@graph` (breadcrumb, mainEntity…).
   */
  id?: string;
  /** ISO date de publication. */
  datePublished?: string;
  /** ISO date de dernière modification (signal de fraîcheur). Omis si absent. */
  dateModified?: string;
  /**
   * ISO date de dernière revue éditoriale/conformité (E-E-A-T 2026). Distinct de
   * `dateModified` : « contenu vérifié à jour le … ». Omis si absent.
   */
  lastReviewed?: string;
  /** Entité ayant revu la page (paire avec `lastReviewed`). */
  reviewedBy?: { name: string; type?: "Organization" | "Person"; url?: string };
  /**
   * `isPartOf`. Défaut `{ "@id": ${SITE_URL}/#website }`. Passer `null` pour omettre,
   * ou un objet pour pointer une section/collection parente.
   */
  isPartOf?: Record<string, unknown> | null;
  /**
   * `publisher`. Défaut `{ "@id": ${SITE_URL}/#organization }`. Passer `null` pour omettre.
   */
  publisher?: Record<string, unknown> | null;
  /**
   * Speakable AEO. `false`/absent = omis. `true` = selectors par défaut
   * (`buildSpeakableSpecification`). `{ selectors }` = selectors ciblés.
   */
  speakable?: boolean | { selectors: ReadonlyArray<string> };
  /** `mainEntity` (entité principale décrite par la page). Passthrough. */
  mainEntity?: unknown;
  /** `hasPart` (sous-éléments d'une CollectionPage : ListItem, cartes…). Passthrough. */
  hasPart?: unknown;
  /** `about` (sujet de la page : Thing / DefinedTerm / Organization). Passthrough. */
  about?: unknown;
  /** `mentions` (entités mentionnées). Passthrough. */
  mentions?: unknown;
  /** `breadcrumb` — ref `{ "@id": ${url}#breadcrumb }` quand le breadcrumb est dans le même graph. */
  breadcrumb?: { "@id": string } | string;
  /** `potentialAction` (ReserveAction, SearchAction…). Passthrough. */
  potentialAction?: unknown;
  /** Résumé court answer-ready (schema.org `abstract`). */
  abstract?: string;
  /** Titre alternatif (schema.org `alternativeHeadline`). */
  alternativeHeadline?: string;
  /** `inLanguage`. Défaut = `locale`. */
  inLanguage?: string;
  /** Échappatoire pour champs rares non modélisés (mergé tel quel). */
  extra?: Record<string, unknown>;
}

/**
 * Factory `WebPage` / `CollectionPage` (et sous-types). Centralise les défauts
 * de marque (isPartOf #website, publisher #organization), le speakable et la
 * normalisation d'URL. Retourne un objet JSON-LD pur (à passer à `<JsonLd>` ou
 * `<JsonLdGraph>`).
 */
export function buildWebPageJsonLd(input: WebPageJsonLdInput) {
  const {
    locale,
    path,
    name,
    type = "WebPage",
    description,
    id,
    datePublished,
    dateModified,
    lastReviewed,
    reviewedBy,
    isPartOf,
    publisher,
    speakable,
    mainEntity,
    hasPart,
    about,
    mentions,
    breadcrumb,
    potentialAction,
    abstract,
    alternativeHeadline,
    inLanguage,
    extra,
  } = input;

  // URL canonique normalisée (strip trailing slash sauf racine) — cohérent avec
  // `buildProductMetadata`.
  const normPath = path === "/" ? "" : path.replace(/\/+$/, "");
  const url = `${SITE_URL}/${locale}${normPath}`;
  const resolvedId = id ?? `${url}#${type === "CollectionPage" ? "collectionpage" : "webpage"}`;

  // isPartOf / publisher : défaut #website / #organization, `null` pour omettre.
  const resolvedIsPartOf =
    isPartOf === null ? undefined : (isPartOf ?? { "@id": `${SITE_URL}/#website` });
  const resolvedPublisher =
    publisher === null ? undefined : (publisher ?? { "@id": `${SITE_URL}/#organization` });

  const resolvedSpeakable =
    speakable === true || (typeof speakable === "object" && speakable?.selectors)
      ? buildSpeakableSpecification(
          typeof speakable === "object" && speakable.selectors
            ? { selectors: speakable.selectors }
            : undefined,
        )
      : undefined;

  return {
    "@context": "https://schema.org",
    "@type": type,
    "@id": resolvedId,
    url,
    name,
    inLanguage: inLanguage ?? locale,
    ...(description ? { description } : {}),
    ...(abstract ? { abstract } : {}),
    ...(alternativeHeadline ? { alternativeHeadline } : {}),
    ...(resolvedIsPartOf ? { isPartOf: resolvedIsPartOf } : {}),
    ...(resolvedPublisher ? { publisher: resolvedPublisher } : {}),
    ...(datePublished ? { datePublished } : {}),
    ...(dateModified ? { dateModified } : {}),
    ...(lastReviewed ? { lastReviewed } : {}),
    ...(reviewedBy
      ? {
          reviewedBy: {
            "@type": reviewedBy.type ?? "Organization",
            name: reviewedBy.name,
            ...(reviewedBy.url ? { url: reviewedBy.url } : {}),
          },
        }
      : {}),
    ...(about !== undefined ? { about } : {}),
    ...(mentions !== undefined ? { mentions } : {}),
    ...(mainEntity !== undefined ? { mainEntity } : {}),
    ...(hasPart !== undefined ? { hasPart } : {}),
    ...(breadcrumb !== undefined
      ? { breadcrumb: typeof breadcrumb === "string" ? { "@id": breadcrumb } : breadcrumb }
      : {}),
    ...(potentialAction !== undefined ? { potentialAction } : {}),
    ...(resolvedSpeakable ? { speakable: resolvedSpeakable } : {}),
    ...(extra ?? {}),
  } as const;
}

/**
 * Convenience wrapper — `CollectionPage` (pages listing : hubs, catégories,
 * annuaires). Force `type: "CollectionPage"`.
 */
export function buildCollectionPageJsonLd(input: Omit<WebPageJsonLdInput, "type">) {
  return buildWebPageJsonLd({ ...input, type: "CollectionPage" });
}

interface OrganizationJsonLdInput {
  locale: Locale;
  /** Override default contact email. Defaults to `presse@axion-ia.com`. */
  contactEmail?: string;
  /** Override default contact type label. Defaults to FR/EN customer service. */
  contactType?: string;
  /** Numéro TVA FR (FR-TVA). Will fournit plus tard. */
  vatID?: string;
  /** Numéro d'immatriculation RCS / SIREN. Will fournit plus tard. */
  registrationNumber?: string;
  /**
   * Certification Qualiopi (Phase B uniquement). Émet un nœud `hasCredential`
   * (`EducationalOccupationalCredential`) reconnu par le Ministère du Travail —
   * signal SEO/AEO/GEO « organisme de formation certifié » sur TOUTES les pages
   * (le nœud `#organization` est partagé + hérité par le `provider` des Course).
   * Données passées par la couche qualiopi (DB-sourcée, gated) ; `description`
   * porte la mention obligatoire pré-formatée. Omis si absent. seo.ts reste
   * générique (n'importe jamais le module qualiopi).
   */
  qualiopiCertification?: {
    /** N° de certificat Qualiopi. */
    number: string;
    /** Mention obligatoire complète (pré-formatée : catégories + validité). */
    description: string;
    /** Organisme certificateur (COFRAC), optionnel. */
    issuer?: string;
  };
}

// Layout-level Organization JSON-LD — single source of truth for AEO/GEO 2026
// (Claude.ai / Perplexity / SGE / Bing Copilot citations).
//
// Strategy : maximize the number of stable identifying fields so that LLM
// answer engines unambiguously identify "Axion-IA" the entity (vs other
// AI consultancies). `sameAs` provides external corroboration, `foundingLocation`
// + `areaServed` ground geography, `contactPoint` makes it actionable.
//
// `vatID` + `identifier (immatriculation RCS / SIREN)` + `telephone` + `address` :
// audit GSC 2026-06-05 A-14 (faille E-E-A-T Trust). Câblés par défaut sur les env
// vars `COMPANY_*` (toutes `optional` dans `env.ts`) — Will les renseigne côté Coolify
// (RUN scope) et le schéma Organization les émet automatiquement, sans réécrire les
// call sites. Tout reste conditionnel : env absent ⇒ champ omis ⇒ 0 régression.
export function buildOrganizationJsonLd({
  locale,
  contactEmail = env.COMPANY_EMAIL ?? "presse@axion-ia.com",
  contactType,
  vatID = env.COMPANY_VAT_NUMBER,
  registrationNumber = env.COMPANY_REGISTRATION_NUMBER,
  qualiopiCertification,
}: OrganizationJsonLdInput) {
  const isFr = locale === "fr";
  const resolvedContactType = contactType ?? (isFr ? "Service client" : "Customer service");
  return {
    "@context": "https://schema.org",
    "@id": `${SITE_URL}/#organization`,
    "@type": "Organization",
    name: "Axion-IA",
    legalName: "Axion-IA SAS",
    alternateName: ["AxionIA", "Axion IA", "axion-ia.com"],
    url: SITE_URL,
    logo: `${SITE_URL}/opengraph-image`,
    description: isFr
      ? "Cabinet IA opérationnel B2B — interventions, audits et implémentation IA pour entreprises."
      : "Operational B2B AI consultancy — on-site AI sessions, audits and implementation for companies.",
    // Wikidata Q-number prepended si WIKIDATA_QNUMBER_AXIONIA configuré
    // (Sprint v7 Phase 10 — Knowledge Graph triangulation). Fallback safe :
    // sans env var, retombe sur les 2 sources sociales historiques.
    // Profils/citations entité (audit GSC 2026-06-05 A-16). Liens nofollow côté
    // plateformes (n'apportent pas d'autorité) mais corroborent l'entité pour Google
    // + LLMs (sameAs = vérification d'identité, pas de link juice).
    // LinkedIn = vanity public réel `company/axion-ia-france` (confirmé Will 2026-06-05 ;
    // page interne /company/123134154).
    sameAs: [
      ...buildOrganizationSameAs(),
      "https://www.linkedin.com/company/axion-ia-france",
      "https://about.me/axion-ia",
      "https://www.indiehackers.com/AxionIA",
    ],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: isFr ? "Services IA pour entreprises" : "AI services for businesses",
      url: `${SITE_URL}/${isFr ? "fr" : "en"}/interventions`,
    },
    foundingDate: "2024",
    // Siège social réel (2026-07-03) : SAS AXION-IA, 11 Avenue Paul Verlaine,
    // 38100 Grenoble (domiciliation), RCS Grenoble — Auvergne-Rhône-Alpes.
    // L'ancrage entité DOIT refléter le RCS (sinon incohérence NAP ↔ registre
    // = risque E-E-A-T). La visibilité Paris / Île-de-France / toute la France
    // reste portée par `areaServed` + les pages pSEO villes/régions (zone
    // servie), pas par l'adresse du siège. Remplace la décision D7 2026-05-21
    // (ancrage Paris), caduque depuis l'immatriculation à Grenoble.
    foundingLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressCountry: "FR",
        addressRegion: "Auvergne-Rhône-Alpes",
        addressLocality: "Grenoble",
      },
    },
    // Fondateur — E-E-A-T : un humain nommé identifiable derrière l'entité
    // (Williams Jullin, LinkedIn réel). Renforce la confiance Google + la
    // citabilité LLM. Audit E-E-A-T 2026-06-22 (P1) — identité dérivée du SSOT
    // `FOUNDER` (lib/brand.ts) et consolidée sur l'entité canonique
    // `/equipe/williams` : `@id` aligné sur le nœud Person émis par
    // `buildPersonWilliamsJsonLd()` → une seule entité Person fusionnée par
    // Google (avant : nom « Williams » + url `/a-propos#will` divergeaient de la
    // page d'autorité `/equipe/williams`).
    founder: {
      "@type": "Person",
      "@id": `${SITE_URL}/fr/equipe/williams#person`,
      name: FOUNDER.fullName,
      jobTitle: isFr ? FOUNDER.jobTitleFr : FOUNDER.jobTitleEn,
      url: `${SITE_URL}/fr/equipe/williams`,
      sameAs: [FOUNDER.linkedin],
    },
    areaServed: ["FR", "EU"],
    knowsLanguage: ["fr", "en"],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: resolvedContactType,
      email: contactEmail,
      availableLanguage: ["French", "English"],
      ...(env.COMPANY_PHONE ? { telephone: env.COMPANY_PHONE } : {}),
    },
    // Adresse postale complète (audit A-14) — émise si `COMPANY_ADDRESS` renseigné.
    ...(env.COMPANY_ADDRESS
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: env.COMPANY_ADDRESS,
            addressLocality: "Grenoble",
            postalCode: "38100",
            addressRegion: "Auvergne-Rhône-Alpes",
            addressCountry: "FR",
          },
        }
      : {}),
    ...(vatID ? { vatID } : {}),
    ...(registrationNumber
      ? {
          identifier: {
            "@type": "PropertyValue",
            propertyID: "immatriculation RCS",
            value: registrationNumber,
          },
        }
      : {}),
    // Certification Qualiopi (Phase B) — `hasCredential` reconnu par le Ministère
    // du Travail. Émis sur TOUTES les pages via le nœud #organization partagé +
    // hérité par le `provider` des Course (fiches formations). Omis si absent.
    ...(qualiopiCertification
      ? {
          hasCredential: {
            "@type": "EducationalOccupationalCredential",
            "@id": `${SITE_URL}/#qualiopi`,
            name: "Certification Qualiopi",
            description: qualiopiCertification.description,
            credentialCategory: "certification qualité",
            ...(qualiopiCertification.number ? { identifier: qualiopiCertification.number } : {}),
            recognizedBy: [
              {
                "@type": "GovernmentOrganization",
                name: "Ministère du Travail",
                url: "https://travail-emploi.gouv.fr/qualiopi-la-marque-de-certification-qualite-des-prestataires-de-formation",
              },
              ...(qualiopiCertification.issuer
                ? [{ "@type": "Organization", name: qualiopiCertification.issuer }]
                : []),
            ],
          },
        }
      : {}),
  } as const;
}

interface WebsiteJsonLdInput {
  locale: Locale;
}

// WebSite JSON-LD with SearchAction — pairs with `/recherche` (FR) / `/search`
// (EN) and gives Google a sitelinks search box on the SERP.
export function buildWebsiteJsonLd({ locale }: WebsiteJsonLdInput) {
  const isFr = locale === "fr";
  return {
    "@context": "https://schema.org",
    "@id": `${SITE_URL}/#website`,
    "@type": "WebSite",
    name: "Axion-IA",
    url: `${SITE_URL}/${locale}`,
    inLanguage: locale,
    description: isFr
      ? "Cabinet IA opérationnel — interventions, audits et implémentation IA."
      : "Operational AI consultancy — on-site sessions, audits and implementation.",
    publisher: {
      "@type": "Organization",
      name: "Axion-IA",
      url: SITE_URL,
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/${locale}/${isFr ? "recherche" : "search"}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  } as const;
}

interface PersonJsonLdInput {
  locale: Locale;
  /** Slug of the person under `/a-propos` or `/blog/auteur/[slug]`. Defaults to "will". */
  slug?: string;
  /** Override default name. */
  name?: string;
  /** Override default jobTitle. */
  jobTitle?: string;
  /** Optional avatar absolute URL. Defaults to OG image. */
  image?: string;
  /** Override default LinkedIn / X profile URLs. */
  sameAs?: ReadonlyArray<string>;
}

// Person JSON-LD — E-E-A-T 2026 signal (Experience-Expertise-Authoritativeness-
// Trust). Critical for AEO/GEO : LLM answer engines need a named human author
// to attribute claims to. Without a Person schema, Axion-IA is a faceless
// `Organization` and gets cited less often in answer-mode SERPs.
//
// Used at /a-propos page-level + /blog/auteur/[slug] for blog post bylines.
//
// Sprint S6.3 P1-3 (2026-05-15) — anti-fuite Manon : la doctrine v2.1 impose
// que les personas IA n'aient AUCUN réseau social. Cette factory utilise le
// LinkedIn de Will en default — si un appelant lui passe `slug:"manon"` (ou
// tout autre persona AuthorProfile.isPersona:true), il leak le LinkedIn de
// Will sur la persona IA. On throw plutôt que de leak silencieusement : les
// personas DOIVENT passer par `buildPersonManonJsonLd` (factory dédiée DB-
// driven). Garde-fou défense-en-profondeur : la page `/blog/auteur/manon`
// 404 déjà côté `getAllBlogAuthorSlugs()`, mais cette garde anticipe une
// promotion Manon vers une page auteure DB-managée (Sprint 14+).
const PERSONA_SLUGS = new Set(["manon"]);

export function buildPersonJsonLd({
  locale,
  slug = "will",
  // Audit E-E-A-T 2026-06-22 (P1) — identité par défaut dérivée du SSOT `FOUNDER`
  // (lib/brand.ts) au lieu de littéraux divergents. `name` = nom complet d'entité
  // (« Williams Jullin »), cohérent avec `Organization.founder` + la page
  // `/equipe/williams`. Un appelant peut toujours surcharger name/jobTitle/sameAs.
  name = FOUNDER.fullName,
  jobTitle,
  image,
  sameAs = [FOUNDER.linkedin],
}: PersonJsonLdInput) {
  if (PERSONA_SLUGS.has(slug)) {
    throw new Error(
      `buildPersonJsonLd refuse le slug persona '${slug}' (doctrine v2.1 — zéro réseau social). ` +
        `Utiliser buildPersonManonJsonLd depuis @/lib/seo-content-gen-factories avec AuthorProfile DB.`,
    );
  }
  const isFr = locale === "fr";
  const resolvedJobTitle = jobTitle ?? (isFr ? FOUNDER.jobTitleFr : FOUNDER.jobTitleEn);
  const resolvedImage = image ?? `${SITE_URL}/opengraph-image`;
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    jobTitle: resolvedJobTitle,
    url: `${SITE_URL}/${locale}/${isFr ? "a-propos" : "about"}#${slug}`,
    image: resolvedImage,
    sameAs,
    worksFor: {
      "@type": "Organization",
      name: "Axion-IA",
      legalName: "Axion-IA SAS",
      url: SITE_URL,
    },
    knowsAbout: [
      isFr ? "Intelligence artificielle opérationnelle" : "Operational AI",
      isFr ? "Audit IA d'entreprise" : "Enterprise AI audits",
      isFr ? "Implémentation IA" : "AI implementation",
      isFr ? "Automatisation processus métier" : "Business process automation",
      "Retrieval-Augmented Generation (RAG)",
      isFr ? "Modèles de langage de grande taille (LLM)" : "Large Language Models (LLM)",
    ],
    knowsLanguage: ["fr", "en"],
  } as const;
}

interface ArticleJsonLdInput {
  locale: Locale;
  /** Path WITHOUT locale prefix, e.g. `/blog/3-quick-wins-2026`. */
  path: string;
  headline: string;
  description: string;
  /** ISO date string. */
  datePublished: string;
  /** ISO date string. Falls back to `datePublished`. */
  dateModified?: string;
  /** Article body (full text) — used for `articleBody` AEO signal. */
  articleBody?: string;
  /** Author slug — defaults to "will". */
  authorSlug?: string;
  /** Author display name — defaults to "Will". */
  authorName?: string;
  /** Image absolute URL. Defaults to OG dynamic. */
  image?: string;
  /** Tags / keywords. */
  keywords?: ReadonlyArray<string>;
  /** Article section (category). */
  articleSection?: string;
  /** Word count for AEO depth signal. */
  wordCount?: number;
  /**
   * Short summary (< 200 chars). schema.org `abstract` — utilisé par Perplexity
   * et Claude.ai pour résumé court dans les Overviews. Si absent, `description`
   * sert de fallback mais `abstract` est plus précis (formulation answer-ready).
   */
  abstract?: string;
  /**
   * Sources externes citées dans l'article (études, articles, rapports).
   * schema.org `citation` array — Perplexity 2026 cite 80% des sources passées
   * en citation. Boost AEO majeur.
   */
  citations?: ReadonlyArray<{ name: string; url: string; author?: string; datePublished?: string }>;
  /**
   * Sources sur lesquelles l'article est BASÉ (étude principale, rapport
   * gouv, INSEE, etc.). schema.org `isBasedOn` — différent de `citation`
   * (qui sont des références ponctuelles). Signal d'autorité plus fort
   * pour Claude/Perplexity (« cet article s'appuie sur X »).
   */
  isBasedOn?: ReadonlyArray<{
    name: string;
    url: string;
    type?: "Report" | "Article" | "Dataset" | "ScholarlyArticle";
  }>;
  /**
   * Entités/concepts mentionnés (Things, technologies, entreprises). schema.org
   * `mentions` array — enrichit le Knowledge Graph Google et aide les LLMs à
   * comprendre les associations entité→sujet.
   */
  mentions?: ReadonlyArray<{
    name: string;
    url?: string;
    type?: "Thing" | "Organization" | "Product" | "Person" | "Place";
  }>;
  /**
   * Speakable specification (AEO / voice / AI Overviews). Auto-injecté par défaut
   * (selectors h1/h2/[data-speakable]/[data-answer]/[data-faq-a]) ; passer `false`
   * pour désactiver, ou `{ selectors: [...] }` pour cibler. Aligne les articles FS
   * sur les pages Service (qui émettent déjà speakable) et sur les articles DB.
   */
  speakable?: boolean | { selectors: ReadonlyArray<string> };
}

// Article JSON-LD — full AEO/GEO 2026 spec :
// - `dateModified` distinct from `datePublished` (Google + LLMs valorisent l'écart
//   pour comprendre la fraîcheur ; sans dateModified = signal faible).
// - `author` typed as Person (vs string) → E-E-A-T.
// - `publisher` Organization avec logo (requis Google for AMP-style cards).
// - `image`, `articleBody`, `wordCount`, `keywords`, `articleSection` →
//   richesse maximale pour citations.
// - `mainEntityOfPage` → Google AI Overviews / SGE l'utilise pour ancrer
//   la citation sur l'URL canonique.
export function buildArticleJsonLd({
  locale,
  path,
  headline,
  description,
  datePublished,
  dateModified,
  articleBody,
  authorSlug = "will",
  authorName = "Williams",
  image,
  keywords,
  articleSection,
  wordCount,
  abstract,
  citations,
  isBasedOn,
  mentions,
  speakable = true,
}: ArticleJsonLdInput) {
  const isFr = locale === "fr";
  const url = `${SITE_URL}/${locale}${path}`;
  const resolvedImage = image ?? `${SITE_URL}/api/og?title=${encodeURIComponent(headline)}`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    // VIS-13 — borne à 110 car. (recommandation Google Rich Results).
    headline: headline.length > 110 ? `${headline.slice(0, 109).trimEnd()}…` : headline,
    description,
    image: resolvedImage,
    datePublished,
    dateModified: dateModified ?? datePublished,
    author: {
      "@type": "Person",
      name: authorName,
      url: `${SITE_URL}/${locale}/${isFr ? "a-propos" : "about"}#${authorSlug}`,
    },
    // Perfection 2026 — référence le nœud Organization complet du layout
    // (@id #organization : adresse, vatID, sameAs) au lieu d'un Organization
    // partiel inline → cohérence @id cross-type (JSON-LD reste valide).
    publisher: { "@id": `${SITE_URL}/#organization` },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: locale,
    ...(articleBody ? { articleBody } : {}),
    ...(keywords && keywords.length ? { keywords: keywords.join(", ") } : {}),
    ...(articleSection ? { articleSection } : {}),
    ...(typeof wordCount === "number" ? { wordCount } : {}),
    ...(abstract ? { abstract } : {}),
    ...(citations && citations.length
      ? {
          citation: citations.map((c) => ({
            "@type": "CreativeWork",
            name: c.name,
            url: c.url,
            ...(c.author ? { author: { "@type": "Person", name: c.author } } : {}),
            ...(c.datePublished ? { datePublished: c.datePublished } : {}),
          })),
        }
      : {}),
    ...(isBasedOn && isBasedOn.length
      ? {
          isBasedOn: isBasedOn.map((b) => ({
            "@type": b.type ?? "CreativeWork",
            name: b.name,
            url: b.url,
          })),
        }
      : {}),
    ...(mentions && mentions.length
      ? {
          mentions: mentions.map((m) => ({
            "@type": m.type ?? "Thing",
            name: m.name,
            ...(m.url ? { url: m.url } : {}),
          })),
        }
      : {}),
    // AEO 2026 — Speakable pour citation vocale / AI Overviews. h2 d'article DB
    // portent déjà `data-speakable` (buildToc) ; AnswerCard porte `data-answer` ;
    // les réponses 40-60 mots sous chaque H2 portent `data-aeo="answer"` (2026-06-22).
    ...(speakable !== false
      ? {
          speakable: buildSpeakableSpecification({
            selectors:
              typeof speakable === "object" && speakable.selectors
                ? speakable.selectors
                : [
                    "h1",
                    "h2",
                    "[data-speakable]",
                    "[data-answer]",
                    '[data-aeo="answer"]',
                    "[data-faq-a]",
                  ],
          }),
        }
      : {}),
  } as const;
}

interface FaqSpeakableInput {
  items: ReadonlyArray<{ question: string; answer: string }>;
  /** CSS selector to scope Speakable extraction. Defaults to `[itemprop='text']`. */
  speakableSelector?: string;
  /**
   * Sélecteurs CSS additionnels à inclure dans Speakable. Permet à une page
   * d'étendre la couverture vocale au-delà du FAQ (ex: home → ajouter
   * `[data-speakable-hero]` pour que voice search lise aussi le H1 + intro).
   * Cf. audit Speakable 2026-05-24 (P1-1).
   */
  additionalSelectors?: ReadonlyArray<string>;
  /**
   * Date de dernière révision éditoriale ISO. Émise seulement si fournie
   * (audit fraîcheur 2026-06-08 : plus de défaut `BUILD_DATE`). Date stable réelle.
   */
  dateModified?: string;
}

// FAQPage JSON-LD enriched with `speakable` — Google Assistant + Alexa + Bixby
// + voice-first AI agents read these aloud as answer snippets. AEO 2026 :
// every FAQ section is a potential voice citation node.
//
// Why a separate factory (vs amending `buildFaqJsonLd`) : Speakable adds
// a `speakable` property at the FAQPage level that not every caller wants
// (some FAQs are too long to be spoken). Opt-in only.
export function buildFaqSpeakableJsonLd({
  items,
  speakableSelector,
  additionalSelectors,
  dateModified,
}: FaqSpeakableInput) {
  // Speakable v2.6 best practice : couvrir question (itemprop=name) ET réponse (itemprop=text)
  // pour que voice search lise le Q+R complet. `additionalSelectors` permet
  // d'étendre la couverture au-delà de la FAQ (ex: hero home).
  const baseSelectors = speakableSelector
    ? [speakableSelector]
    : ["[itemprop='name']", "[itemprop='text']", "[data-faq-q]", "[data-faq-a]"];
  const selectors = additionalSelectors
    ? [...baseSelectors, ...additionalSelectors]
    : baseSelectors;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    // dateModified émis seulement si fourni (audit fraîcheur 2026-06-08, cohérent
    // avec buildFaqJsonLd — retrait du défaut BUILD_DATE).
    ...(dateModified ? { dateModified } : {}),
    // `numberOfItems` : recommandé Google Search Console (rich results validator
    // émet warning sans). Aligne avec audit AEO 2026-05-24 (P1-4).
    numberOfItems: items.length,
    // Use buildSpeakableSpecification helper from main (DRY across all schemas).
    speakable: buildSpeakableSpecification({ selectors }),
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  } as const;
}

interface LocalBusinessJsonLdInput {
  locale: Locale;
  /** Path WITHOUT locale prefix, e.g. `/implantations/ile-de-france/paris`. */
  path: string;
  /** Localised name, e.g. "Cabinet IA opérationnel à Paris". */
  name: string;
  /** Localised description (40-80 words for SGE/Perplexity citation). */
  description: string;
  /** Area served — admin region or city. */
  areaServed: { type: "Place" | "AdministrativeArea" | "City"; name: string };
  /** Optional postal address (city-level pages). */
  address?: { city: string; region?: string; country?: string; postalCode?: string };
  /** Optional geo coordinates. */
  geo?: { latitude: number; longitude: number };
  /** Optional price range (e.g. "€€€"). */
  priceRange?: string;
  /**
   * Opening hours typés Schema.org (cf. https://schema.org/OpeningHoursSpecification).
   * **Pas de default** depuis Sprint Correctif P1-2 2026-05-23 (audit E2E passe 2).
   * Avant : default Mo-Fr 09:00-18:00 → fake-claim de bureau ouvert dans chaque
   * ville où LB émis. Maintenant : omettre = pas d'openingHours dans le JSON-LD
   * (compatible Service Area Business pattern Google). À passer explicitement
   * UNIQUEMENT pour les pages avec un vrai bureau physique (ex: /a-propos siège
   * Grenoble).
   * Cert C6 2026-05-08 : forme objet typée requise (Google Validator rejette les
   * arrays de strings type "Mo-Fr 09:00-18:00").
   */
  openingHours?: ReadonlyArray<{
    dayOfWeek: ReadonlyArray<
      "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday"
    >;
    /** Format HH:MM 24h. */
    opens: string;
    /** Format HH:MM 24h. */
    closes: string;
  }>;
}

/**
 * Default opening hours utilisables par la page /a-propos ou /contact (siège
 * Grenoble réel). Sprint Correctif P1-2 2026-05-23 : ces hours ne sont PLUS
 * appliquées automatiquement par `buildLocalBusinessJsonLd` (cf. commentaire
 * de la fonction) — à passer explicitement.
 */
export const DEFAULT_HEADQUARTERS_OPENING_HOURS = [
  {
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    opens: "09:00",
    closes: "18:00",
  },
] as const;

// LocalBusiness JSON-LD — Service Area Business safe mode.
//
// Sprint Correctif P1-2 (2026-05-23 — audit E2E passe 2 runtime + décision Will
// 2026-05-23) : Axion-IA = 1 siège FR (Grenoble) qui sert toute la France. Pour
// chaque page ville/région : on émet `ProfessionalService` (compatible LocalBusiness
// schema.org) avec `areaServed` mais SANS les attributs qui claim un bureau
// physique (`geo`, `openingHoursSpecification`, `priceRange`, `address.postalCode`)
// SAUF si le caller passe ces valeurs explicitement.
//
// Avant : `priceRange='€€€'` + `openingHours=DEFAULT_OPENING_HOURS` étaient appliqués
// par défaut → chaque ville prétendait avoir un bureau ouvert 9h-18h Mo-Fr avec un
// tarif € € €. Source de risque "deceptive structured data" (Google guidelines).
//
// Maintenant : ces champs ne sont émis QUE si explicitement passés. Les pages
// ville (`implantations/[ville]`, `audit/par-ville/[ville]`, etc.) appellent
// sans `geo`/`openingHours`/`priceRange` → JSON-LD propre Service Area Business.
// Une seule page peut/doit passer les vraies valeurs : `/a-propos` ou `/contact`
// avec address Grenoble réelle (TODO Will).
//
// Référence Google : « Do not mark up an address that is not a real, accurate
// physical address. » → https://developers.google.com/search/docs/appearance/structured-data/local-business
export function buildLocalBusinessJsonLd({
  locale,
  path,
  name,
  description,
  areaServed,
  address,
  geo,
  priceRange,
  openingHours,
}: LocalBusinessJsonLdInput) {
  const url = `${SITE_URL}/${locale}${path}`;
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name,
    description,
    url,
    image: `${SITE_URL}/opengraph-image`,
    parentOrganization: {
      "@type": "Organization",
      name: "Axion-IA",
      legalName: "Axion-IA SAS",
      alternateName: ["AxionIA", "Axion IA", "axion-ia.com"],
      url: SITE_URL,
    },
    areaServed: {
      "@type": areaServed.type,
      name: areaServed.name,
    },
    knowsLanguage: ["fr", "en"],
    ...(priceRange ? { priceRange } : {}),
    ...(address
      ? {
          address: {
            "@type": "PostalAddress",
            addressLocality: address.city,
            ...(address.region ? { addressRegion: address.region } : {}),
            ...(address.postalCode ? { postalCode: address.postalCode } : {}),
            addressCountry: address.country ?? "FR",
          },
        }
      : {}),
    ...(geo
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: geo.latitude,
            longitude: geo.longitude,
          },
        }
      : {}),
    ...(openingHours && openingHours.length > 0
      ? {
          openingHoursSpecification: openingHours.map((spec) => ({
            "@type": "OpeningHoursSpecification",
            dayOfWeek: spec.dayOfWeek,
            opens: spec.opens,
            closes: spec.closes,
          })),
        }
      : {}),
  } as const;
}

interface PlaceJsonLdInput {
  locale: Locale;
  /** Path WITHOUT locale prefix. */
  path: string;
  name: string;
  geo: { latitude: number; longitude: number };
  /** Parent administrative area (region for a city, country for a region). */
  containedInPlace?: { name: string; url?: string };
  /** Population for differentiation (anti-doorway pages). */
  population?: number;
  /** sameAs URLs for entity reconciliation (Wikipedia, Wikidata). Audit Will 2026-05-27. */
  sameAs?: ReadonlyArray<string>;
}

// Place JSON-LD — paired with LocalBusiness for city/region pages. Useful
// for Google Maps + Wikipedia-style entity reconciliation by AI Overviews.
//
// Audit Will 2026-05-27 : ajout `sameAs` (Wikipedia + Wikidata) pour booster
// E-E-A-T cross-domain. Knowledge Graph mondiale liée à l'entité géographique.
export function buildPlaceJsonLd({
  locale,
  path,
  name,
  geo,
  containedInPlace,
  population,
  sameAs,
}: PlaceJsonLdInput) {
  const url = `${SITE_URL}/${locale}${path}`;
  return {
    "@context": "https://schema.org",
    "@type": "Place",
    name,
    url,
    geo: {
      "@type": "GeoCoordinates",
      latitude: geo.latitude,
      longitude: geo.longitude,
    },
    ...(containedInPlace
      ? {
          containedInPlace: {
            "@type": "Place",
            name: containedInPlace.name,
            ...(containedInPlace.url ? { url: containedInPlace.url } : {}),
          },
        }
      : {}),
    ...(typeof population === "number"
      ? {
          additionalProperty: {
            "@type": "PropertyValue",
            propertyID: "population",
            value: population,
          },
        }
      : {}),
    ...(sameAs && sameAs.length > 0 ? { sameAs } : {}),
  } as const;
}

interface ItemListJsonLdInput {
  locale: Locale;
  /** Path WITHOUT locale prefix. */
  path: string;
  /** ItemList name (e.g. "Stack IA Axion-IA"). */
  name: string;
  items: ReadonlyArray<{ url: string; name: string; position: number; description?: string }>;
}

// ItemList JSON-LD — used for /stack-ia (catalogue), /implantations (régions),
// region pages (top villes), city listings. AEO/GEO : LLMs use ItemList
// to enumerate options when answering "what AI tools / cities does Axion-IA cover?".
export function buildItemListJsonLd({ locale, path, name, items }: ItemListJsonLdInput) {
  const url = `${SITE_URL}/${locale}${path}`;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    url,
    numberOfItems: items.length,
    itemListElement: items.map((item) => ({
      "@type": "ListItem",
      position: item.position,
      name: item.name,
      url: item.url,
      ...(item.description ? { description: item.description } : {}),
    })),
  } as const;
}

interface ProductJsonLdInput {
  locale: Locale;
  /** Path WITHOUT locale prefix. */
  path: string;
  name: string;
  description: string;
  /** Brand / vendor name (e.g. "Anthropic", "OpenAI"). */
  brand?: string;
  /** Image absolute URL. */
  image?: string;
  /** Category (e.g. "Modèle de langage", "Agent autonome"). */
  category?: string;
  /** Optional offer block. */
  offer?: {
    priceRange?: string; // ex "€20-€200/mois"
    availability?: "InStock" | "PreOrder" | "Discontinued";
    url?: string;
  };
}

// Product JSON-LD — used for /stack-ia tools (catalogue d'outils IA tiers
// recommandés par Axion-IA). Permet à Google AI Overviews de citer chaque
// outil individuellement quand un utilisateur demande "quel outil pour X ?".
export function buildProductJsonLd({
  locale,
  path,
  name,
  description,
  brand,
  image,
  category,
  offer,
}: ProductJsonLdInput) {
  const url = `${SITE_URL}/${locale}${path}`;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    url,
    ...(image ? { image } : {}),
    ...(brand ? { brand: { "@type": "Brand", name: brand } } : {}),
    ...(category ? { category } : {}),
    ...(offer
      ? {
          offers: {
            "@type": "Offer",
            ...(offer.priceRange ? { priceRange: offer.priceRange } : {}),
            availability: `https://schema.org/${offer.availability ?? "InStock"}`,
            ...(offer.url ? { url: offer.url } : { url }),
          },
        }
      : {}),
  } as const;
}

interface HowToStepInput {
  name: string;
  text: string;
  /** Optional image URL for the step. */
  image?: string;
  /** Optional URL anchor for deep linking. */
  url?: string;
}

interface HowToJsonLdInput {
  locale: Locale;
  /** Path WITHOUT locale prefix. */
  path: string;
  name: string;
  description: string;
  /** Estimated total time, ISO 8601 duration (e.g. "P5D" = 5 days). */
  totalTime?: string;
  /** Estimated cost. */
  estimatedCost?: { currency: string; value: string };
  /** Tools / supplies needed (optional). */
  supply?: ReadonlyArray<string>;
  /** Steps in order. */
  steps: ReadonlyArray<HowToStepInput>;
}

// HowTo JSON-LD — used for /methodologie (4-step Axion-IA process : cadrage
// → démo → plan → mise en production). Critical for AEO 2026 : Google AI
// Overviews et Perplexity citent les HowTo schemas pour répondre aux
// requêtes "comment faire X" / "quelles étapes pour Y".
export function buildHowToJsonLd({
  locale,
  path,
  name,
  description,
  totalTime,
  estimatedCost,
  supply,
  steps,
}: HowToJsonLdInput) {
  const url = `${SITE_URL}/${locale}${path}`;
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name,
    description,
    url,
    inLanguage: locale,
    ...(totalTime ? { totalTime } : {}),
    ...(estimatedCost
      ? {
          estimatedCost: {
            "@type": "MonetaryAmount",
            currency: estimatedCost.currency,
            value: estimatedCost.value,
          },
        }
      : {}),
    ...(supply && supply.length
      ? {
          supply: supply.map((s) => ({ "@type": "HowToSupply", name: s })),
        }
      : {}),
    step: steps.map((s, idx) => ({
      "@type": "HowToStep",
      position: idx + 1,
      name: s.name,
      text: s.text,
      ...(s.image ? { image: s.image } : {}),
      ...(s.url ? { url: s.url } : { url: `${url}#step-${idx + 1}` }),
    })),
  } as const;
}

// ============================================================
// Course JSON-LD (City Domination 2026-05-18 P1-2 + audit A4 P1)
// ============================================================
//
// Schema.org `Course` activé sur les pages /interventions/collectives/*
// (sessions 4h, 1-jour, 2-jours, 3-jours-plus). Le naming brand reste
// "intervention" en URL et copy canonique, mais le schema déclare la
// sémantique formative pour permettre la citation AEO "formation IA" par
// Google AI Overviews / Perplexity / Claude.
//
// Doctrine 2026 : `Course` doit avoir au moins 1 `CourseInstance` pour
// être éligible aux rich results. On émet `Onsite` par défaut (interventions
// sur site client), modes additionnels possibles (`Hybrid`, `Online`) selon
// l'offre.

export interface CourseJsonLdInput {
  /** Locale "fr" | "en" (path canonical). */
  readonly locale: string;
  /** Path canonical (ex. "/interventions/collectives/1-jour"). */
  readonly path: string;
  /** Nom canonique (ex. "Intervention collective 1 jour IA opérationnelle"). */
  readonly name: string;
  /** Description longue éligible rich results (≥ 50 caractères). */
  readonly description: string;
  /**
   * Mode pédagogique : `Onsite` (par défaut intervention sur site client),
   * `Hybrid` (partiel distanciel), `Online` (full distanciel). Schema.org
   * accepte plusieurs.
   */
  readonly courseMode?: ReadonlyArray<"Onsite" | "Hybrid" | "Online">;
  /** Durée ISO 8601 (ex. "PT7H" pour 1 jour, "PT4H" pour 4h). SSOT : `formationDurationIso` (src/content/formations). */
  readonly duration?: string;
  /** Niveau éducatif (par défaut "Professional" — public B2B Axion-IA). */
  readonly educationalLevel?: string;
  /**
   * Audience cible textuelle (ex. "Décideurs, managers, équipes opérationnelles").
   * Schema.org `BusinessAudience.audienceType`.
   */
  readonly audienceType?: string;
  /** Prix offre (HT — Axion-IA FR régime TVA FR). */
  readonly priceEurHt?: number;
  /**
   * Catégorie pédagogique (ex. "IA opérationnelle", "ChatGPT entreprise").
   * Schema.org `Course.about`.
   */
  readonly about?: string;
}

export function buildCourseJsonLd(input: CourseJsonLdInput) {
  const url = `${SITE_URL}/${input.locale}${input.path}`;
  const courseMode = input.courseMode ?? ["Onsite"];
  const educationalLevel = input.educationalLevel ?? "Professional";
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    "@id": `${url}#course`,
    name: input.name,
    description: input.description,
    url,
    inLanguage: input.locale === "fr" ? "fr-FR" : "en-US",
    provider: { "@id": `${SITE_URL}/#organization` },
    educationalLevel,
    ...(input.about ? { about: input.about } : {}),
    ...(input.audienceType
      ? {
          audience: {
            "@type": "BusinessAudience",
            audienceType: input.audienceType,
          },
        }
      : {}),
    hasCourseInstance: courseMode.map((mode) => ({
      "@type": "CourseInstance",
      courseMode: mode,
      ...(input.duration ? { courseWorkload: input.duration } : {}),
      // Onsite : on indique France comme area (sans adresse fixe — Axion-IA
      // intervient chez le client, pas dans un local Axion-IA).
      ...(mode === "Onsite"
        ? {
            location: {
              "@type": "Place",
              name: "Sur site client (France métropolitaine)",
              address: {
                "@type": "PostalAddress",
                addressCountry: "FR",
              },
            },
          }
        : {}),
    })),
    ...(typeof input.priceEurHt === "number"
      ? {
          offers: {
            "@type": "Offer",
            url,
            price: input.priceEurHt.toString(),
            priceCurrency: "EUR",
            availability: "https://schema.org/InStock",
            category: "Professional training",
          },
        }
      : {}),
  } as const;
}

interface ReviewJsonLdInput {
  /** Author name (client / role / company anonymized). */
  authorName: string;
  /** Optional author role (e.g. "DRH"). */
  authorRole?: string;
  /** Rating 1-5. */
  ratingValue: number;
  /** Best rating (defaults to 5). */
  bestRating?: number;
  /** Review body. */
  reviewBody: string;
  /** Item being reviewed (Service or Product). */
  itemReviewed: { type: "Service" | "Product"; name: string };
  /** Date in ISO format. */
  datePublished?: string;
}

// Review JSON-LD — used for testimonials / cas-concrets when client gives
// explicit consent. Contributes to AggregateRating si plusieurs Reviews
// sont agrégés. Star rating affiché dans Google SERP cards (rich results).
export function buildReviewJsonLd({
  authorName,
  authorRole,
  ratingValue,
  bestRating = 5,
  reviewBody,
  itemReviewed,
  datePublished,
}: ReviewJsonLdInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Review",
    author: {
      "@type": "Person",
      name: authorName,
      ...(authorRole ? { jobTitle: authorRole } : {}),
    },
    reviewRating: {
      "@type": "Rating",
      ratingValue,
      bestRating,
    },
    reviewBody,
    itemReviewed: {
      "@type": itemReviewed.type,
      name: itemReviewed.name,
    },
    ...(datePublished ? { datePublished } : {}),
  } as const;
}

interface AggregateRatingJsonLdInput {
  /** Average rating. */
  ratingValue: number;
  /** Number of reviews. */
  reviewCount: number;
  /** Best rating (defaults to 5). */
  bestRating?: number;
  /** Item being rated. */
  itemReviewed: { type: "Service" | "Product" | "Organization"; name: string };
}

// AggregateRating JSON-LD — used to summarize multiple Reviews. Affiche
// les étoiles agrégées dans Google SERP (rich results). À utiliser sur
// la page Service principale ou /a-propos quand on a ≥ 3 reviews collectées.
export function buildAggregateRatingJsonLd({
  ratingValue,
  reviewCount,
  bestRating = 5,
  itemReviewed,
}: AggregateRatingJsonLdInput) {
  return {
    "@context": "https://schema.org",
    "@type": "AggregateRating",
    ratingValue,
    reviewCount,
    bestRating,
    itemReviewed: {
      "@type": itemReviewed.type,
      name: itemReviewed.name,
    },
  } as const;
}

interface DatasetJsonLdInput {
  locale: Locale;
  /** Path WITHOUT locale prefix. */
  path: string;
  name: string;
  description: string;
  /** Optional keywords. */
  keywords?: ReadonlyArray<string>;
  /** License URL (e.g. CC BY 4.0). */
  license?: string;
  /** Date of publication. */
  datePublished?: string;
  /** Date of last update. */
  dateModified?: string;
  /** Distribution format(s). */
  distribution?: ReadonlyArray<{ encodingFormat: string; contentUrl: string }>;
  /** Spatial coverage (e.g. "France"). */
  spatialCoverage?: string;
  /** Temporal coverage (e.g. "2020/2025"). */
  temporalCoverage?: string;
}

// Dataset JSON-LD — pour ROI calculator outputs, datasets stratégie IA,
// chiffres consolidés Axion-IA. Permet à Google Dataset Search de citer
// Axion-IA et à Claude/Perplexity de référencer les chiffres avec source.
export function buildDatasetJsonLd({
  locale,
  path,
  name,
  description,
  keywords,
  license,
  datePublished,
  dateModified,
  distribution,
  spatialCoverage,
  temporalCoverage,
}: DatasetJsonLdInput) {
  const url = `${SITE_URL}/${locale}${path}`;
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name,
    description,
    url,
    inLanguage: locale,
    creator: {
      "@type": "Organization",
      name: "Axion-IA",
      legalName: "Axion-IA SAS",
      alternateName: ["AxionIA", "Axion IA", "axion-ia.com"],
      url: SITE_URL,
    },
    ...(keywords && keywords.length ? { keywords: keywords.join(", ") } : {}),
    ...(license ? { license } : {}),
    ...(datePublished ? { datePublished } : {}),
    ...(dateModified ? { dateModified: dateModified ?? datePublished } : {}),
    ...(distribution && distribution.length
      ? {
          distribution: distribution.map((d) => ({
            "@type": "DataDownload",
            encodingFormat: d.encodingFormat,
            contentUrl: d.contentUrl,
          })),
        }
      : {}),
    ...(spatialCoverage ? { spatialCoverage } : {}),
    ...(temporalCoverage ? { temporalCoverage } : {}),
  } as const;
}

interface ImageObjectJsonLdInput {
  /** Absolute image URL. */
  url: string;
  /** Image caption / alt-equivalent. */
  caption?: string;
  /** Image dimensions. */
  width?: number;
  height?: number;
  /** Date created (ISO). */
  uploadDate?: string;
  /** Content licence URL. */
  license?: string;
  /**
   * Texte d'attribution (Schema.org `creditText`). Requis par Google dès
   * qu'une `license` est déclarée, sinon warning « Champ creditText manquant »
   * dans le rapport GSC « Métadonnées d'image ». Default : "Axion-IA".
   */
  creditText?: string;
}

// ImageObject JSON-LD — pour les images riches (cas-concrets photo, hero
// schemas avec contexte sémantique). Aide Google Image Search à comprendre
// et citer les visuels Axion-IA. Utiliser sur les pages avec images qui
// méritent leur propre indexation (illustrations originales).
export function buildImageObjectJsonLd({
  url,
  caption,
  width,
  height,
  uploadDate,
  license,
  creditText = "Axion-IA",
}: ImageObjectJsonLdInput) {
  return {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    contentUrl: url,
    url,
    ...(caption ? { caption } : {}),
    ...(typeof width === "number" ? { width } : {}),
    ...(typeof height === "number" ? { height } : {}),
    ...(uploadDate ? { uploadDate } : {}),
    // creditText accompagne toujours `license` (exigence Google Image metadata).
    ...(license ? { license, creditText } : {}),
  } as const;
}

// ============================================================
// ImageGraph JSON-LD (Sprint perfection 2026-05-28 — Will + audit sub-agent)
// ============================================================
//
// Émet un `@graph` ImageObject array pour exposer plusieurs images d'une
// page à l'indexation Google Images / Bing / Pinterest et permettre la
// citation par AI Overviews / Perplexity / Claude Vision. Pattern enrichi
// vs `buildImageObjectJsonLd` qui ne gère qu'une seule image.
//
// Champs par image : `@id` stable + `contentUrl` + `name` (titre) + `alt`
// (description SEO dense) + dimensions + license CC BY 4.0 par défaut +
// creator/copyrightHolder Organization Axion-IA + datePublished + inLanguage.
//
// Centralise le pattern dupliqué inline dans `/interventions/collectives`.
// Réutilisable pour : home, audit, implementation, un-a-un, codage-dev,
// sites-web-augmentes, cas-concrets, ressources, actualites.

interface ImageGraphImageInput {
  /** Path relatif (ex. "/illustrations/formations/formateur-ia-claude.png"). */
  src: string;
  /** Titre court de l'image (Schema.org `name`). */
  name: string;
  /** Alt text dense pour SEO + a11y (Schema.org `description`). */
  alt: string;
  /** Dimensions en pixels (recommandé pour CLS-safe pre-render). */
  width?: number;
  height?: number;
  /** Format encoding (ex. "image/png", "image/avif"). Default : "image/png". */
  encodingFormat?: string;
  /** Date de publication ISO. Omise si non fournie (plus de défaut BUILD_DATE). */
  datePublished?: string;
  /**
   * `representativeOfPage` — signale à Google Images que l'image représente la
   * page (candidate vignette/hero). Default `false`. Une seule image par page
   * devrait être `true`.
   */
  representativeOfPage?: boolean;
}

interface ImageGraphJsonLdInput {
  /** Locale "fr" | "en". */
  locale: Locale;
  /** Tableau d'images (1 à N). */
  images: ReadonlyArray<ImageGraphImageInput>;
  /** License URL. Default : CC BY 4.0. */
  license?: string;
  /**
   * Nom de l'Organization creator/copyrightHolder. Default : "Axion-IA".
   * Permet override pour pages partenariat/presse si besoin.
   */
  organizationName?: string;
}

export function buildImageGraphJsonLd({
  locale,
  images,
  license = "https://creativecommons.org/licenses/by/4.0/",
  organizationName = "Axion-IA",
}: ImageGraphJsonLdInput) {
  return {
    "@context": "https://schema.org",
    "@graph": images.map((img) => ({
      "@type": "ImageObject",
      "@id": `${SITE_URL}${img.src}#image`,
      contentUrl: `${SITE_URL}${img.src}`,
      url: `${SITE_URL}${img.src}`,
      name: img.name,
      description: img.alt,
      ...(typeof img.width === "number" ? { width: img.width } : {}),
      ...(typeof img.height === "number" ? { height: img.height } : {}),
      encodingFormat: img.encodingFormat ?? "image/png",
      representativeOfPage: img.representativeOfPage === true,
      license,
      acquireLicensePage: `${SITE_URL}/${locale}/cgu`,
      creator: {
        "@type": "Organization",
        // VIS-17 (audit visibilité 2026-06-05) — aligne sur l'@id canonique de
        // l'Organization globale (`/#organization`) pour fusionner l'entité dans
        // le graphe (avant : `#org` ≠ `/#organization` → entité non reliée).
        "@id": `${SITE_URL}/#organization`,
        name: organizationName,
      },
      copyrightHolder: {
        "@type": "Organization",
        // VIS-17 (audit visibilité 2026-06-05) — aligne sur l'@id canonique de
        // l'Organization globale (`/#organization`) pour fusionner l'entité dans
        // le graphe (avant : `#org` ≠ `/#organization` → entité non reliée).
        "@id": `${SITE_URL}/#organization`,
        name: organizationName,
      },
      copyrightNotice: `© ${organizationName} 2026 — CC BY 4.0`,
      // creditText : exigé par Google dès qu'on déclare `license` +
      // `acquireLicensePage` (rapport « Métadonnées d'image » GSC). Sans lui,
      // warning « Champ creditText manquant ». Texte d'attribution lisible.
      creditText: organizationName,
      // datePublished émis seulement si fourni (audit fraîcheur 2026-06-08 :
      // retrait du défaut BUILD_DATE qui datait les images de ~28 hubs statiques
      // au timestamp du build). Les pages galerie DB passent leur vraie date via
      // un autre builder (image-seo.service.ts) — non affectées.
      ...(img.datePublished ? { datePublished: img.datePublished } : {}),
      inLanguage: locale,
    })),
  } as const;
}

/** Déduit le MIME `encodingFormat` depuis l'extension du fichier statique. */
function encodingFormatFromSrc(src: string): string {
  const ext = src.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "avif":
      return "image/avif";
    case "webp":
      return "image/webp";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "svg":
      return "image/svg+xml";
    default:
      return "image/png";
  }
}

/**
 * Construit le `@graph` d'`ImageObject` d'une page DEPUIS le manifeste SSOT
 * (`src/lib/seo/page-images.ts`). Retourne `null` si la page n'a aucune image
 * déclarée — l'appelant omet alors le `<JsonLd>`. C'est le consommateur n°2 du
 * manifeste (le rendu de la page = n°1, le sitemap images = n°3), ce qui garantit
 * que le JSON-LD ne diverge jamais des images réellement affichées ni du sitemap.
 */
export function buildPageImageGraphJsonLd({ locale, path }: { locale: Locale; path: string }) {
  const images = getPageImages(path);
  if (images.length === 0) return null;
  return buildImageGraphJsonLd({
    locale,
    images: images.map((im) => ({
      src: im.src,
      name: locale === "fr" ? im.nameFr : im.nameEn,
      alt: locale === "fr" ? im.altFr : im.altEn,
      width: im.width,
      height: im.height,
      encodingFormat: im.encodingFormat ?? encodingFormatFromSrc(im.src),
      ...(im.representativeOfPage ? { representativeOfPage: true } : {}),
    })),
  });
}

/**
 * Nœud `primaryImageOfPage` pour un WebPage/CollectionPage : référence l'`@id`
 * de l'ImageObject représentatif de la page (déjà émis par
 * `buildPageImageGraphJsonLd`). Retourne `undefined` si la page n'a pas d'image.
 */
export function buildPrimaryImageOfPage(path: string): { "@id": string } | undefined {
  const rep = getRepresentativePageImage(path);
  return rep ? { "@id": `${SITE_URL}${rep.src}#image` } : undefined;
}

interface QAPageJsonLdInput {
  locale: Locale;
  /** Path WITHOUT locale prefix. */
  path: string;
  /** Main question. */
  question: string;
  /** Accepted answer. */
  acceptedAnswer: { text: string; authorName?: string; upvoteCount?: number };
  /** Optional suggested answers. */
  suggestedAnswers?: ReadonlyArray<{ text: string; authorName?: string; upvoteCount?: number }>;
  /** Date de publication/relecture (recommandé QAPage). Émis si fourni. */
  datePublished?: string | Date;
}

// QAPage JSON-LD — différent de FAQPage : pour pages détail FAQ par question
// (forum-style). Utiliser sur /faq/[id] ou /centre-aide/[slug] où une seule
// question domine la page. AEO : Google distingue QAPage (1 Q principale)
// de FAQPage (liste de Q/A) — utile quand la page est centrée sur 1 réponse.
export function buildQAPageJsonLd({
  locale,
  path,
  question,
  acceptedAnswer,
  suggestedAnswers,
  datePublished,
}: QAPageJsonLdInput) {
  const url = `${SITE_URL}/${locale}${path}`;
  // GSC Rich Results 2026-07-03 — QAPage requiert `answerCount` sur la Question
  // (sinon INVALIDE). Champs recommandés `text`/`author`/`url`/`datePublished`
  // fournis honnêtement : auteur = l'Organisation (contenu site-authored), date
  // si fournie. `upvoteCount` jamais fabriqué (politique anti-fabrication).
  const orgRef = { "@id": `${SITE_URL}/#organization` } as const;
  const dateIso = datePublished ? new Date(datePublished).toISOString() : undefined;
  const answerCount = 1 + (suggestedAnswers?.length ?? 0);
  return {
    "@context": "https://schema.org",
    "@type": "QAPage",
    mainEntity: {
      "@type": "Question",
      name: question,
      text: question,
      url,
      answerCount,
      author: orgRef,
      ...(dateIso ? { datePublished: dateIso } : {}),
      acceptedAnswer: {
        "@type": "Answer",
        text: acceptedAnswer.text,
        url,
        author: acceptedAnswer.authorName
          ? { "@type": "Person", name: acceptedAnswer.authorName }
          : orgRef,
        ...(dateIso ? { datePublished: dateIso } : {}),
        ...(typeof acceptedAnswer.upvoteCount === "number"
          ? { upvoteCount: acceptedAnswer.upvoteCount }
          : {}),
      },
      ...(suggestedAnswers && suggestedAnswers.length
        ? {
            suggestedAnswer: suggestedAnswers.map((a) => ({
              "@type": "Answer",
              text: a.text,
              author: a.authorName ? { "@type": "Person", name: a.authorName } : orgRef,
              ...(typeof a.upvoteCount === "number" ? { upvoteCount: a.upvoteCount } : {}),
            })),
          }
        : {}),
    },
  } as const;
}
