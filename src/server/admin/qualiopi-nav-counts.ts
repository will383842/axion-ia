/**
 * Compteurs « à traiter » de la console Qualiopi — SSOT des pastilles rouges.
 *
 * ## Pourquoi ce module (refonte console phase 1, 2026-08-01)
 *
 * Verdict de Will sur la console : « on ne sait pas où regarder, on ne sait
 * pas par quoi commencer ». La réponse tient en deux morceaux : une page
 * « À traiter » qui liste ce qui attend, et des pastilles rouges avec compteur
 * sur la navigation — le principe des messages non lus.
 *
 * 🔴 Un seul module produit ces chiffres, consommé PAR LES DEUX : la sidebar
 * (badges) et la page « À traiter » (blocs). Deux calculs séparés diraient un
 * jour deux chiffres différents pour la même chose — et un badge qui ment une
 * fois n'est plus jamais regardé.
 *
 * ## Philosophie des compteurs (décision Will 2026-07-29, boîte de réception)
 *
 * Le badge compte ce qu'il RESTE À FAIRE — il descend à zéro. Jamais un
 * compteur de volume, qu'on finit par ignorer.
 *
 * Stub-safe : chaque compteur retombe à 0 sur erreur (build sans DB).
 */

import { prisma } from "@/lib/prisma";
import { compterEnAttente } from "@/server/email/outbox-service";
import { countNonLues } from "@/server/qualiopi/alertes/alertes-service";

export interface QualiopiNavCounts {
  /** Pièces dont une signature manque (partielle) ou n'a pas commencé (en_attente). */
  signatures: number;
  /** E-mails retenus dans la corbeille de validation (F60). */
  emails: number;
  /** Alertes système actives non lues (évaluateur quotidien 07:00). */
  alertes: number;
  /** Somme — la pastille de « À traiter » et du pôle. */
  total: number;
}

export const COMPTEURS_VIDES: QualiopiNavCounts = {
  signatures: 0,
  emails: 0,
  alertes: 0,
  total: 0,
};

/**
 * Calcule les trois compteurs en parallèle. Chacun est indépendamment
 * fail-soft : une table indisponible ne doit jamais priver la sidebar des
 * deux autres chiffres — ni, surtout, faire tomber le layout admin entier.
 */
export async function compterQualiopiNav(): Promise<QualiopiNavCounts> {
  const [signatures, emails, alertes] = await Promise.all([
    prisma.documentGenere
      .count({ where: { statutSignature: { in: ["partielle", "en_attente"] } } })
      .catch(() => 0),
    compterEnAttente().catch(() => 0),
    // `countNonLues` du service — le MÊME compteur que la page Alertes, pas
    // une réécriture du where (ils divergeraient).
    countNonLues().catch(() => 0),
  ]);
  return { signatures, emails, alertes, total: signatures + emails + alertes };
}
