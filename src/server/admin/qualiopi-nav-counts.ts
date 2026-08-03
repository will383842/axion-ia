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
import { compterPiecesEnAttente } from "@/server/qualiopi/documents/signature/pieces-en-attente";

export interface QualiopiNavCounts {
  /** Pièces dont une signature manque (partielle) ou n'a pas commencé (en_attente). */
  signatures: number;
  /** E-mails retenus dans la corbeille de validation (F60). */
  emails: number;
  /** Alertes système actives non lues (évaluateur quotidien 07:00). */
  alertes: number;
  /**
   * Relances de recouvrement en attente d'un clic (hub facturation).
   *
   * 🔴 Manquait entièrement. Les relances proposées n'existaient QUE dans le hub
   * facturation : ni pastille, ni ligne dans « À traiter ». Un impayé ne se
   * signalait donc nulle part tant qu'on n'ouvrait pas l'écran — soit
   * exactement le « on ne sait pas où regarder » que ces compteurs corrigent,
   * sur le sujet où l'oubli coûte le plus cher.
   */
  relances: number;
  /** Somme — la pastille de « À traiter » et du pôle. */
  total: number;
}

export const COMPTEURS_VIDES: QualiopiNavCounts = {
  signatures: 0,
  emails: 0,
  alertes: 0,
  relances: 0,
  total: 0,
};

/**
 * Calcule les quatre compteurs en parallèle. Chacun est indépendamment
 * fail-soft : une table indisponible ne doit jamais priver la sidebar des
 * autres chiffres — ni, surtout, faire tomber le layout admin entier.
 */
export async function compterQualiopiNav(): Promise<QualiopiNavCounts> {
  const now = new Date();
  const [signatures, emails, alertes, relances] = await Promise.all([
    // 🔴 C'ÉTAIT UN `prisma.count` BRUT, ET IL MENTAIT. La page « À traiter »
    // retire les pièces REMPLACÉES (une convention non signée alors qu'une
    // autre, du même type et sur la même session, l'est intégralement) ; ce
    // compteur, non. Résultat lu en production le 2026-08-03 : la pastille
    // annonçait 2 pendant que la page affichait « Rien à traiter — tout est à
    // jour ». Le filtre vit maintenant dans un module partagé, et les DEUX
    // appelants passent par lui — c'est la promesse écrite en tête de fichier.
    compterPiecesEnAttente().catch(() => 0),
    compterEnAttente().catch(() => 0),
    // `countNonLues` du service — le MÊME compteur que la page Alertes, pas
    // une réécriture du where (ils divergeraient).
    countNonLues().catch(() => 0),
    // Même définition d'« à traiter » que le hub facturation : jamais traitées,
    // PLUS les reportées dont l'échéance de report est passée (une relance
    // reportée doit REVENIR, jamais disparaître). Deux définitions donneraient
    // un jour deux chiffres — et un badge qui ment n'est plus jamais regardé.
    prisma.relanceProposee
      .count({
        where: {
          OR: [{ statut: "a_traiter" }, { statut: "reportee", reporteeJusqua: { lte: now } }],
        },
      })
      .catch(() => 0),
  ]);
  return {
    signatures,
    emails,
    alertes,
    relances,
    total: signatures + emails + alertes + relances,
  };
}
