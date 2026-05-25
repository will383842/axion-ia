/**
 * Helper async resolveVilleWithCopy — résolution Ville avec fallback DB.
 *
 * Architecture (Sprint VilleCopy generator 2026-05-24) :
 *
 *   Priorité de résolution VilleCopy :
 *     1. Fichier statique `src/content/villes/copy/[slug].ts` (manuel curatié, ~40 villes pilotes)
 *     2. Table DB `GeneratedVilleCopy` (status=approved, généré par ville-hub-copy.ts)
 *     3. Aucune copy → ville reste en stub `noindex follow` (anti-doorway HCU 2024)
 *
 * Pourquoi un helper séparé plutôt que rendre `getVille()` async :
 *   - `getVille()` est utilisé synchrone dans ~9 fichiers (workers, tests, etc.)
 *   - Le rendre async = breaking change massif
 *   - Cette fonction est utilisée UNIQUEMENT par la page hub (`page.tsx`)
 *
 * Build-time stub : si DATABASE_URL pointe `stub.invalid` (GH Actions), le client
 * Prisma stub-aware retourne `null` (cf. AGENTS.md) → fallback gracieux sur stub
 * `noindex follow`. La page sera repeuplée par ISR au premier hit prod.
 */

import { getVille, type Ville } from "./index";
import type { VilleCopy, VilleFaq } from "./copy/types";
import { prisma } from "@/lib/prisma";

interface DbVilleCopyShape {
  readonly pitchFr: string;
  readonly directAnswerFr: string;
  readonly ecosystemFr: string;
  readonly distancesFr: string;
  readonly topSectorsNaf: ReadonlyArray<string>;
  readonly servicesContextJson: {
    readonly audit?: { readonly fr: string };
    readonly interventions?: { readonly fr: string };
    readonly implementation?: { readonly fr: string };
    readonly unAUn?: { readonly fr: string };
  };
  readonly faqGeolocaliseeJson: ReadonlyArray<VilleFaq>;
  readonly heroSchemaJson: {
    readonly centerSubLabel?: string;
    readonly satellites: ReadonlyArray<{
      readonly label: string;
      readonly detail: string;
      readonly accent: "terracotta" | "primary" | "sage" | "mocha";
    }>;
  } | null;
}

/**
 * Map la row DB `GeneratedVilleCopy` vers le shape `VilleCopy` consommé par
 * la page. Les champs EN restent vides (FR-only — EN locale désactivé).
 */
function mapDbToVilleCopy(row: DbVilleCopyShape): VilleCopy {
  const services: VilleCopy["servicesContext"] = {};
  if (row.servicesContextJson.audit?.fr) {
    services.audit = { fr: row.servicesContextJson.audit.fr, en: row.servicesContextJson.audit.fr };
  }
  if (row.servicesContextJson.interventions?.fr) {
    services.interventions = {
      fr: row.servicesContextJson.interventions.fr,
      en: row.servicesContextJson.interventions.fr,
    };
  }
  if (row.servicesContextJson.implementation?.fr) {
    services.implementation = {
      fr: row.servicesContextJson.implementation.fr,
      en: row.servicesContextJson.implementation.fr,
    };
  }
  if (row.servicesContextJson.unAUn?.fr) {
    services.unAUn = {
      fr: row.servicesContextJson.unAUn.fr,
      en: row.servicesContextJson.unAUn.fr,
    };
  }

  const copy: VilleCopy = {
    pitchFr: row.pitchFr,
    pitchEn: row.pitchFr, // FR-only — miroir pour satisfaire le type
    directAnswerFr: row.directAnswerFr,
    directAnswerEn: row.directAnswerFr,
    ecosystemFr: row.ecosystemFr,
    ecosystemEn: row.ecosystemFr,
    distancesFr: row.distancesFr,
    distancesEn: row.distancesFr,
    topSectorsNaf: row.topSectorsNaf,
    servicesContext: services,
    faqGeolocalisee: row.faqGeolocaliseeJson,
  };
  if (row.heroSchemaJson) {
    copy.heroSchema = row.heroSchemaJson;
  }
  return copy;
}

/**
 * Récupère la GeneratedVilleCopy `approved` la plus récente pour un slug.
 * Retourne `null` si :
 *  - Aucune row pour ce slug
 *  - La row existe mais status != approved
 *  - Build-time stub (DATABASE_URL=stub.invalid) — Prisma stub-aware retourne null
 */
async function getApprovedVilleCopyFromDb(slug: string): Promise<VilleCopy | null> {
  try {
    const row = await prisma.generatedVilleCopy.findFirst({
      where: { villeSlug: slug, status: "approved" },
      select: {
        pitchFr: true,
        directAnswerFr: true,
        ecosystemFr: true,
        distancesFr: true,
        topSectorsNaf: true,
        servicesContextJson: true,
        faqGeolocaliseeJson: true,
        heroSchemaJson: true,
      },
    });
    if (!row) return null;
    return mapDbToVilleCopy(row as unknown as DbVilleCopyShape);
  } catch (err) {
    // Build-time / DB inaccessible — fallback gracieux
    console.warn(
      `[resolveVilleWithCopy] DB read failed for ${slug}, returning null`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Résout une ville + sa copy en suivant la priorité :
 *   1. Fichier statique → si présent, utilisé tel quel
 *   2. DB GeneratedVilleCopy status=approved → fallback
 *   3. Aucune copy → stub `noindex`
 *
 * Usage : exclusivement par `page.tsx` du hub ville (page mère).
 * Les sous-pages /[verticale] utilisent `getVille()` sync (pas besoin de copy).
 */
export async function resolveVilleWithCopy(slug: string): Promise<Ville | undefined> {
  const ville = getVille(slug);
  if (!ville) return undefined;
  // Priorité 1 — fichier statique manuel
  if (ville.copy) return ville;
  // Priorité 2 — DB GeneratedVilleCopy approved
  const dbCopy = await getApprovedVilleCopyFromDb(slug);
  if (dbCopy) {
    return { ...ville, copy: dbCopy };
  }
  // Priorité 3 — pas de copy, stub minimal
  return ville;
}
