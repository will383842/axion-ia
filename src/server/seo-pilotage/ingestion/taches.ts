/**
 * Les deux tâches de collecte du robot (P4) : `ingestion-gsc` (le dernier jour final) et
 * `rattrapage-gsc` (jusqu'à `JOURS_PAR_PASSAGE` jours d'historique par passage, du plus récent au
 * plus ancien, jusqu'à 16 mois). Le quota Search Console s'arrête proprement : le premier échec
 * (quota 429 compris) stoppe le passage, sans brûler les tentatives des jours suivants.
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

/** Jours d'historique remplis au plus par passage de rattrapage (3 passages par heure). */
export const JOURS_PAR_PASSAGE = 30;
/** Pause entre deux jours : chaque jour fait 3 appels, donc ≈ 3 appels par 1,5 s, très sous le quota. */
export const PAUSE_ENTRE_JOURS_MS = 1500;
/** Un passage s'arrête de lui-même bien avant `lockDuration` du worker (10 min). */
export const BUDGET_PASSAGE_MS = 8 * 60_000;

/** Réglages de test pour le rattrapage (pause et horloge injectables). */
export interface DepsRattrapage extends DepsIngestion {
  readonly pause?: (ms: number) => Promise<void>;
  readonly horloge?: () => number;
  readonly joursParPassage?: number;
}

export type IssueTache =
  | { readonly tache: string; readonly issue: "saute"; readonly motif: string }
  | { readonly tache: string; readonly issue: "termine"; readonly motif: string }
  | { readonly tache: string; readonly issue: "fait"; readonly jour: IssueJour }
  | {
      readonly tache: string;
      readonly issue: "lot";
      readonly jours: ReadonlyArray<IssueJour>;
      /** Pourquoi le passage s'est arrêté. */
      readonly arret: "plafond" | "echec" | "temps" | "historique_complet";
    };

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

const dormir = (ms: number): Promise<void> => new Promise((ok) => setTimeout(ok, ms));

export async function tacheRattrapageGsc(deps: DepsRattrapage): Promise<IssueTache> {
  const tache = "rattrapage-gsc";
  const d = await dernierJour(deps);
  if (!("jour" in d)) return { tache, issue: "saute", motif: d.etat };
  const maintenant = (deps.maintenant ?? (() => new Date()))();
  const horloge = deps.horloge ?? Date.now;
  const pause = deps.pause ?? dormir;
  const plafond = deps.joursParPassage ?? JOURS_PAR_PASSAGE;
  const debut = horloge();
  const borne = reculerMois(d.jour, MOIS_HISTORIQUE);
  const runs = await deps.prisma.gscImportRun.findMany({
    where: {
      typeRecherche: TYPE_RECHERCHE,
      jour: { gte: enDate(borne), lte: enDate(d.jour) },
    },
    select: { jour: true, statut: true, tentatives: true, debutLe: true },
  });
  const parJour = new Map(runs.map((r) => [enJour(r.jour), r]));
  const jours: IssueJour[] = [];
  // Du plus récent au plus ancien : l'historique utile arrive en premier.
  for (let j = ajouterJours(d.jour, -1); j >= borne; j = ajouterJours(j, -1)) {
    const run = parJour.get(j);
    if (run) {
      if (run.statut === "reussi") continue;
      // Abandonné, quel que soit le statut (un jour qui fait tomber le processus reste `en_cours`) :
      // visible à l'écran de santé, jamais repris seul.
      if (run.tentatives >= TENTATIVES_MAX) continue;
      if (run.statut === "en_cours") {
        if (maintenant.getTime() - run.debutLe.getTime() < DELAI_PASSAGE_MORT_MS) continue;
      }
    }
    if (jours.length >= plafond) return { tache, issue: "lot", jours, arret: "plafond" };
    if (jours.length > 0) {
      if (horloge() - debut >= BUDGET_PASSAGE_MS)
        return { tache, issue: "lot", jours, arret: "temps" };
      await pause(PAUSE_ENTRE_JOURS_MS);
    }
    const r = await ingererJour(j, deps);
    jours.push(r);
    // Le premier échec (quota 429 compris) arrête le passage : on ne martèle pas Google, et un
    // incident général ne consomme pas les tentatives de tous les jours du lot.
    if (r.issue === "echec") return { tache, issue: "lot", jours, arret: "echec" };
  }
  if (jours.length === 0) return { tache, issue: "termine", motif: "historique_complet" };
  return { tache, issue: "lot", jours, arret: "historique_complet" };
}
