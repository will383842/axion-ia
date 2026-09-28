/**
 * Le point après un rendez-vous, lu d'un coup d'œil (2026-09-28).
 *
 * Demande de Will : « une fois la visio terminée, je ne sais pas s'il se passe
 * quelque chose ou pas ». Deux réponses, toutes deux pures :
 *   · `libelleDuPoint` — ce que le point dit, en une ligne, partout où un
 *     rendez-vous passé s'affiche (onglet « Passés », liste des appels) ;
 *   · `joursDeRetard` — un point qui n'est pas fait 24 h après la fin est en
 *     retard, et l'écran le dit en rouge.
 *
 * ⚠️ Aucun import serveur : lu par des composants serveur ET par les tests.
 */

import { LIBELLE_ISSUE, LIBELLE_SUITE, type IssueRdv, type SuiteRdv } from "./suivi";
import { LIBELLE_ISSUE_APPORTEUR, type DecisionApporteur } from "./issue-apporteur";

export interface PointLu {
  issue: IssueRdv;
  suite: SuiteRdv | null;
  decision?: DecisionApporteur | null;
}

/**
 * « A eu lieu · Retenu », « A eu lieu · Devis à envoyer », « Absent »…
 *
 * La décision d'un échange apporteur remplace la suite d'un client : les deux
 * ne coexistent jamais (cf. `issue-apporteur.ts`).
 */
export function libelleDuPoint(p: PointLu): string {
  const issue = LIBELLE_ISSUE[p.issue];
  if (p.issue !== "eu_lieu") return issue;
  if (p.decision) return `${issue} · ${LIBELLE_ISSUE_APPORTEUR[p.decision]}`;
  if (p.suite) return `${issue} · ${LIBELLE_SUITE[p.suite]}`;
  return issue;
}

/** Au-delà de ce délai après la fin, un point non fait est « en retard ». */
export const HEURES_AVANT_RETARD = 24;

/**
 * Nombre de jours écoulés depuis la fin, quand le point est en retard ;
 * `null` tant que les 24 heures ne sont pas écoulées.
 *
 * Bornes : fin + 24 h pile → 1 jour de retard ; fin + 23 h 59 → `null`.
 */
export function joursDeRetard(fin: Date, maintenant: Date): number | null {
  const ecoule = maintenant.getTime() - fin.getTime();
  if (ecoule < HEURES_AVANT_RETARD * 3_600_000) return null;
  return Math.floor(ecoule / 86_400_000);
}

/** « 1 jour », « 3 jours ». */
export function enJours(n: number): string {
  return `${n} jour${n > 1 ? "s" : ""}`;
}
