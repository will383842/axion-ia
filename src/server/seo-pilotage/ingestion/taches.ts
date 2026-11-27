/**
 * Les deux tâches de collecte du robot (P4) : `ingestion-gsc` (le dernier jour final) et
 * `rattrapage-gsc` (UN jour d'historique par passage, du plus récent au plus ancien, jusqu'à
 * 16 mois). Le quota Search Console s'arrête proprement : un échec de quota stoppe le passage.
 */
import { gscDernierJourFinal, type GscEtat } from "@/server/content-gen/seo/gsc-client";
import { ajouterJours, enDate, enJour, MOIS_HISTORIQUE, reculerMois } from "./dates";
import {
  DELAI_PASSAGE_MORT_MS,
  ingererJour,
  TENTATIVES_MAX,
  TYPE_RECHERCHE,
  type DepsIngestion,
  type IssueJour,
} from "./jour";

export type IssueTache =
  | { readonly tache: string; readonly issue: "saute"; readonly motif: string }
  | { readonly tache: string; readonly issue: "termine"; readonly motif: string }
  | { readonly tache: string; readonly issue: "fait"; readonly jour: IssueJour };

async function dernierJour(
  deps: DepsIngestion,
): Promise<{ jour: string } | { etat: GscEtat | "aucune_donnee" }> {
  const r = await gscDernierJourFinal({
    ...(deps.maintenant ? { maintenant: deps.maintenant } : {}),
  });
  if (r.etat !== "ok") return { etat: r.etat };
  if (!r.jour) return { etat: "aucune_donnee" };
  return { jour: r.jour };
}

export async function tacheIngestionGsc(deps: DepsIngestion): Promise<IssueTache> {
  const tache = "ingestion-gsc";
  const d = await dernierJour(deps);
  if (!("jour" in d)) return { tache, issue: "saute", motif: d.etat };
  return { tache, issue: "fait", jour: await ingererJour(d.jour, deps) };
}

export async function tacheRattrapageGsc(deps: DepsIngestion): Promise<IssueTache> {
  const tache = "rattrapage-gsc";
  const d = await dernierJour(deps);
  if (!("jour" in d)) return { tache, issue: "saute", motif: d.etat };
  const maintenant = (deps.maintenant ?? (() => new Date()))();
  const borne = reculerMois(d.jour, MOIS_HISTORIQUE);
  const runs = await deps.prisma.gscImportRun.findMany({
    where: {
      typeRecherche: TYPE_RECHERCHE,
      jour: { gte: enDate(borne), lte: enDate(d.jour) },
    },
    select: { jour: true, statut: true, tentatives: true, debutLe: true },
  });
  const parJour = new Map(runs.map((r) => [enJour(r.jour), r]));
  // Du plus récent au plus ancien : l'historique utile arrive en premier.
  for (let j = ajouterJours(d.jour, -1); j >= borne; j = ajouterJours(j, -1)) {
    const run = parJour.get(j);
    if (!run) return { tache, issue: "fait", jour: await ingererJour(j, deps) };
    if (run.statut === "reussi") continue;
    // Abandonné, quel que soit le statut (un jour qui fait tomber le processus reste `en_cours`) :
    // visible à l'écran de santé, jamais repris seul.
    if (run.tentatives >= TENTATIVES_MAX) continue;
    if (run.statut === "en_cours") {
      if (maintenant.getTime() - run.debutLe.getTime() < DELAI_PASSAGE_MORT_MS) continue;
    }
    return { tache, issue: "fait", jour: await ingererJour(j, deps) };
  }
  return { tache, issue: "termine", motif: "historique_complet" };
}
