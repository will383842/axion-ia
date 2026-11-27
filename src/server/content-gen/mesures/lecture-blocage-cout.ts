/**
 * Fiche C1 — lecture (LECTURE SEULE) des jobs de génération des N derniers jours.
 * Aucune écriture, aucune migration : `ContentGenJob` + `GenerationLog` existants.
 * Le calcul vit dans `taux-blocage-cout.ts` (pur, testé sans base).
 *
 * `outputJsonRaw` contient le corps complet de l'article : on lit par lots et on ne
 * garde de chaque ligne que ce que le calcul consomme.
 */

import { prisma } from "@/lib/prisma";
import {
  calculerRapportBlocageCout,
  type LigneJobMesure,
  type RapportBlocageCout,
} from "./taux-blocage-cout";

export const FENETRE_JOURS_DEFAUT = 30;
const TAILLE_LOT = 100;
/** Garde-fou : au plus ce nombre de jobs lus. */
const LIMITE_JOBS = 5000;
const STATUTS_MESURES = [
  "needs_review",
  "approved",
  "publishing",
  "published",
  "quality_improving",
  "quarantined_critical",
  "quarantined_factcheck",
] as const;

function objet(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/** On ne garde de `outputJsonRaw` que les clés lues par le calcul (le corps n'est pas conservé). */
function extraireUtile(brut: unknown): unknown {
  const o = objet(brut);
  if (!o) return null;
  return {
    equipe: o["equipe"] ? { ...(objet(o["equipe"]) ?? {}), brief: undefined } : undefined,
    intentAligned: o["intentAligned"],
    doctrineHardFaults: o["doctrineHardFaults"],
    barrieresRelecture: o["barrieresRelecture"],
    outlineDedupVerdict: o["outlineDedupVerdict"],
    finalIndexationTier: o["finalIndexationTier"],
  };
}

export async function chargerLignesBlocageCout(
  jours: number = FENETRE_JOURS_DEFAUT,
  maintenant: Date = new Date(),
): Promise<LigneJobMesure[]> {
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return [];
  const depuis = new Date(maintenant.getTime() - jours * 86_400_000);
  const lignes: LigneJobMesure[] = [];
  let curseur: string | undefined;

  while (lignes.length < LIMITE_JOBS) {
    const lot = await prisma.contentGenJob.findMany({
      where: { createdAt: { gte: depuis }, status: { in: [...STATUTS_MESURES] } },
      select: {
        id: true,
        contentType: true,
        status: true,
        costUsd: true,
        outputJsonRaw: true,
      },
      orderBy: { id: "asc" },
      take: TAILLE_LOT,
      ...(curseur ? { cursor: { id: curseur }, skip: 1 } : {}),
    });
    if (lot.length === 0) break;
    curseur = lot[lot.length - 1]?.id;

    const ids = lot.map((j) => j.id);
    const journaux = await prisma.generationLog.findMany({
      where: {
        jobId: { in: ids },
        step: "validation",
        message: { startsWith: "Publication automatique refusée" },
      },
      select: { jobId: true, metadata: true },
    });
    const parJob = new Map<string, { causes: string[]; bloque: boolean }>();
    for (const j of journaux) {
      const m = objet(j.metadata);
      const cur = parJob.get(j.jobId) ?? { causes: [], bloque: false };
      if (Array.isArray(m?.["causes"])) {
        for (const c of m["causes"]) if (typeof c === "string") cur.causes.push(c);
      }
      if (m?.["auto_publish_blocked"] === true) cur.bloque = true;
      parJob.set(j.jobId, cur);
    }

    for (const j of lot) {
      const jr = parJob.get(j.id);
      lignes.push({
        id: j.id,
        contentType: j.contentType,
        status: j.status,
        costUsd: j.costUsd === null ? null : Number(j.costUsd),
        outputJsonRaw: extraireUtile(j.outputJsonRaw),
        // Un job relu plusieurs fois peut avoir plusieurs lignes : on dédoublonne les causes.
        causes: jr ? [...new Set(jr.causes)] : [],
        blocageJournalise: jr?.bloque ?? false,
      });
    }
    if (lot.length < TAILLE_LOT) break;
  }
  return lignes;
}

export async function chargerRapportBlocageCout(
  jours: number = FENETRE_JOURS_DEFAUT,
): Promise<RapportBlocageCout> {
  return calculerRapportBlocageCout(await chargerLignesBlocageCout(jours));
}
