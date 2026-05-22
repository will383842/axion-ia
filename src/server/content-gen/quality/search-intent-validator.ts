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
    case "voice_search": {
      // Voice search 2026 : phrases courtes ≤ 15 mots TTS-friendly + conversationnel.
      const plainBody = input.bodyHtml
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const sentences = plainBody.split(/[.!?]+/).filter((s) => s.trim().length > 0);
      const longSentences = sentences.filter(
        (s) =>
          s
            .trim()
            .split(/\s+/)
            .filter((w) => w.length > 0).length > 15,
      );
      const longRatio = sentences.length > 0 ? longSentences.length / sentences.length : 0;
      // ≥ 30 % de phrases > 15 mots → hard fail (TTS-unfriendly).
      if (longRatio >= 0.3) {
        hardFails.push(
          `Intent voice_search : ${longSentences.length}/${sentences.length} phrases > 15 mots (>= 30% TTS-unfriendly)`,
        );
      } else if (longRatio >= 0.15) {
        warnings.push(
          `Intent voice_search : ${longSentences.length}/${sentences.length} phrases > 15 mots (cible < 15%)`,
        );
      }
      // Title conversationnel : commence par interrogatif ou inclut un point d'interrogation.
      const isConversational =
        /^(comment|pourquoi|qu'est-ce|quel|quand|combien|où|qui|est-ce)/i.test(input.title) ||
        input.title.includes("?");
      if (!isConversational) {
        warnings.push(
          "Title intent voice_search : devrait être conversationnel (question ou starter interrogatif)",
        );
      }
      break;
    }
    case "ai_overview": {
      // AI Overview 2026 (SGE) : définition sourcée P1 40-50 mots dans le premier paragraphe.
      // metaDescription doit faire office de réponse directe ≤ 50 mots.
      const metaWordCount = input.metaDescription.split(/\s+/).filter((w) => w.length > 0).length;
      if (metaWordCount < 30 || metaWordCount > 60) {
        warnings.push(
          `Intent ai_overview : metaDescription ${metaWordCount} mots (cible 30-60 pour SGE)`,
        );
      }
      // Premier <p> du body doit contenir une définition courte (40-50 mots ±20%).
      const firstParagraphMatch = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(input.bodyHtml);
      const firstParagraphText = (firstParagraphMatch?.[1] ?? "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const firstParagraphWordCount = firstParagraphText
        .split(/\s+/)
        .filter((w) => w.length > 0).length;
      if (firstParagraphText.length === 0) {
        hardFails.push("Intent ai_overview : premier <p> introuvable dans bodyHtml");
      } else if (firstParagraphWordCount < 30 || firstParagraphWordCount > 70) {
        warnings.push(
          `Intent ai_overview : premier paragraphe ${firstParagraphWordCount} mots (cible 30-70 pour AI Overview)`,
        );
      }
      // Citations P1 : au moins 1 citation source primaire attendue.
      if ((input.citationCount ?? 0) < 1) {
        warnings.push(
          `Intent ai_overview : ${input.citationCount ?? 0} citation (cible >= 1 source P1)`,
        );
      }
      break;
    }
    case "featured_snippet": {
      // Featured snippet position 0 : 40-60 mots data-aeo="tldr" en début de contenu.
      const tldrMatch = /<[^>]+\bdata-aeo=["']tldr["'][^>]*>([\s\S]*?)<\/[^>]+>/i.exec(
        input.bodyHtml,
      );
      if (!tldrMatch) {
        hardFails.push(
          'Intent featured_snippet : bloc data-aeo="tldr" manquant (position 0 requise)',
        );
      } else {
        const tldrText =
          tldrMatch[1]
            ?.replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim() ?? "";
        const tldrWordCount = tldrText.split(/\s+/).filter((w) => w.length > 0).length;
        if (tldrWordCount < 30 || tldrWordCount > 75) {
          warnings.push(
            `Intent featured_snippet : bloc TLDR ${tldrWordCount} mots (cible 40-60 pour position 0)`,
          );
        }
      }
      break;
    }
  }

  return {
    aligned: hardFails.length === 0,
    warnings,
    hardFails,
  };
}
