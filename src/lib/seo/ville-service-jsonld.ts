/**
 * Centralized JSON-LD graph factory — pages ville × service Axion-IA.
 * Phase C 2026-05-20 — SEO/AEO/GEO perfection maximale France.
 *
 * Source unique de vérité pour TOUT le structured data émis sur :
 *   /audit/par-ville/[ville]
 *   /interventions/par-ville/[ville]
 *   /implementation/par-ville/[ville]
 *   /un-a-un/par-ville/[ville]
 *
 * Schémas émis (2026 best practices) :
 *   1. Service (areaServed City + Region + Country + alternativeHeadline)
 *   2. (retiré le 2026-11-11 : fausse implantation par ville — voir le corps)
 *   3. BreadcrumbList (3 niveaux + @id)
 *   4. FAQPage + Speakable (cible #axion-direct-answer + #axion-faq ; NB : Google
 *      a restreint le rich result FAQ en 2023, conservé pour l'AEO/GEO + LLMs)
 *   5. HowTo (méthodologie pas à pas — markup valide ; NB : Google a retiré le
 *      rich result HowTo en 2024, conservé pour l'AEO/GEO + LLMs)
 *   6. Person (Manon — autrice E-E-A-T)
 *   7. WebPage + abstract (signal #1 featured snippets / position 0 / AI Overviews)
 *   8. ItemList (villes proches même service)
 *
 * Scalabilité : ajouter la 40e ville = 0 ligne de code ici.
 * Testabilité  : fonction pure, couvrable en Vitest.
 * Maintien     : ajouter un nouveau schéma = 1 seul endroit.
 */

import type { Locale } from "@/i18n/routing";
import {
  buildServiceJsonLd,
  buildBreadcrumbJsonLd,
  buildItemListJsonLd,
  buildHowToJsonLd,
  buildWebPageJsonLd,
  SITE_URL,
} from "@/lib/seo";
import { JOURNEE_IA_SERVICE_ID, buildJourneeIaServiceJsonLd } from "@/lib/seo/journee-ia-service";

// ─── Types ───────────────────────────────────────────────────────────────────

export type VilleServiceKey =
  "audit" | "interventions" | "implementation" | "un-a-un" | "sites-web-augmentes";

/** ISO 8601 duration par service (utilisé dans HowTo totalTime). */
const SERVICE_DURATION: Record<VilleServiceKey, string> = {
  audit: "P5D",
  interventions: "PT4H",
  implementation: "P4W",
  "un-a-un": "PT2H",
  "sites-web-augmentes": "P3W",
};

export interface VilleServiceJsonLdInput {
  readonly locale: Locale;
  readonly isFr: boolean;
  readonly service: VilleServiceKey;
  /** Nom FR du service, ex : "Audit IA". */
  readonly serviceNameFr: string;
  /** Nom EN du service, ex : "AI audit". */
  readonly serviceNameEn: string;
  /** URL canonique du service (sans ville), ex : "/audit". */
  readonly serviceCanonical: string;
  /** Chemin FR de la section par-ville, ex : "/audit/par-ville". */
  readonly servicePathFr: string;
  readonly ville: {
    readonly nameFr: string;
    readonly slug: string;
    readonly postalCode?: string;
    readonly geo: { readonly lat: number; readonly lon: number };
    readonly region: string;
  };
  readonly region: {
    readonly nameFr: string;
    readonly slug: string;
  };
  /** Texte hero 80-150 mots — description Service + LocalBusiness. */
  readonly hero: string;
  /**
   * Réponse directe 40-80 mots citable LLMs (Perplexity / Claude / AI Overviews).
   * Si absent, le début du `hero` est utilisé comme proxy.
   */
  readonly directAnswer?: string;
  /** Items FAQ service × ville (cible ≥ 8). */
  readonly faqItems: ReadonlyArray<{ readonly question: string; readonly answer: string }>;
  /**
   * Étapes de la méthodologie service (4-6 étapes).
   * Déclenche le schéma HowTo si ≥ 3 étapes présentes.
   */
  readonly methodologySteps: ReadonlyArray<{
    readonly step: string;
    readonly detail: string;
  }>;
  /** Villes proches pour l'ItemList maillage interne. */
  readonly nearbyVilles: ReadonlyArray<{
    readonly ville: { readonly nameFr: string; readonly slug: string };
  }>;
  /** Prix d'entrée HT en euros (pour HowTo estimatedCost + Service). */
  readonly priceEur?: number;
  /** Fourchette tarifaire affichée ("€€€" par défaut). */
  readonly priceRange?: string;
}

// ─── Factory principale ───────────────────────────────────────────────────────

/**
 * Produit le tableau complet de schémas JSON-LD pour une page ville × service.
 * Passer directement à `<JsonLdGraph schemas={buildVilleServiceJsonLdGraph(...)} />`.
 */
export function buildVilleServiceJsonLdGraph(
  input: VilleServiceJsonLdInput,
): ReadonlyArray<Record<string, unknown>> {
  const {
    locale,
    isFr,
    service,
    serviceNameFr,
    serviceNameEn,
    serviceCanonical,
    servicePathFr,
    ville,
    region,
    hero,
    directAnswer,
    faqItems,
    methodologySteps,
    nearbyVilles,
    priceEur,
  } = input;

  const path = `${servicePathFr}/${ville.slug}` as `/${string}`;
  const url = `${SITE_URL}/${locale}${path}`;
  const schemas: Record<string, unknown>[] = [];

  // ── 1. Service ─────────────────────────────────────────────────────────────
  schemas.push(
    buildServiceJsonLd({
      locale,
      path,
      name: isFr
        ? `${serviceNameFr} à ${ville.nameFr} · Axion-IA`
        : `${serviceNameEn} in ${ville.nameFr} · Axion-IA`,
      description: hero,
      serviceType: serviceNameEn,
      ...(typeof priceEur === "number" ? { priceEur } : {}),
      areasServed: [
        {
          type: "City",
          name: ville.nameFr,
          url: `${SITE_URL}/${locale}/implantations/${ville.region}/${ville.slug}`,
        },
        {
          type: "AdministrativeArea",
          name: region.nameFr,
          url: `${SITE_URL}/${locale}/implantations/${region.slug}`,
        },
        { type: "Country", name: "France" },
      ],
    } as Parameters<typeof buildServiceJsonLd>[0]),
  );

  // ── 2. (retiré le 2026-11-11) LocalBusiness / ProfessionalService ──────────
  // Le nœud déclarait une `PostalAddress` dont la localité était la ville servie et un
  // `sameAs` vers la page Wikipédia/Wikidata DE LA VILLE : une fausse implantation par
  // ville. Axion-IA n'a pas de bureau dans chaque commune ; la zone servie est portée
  // par `Service.areaServed` (ci-dessus), et l'entreprise par `#organization` (layout).

  // ── 3. BreadcrumbList ──────────────────────────────────────────────────────
  schemas.push(
    buildBreadcrumbJsonLd({
      locale,
      items: [
        { name: isFr ? "Accueil" : "Home", href: "/" },
        { name: isFr ? serviceNameFr : serviceNameEn, href: serviceCanonical as `/${string}` },
        {
          name: isFr ? `${serviceNameFr} à ${ville.nameFr}` : `${serviceNameEn} in ${ville.nameFr}`,
          href: path,
        },
      ],
    }),
  );

  // ── 4. FAQPage + Speakable ─────────────────────────────────────────────────
  // cssSelector cible les éléments HTML balisés dans VilleServicePageTemplate :
  //   #axion-direct-answer → réponse directe (rendu uniquement si directAnswer fourni)
  //   #axion-faq           → wrapper div autour de <FaqBlock>
  // Le selector #axion-direct-answer est conditionnel pour éviter le drift
  // JSON-LD / DOM (P2-2 Sprint S+5) : VilleServicePageTemplate ne rend ce bloc
  // que si `ville.copy?.directAnswerFr` est défini.
  const speakableSelectors: string[] = [
    ...(directAnswer ? ["#axion-direct-answer"] : []),
    "#axion-faq",
  ];
  if (faqItems.length > 0) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqItems.map((item, idx) => ({
        "@type": "Question",
        "@id": `${url}#faq-${idx + 1}`,
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    });
  }

  // ── 5. HowTo (méthodologie pas à pas) ─────────────────────────────────────
  // NB : Google a retiré le rich result HowTo (2024) ; markup conservé pour
  // l'AEO/GEO + citations Perplexity "comment fonctionne X" (extraction LLM).
  // Émis uniquement si ≥ 3 étapes (min pour un HowTo significatif).
  if (methodologySteps.length >= 3) {
    schemas.push(
      buildHowToJsonLd({
        locale,
        path,
        name: isFr
          ? `Comment se déroule ${serviceNameFr.toLowerCase()} à ${ville.nameFr} avec Axion-IA`
          : `How ${serviceNameEn.toLowerCase()} in ${ville.nameFr} works with Axion-IA`,
        description: (directAnswer ?? hero).slice(0, 200),
        totalTime: SERVICE_DURATION[service],
        ...(typeof priceEur === "number"
          ? { estimatedCost: { currency: "EUR", value: String(priceEur) } }
          : {}),
        steps: methodologySteps.map((s) => ({
          name: s.step,
          text: s.detail,
        })),
      }),
    );
  }

  // ── 6. Person — Manon (autrice éditoriale) ─────────────────────────────────
  // Nécessaire pour le signal E-E-A-T (Experience, Expertise, Authority, Trust).
  // Google AI Overviews et Perplexity valorisent l'authorship documenté.
  schemas.push({
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Manon",
    jobTitle: isFr ? "Plume éditoriale Axion-IA" : "Editorial voice Axion-IA",
    worksFor: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Axion-IA",
    },
    knowsAbout: isFr
      ? ["Intelligence artificielle en entreprise", "Audit IA", "Transformation numérique PME"]
      : ["Enterprise AI", "AI audit", "SME digital transformation"],
    knowsLanguage: ["fr", "en"],
  });

  // ── 7. WebPage JSON-LD + abstract (signal #1 pour featured snippets / position 0)
  // `abstract` (< 160 chars) est le champ que Google, Perplexity et Claude.ai
  // extraient en priorité pour les rich snippets et AI Overviews.
  // `speakable` pointe vers #axion-direct-answer pour la lecture vocale (SGE/Bixby).
  // `alternativeHeadline` = titre court requête (signal requête courte Google).
  const abstractText = directAnswer
    ? directAnswer.slice(0, 160)
    : hero.slice(0, 160) + (hero.length > 160 ? "…" : "");

  schemas.push(
    buildWebPageJsonLd({
      locale,
      path,
      name: isFr
        ? `${serviceNameFr} à ${ville.nameFr} · Axion-IA`
        : `${serviceNameEn} in ${ville.nameFr} · Axion-IA`,
      // abstract = cible extraction position 0 / AI Overviews (< 160 chars answer-ready)
      abstract: abstractText,
      // alternativeHeadline = signal requête courte ("audit IA Lyon", "IA Lyon")
      alternativeHeadline: isFr
        ? `${serviceNameFr} à ${ville.nameFr}`
        : `${serviceNameEn} in ${ville.nameFr}`,
      description: hero.slice(0, 300),
      about: [
        { "@type": "City", name: ville.nameFr },
        { "@type": "Service", name: isFr ? serviceNameFr : serviceNameEn },
      ],
      // Speakable cible le bloc directAnswer + FAQ pour voice search (SGE, Bixby, Google Assistant)
      // Selector #axion-direct-answer conditionnel (P2-2 Sprint S+5 — drift JSON-LD/DOM fix).
      speakable: { selectors: speakableSelectors },
      breadcrumb: { "@id": `${url}#breadcrumb` },
      potentialAction: {
        "@type": "ReserveAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/${locale}/appel`,
        },
        result: {
          "@type": "Reservation",
          name: isFr ? `Réservation ${serviceNameFr}` : `${serviceNameEn} booking`,
        },
      },
    }),
  );

  // ── 8. ItemList villes proches ─────────────────────────────────────────────
  if (nearbyVilles.length > 0) {
    schemas.push(
      buildItemListJsonLd({
        locale,
        path,
        name: isFr
          ? `Villes proches couvertes pour ${serviceNameFr.toLowerCase()}`
          : `Nearby cities covered for ${serviceNameEn.toLowerCase()}`,
        items: nearbyVilles.map(({ ville: v }, idx) => ({
          position: idx + 1,
          name: v.nameFr,
          url: `${SITE_URL}/${locale}${servicePathFr}/${v.slug}`,
        })),
      }),
    );
  }

  return schemas as ReadonlyArray<Record<string, unknown>>;
}

// ═════════════════════════════════════════════════════════════════════════════
// La Journée IA, ville par ville et région par région (2026-11-11)
// ═════════════════════════════════════════════════════════════════════════════
//
// Les pages `/fr/implantations/**` émettent TROIS nœuds, en ligne dans le HTML :
//   1. `Service` — le MÊME `@id` que le Service de la landing `/fr/journee-ia`
//      (construit par `buildJourneeIaServiceJsonLd`), dont seul `areaServed` est
//      précisé : la ville (nœud `City`, `sameAs` Wikidata DANS ce nœud) ou la région ;
//   2. `BreadcrumbList` ;
//   3. `WebPage`, `about` → le Service.
// Aucun `LocalBusiness`, aucune adresse, aucun `Review`/`AggregateRating` : Axion-IA
// n'a pas de bureau dans chaque ville, elle vient dans les locaux de l'entreprise.

const LOCALE_FR = "fr" as const;

interface FilAriane {
  readonly name: string;
  readonly href: string;
}

interface PageLocaleInput {
  /** Chemin sans locale, ex. `/implantations/bretagne/brest`. */
  readonly path: string;
  /** Title servi (nom de la WebPage). */
  readonly titre: string;
  readonly description: string;
  /** Fil d'Ariane, accueil compris. */
  readonly filAriane: ReadonlyArray<FilAriane>;
  /** Sélecteurs CSS des passages « speakable ». */
  readonly speakable: ReadonlyArray<string>;
  readonly datePublished: string;
  readonly dateModified: string;
}

function noeudsPageLocale(
  input: PageLocaleInput,
  areaServed: Record<string, unknown>,
): ReadonlyArray<Record<string, unknown>> {
  const url = `${SITE_URL}/${LOCALE_FR}${input.path}`;
  const service = { ...buildJourneeIaServiceJsonLd(), areaServed };
  const breadcrumb = buildBreadcrumbJsonLd({ locale: LOCALE_FR, items: input.filAriane });
  const webPage = buildWebPageJsonLd({
    locale: LOCALE_FR,
    path: input.path,
    name: input.titre,
    description: input.description,
    inLanguage: "fr-FR",
    about: { "@id": JOURNEE_IA_SERVICE_ID },
    breadcrumb: { "@id": `${url}#breadcrumb` },
    speakable: { selectors: [...input.speakable] },
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    extra: { spatialCoverage: areaServed },
  });
  return [service, breadcrumb, webPage];
}

export interface JourneeIaVilleJsonLdInput extends PageLocaleInput {
  readonly ville: { readonly nameFr: string };
  readonly region: { readonly nameFr: string };
  /** URL Wikidata de la commune (placée dans le nœud `City`). */
  readonly wikidataUrl: string;
}

/** Service (Journée IA, `areaServed` = la ville) + BreadcrumbList + WebPage. */
export function buildJourneeIaVilleJsonLd(
  input: JourneeIaVilleJsonLdInput,
): ReadonlyArray<Record<string, unknown>> {
  return noeudsPageLocale(input, {
    "@type": "City",
    name: input.ville.nameFr,
    sameAs: input.wikidataUrl,
    containedInPlace: {
      "@type": "AdministrativeArea",
      name: input.region.nameFr,
      containedInPlace: { "@type": "Country", name: "France" },
    },
  });
}

export interface JourneeIaRegionJsonLdInput extends PageLocaleInput {
  readonly region: { readonly nameFr: string };
}

/** Service (Journée IA, `areaServed` = la région) + BreadcrumbList + WebPage. */
export function buildJourneeIaRegionJsonLd(
  input: JourneeIaRegionJsonLdInput,
): ReadonlyArray<Record<string, unknown>> {
  return noeudsPageLocale(input, {
    "@type": "AdministrativeArea",
    name: input.region.nameFr,
    containedInPlace: { "@type": "Country", name: "France" },
  });
}

/** Le hub `/fr/implantations` : Service (France) + BreadcrumbList + WebPage. */
export function buildJourneeIaHubJsonLd(
  input: PageLocaleInput,
): ReadonlyArray<Record<string, unknown>> {
  return noeudsPageLocale(input, { "@type": "Country", name: "France" });
}
