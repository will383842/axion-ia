/**
 * Qualiopi — Échéance de paiement des honoraires d'un formateur indépendant.
 *
 * Module PUR : aucune lecture Prisma, aucune horloge implicite. Le `now` est
 * toujours reçu, jamais lu ici — sans quoi les tests ne pourraient pas décrire
 * « la veille de l'échéance » sans figer la machine.
 *
 * ── POURQUOI CE MODULE EXISTE ────────────────────────────────────────────────
 *
 * 🔴 `TrainerStatement.echeanceAt` existait au schéma depuis le 2026-07-09
 * (migration `trainer_commissionnement`), **indexé**, et AUCUNE ligne de code ne
 * l'écrivait. Vérifié le 2026-09-09 : les vingt-sept fichiers qui nomment
 * `echeanceAt` parlent tous de `FactureFormation`. La colonne était une
 * intention, pas une donnée.
 *
 * C'est exactement le défaut que ce dépôt a déjà payé sur les factures clients
 * (`facture_sans_echeance`, cf. `conditions-client.ts`) : **aucune comparaison
 * SQL n'est vraie pour NULL**. Une règle d'alerte écrite sur `echeanceAt < now`
 * aurait été verte, silencieuse et parfaitement inutile — un moteur qui ne
 * remonte rien parce qu'il ne peut rien remonter.
 *
 * D'où les deux gestes de ce module, et l'ordre compte :
 *   1. l'échéance est POSÉE au seul point d'entrée qui existe (le passage en
 *      `facture_recue`, qui exige déjà `dateFacture`) ;
 *   2. la lecture ne dépend JAMAIS de la colonne seule — `echeanceEffective`
 *      retombe sur `dateFacture + 30 j` pour les relevés antérieurs à ce
 *      correctif. Une alerte muette sur le stock aurait reproduit, à un mois
 *      d'intervalle, la leçon « une correction ferme le chemin nominal et
 *      laisse le stock derrière ».
 *
 * ── LE DÉLAI VIENT DU CONTRAT, PAS D'UN RÉGLAGE ──────────────────────────────
 *
 * 30 jours à compter de l'ÉMISSION de la facture : c'est ce que stipule la
 * clause 4 du contrat de sous-traitance (« Délai de paiement », PR #1024), et
 * c'est la seule valeur licite ici. Contrairement au délai client, il n'est pas
 * paramétrable par tiers — un délai négocié au cas par cas contredirait la pièce
 * qu'on fait signer, et l'art. L.441-10 du Code de commerce plafonne de toute
 * façon le délai convenu à 60 jours (plafond d'ORDRE PUBLIC : une stipulation
 * au-delà est réputée non écrite).
 *
 * ⚠️ Le point de départ est la FACTURE, jamais l'encaissement du client.
 * « Payé quand le client a payé » subordonne la dette à un événement sans
 * borne : la clause est réputée non écrite et l'infraction est passible d'une
 * amende administrative allant jusqu'à 2 M€ pour une personne morale. Ce qui est
 * licite — et qui est la construction retenue — c'est de déplacer le FAIT
 * GÉNÉRATEUR : la facture est émise après validation du relevé de la période.
 * On décale le point de départ, on ne repousse aucune échéance.
 *
 * ⚠️ NE PAS TRANSPOSER À UN APPORTEUR. Pour une commission d'apport, l'acquisition
 * à l'encaissement est licite : on y définit le fait générateur d'un DROIT, pas
 * le report d'une DETTE échue. Cf. `contrat-sous-traitance.tsx` et le contrat
 * v1 d'Axion Partners (`paiement.recu`).
 */

import { calculerEcheanceFacture } from "../financements/conditions-client";
import type { StatementStatut } from "./run";

/**
 * Délai de règlement des honoraires, en jours francs depuis l'émission de la
 * facture. Valeur CONTRACTUELLE : elle recopie la clause 4 du contrat de
 * sous-traitance. La changer ici sans changer la pièce ferait payer l'organisme
 * à un rythme que le document qu'il fait signer ne porte pas.
 */
export const DELAI_PAIEMENT_HONORAIRES_JOURS = 30;

/**
 * Échéance de règlement d'une facture d'honoraires.
 *
 * Réutilise délibérément `calculerEcheanceFacture` plutôt que de refaire
 * l'arithmétique de dates : c'est la même opération, elle est déjà bornée à
 * [1, 60] jours (plancher et plafond de l'art. L.441-10), et une seconde
 * implémentation aurait divergé au premier changement — c'est très exactement
 * ce que ce dépôt a constaté sur les cinq émetteurs de factures clients qui
 * recopiaient le calcul.
 *
 * @param dateFacture Date d'émission de la facture d'honoraires.
 */
export function calculerEcheanceHonoraires(dateFacture: Date): Date {
  return calculerEcheanceFacture(dateFacture, DELAI_PAIEMENT_HONORAIRES_JOURS);
}

/** Ce qu'il faut savoir d'un relevé pour dater son exigibilité. */
export interface ReleveDatable {
  readonly statut: StatementStatut;
  readonly dateFacture: Date | null;
  readonly echeanceAt: Date | null;
  readonly payeAt: Date | null;
}

/**
 * L'échéance RÉELLE d'un relevé, colonne posée ou non.
 *
 * 🔑 Le repli n'est pas une commodité, c'est le cœur du correctif. Les relevés
 * passés en `facture_recue` avant le 2026-09-09 portent `echeanceAt = null` : y
 * lire l'exigibilité directement laisserait tout le stock hors du pilotage,
 * indéfiniment et sans bruit. Le repli le rattrape par le calcul, et le script
 * `backfill:echeance-honoraires` remet la colonne en accord avec lui.
 *
 * Rend `null` quand rien ne permet de dater — un relevé non facturé n'a pas
 * d'échéance, et il ne faut surtout pas lui en inventer une : elle lui donnerait
 * une ancienneté de dette devinée.
 */
export function echeanceEffective(releve: ReleveDatable): Date | null {
  if (releve.echeanceAt !== null) return releve.echeanceAt;
  if (releve.dateFacture === null) return null;
  return calculerEcheanceHonoraires(releve.dateFacture);
}

/**
 * Statuts d'un relevé pour lesquels l'organisme DOIT de l'argent.
 *
 * `valide` en fait partie : le relevé est arrêté, la mission est faite, les
 * heures sont constatées — la dette existe, seule la facture manque. L'exclure
 * ferait dire à l'écran « on ne doit rien » à l'instant précis où l'on vient de
 * reconnaître ce qu'on doit.
 *
 * `brouillon` et `a_valider` en sont exclus : un montant qu'aucun humain n'a
 * relu n'est pas une dette, c'est une estimation. `paye` et `annule` non plus,
 * pour des raisons évidentes.
 */
export const STATUTS_RELEVE_DU: readonly StatementStatut[] = ["valide", "facture_recue"];

/**
 * Nombre de jours de retard, ou `null` si le relevé n'est pas en retard.
 *
 * Un relevé payé n'est jamais en retard — même payé après l'échéance : le
 * retard s'est produit, il ne se constate plus. Une alerte qui rouvrirait sur
 * un fait acquitté transformerait la liste en historique, ce que le catalogue
 * refuse explicitement.
 */
export function joursDeRetard(releve: ReleveDatable, now: Date): number | null {
  if (releve.payeAt !== null) return null;
  if (!STATUTS_RELEVE_DU.includes(releve.statut)) return null;
  const echeance = echeanceEffective(releve);
  if (echeance === null) return null;
  if (echeance.getTime() >= now.getTime()) return null;
  return Math.floor((now.getTime() - echeance.getTime()) / 86_400_000);
}
