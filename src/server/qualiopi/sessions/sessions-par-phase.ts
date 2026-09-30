/**
 * 🔴 Lot L4 (2026-09-30) — la liste des sessions rangée PAR PHASE.
 *
 * Constat de l'audit UX en production : on ne suivait pas une session de bout en
 * bout, la liste mélangeait les dossiers à préparer, ceux du jour, ceux qui
 * attendent encore une pièce et ceux qui sont clos. Les onglets « Préparer /
 * Le jour J / Après / Clôturées / Annulées » disent où en est chaque dossier.
 *
 * ## Une seule règle : `phaseDossier` (ADR 0060)
 *
 * La phase n'est PAS recalculée ici. Elle vient de `phaseDossier(statut, etat)`,
 * la fonction que partagent la fiche session et le dossier d'audit. Ce module ne
 * fait que DEUX choses :
 *   1. traduire la phase en préfiltre SQL sur le statut — exact pour quatre
 *      phases sur cinq, puisque `phaseDossier` ne lit le verrou que pour une
 *      session `realisee` (« Après » ou « Clôturées ») ;
 *   2. pour ces deux-là seulement, lire les états du verrou en UN appel groupé
 *      (`chargerEtatsVerrou`, deux requêtes quel que soit le nombre de sessions)
 *      et garder les identifiants dont la phase est celle demandée.
 *
 * 🔴 Jamais une lecture par session : la liste des « Après » d'une année peut
 * compter des centaines de dossiers, un appel par ligne ferait exploser le temps
 * de la page (N+1). Verrouillé par le test qui compte les appels à Prisma.
 */

import type { Prisma } from "../../../../prisma/generated/client";
import { prisma } from "@/lib/prisma";
import {
  chargerEtatsVerrou,
  phaseDossier,
  type EtatVerrouDossier,
  type PhaseDossier,
  type StatutSessionVerrou,
} from "./verrou-dossier";

/** Les onglets de la liste, dans l'ordre de la vie d'un dossier. */
export const ONGLETS_PHASE: ReadonlyArray<{ readonly phase: PhaseDossier; readonly libelle: string }> =
  [
    { phase: "preparer", libelle: "Préparer" },
    { phase: "jour_j", libelle: "Le jour J" },
    { phase: "apres", libelle: "Après" },
    { phase: "cloturee", libelle: "Clôturées" },
    { phase: "hors_parcours", libelle: "Annulées" },
  ];

/** Libellé court de la phase d'UNE ligne (colonne « Dossier » de la liste). */
export const LIBELLE_PHASE: Readonly<Record<PhaseDossier, string>> = {
  preparer: "À préparer",
  jour_j: "Le jour J",
  apres: "Après la session",
  cloturee: "Clôturé",
  hors_parcours: "Annulée ou reportée",
};

/** `?phase=` → la phase, `null` pour « toutes » ou une valeur inconnue. */
export function parsePhaseParam(v: string | string[] | undefined): PhaseDossier | null {
  if (typeof v !== "string") return null;
  return ONGLETS_PHASE.some((o) => o.phase === v) ? (v as PhaseDossier) : null;
}

/**
 * Les statuts qui PEUVENT tomber dans la phase — le préfiltre SQL.
 *
 * Exact par construction de `phaseDossier` : `annulee`/`reportee` → hors
 * parcours ; `planifiee` → préparer ; `en_cours` → jour J ; `realisee` → après
 * OU clôturée selon le verrou (seul cas où il faut lire les pièces).
 */
export function statutsDeLaPhase(phase: PhaseDossier): StatutSessionVerrou[] {
  switch (phase) {
    case "preparer":
      return ["planifiee"];
    case "jour_j":
      return ["en_cours"];
    case "apres":
    case "cloturee":
      return ["realisee"];
    case "hors_parcours":
      return ["annulee", "reportee"];
  }
}

/** Vrai quand le statut seul ne suffit pas à trancher la phase. */
export function phaseDemandeLeVerrou(phase: PhaseDossier): boolean {
  return phase === "apres" || phase === "cloturee";
}

export type EtatsVerrou = Map<string, { statut: StatutSessionVerrou; etat: EtatVerrouDossier }>;

/**
 * Restriction à passer à `listSessionsForAdmin` pour n'afficher que la phase.
 *
 * - `ids` n'est posé que pour « Après » et « Clôturées » ; il est calculé sur la
 *   FENÊTRE entière (pas sur une page), sans quoi la pagination compterait des
 *   lignes qu'elle n'affiche pas.
 * - `etats` rend les états déjà lus, pour que la page ne les relise pas.
 *
 * Fail-soft : si la lecture des états échoue, on rend `ids: []` (liste vide qui
 * le DIT à l'écran) plutôt que de classer à tort un dossier « Clôturé ».
 */
export async function restrictionDeLaPhase(
  phase: PhaseDossier,
  whereFenetre: Prisma.TrainingSessionWhereInput,
  maintenant: Date = new Date(),
): Promise<{
  statuts: StatutSessionVerrou[];
  ids: string[] | null;
  etats: EtatsVerrou;
  lectureEchouee: boolean;
}> {
  const statuts = statutsDeLaPhase(phase);
  if (!phaseDemandeLeVerrou(phase)) {
    return { statuts, ids: null, etats: new Map(), lectureEchouee: false };
  }
  try {
    const realisees = await prisma.trainingSession.findMany({
      where: { ...whereFenetre, statut: { in: statuts } },
      select: { id: true },
    });
    const etats = await chargerEtatsVerrou(
      realisees.map((s) => s.id),
      maintenant,
    );
    const ids: string[] = [];
    for (const [id, { statut, etat }] of etats) {
      if (phaseDossier(statut, etat) === phase) ids.push(id);
    }
    return { statuts, ids, etats, lectureEchouee: false };
  } catch {
    return { statuts, ids: [], etats: new Map(), lectureEchouee: true };
  }
}

/**
 * La phase de chaque ligne affichée. Réutilise les états déjà lus par
 * `restrictionDeLaPhase` ; sinon, UN appel groupé pour les lignes de la page.
 * Fail-soft : une ligne sans état affiche « — », jamais une phase inventée.
 */
export async function phasesDesLignes(
  ids: ReadonlyArray<string>,
  dejaLus: EtatsVerrou,
  maintenant: Date = new Date(),
): Promise<Map<string, PhaseDossier>> {
  const manquants = ids.filter((id) => !dejaLus.has(id));
  let etats: EtatsVerrou = dejaLus;
  if (manquants.length > 0) {
    try {
      const lus = await chargerEtatsVerrou(manquants, maintenant);
      etats = new Map([...dejaLus, ...lus]);
    } catch {
      // Fail-soft : la colonne dira « — » pour ces lignes.
    }
  }
  const out = new Map<string, PhaseDossier>();
  for (const id of ids) {
    const e = etats.get(id);
    if (e) out.set(id, phaseDossier(e.statut, e.etat));
  }
  return out;
}
