/**
 * Porte qualité : les deux seuls accès base de l'observation (Q7 écriture, Q8 lecture).
 * Le module `porte-qualite/` reste pur ; tout `prisma` est ici. Sans « use server » :
 * ces fonctions ne sont pas des endpoints (l'action gardée est dans
 * `actions/content-gen/porte-qualite.ts`).
 */

import { prisma } from "@/lib/prisma";
import { readContentGenConfigDirect } from "@/server/content-gen/config-store";
import {
  CLE_CONFIG_PORTE,
  construireVue,
  lireDerogations,
  lireJournal,
  listerInterdits,
  observationActive,
  observerSortie,
  type DerogationAffichee,
  type EntreeJournal,
  type InterditAffiche,
  type IssueObservation,
  type LigneVerdictLue,
  type Source,
  type VuePorte,
} from "@/server/content-gen/porte-qualite";

/** Appelée par le worker de génération. Ne lève jamais, ne change aucun statut. */
export async function observerJobPorte(
  jobId: string,
  contentType: string,
  sortie: unknown,
): Promise<IssueObservation> {
  // Contrat de build (AGENTS.md) : sous l'URL stub, aucune requête ne part.
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return "eteint";
  return observerSortie(
    { jobId, contentType, sortie },
    {
      creer: (ligne) =>
        prisma.contentQualityVerdict.create({
          data: {
            jobId: ligne.jobId,
            contentKind: ligne.contentKind,
            versionPorte: ligne.versionPorte,
            mode: ligne.mode,
            verdict: ligne.verdict,
            note: ligne.note,
            criteres: ligne.criteres as never,
            seuilsFiges: ligne.seuilsFiges as never,
          },
        }),
      lireConfig: () => readContentGenConfigDirect<unknown>(CLE_CONFIG_PORTE, {}),
      maintenant: () => new Date(),
      journal: (message, detail) => console.warn(JSON.stringify({ event: message, ...detail })),
    },
    process.env,
  );
}

const MAX_LIGNES = 200;

/** Lecture seule pour l'écran. Table absente (P2021) ou panne : « indisponible », jamais 0. */
export async function lireVuePorte(): Promise<VuePorte> {
  let config: unknown = {};
  try {
    config = await readContentGenConfigDirect<unknown>(CLE_CONFIG_PORTE, {});
  } catch {
    // Config illisible : l'écran montre les défauts du back-end, pas une panne.
  }
  let lignes: Source<ReadonlyArray<LigneVerdictLue>>;
  try {
    const rows = await prisma.contentQualityVerdict.findMany({
      orderBy: { createdAt: "desc" },
      take: MAX_LIGNES,
    });
    lignes = { etat: "ok", valeur: rows };
  } catch (e) {
    const absente = (e as { code?: string } | null)?.code === "P2021";
    lignes = {
      etat: "indisponible",
      raison: absente ? "La table des verdicts n'existe pas encore." : "Lecture impossible.",
    };
  }
  return construireVue({
    config,
    interrupteurActif: observationActive(process.env),
    // Dernier verdict écrit : seule preuve que le WORKER observe (le drapeau se lit ici côté application).
    dernierVerdictLe: lignes.etat === "ok" ? (lignes.valeur[0]?.createdAt ?? null) : null,
    lignes,
  });
}

export interface VueReglagesJournal {
  readonly journal: Source<ReadonlyArray<EntreeJournal>>;
  readonly derogations: Source<ReadonlyArray<DerogationAffichee>>;
  /** Liste importée de `interdits-publication.ts`, jamais modifiable depuis l'écran. */
  readonly interdits: ReadonlyArray<InterditAffiche>;
}

/** Onglet 4 (Q14), lecture seule : journal des changements de réglages et dérogations. */
export async function lireVueReglagesJournal(): Promise<VueReglagesJournal> {
  const indispo = (e: unknown, quoi: string): { etat: "indisponible"; raison: string } => ({
    etat: "indisponible",
    raison:
      (e as { code?: string } | null)?.code === "P2021"
        ? `La table ${quoi} n'existe pas encore.`
        : "Lecture impossible.",
  });
  let journal: VueReglagesJournal["journal"];
  try {
    const rows = await prisma.contentGenAuditLog.findMany({
      where: { settingKey: CLE_CONFIG_PORTE },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    journal = { etat: "ok", valeur: lireJournal(rows) };
  } catch (e) {
    journal = indispo(e, "du journal");
  }
  let derogations: VueReglagesJournal["derogations"];
  try {
    const rows = await prisma.contentQualityVerdict.findMany({
      where: { decidePar: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    derogations = { etat: "ok", valeur: lireDerogations(rows) };
  } catch (e) {
    derogations = indispo(e, "des verdicts");
  }
  return { journal, derogations, interdits: listerInterdits() };
}
