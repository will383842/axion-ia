/**
 * Qualiopi — repères de lecture pour un PREMIER audit (audit initial).
 *
 * Module PUR : aucune dépendance Prisma, Redis ou I/O.
 *
 * ## Le régime de l'audit initial
 *
 * L'arrêté du 6 juin 2019 (art. 1, version consolidée) et le guide de lecture
 * du RNQ V9 désignent onze indicateurs dont l'audit initial ne vérifie que la
 * FORMALISATION du processus ; leur mise en œuvre effective est vérifiée à
 * l'audit de surveillance. La liste ci-dessous est celle du texte, recopiée
 * telle quelle — y compris 3, 13 et 14, qui ne sont pas applicables ici : ils
 * sont filtrés À L'AFFICHAGE (un indicateur non applicable ne porte aucun
 * repère), jamais retirés de la constante, pour qu'elle reste vérifiable contre
 * sa source.
 *
 * Source : `_AUDIT/AUDIT-QUALIOPI-CERTIFICATION-2026-07/phase1-sources/
 * 06-deroulement-audit-initial.md`, § 7 (liste vérifiée sur quatre sources :
 * arrêté art. 1, guide de lecture V9, procédure Acuria v4 p. 9, Pronéo).
 *
 * ⚠️ Ce régime vise le « nouvel entrant » (première année d'activité, ou
 * nouvelle catégorie d'actions). Il ne change AUCUN statut calculé : le moteur
 * de conformité continue de mesurer la mise en œuvre, et c'est voulu — elle
 * sera vérifiée à la surveillance.
 */

import type { StatutConformite } from "./conformite-service";

/** Les onze indicateurs à modalités d'audit adaptées (arrêté, art. 1). */
export const INDICATEURS_AUDIT_INITIAL_PROCESSUS = [
  2, 3, 11, 13, 14, 19, 22, 24, 25, 26, 32,
] as const satisfies readonly number[];

/** La mention, une seule fois. */
export const MENTION_AUDIT_INITIAL =
  "Pour un organisme nouvel entrant, l'auditeur vérifie à l'audit initial que le processus est défini et formalisé ; la mise en œuvre est vérifiée à l'audit de surveillance.";

/**
 * Indicateur 12 — précision du guide de lecture. Elle ne change PAS le statut :
 * le moteur continue de mesurer le suivi de l'assiduité sur toutes les sessions.
 */
export const PRECISION_INDICATEUR_12 =
  "Exigé pour les actions de plus de deux jours (guide de lecture).";

/** L'indicateur `numero` relève-t-il du régime « processus formalisé » à l'initial ? */
export function relevesDuRegimeAuditInitial(numero: number): boolean {
  return (INDICATEURS_AUDIT_INITIAL_PROCESSUS as readonly number[]).includes(numero);
}

/**
 * Repères de lecture d'un indicateur, dans l'ordre d'affichage.
 *
 * Un indicateur NON APPLICABLE n'en porte aucun : son motif suffit, et lui
 * attacher le régime de l'audit initial laisserait croire qu'il sera audité.
 */
export function reperesDeLecture(numero: number, statut: StatutConformite): string[] {
  if (statut === "non_applicable") return [];
  const reperes: string[] = [];
  if (relevesDuRegimeAuditInitial(numero)) reperes.push(MENTION_AUDIT_INITIAL);
  if (numero === 12) reperes.push(PRECISION_INDICATEUR_12);
  return reperes;
}
