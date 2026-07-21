/**
 * Qualiopi T13 — Tuple, empreinte et chaînage des CONTRESIGNATURES formateur.
 *
 * Miroir de `hash.ts`, avec deux différences qui ne sont pas cosmétiques.
 *
 * **Le grain.** Le formateur signe UNE fois par demi-journée, pour tout le
 * groupe — pas une fois par stagiaire. C'est ce décalage qui impose une table
 * distincte : les loger ensemble était l'erreur de conception de la v2 du plan.
 *
 * **La portée de la chaîne.** Elle est (session × formateur), là où celle des
 * stagiaires est l'inscription. Deux co-animateurs ont donc chacun leur propre
 * chaîne sur une même session et ne se gênent pas — et l'index unique partiel
 * `emargement_contresignature_chaine_lineaire` interdit qu'une chaîne fourche.
 *
 * ⚠️ Décision D10 : la contresignature N'ALIMENTE PAS `heuresAnimees`. Sinon le
 * formateur attesterait les heures qui déterminent sa propre rémunération — un
 * conflit d'intérêts qu'un auditeur ou un financeur peut soulever seul. C'est un
 * acte de preuve pédagogique, sans effet sur la paie.
 *
 * Logique pure — aucun import Prisma, aucune horloge.
 */

import { createHash } from "node:crypto";
import { canonicalJson, type CanonicalValue } from "./canonical";
import type { MaillonChaine } from "./hash";

/** Version courante du tuple de contresignature. À incrémenter à tout changement de forme. */
export const HASH_VERSION_CONTRESIGNATURE = 1;

/**
 * Données figées au moment de la contresignature.
 *
 * Tous les champs sont OBLIGATOIRES, `null` compris : un champ absent et un
 * champ nul doivent produire des empreintes différentes.
 */
export interface TupleContresignatureV1 {
  contexteType: "collectif" | "afest_1to1";
  /** Portée de la chaîne. Un seul des deux est non nul (CHECK d'exclusivité). */
  sessionId: string | null;
  coachingId: string | null;
  /** Formateur qui contresigne. HACHÉ : c'est lui qui atteste. */
  trainerId: string;
  formateurNom: string;
  /** Jour civil `YYYY-MM-DD` (heure de Paris). */
  date: string;
  demiJournee: "matin" | "apres_midi" | "journee";
  /** Horaires RÉELS — exigence jurisprudentielle, pas un ornement. */
  heureDebut: string;
  heureFin: string;
  /** Intitulé et modules figés : le programme peut être modifié après. */
  formationIntitule: string;
  modules: string[];
  methode: "canvas" | "confirmation_accessible" | "papier_scanne";
  /** SHA-256 de l'IMAGE. `null` pour `confirmation_accessible`. */
  signatureSha256: string | null;
  /** Horodatage à la milliseconde, ISO-8601 UTC. */
  signeAtIso: string;
  ipHash: string | null;
  userAgentSha256: string | null;
  mentionVersion: string;
  /** `selfHash` de la contresignature précédente du MÊME formateur sur la session. */
  prevHash: string | null;
}

function versCanonical(t: TupleContresignatureV1): CanonicalValue {
  // L'ordre littéral n'a aucune importance : `canonicalJson` trie les clés.
  return {
    v: HASH_VERSION_CONTRESIGNATURE,
    contexteType: t.contexteType,
    sessionId: t.sessionId,
    coachingId: t.coachingId,
    trainerId: t.trainerId,
    formateurNom: t.formateurNom,
    date: t.date,
    demiJournee: t.demiJournee,
    heureDebut: t.heureDebut,
    heureFin: t.heureFin,
    formationIntitule: t.formationIntitule,
    modules: t.modules,
    methode: t.methode,
    signatureSha256: t.signatureSha256,
    signeAt: t.signeAtIso,
    ipHash: t.ipHash,
    userAgentSha256: t.userAgentSha256,
    mentionVersion: t.mentionVersion,
    prevHash: t.prevHash,
  };
}

/** Représentation canonique exacte qui sera hachée. Exposée pour l'audit et les tests. */
export function tupleContresignatureCanonique(t: TupleContresignatureV1): string {
  return canonicalJson(versCanonical(t));
}

/** Empreinte SHA-256 hex (64 caractères) du tuple. */
export function calculerSelfHashContresignature(t: TupleContresignatureV1): string {
  return createHash("sha256").update(tupleContresignatureCanonique(t), "utf8").digest("hex");
}

/**
 * Miroir des colonnes scalaires d'`emargement_contresignatures`.
 *
 * Volontairement structurel : si une colonne disparaissait du schéma, l'appelant
 * qui remplit cette interface cesserait de compiler.
 */
export interface LigneContresignature {
  id: string;
  contexteType: "collectif" | "afest_1to1";
  sessionId: string | null;
  coachingId: string | null;
  trainerId: string;
  formateurNom: string;
  date: Date;
  demiJournee: "matin" | "apres_midi" | "journee";
  heureDebut: string;
  heureFin: string;
  formationIntitule: string;
  /** `Json` en base : le type n'est PAS garanti côté application. */
  modulesSnapshot: unknown;
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
 * Reconstruit le tuple, ou `null` s'il n'est pas recalculable.
 *
 * ⚠️ Refuse une `date` qui n'est pas à minuit UTC : une colonne `@db.Date` est
 * rendue ainsi par Prisma, et une date décalée signale que l'invariant
 * d'écriture a été rompu. Recalculer une empreinte dessus ne produirait aucune
 * information fiable.
 */
export function tupleContresignatureDepuisLigne(
  ligne: LigneContresignature,
): TupleContresignatureV1 | null {
  if (ligne.hashVersion !== HASH_VERSION_CONTRESIGNATURE) return null;
  if (
    ligne.date.getUTCHours() !== 0 ||
    ligne.date.getUTCMinutes() !== 0 ||
    ligne.date.getUTCSeconds() !== 0 ||
    ligne.date.getUTCMilliseconds() !== 0
  ) {
    return null;
  }
  if (!Array.isArray(ligne.modulesSnapshot)) return null;
  const modules = ligne.modulesSnapshot as unknown[];
  if (!modules.every((m): m is string => typeof m === "string")) return null;

  return {
    contexteType: ligne.contexteType,
    sessionId: ligne.sessionId,
    coachingId: ligne.coachingId,
    trainerId: ligne.trainerId,
    formateurNom: ligne.formateurNom,
    date: ligne.date.toISOString().slice(0, 10),
    demiJournee: ligne.demiJournee,
    heureDebut: ligne.heureDebut,
    heureFin: ligne.heureFin,
    formationIntitule: ligne.formationIntitule,
    modules,
    methode: ligne.methode,
    signatureSha256: ligne.signatureSha256,
    signeAtIso: ligne.signeAt.toISOString(),
    ipHash: ligne.ipHash,
    userAgentSha256: ligne.userAgentSha256,
    mentionVersion: ligne.mentionVersion,
    prevHash: ligne.prevHash,
  };
}

/**
 * Maillon prêt pour `verifierChaine`, avec sa fonction de recalcul.
 *
 * La vérification elle-même est celle des signatures stagiaires : c'est
 * volontaire. Dupliquer une vérification d'intégrité est précisément l'endroit
 * où une divergence se cacherait — et personne ne la verrait avant un contrôle.
 */
export function maillonContresignatureDepuisLigne(ligne: LigneContresignature): MaillonChaine {
  return {
    id: ligne.id,
    prevHash: ligne.prevHash,
    selfHash: ligne.selfHash,
    hashVersion: ligne.hashVersion,
    versionAttendue: HASH_VERSION_CONTRESIGNATURE,
    recalculer: () => {
      const tuple = tupleContresignatureDepuisLigne(ligne);
      return tuple === null ? null : calculerSelfHashContresignature(tuple);
    },
  };
}
