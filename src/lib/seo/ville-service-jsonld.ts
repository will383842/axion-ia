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
 *   2. LocalBusiness/ProfessionalService (@id + geo + telephone + email + sameAs ville)
 *   3. BreadcrumbList (3 niveaux + @id)
 *   4. FAQPage + Speakable (cible #axion-direct-answer + #axion-faq)
 *   5. HowTo (méthodologie pas à pas — rich result éligible)
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
  SITE_URL,
} from "@/lib/seo";
import { buildSpeakableSpecification } from "@/lib/seo/speakable-universal";

// ─── Types ───────────────────────────────────────────────────────────────────

export type VilleServiceKey = "audit" | "interventions" | "implementation" | "un-a-un";

/** ISO 8601 duration par service (utilisé dans HowTo totalTime). */
const SERVICE_DURATION: Record<VilleServiceKey, string> = {
  audit: "P5D",
  interventions: "PT4H",
  implementation: "P4W",
  "un-a-un": "PT2H",
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
  const cityWikiUrl = `https://fr.wikipedia.org/wiki/${encodeURIComponent(ville.nameFr.replace(/ /g, "_"))}`;
  // Wikidata sameAs ville — Audit Will 2026-05-27 (P2 fix E-E-A-T).
  // Lien de recherche Wikidata par nom : redirige vers le Q-ID de la ville
  // (Knowledge Graph mondiale). Boost cross-domain authority pour LLMs/AI Overviews.
  const cityWikidataUrl = `https://www.wikidata.org/wiki/Special:Search?search=${encodeURIComponent(ville.nameFr)}`;

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

  // ── 2. LocalBusiness / ProfessionalService (Service Area Business safe) ──
  // Sprint correctif P1-1 (2026-05-23) — Axion-IA = 1 siège FR + interventions
  // mixtes (présentiel/remote). Pattern Schema.org "Service Area Business"
  // légitime mais ASSAINI pour éviter sanction Google "fake local SEO" :
  //   ❌ RETIRÉ `geo` (GPS = revendique bureau physique → faux pour villes hors siège)
  //   ❌ RETIRÉ `openingHoursSpecification` (9h-18h = bureau ouvert chaque ville → faux)
  //   ❌ RETIRÉ `priceRange` (varie par mission, pas par ville)
  //   ❌ RETIRÉ `address.postalCode` (CP = revendique adresse précise)
  //   ✅ GARDÉ `address.addressLocality` (= zone de service couverte, légitime SAB)
  //   ✅ GARDÉ `parentOrganization` (essentiel : pointe vers entité unique root)
  //   ✅ GARDÉ `areaServed` (cœur du pattern Service Area Business)
  // Référence : https://developers.google.com/search/docs/appearance/structured-data/local-business
  // « Do not mark up an address that is not a real, accurate physical address. »
  schemas.push({
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "ProfessionalService"],
    "@id": `${url}#business`,
    name: isFr
      ? `Axion-IA · ${serviceNameFr} à ${ville.nameFr}`
      : `Axion-IA · ${serviceNameEn} in ${ville.nameFr}`,
    description: hero,
    url,
    email: "contact@axion-ia.com",
    image: `${SITE_URL}/opengraph-image`,
    address: {
      "@type": "PostalAddress",
      addressLocality: ville.nameFr,
      addressRegion: region.nameFr,
      addressCountry: "FR",
    },
    sameAs: ["https://www.linkedin.com/company/axion-ia", cityWikiUrl, cityWikidataUrl],
    parentOrganization: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Axion-IA",
      legalName: "Axion-IA",
      url: SITE_URL,
    },
    areaServed: { "@type": "City", name: ville.nameFr },
    knowsLanguage: ["fr", "en"],
  });

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
  // Éligible rich result "étapes" Google + citations Perplexity "comment fonctionne X".
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

  schemas.push({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
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
    inLanguage: locale,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    about: [
      { "@type": "City", name: ville.nameFr },
      { "@type": "Service", name: isFr ? serviceNameFr : serviceNameEn },
    ],
    // Speakable cible le bloc directAnswer + FAQ pour voice search (SGE, Bixby, Google Assistant)
    // Selector #axion-direct-answer conditionnel (P2-2 Sprint S+5 — drift JSON-LD/DOM fix).
    speakable: buildSpeakableSpecification({ selectors: speakableSelectors }),
    breadcrumb: { "@id": `${url}#breadcrumb` },
    potentialAction: {
      "@type": "ReserveAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/${locale}/reserver?ville=${ville.slug}&service=${service}`,
      },
      result: {
        "@type": "Reservation",
        name: isFr ? `Réservation ${serviceNameFr}` : `${serviceNameEn} booking`,
      },
    },
  });

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
