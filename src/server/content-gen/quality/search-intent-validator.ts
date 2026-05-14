/**
 * Content Generator — Search intent validator (§ 26 master prompt v1.7).
 *
 * Vérifie l'alignement structurel d'un contenu généré avec son `targetSearchIntent`.
 * Émet des warnings prescriptifs si désalignement.
 */

import type { SearchIntent } from "../../../../prisma/generated/client";

export interface IntentValidationInput {
  readonly intent: SearchIntent;
  readonly slug: string;
  readonly title: string;
  readonly metaDescription: string;
  readonly bodyHtml: string;
  readonly hasLocalBusinessJsonLd?: boolean;
  readonly hasGeoMeta?: boolean;
  readonly hasComparisonTable?: boolean;
  readonly hasPrimaryCta?: boolean;
  readonly citationCount?: number;
}

export interface IntentValidationResult {
  readonly aligned: boolean;
  readonly warnings: ReadonlyArray<string>;
  readonly hardFails: ReadonlyArray<string>;
}

export function validateIntentAlignment(input: IntentValidationInput): IntentValidationResult {
  const warnings: string[] = [];
  const hardFails: string[] = [];

  switch (input.intent) {
    case "transactional": {
      // Slug doit contenir verbe d'action ("reserver", "obtenir", "demander")
      const verbs = /(reserver|obtenir|demander|commander|booker|reserve|book)/i;
      if (!verbs.test(input.slug)) {
        warnings.push("Slug intent transactional : verbe d'action manquant (reserver/obtenir/...)");
      }
      // Title doit contenir un déclencheur ("Réservez", "Obtenez", "Demandez")
      if (!/(réservez|obtenez|demandez|commandez)/i.test(input.title)) {
        warnings.push("Title intent transactional : déclencheur verbe manquant");
      }
      // CTA primary dans la 1ʳᵉ moitié
      if (input.hasPrimaryCta !== true) {
        hardFails.push("Intent transactional sans CTA primary détecté");
      }
      break;
    }
    case "local": {
      if (!input.hasLocalBusinessJsonLd) {
        hardFails.push("Intent local sans LocalBusiness JSON-LD");
      }
      if (!input.hasGeoMeta) {
        hardFails.push("Intent local sans meta geo.region / geo.position");
      }
      // Slug doit contenir ville
      if (!/[a-z]+(-[a-z]+)+$/.test(input.slug)) {
        warnings.push("Intent local : slug devrait inclure ville (format `verbe-ville`)");
      }
      break;
    }
    case "informational": {
      // Doit avoir ≥ 3 citations
      if ((input.citationCount ?? 0) < 3) {
        hardFails.push(`Intent informational sans citations (${input.citationCount ?? 0}/3)`);
      }
      // Title doit commencer par "Comment", "Pourquoi", "Qu'est-ce que", etc.
      const starts = /^(comment|pourquoi|qu'est-ce|quels|quelles|combien|que faire)/i;
      if (!starts.test(input.title)) {
        warnings.push("Title intent informational : devrait commencer par Comment/Pourquoi/...");
      }
      break;
    }
    case "commercial_investigation": {
      if (!input.hasComparisonTable) {
        hardFails.push("Intent commercial_investigation sans <table> comparatif");
      }
      // Title doit contenir "vs", "comparatif", "meilleur", "alternative"
      if (!/(\s+vs\s+|comparatif|meilleur|alternative|comparaison)/i.test(input.title)) {
        warnings.push(
          "Title intent commercial : devrait contenir vs/comparatif/meilleur/alternative",
        );
      }
      break;
    }
    case "navigational": {
      // Pas auto-généré V1 — log info
      warnings.push("Intent navigational : pages réservées aux contenus manuels (§ 26.4)");
      break;
    }
  }

  return {
    aligned: hardFails.length === 0,
    warnings,
    hardFails,
  };
}
