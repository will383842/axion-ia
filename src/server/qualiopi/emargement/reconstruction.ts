/**
 * Qualiopi T13 — Reconstruction du tuple signé depuis les colonnes.
 *
 * C'est le chaînon qui rend `verifierChaine` autre chose qu'une intention.
 *
 * Une empreinte ne vaut que si on sait la RECALCULER. Tant que les données
 * signées ne vivaient pas toutes en colonnes, `MaillonChaine.tuple` valait
 * `null` et la vérification répondait `tuple_irrecalculable` sur chaque ligne :
 * un registre décoratif, qui aurait donné l'illusion de la preuve sans en
 * apporter. Les colonnes de snapshot (`date`, `demiJournee`, `heureDebut`,
 * `heureFin`, `formationIntitule`, `modulesSnapshot`, `formateurNom`) existent
 * pour cette seule raison.
 *
 * ⚠️ Reconstruire par JOINTURE aurait été pire que de ne rien avoir. Le créneau,
 * l'intitulé de la formation, son programme et l'affectation du formateur sont
 * tous modifiables après coup : renommer une formation aurait invalidé
 * rétroactivement, et en silence, toutes les empreintes déjà émises. Une preuve
 * qui se casse quand on renomme une ligne de catalogue n'est pas une preuve.
 *
 * Logique pure — aucun import Prisma. L'interface d'entrée est un MIROIR des
 * colonnes, pas le type Prisma : la couche pure ne doit pas dépendre du client
 * généré, et les tests n'ont pas à instancier une base.
 */

import type {
  EmargementSignature as PrismaEmargementSignature,
  EmargementContresignature as PrismaEmargementContresignature,
} from "../../../../prisma/generated/client";
import type { LigneContresignature } from "./contresignature-hash";
import {
  type MaillonChaine,
  type TupleSignatureV1,
  calculerSelfHash,
  versionRecalculable,
} from "./hash";

/**
 * Miroir des colonnes scalaires d'`emargement_signatures`.
 *
 * Volontairement structurel : si une colonne du snapshot disparaissait du
 * schéma, ce fichier cesserait de compiler chez l'appelant qui le remplit.
 */
export interface LigneSignature {
  id: string;
  contexteType: "collectif" | "afest_1to1";
  /** Portée de la chaîne (D12). Haché : voir `TupleSignatureV1.enrollmentId`. */
  enrollmentId: string | null;
  creneauId: string | null;
  coachingId: string | null;
  /**
   * Colonne `@db.Date` : Prisma la rend TOUJOURS à minuit UTC.
   *
   * ⚠️ L'écriture doit respecter le même invariant (`new Date(\`${iso}T00:00:00.000Z\`)`).
   * Poser un `new Date()` brut laisserait PostgreSQL décider du jour au cast
   * timestamp→date, selon le fuseau de la session : une signature apposée le
   * 10 juin à 23 h 30 UTC (11 juin à Paris) serait hachée « 2026-06-11 » avant
   * insertion et relue « 2026-06-10 ». Empreinte définitivement fausse, sur une
   * table append-only. `tupleDepuisLigne` refuse donc toute date non alignée.
   */
  date: Date;
  demiJournee: "matin" | "apres_midi" | "journee";
  heureDebut: string;
  heureFin: string;
  formationIntitule: string;
  /** `Json` en base : le type n'est PAS garanti côté application. */
  modulesSnapshot: unknown;
  formateurNom: string;
  signataireNom: string;
  signataireEmail: string | null;
  methode: "canvas" | "confirmation_accessible" | "papier_scanne";
  signatureSha256: string | null;
  signeAt: Date;
  ipHash: string | null;
  userAgentSha256: string | null;
  mentionVersion: string;
  prevHash: string | null;
  selfHash: string;
  hashVersion: number;
}

/**
 * Jour civil `YYYY-MM-DD` d'une colonne `@db.Date`.
 *
 * Prisma rend une colonne `DATE` à MINUIT UTC : l'extraction se fait donc en
 * UTC, jamais en heure locale. Passer par un formatage local décalerait la date
 * d'un jour pour tout serveur à l'ouest de Greenwich — et un jour de décalage
 * dans un tuple haché est une empreinte définitivement fausse.
 */
function jourCivil(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** `modulesSnapshot` n'est un tableau d'intitulés que si la base a tenu son CHECK. */
function modules(valeur: unknown): string[] | null {
  if (!Array.isArray(valeur)) return null;
  return valeur.every((m) => typeof m === "string") ? (valeur as string[]) : null;
}

/**
 * Reconstruit le tuple signé, ou `null` s'il n'est pas recalculable.
 *
 * `null` n'est pas un échec silencieux : `verifierChaine` le transforme en
 * anomalie `tuple_irrecalculable`, visible dans le rapport. C'est la bonne
 * façon de traiter une ligne dont on ne peut plus rien dire — l'inverse d'une
 * vérification qui passerait en fermant les yeux.
 */
export function tupleDepuisLigne(ligne: LigneSignature): TupleSignatureV1 | null {
  // Une version inconnue ne se recalcule pas avec ce code : le dire ici évite de
  // produire une empreinte qui ne correspondrait à rien.
  if (!versionRecalculable(ligne.hashVersion)) return null;

  // Une date qui n'est pas à minuit UTC signale que l'invariant d'écriture a été
  // rompu quelque part : recalculer une empreinte dessus produirait un faux
  // négatif ou un faux positif, jamais une information fiable.
  if (
    ligne.date.getUTCHours() !== 0 ||
    ligne.date.getUTCMinutes() !== 0 ||
    ligne.date.getUTCSeconds() !== 0 ||
    ligne.date.getUTCMilliseconds() !== 0
  ) {
    return null;
  }

  const mods = modules(ligne.modulesSnapshot);
  if (mods === null) return null;

  return {
    contexteType: ligne.contexteType,
    enrollmentId: ligne.enrollmentId,
    creneauId: ligne.creneauId,
    coachingId: ligne.coachingId,
    date: jourCivil(ligne.date),
    demiJournee: ligne.demiJournee,
    heureDebut: ligne.heureDebut,
    heureFin: ligne.heureFin,
    formationIntitule: ligne.formationIntitule,
    modules: mods,
    formateurNom: ligne.formateurNom,
    signataireNom: ligne.signataireNom,
    signataireEmail: ligne.signataireEmail,
    methode: ligne.methode,
    signatureSha256: ligne.signatureSha256,
    signeAtIso: ligne.signeAt.toISOString(),
    ipHash: ligne.ipHash,
    userAgentSha256: ligne.userAgentSha256,
    mentionVersion: ligne.mentionVersion,
    prevHash: ligne.prevHash,
  };
}

/** Maillon prêt pour `verifierChaine`, tuple reconstruit inclus. */
export function maillonDepuisLigne(ligne: LigneSignature): MaillonChaine {
  return {
    id: ligne.id,
    prevHash: ligne.prevHash,
    selfHash: ligne.selfHash,
    hashVersion: ligne.hashVersion,
    versionRecalculable,
    recalculer: () => {
      const tuple = tupleDepuisLigne(ligne);
      // On recalcule avec la version DE LA LIGNE, pas la courante : c'est tout
      // l'objet du registre de sérialiseurs.
      return tuple === null ? null : calculerSelfHash(tuple, ligne.hashVersion);
    },
  };
}

/**
 * Verrou de type — c'est LUI qui empêche le bug d'origine de se reproduire.
 *
 * `LigneSignature` est un miroir écrit à la main : sans ce verrou, retirer une
 * colonne de snapshot du schéma Prisma laisserait passer `tsc`, les 24 tests
 * de ce module, et l'on redécouvrirait à l'audit que la chaîne n'est pas
 * vérifiable. L'affectation ci-dessous ne compile que si CHAQUE champ de
 * `LigneSignature` existe, avec un type compatible, sur la ligne Prisma.
 *
 * `prisma generate` tourne avant `tsc` en CI (Gate A), donc l'incohérence est
 * détectée à la compilation, pas en production.
 *
 * ⚠️ Un verrou n'a de valeur que s'il est TRAVERSÉ. Tout code qui convertit une
 * ligne Prisma en `LigneSignature` doit passer par ici — un `as unknown as
 * LigneSignature` le contourne et rend cette garantie décorative.
 */
export type VerrouColonnes = (ligne: PrismaEmargementSignature) => LigneSignature;
export const verrouColonnes: VerrouColonnes = (ligne) => ligne;

/**
 * Le même verrou, pour la chaîne des CONTRESIGNATURES formateur.
 *
 * Il manquait : `contresignature-hash.ts` annonçait la garantie sans qu'aucune
 * ligne ne la porte. Elle coûte deux lignes et vaut le jour où quelqu'un
 * renomme une colonne du snapshot — un renommage qui, sans elle, ne casserait
 * rien avant le contrôle.
 */
export type VerrouColonnesContresignature = (
  ligne: PrismaEmargementContresignature,
) => LigneContresignature;
export const verrouColonnesContresignature: VerrouColonnesContresignature = (ligne) => ligne;
