"use server";

/**
 * Prospection — Actions d'exploitation (ops) déclenchables depuis la console.
 * Évite d'avoir à lancer l'ingestion Stock depuis un script/REPL (vérif backend).
 */

import { requireProspectionAccess } from "./_auth";
import {
  enqueueProspectionStockIngest,
  enqueueProspectionEnrich,
} from "@/server/prospection/queue/queues";
import { prisma } from "@/lib/prisma";

export interface EnrichSegmentFilters {
  departement?: string;
  secteur?: string;
  naf?: string;
  /** Ne (ré)enrichir que les entreprises pas encore enrichies. Défaut true. */
  onlyPending?: boolean;
}

/**
 * Enfile un job d'ingestion du Stock Sirene (chemins pris du job-data ou des env
 * `PROSPECTION_STOCK_*_PATH`). Réservé `admin` (capacité config).
 */
export async function triggerProspectionStockIngest(_formData?: FormData): Promise<void> {
  const session = await requireProspectionAccess("config");
  // Échec CLAIR si aucun fichier Stock n'est provisionné (sinon le job no-op en
  // silence et la campagne se clôt à vide — audit backend). Les chemins sont
  // fournis via env (fichiers Sirene montés sur le VPS).
  if (
    !process.env.PROSPECTION_STOCK_UNITE_LEGALE_PATH &&
    !process.env.PROSPECTION_STOCK_ETABLISSEMENT_PATH
  ) {
    throw new Error(
      "Aucun fichier Stock Sirene configuré (PROSPECTION_STOCK_UNITE_LEGALE_PATH / " +
        "PROSPECTION_STOCK_ETABLISSEMENT_PATH). Télécharger le Stock data.gouv, le monter, " +
        "puis renseigner ces variables avant de lancer l'ingestion.",
    );
  }
  await enqueueProspectionStockIngest({});
  await prisma.prospectionEvent.create({
    data: {
      type: "refresh",
      actorId: session.userId,
      reason: "ingestion Stock Sirene déclenchée (console)",
    },
  });
}

/**
 * Enrichissement INDÉPENDANT d'un segment déjà collecté (dép / secteur / NAF),
 * découplé d'une campagne. Enfile l'enrichissement des entreprises correspondantes
 * (par défaut seulement celles non encore enrichies). Keyset borné. RGPD : opt-out
 * + non-diffusibles exclus. Réservé `operate` (admin/editor).
 */
export async function enrichProspectionSegment(
  filters: EnrichSegmentFilters,
): Promise<{ enqueued: number }> {
  const session = await requireProspectionAccess("operate");
  const where = {
    statutDiffusion: "diffusible",
    etatAdministratif: "actif",
    optOut: false,
    ...(filters.departement ? { departement: filters.departement } : {}),
    ...(filters.secteur ? { secteur: filters.secteur as never } : {}),
    ...(filters.naf ? { naf: filters.naf } : {}),
    ...(filters.onlyPending === false ? {} : { enrichmentStatus: "pending" as never }),
  };

  const CAP = 50_000;
  let cursor: string | undefined;
  let enqueued = 0;
  while (enqueued < CAP) {
    const page: Array<{ id: string }> = await prisma.prospectionCompany.findMany({
      where: where as never,
      select: { id: true },
      orderBy: { id: "asc" },
      take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (page.length === 0) break;
    for (const c of page) {
      await enqueueProspectionEnrich(c.id);
      enqueued++;
    }
    cursor = page[page.length - 1]!.id;
    if (page.length < 500) break;
  }

  await prisma.prospectionEvent.create({
    data: {
      type: "refresh",
      actorId: session.userId,
      reason: `enrichissement segment (${enqueued}) — dép=${filters.departement ?? "*"} secteur=${filters.secteur ?? "*"} naf=${filters.naf ?? "*"}`,
    },
  });
  return { enqueued };
}
