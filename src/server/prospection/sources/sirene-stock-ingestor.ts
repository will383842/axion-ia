/**
 * Prospection — Ingestion du Stock Sirene (T3).
 *
 * Stream les fichiers Stock (via `StockSource`), valide chaque ligne (Zod),
 * bulk-upsert Company + Establishment (dédup SIREN/SIRET), met à jour la géo du
 * siège, et construit le dénominateur `StockReference` (dép × naf × taille) à
 * partir des sièges diffusibles actifs.
 *
 * Garde-fous :
 *  - **Non-diffusible exclu** : une unité/établissement `statutDiffusion ≠
 *    diffusible` n'est JAMAIS écrit (RGPD — matrice T3 #4).
 *  - **Schéma altéré** : une ligne qui échoue au parse Zod est comptée
 *    (`invalidRows`) et ignorée — jamais un `null` écrit en masse (matrice T3).
 *  - `db` injecté (le vrai `prisma` le satisfait structurellement) → testable
 *    sans base réelle.
 */

import type { Prisma } from "../../../../prisma/generated/client";
import type { Taille } from "@/lib/prospection/enums";
import {
  uniteLegaleRowSchema,
  etablissementRowSchema,
  mapUniteLegale,
  mapEtablissement,
} from "./sirene-stock-schema";
import type { StockSource, StockRow } from "./stock-source";

export interface IngestDb {
  prospectionCompany: {
    upsert(args: Prisma.ProspectionCompanyUpsertArgs): Promise<unknown>;
    updateMany(args: Prisma.ProspectionCompanyUpdateManyArgs): Promise<unknown>;
  };
  prospectionEstablishment: {
    upsert(args: Prisma.ProspectionEstablishmentUpsertArgs): Promise<unknown>;
  };
  prospectionStockReference: {
    upsert(args: Prisma.ProspectionStockReferenceUpsertArgs): Promise<unknown>;
  };
}

export interface IngestOptions {
  batchSize?: number;
  now?: () => Date;
}

export interface IngestSummary {
  uniteLegaleSeen: number;
  uniteLegaleUpserted: number;
  uniteLegaleSkippedNonDiffusible: number;
  invalidUniteLegaleRows: number;
  uniteLegaleDbErrors: number;
  etablissementSeen: number;
  etablissementUpserted: number;
  etablissementSkippedNonDiffusible: number;
  invalidEtablissementRows: number;
  /** Établissement dont l'unité légale est absente en base (delta / UL invalide) — sauté sans casser le run. */
  etablissementOrphanSkipped: number;
  etablissementDbErrors: number;
  siegeGeoUpdated: number;
  /** Sièges actifs mais incomplets (naf/taille/dép manquant) → hors dénominateur (tracé, pas silencieux). */
  siegeIncomplet: number;
  stockReferenceRows: number;
}

// Code d'erreur Prisma « record not found » (connect vers une ligne absente).
function isRecordNotFound(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2025";
}

// Traite un flux en lots (concurrence bornée par lot) sans charger tout en mémoire.
async function processInBatches<T>(
  iterable: AsyncIterable<StockRow>,
  batchSize: number,
  handle: (row: StockRow) => Promise<T>,
): Promise<void> {
  let batch: StockRow[] = [];
  for await (const row of iterable) {
    batch.push(row);
    if (batch.length >= batchSize) {
      await Promise.all(batch.map(handle));
      batch = [];
    }
  }
  if (batch.length > 0) await Promise.all(batch.map(handle));
}

export async function ingestSireneStock(
  source: StockSource,
  db: IngestDb,
  options: IngestOptions = {},
): Promise<IngestSummary> {
  const batchSize = options.batchSize ?? 500;
  const now = options.now ?? (() => new Date());
  const summary: IngestSummary = {
    uniteLegaleSeen: 0,
    uniteLegaleUpserted: 0,
    uniteLegaleSkippedNonDiffusible: 0,
    invalidUniteLegaleRows: 0,
    uniteLegaleDbErrors: 0,
    etablissementSeen: 0,
    etablissementUpserted: 0,
    etablissementSkippedNonDiffusible: 0,
    invalidEtablissementRows: 0,
    etablissementOrphanSkipped: 0,
    etablissementDbErrors: 0,
    siegeGeoUpdated: 0,
    siegeIncomplet: 0,
    stockReferenceRows: 0,
  };

  // Dénominateur accumulé en mémoire : "dep|naf|taille" → compte (sièges diffusibles actifs).
  const stockCounts = new Map<
    string,
    { departement: string; naf: string; taille: Taille; count: number }
  >();

  // SIREN d'unités légales non-diffusibles (donc jamais créées) : leurs
  // établissements ne doivent PAS être écrits (sinon `connect` échouerait sur une
  // Company inexistante) — et RGPD : cohérence de l'exclusion (minorité en mémoire).
  const skippedSirens = new Set<string>();

  // Sièges déjà comptés (dédup SIRET du dénominateur : un fichier Stock peut
  // répéter un SIRET sur correction → ne pas gonfler `stockAttendu`).
  const seenSiegeSirets = new Set<string>();

  // --- Passe 1 : unités légales (identité/activité/taille/type/diffusion) ---
  await processInBatches(source.iterateUniteLegale(), batchSize, async (raw) => {
    summary.uniteLegaleSeen++;
    const parsed = uniteLegaleRowSchema.safeParse(raw);
    if (!parsed.success) {
      summary.invalidUniteLegaleRows++;
      return;
    }
    const c = mapUniteLegale(parsed.data);
    if (c.statutDiffusion !== "diffusible") {
      summary.uniteLegaleSkippedNonDiffusible++;
      skippedSirens.add(c.siren);
      return;
    }
    const createData: Prisma.ProspectionCompanyCreateInput = {
      siren: c.siren,
      denomination: c.denomination,
      sigle: c.sigle,
      formeJuridique: c.formeJuridique,
      natureJuridique: c.natureJuridique,
      dateCreation: c.dateCreation,
      etatAdministratif: c.etatAdministratif,
      naf: c.naf,
      nafLibelle: c.nafLibelle,
      sectionNaf: c.sectionNaf,
      secteur: c.secteur,
      trancheEffectif: c.trancheEffectif,
      taille: c.taille,
      tailleSource: c.tailleSource,
      categorieEntreprise: c.categorieEntreprise,
      typeOrganisation: c.typeOrganisation,
      statutDiffusion: c.statutDiffusion,
      economieSocialeSolidaire: c.economieSocialeSolidaire,
      source: "stock_sirene",
      firstSeenAt: now(),
      lastCollectedAt: now(),
    };
    // À l'upsert on ne réécrit PAS firstSeenAt (garde la 1re date vue).
    const updateData: Prisma.ProspectionCompanyUpdateInput = {
      denomination: c.denomination,
      sigle: c.sigle,
      formeJuridique: c.formeJuridique,
      natureJuridique: c.natureJuridique,
      dateCreation: c.dateCreation,
      etatAdministratif: c.etatAdministratif,
      naf: c.naf,
      sectionNaf: c.sectionNaf,
      secteur: c.secteur,
      trancheEffectif: c.trancheEffectif,
      taille: c.taille,
      tailleSource: c.tailleSource,
      categorieEntreprise: c.categorieEntreprise,
      typeOrganisation: c.typeOrganisation,
      statutDiffusion: c.statutDiffusion,
      economieSocialeSolidaire: c.economieSocialeSolidaire,
      lastCollectedAt: now(),
    };
    try {
      await db.prospectionCompany.upsert({
        where: { siren: c.siren },
        create: createData,
        update: updateData,
      });
      summary.uniteLegaleUpserted++;
    } catch (err) {
      // Isolation par ligne : une erreur DB transitoire ne casse pas tout le run.
      summary.uniteLegaleDbErrors++;
      console.error(`[stock-ingestor] upsert company ${c.siren} failed:`, err);
    }
  });

  // --- Passe 2 : établissements (siège → géo Company + dénominateur) ---
  await processInBatches(source.iterateEtablissement(), batchSize, async (raw) => {
    summary.etablissementSeen++;
    const parsed = etablissementRowSchema.safeParse(raw);
    if (!parsed.success) {
      summary.invalidEtablissementRows++;
      return;
    }
    const e = mapEtablissement(parsed.data);
    // Exclu si l'établissement est non-diffusible OU si son unité légale a été
    // écartée (non-diffusible) → jamais de connect vers une Company absente.
    if (e.statutDiffusion !== "diffusible" || skippedSirens.has(e.siren)) {
      summary.etablissementSkippedNonDiffusible++;
      return;
    }
    try {
      await db.prospectionEstablishment.upsert({
        where: { siret: e.siret },
        create: {
          siret: e.siret,
          company: { connect: { siren: e.siren } },
          estSiege: e.estSiege,
          naf: e.naf,
          trancheEffectif: e.trancheEffectif,
          adresse: e.adresse,
          departement: e.departement,
          codePostal: e.codePostal,
          commune: e.commune,
          communeCode: e.communeCode,
          etatAdministratif: e.etatAdministratif,
          statutDiffusion: e.statutDiffusion,
        },
        update: {
          estSiege: e.estSiege,
          naf: e.naf,
          trancheEffectif: e.trancheEffectif,
          adresse: e.adresse,
          departement: e.departement,
          codePostal: e.codePostal,
          commune: e.commune,
          communeCode: e.communeCode,
          etatAdministratif: e.etatAdministratif,
          statutDiffusion: e.statutDiffusion,
        },
      });
      summary.etablissementUpserted++;
    } catch (err) {
      if (isRecordNotFound(err)) {
        // Company absente (delta / UL invalide) → orphelin sauté, run non cassé.
        summary.etablissementOrphanSkipped++;
      } else {
        summary.etablissementDbErrors++;
        console.error(`[stock-ingestor] upsert establishment ${e.siret} failed:`, err);
      }
      return;
    }

    if (e.estSiege) {
      // Géo du siège reportée sur la Company (updateMany = no-op si société absente).
      const res = (await db.prospectionCompany.updateMany({
        where: { siren: e.siren },
        data: {
          departement: e.departement,
          codePostal: e.codePostal,
          commune: e.commune,
          communeCode: e.communeCode,
          region: e.region,
          adresse: e.adresse,
        },
      })) as { count?: number };
      if (res && typeof res.count === "number" && res.count > 0) summary.siegeGeoUpdated++;

      // Dénominateur : sièges diffusibles actifs, DÉDUPLIQUÉS par SIRET, par (dép, naf, taille).
      if (e.etatAdministratif === "actif" && !seenSiegeSirets.has(e.siret)) {
        if (e.departement && e.naf && e.taille) {
          seenSiegeSirets.add(e.siret);
          const key = `${e.departement}|${e.naf}|${e.taille}`;
          const existing = stockCounts.get(key);
          if (existing) existing.count++;
          else
            stockCounts.set(key, {
              departement: e.departement,
              naf: e.naf,
              taille: e.taille,
              count: 1,
            });
        } else {
          // Siège actif mais incomplet (naf/taille/dép manquant) → tracé, hors dénominateur.
          summary.siegeIncomplet++;
        }
      }
    }
  });

  // --- Écriture du dénominateur StockReference ---
  const refreshedAt = now();
  for (const entry of stockCounts.values()) {
    await db.prospectionStockReference.upsert({
      where: {
        departement_naf_taille: {
          departement: entry.departement,
          naf: entry.naf,
          taille: entry.taille,
        },
      },
      create: {
        departement: entry.departement,
        naf: entry.naf,
        taille: entry.taille,
        stockAttendu: entry.count,
        stockRefreshedAt: refreshedAt,
      },
      update: { stockAttendu: entry.count, stockRefreshedAt: refreshedAt },
    });
    summary.stockReferenceRows++;
  }

  return summary;
}
