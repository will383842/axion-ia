import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { env } from "@/env";
// Cycle d'import autorisé : `service-coverage.ts` réimporte SITE_URL d'ici, mais
// SITE_URL est une const tier-0 résolue au top-level. Les fonctions sont
// appelées au runtime quand les 2 modules sont déjà évalués. ESM-safe.
import { buildServiceAreasServed } from "@/lib/service-coverage";

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
  /** Optional accent for `/api/og` dynamic image (primary/purple/orange/green). */
  ogAccent?: "primary" | "purple" | "orange" | "green";
}

export function buildProductMetadata({
  locale,
  path,
  title,
  description,
  alternates,
  ogImage,
  ogAccent,
}: ProductSeoInput): Metadata {
  const fr = alternates?.fr ?? path;
  const en = alternates?.en ?? path;
  // Default OG image : dynamic `/api/og` with title + optional accent.
  // For pages that need a custom static OG (homepage), pass `ogImage`.
  const resolvedOgImage =
    ogImage ??
    `${SITE_URL}/api/og?title=${encodeURIComponent(title)}${ogAccent ? `&accent=${ogAccent}` : ""}`;
  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}${path}`,
      languages: {
        fr: `/fr${fr}`,
        en: `/en${en}`,
        "x-default": `/fr${fr}`,
      },
    },
    openGraph: {
      type: "website",
      locale: locale === "fr" ? "fr_FR" : "en_US",
      url: `${SITE_URL}/${locale}${path}`,
      title,
      description,
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
      description,
      images: [resolvedOgImage],
    },
    robots: { index: true, follow: true },
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
    // dateModified : signal de fraîcheur AI Overviews 2026. Auto-injecté à
    // la BUILD_DATE si la page n'a rien passé explicitement (audit perfection
    // 2026-05-12). Pour bypass (rare), passer `dateModified: ""` ne suffit
    // pas — il faudrait étendre l'interface. Le default couvre 100 % des cas.
    dateModified: dateModified ?? BUILD_DATE,
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
}

export function buildFaqJsonLd({ items, speakable = true }: FaqJsonLdInput) {
  // Auto-injection Speakable (audit perfection 2026-05-12) — chaque FAQ est
  // désormais éligible Google Assistant / Alexa quand un utilisateur demande
  // "Axion-IA, comment ça se passe une formation IA ?" via vocal. Sans
  // override, on cible les attributs data-faq-q et data-faq-a (à appliquer
  // dans les composants InterventionFaqList / FaqAccordion progressivement).
  const speakableSelector = typeof speakable === "string" ? speakable : "[data-faq-q],[data-faq-a]";
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
    ...(speakable !== false
      ? {
          speakable: {
            "@type": "SpeakableSpecification",
            cssSelector: [speakableSelector],
          },
        }
      : {}),
  } as const;
}

interface BreadcrumbJsonLdInput {
  locale: Locale;
  items: ReadonlyArray<{ name: string; href: string }>;
}

export function buildBreadcrumbJsonLd({ locale, items }: BreadcrumbJsonLdInput) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: `${SITE_URL}/${locale}${item.href === "/" ? "" : item.href}`,
    })),
  } as const;
}

interface OrganizationJsonLdInput {
  locale: Locale;
  /** Override default contact email. Defaults to `presse@axion-ia.com`. */
  contactEmail?: string;
  /** Override default contact type label. Defaults to FR/EN customer service. */
  contactType?: string;
  /** Estonian VAT number, e.g. `EE-XXXXXXXXX`. Will fournit plus tard. */
  vatID?: string;
  /** Estonian commercial registry code (registrikood). Will fournit plus tard. */
  registrikood?: string;
}

// Layout-level Organization JSON-LD — single source of truth for AEO/GEO 2026
// (Claude.ai / Perplexity / SGE / Bing Copilot citations).
//
// Strategy : maximize the number of stable identifying fields so that LLM
// answer engines unambiguously identify "Axion-IA" the entity (vs other
// AI consultancies). `sameAs` provides external corroboration, `foundingLocation`
// + `areaServed` ground geography, `contactPoint` makes it actionable.
//
// `vatID` + `identifier (registrikood)` are optional — once Will transmits the
// Estonia legal references, pass them in from the call site without rewriting
// this helper.
export function buildOrganizationJsonLd({
  locale,
  contactEmail = "presse@axion-ia.com",
  contactType,
  vatID,
  registrikood,
}: OrganizationJsonLdInput) {
  const isFr = locale === "fr";
  const resolvedContactType = contactType ?? (isFr ? "Service client" : "Customer service");
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Axion-IA",
    legalName: "Axion-IA OÜ",
    url: SITE_URL,
    logo: `${SITE_URL}/opengraph-image`,
    description: isFr
      ? "Cabinet IA opérationnel B2B — interventions, audits et implémentation IA pour entreprises."
      : "Operational B2B AI consultancy — on-site AI sessions, audits and implementation for companies.",
    sameAs: ["https://www.linkedin.com/company/axion-ia", "https://www.facebook.com/axionia"],
    foundingDate: "2024",
    foundingLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressCountry: "EE",
        addressLocality: "Tallinn",
      },
    },
    areaServed: ["FR", "EU"],
    knowsLanguage: ["fr", "en"],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: resolvedContactType,
      email: contactEmail,
      availableLanguage: ["French", "English"],
    },
    ...(vatID ? { vatID } : {}),
    ...(registrikood
      ? {
          identifier: {
            "@type": "PropertyValue",
            propertyID: "registrikood",
            value: registrikood,
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
        urlTemplate: `${SITE_URL}/${locale}/${isFr ? "recherche" : "search"}?q={query}`,
      },
      "query-input": "required name=query",
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
  name = "Will",
  jobTitle,
  image,
  sameAs = ["https://www.linkedin.com/in/will-axion-ia"],
}: PersonJsonLdInput) {
  if (PERSONA_SLUGS.has(slug)) {
    throw new Error(
      `buildPersonJsonLd refuse le slug persona '${slug}' (doctrine v2.1 — zéro réseau social). ` +
        `Utiliser buildPersonManonJsonLd depuis @/lib/seo-content-gen-factories avec AuthorProfile DB.`,
    );
  }
  const isFr = locale === "fr";
  const resolvedJobTitle =
    jobTitle ?? (isFr ? "Fondateur · lead consultant IA" : "Founder · lead AI consultant");
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
      legalName: "Axion-IA OÜ",
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
  authorName = "Will",
  image,
  keywords,
  articleSection,
  wordCount,
}: ArticleJsonLdInput) {
  const isFr = locale === "fr";
  const url = `${SITE_URL}/${locale}${path}`;
  const resolvedImage = image ?? `${SITE_URL}/api/og?title=${encodeURIComponent(headline)}`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description,
    image: resolvedImage,
    datePublished,
    dateModified: dateModified ?? datePublished,
    author: {
      "@type": "Person",
      name: authorName,
      url: `${SITE_URL}/${locale}/${isFr ? "a-propos" : "about"}#${authorSlug}`,
    },
    publisher: {
      "@type": "Organization",
      name: "Axion-IA",
      legalName: "Axion-IA OÜ",
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/opengraph-image`,
      },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: locale,
    ...(articleBody ? { articleBody } : {}),
    ...(keywords && keywords.length ? { keywords: keywords.join(", ") } : {}),
    ...(articleSection ? { articleSection } : {}),
    ...(typeof wordCount === "number" ? { wordCount } : {}),
  } as const;
}

interface FaqSpeakableInput {
  items: ReadonlyArray<{ question: string; answer: string }>;
  /** CSS selector to scope Speakable extraction. Defaults to `[itemprop='text']`. */
  speakableSelector?: string;
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
  speakableSelector = "[itemprop='text']",
}: FaqSpeakableInput) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: [speakableSelector],
    },
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
   * Default : Mo-Fr 09:00-18:00.
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

const DEFAULT_OPENING_HOURS = [
  {
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    opens: "09:00",
    closes: "18:00",
  },
] as const;

// LocalBusiness JSON-LD — required for «#1 ville/région» strategy.
// Each city/region landing page (Sprint 15) emits this so Google Maps,
// Google AI Overviews local pack, and Apple Maps surface Axion-IA as the
// AI consultancy for that geography. Available NOW so Will can wire it
// when he creates the pages.
export function buildLocalBusinessJsonLd({
  locale,
  path,
  name,
  description,
  areaServed,
  address,
  geo,
  priceRange = "€€€",
  openingHours = DEFAULT_OPENING_HOURS,
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
      legalName: "Axion-IA OÜ",
      url: SITE_URL,
    },
    areaServed: {
      "@type": areaServed.type,
      name: areaServed.name,
    },
    knowsLanguage: ["fr", "en"],
    priceRange,
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
    ...(openingHours.length
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
}

// Place JSON-LD — paired with LocalBusiness for city/region pages. Useful
// for Google Maps + Wikipedia-style entity reconciliation by AI Overviews.
export function buildPlaceJsonLd({
  locale,
  path,
  name,
  geo,
  containedInPlace,
  population,
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
      legalName: "Axion-IA OÜ",
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
    ...(license ? { license } : {}),
  } as const;
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
}: QAPageJsonLdInput) {
  const url = `${SITE_URL}/${locale}${path}`;
  return {
    "@context": "https://schema.org",
    "@type": "QAPage",
    mainEntity: {
      "@type": "Question",
      name: question,
      url,
      acceptedAnswer: {
        "@type": "Answer",
        text: acceptedAnswer.text,
        ...(acceptedAnswer.authorName
          ? { author: { "@type": "Person", name: acceptedAnswer.authorName } }
          : {}),
        ...(typeof acceptedAnswer.upvoteCount === "number"
          ? { upvoteCount: acceptedAnswer.upvoteCount }
          : {}),
      },
      ...(suggestedAnswers && suggestedAnswers.length
        ? {
            suggestedAnswer: suggestedAnswers.map((a) => ({
              "@type": "Answer",
              text: a.text,
              ...(a.authorName ? { author: { "@type": "Person", name: a.authorName } } : {}),
              ...(typeof a.upvoteCount === "number" ? { upvoteCount: a.upvoteCount } : {}),
            })),
          }
        : {}),
    },
  } as const;
}
