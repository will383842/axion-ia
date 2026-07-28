/**
 * AFEST 1-to-1 — Tuple canonique, empreinte et chaînage des signatures de séance.
 *
 * Miroir de `emargement/hash.ts` et de `emargement/contresignature-hash.ts`, avec
 * quatre différences qui ne sont pas cosmétiques.
 *
 * **Le grain.** Une séance × un rôle. Le collectif signe un créneau
 * (demi-journée) ; ici trois rôles distincts — bénéficiaire, formateur, tuteur
 * entreprise — signent chacune des N séances d'un parcours qui peut durer
 * vingt-quatre mois.
 *
 * **La portée de la chaîne.** Elle est (parcours × rôle). Les trois rôles ont
 * donc trois chaînes indépendantes sur un même parcours et ne se sérialisent pas
 * les uns derrière les autres — et l'index unique partiel
 * `coaching_seance_signature_chaine_lineaire` (`NULLS NOT DISTINCT`) interdit
 * qu'une chaîne fourche.
 *
 * **La version.** `HASH_VERSION_SEANCE` est PROPRE à ce contexte. Bumper
 * `HASH_VERSION_COURANTE` pour les besoins de l'AFEST invaliderait la
 * recalculabilité du collectif ; l'inverse est vrai aussi.
 *
 * **Ce qui n'est PAS haché.** `dureeMinutes` est volontairement hors du tuple :
 * elle est redondante avec `(heureDebut, heureFin)`, et sceller deux
 * représentations de la même grandeur, c'est figer une contradiction
 * potentielle. La référence collective ne hache jamais la durée non plus.
 * `ipHash` et `userAgentSha256` sont hors tuple pour une autre raison —
 * l'effacement RGPD doit pouvoir les mettre à `null` sans rendre
 * `empreinte_invalide` sur des pièces intactes. C'est exactement le bug que le
 * collectif a dû corriger, et qu'on ne reproduit pas.
 *
 * Logique pure — aucun import Prisma, aucune horloge.
 */

import { createHash } from "node:crypto";
import { canonicalJson, type CanonicalValue } from "@/server/qualiopi/emargement/canonical";
import type { MaillonChaine } from "@/server/qualiopi/emargement/hash";

/** Version courante du tuple de signature de séance AFEST. */
export const HASH_VERSION_SEANCE = 1;

/**
 * Versions encore recalculables — même doctrine que le collectif : quand la
 * forme change, on INCRÉMENTE `HASH_VERSION_SEANCE`, on FIGE l'ancien
 * sérialiseur ici, et on n'y touche plus jamais. Une empreinte émise reste
 * vérifiable pour toujours, et `maillonSeanceDepuisLigne` recalcule avec la
 * version DE LA LIGNE, jamais la courante.
 */
const SERIALISEURS_SEANCE: Readonly<Record<number, (t: TupleSeanceSignatureV1) => CanonicalValue>> =
  {
    1: versCanonicalSeanceV1,
  };

/** Vrai si ce code sait recalculer une empreinte de séance de cette version. */
export function versionSeanceRecalculable(version: number): boolean {
  return Object.prototype.hasOwnProperty.call(SERIALISEURS_SEANCE, version);
}

/** Rôles signataires. Reprend l'enum DB `coaching_signataire_role`. */
export type RoleSignataireAfest = "beneficiaire" | "formateur" | "tuteur";

/** Modalités de recueil. Reprend l'enum DB `coaching_signature_methode`. */
export type MethodeSignatureAfest = "trace" | "papier_scanne" | "confirmation_accessible";

/**
 * Données figées au moment de la signature d'une séance.
 *
 * Tous les champs sont OBLIGATOIRES, `null` compris : un champ absent et un
 * champ nul doivent produire des empreintes différentes, et la
 * canonicalisation refuse `undefined` pour cette raison.
 */
export interface TupleSeanceSignatureV1 {
  /**
   * Discriminant de contexte. Distinct de `'afest_1to1'` du chemin collectif :
   * deux tuples de forme différente ne doivent jamais pouvoir se confondre, même
   * par accident de copie.
   */
  contexteType: "afest_seance";
  /**
   * Portée de la chaîne, avec `role`.
   *
   * 🔴 HACHÉ, et ce n'est pas facultatif. Sans lui, un simple
   * `UPDATE coaching_seance_signatures SET coaching_id = <autre>` réattribuerait
   * la chaîne complète d'un parcours assidu à un parcours vide : aucun
   * `selfHash` ne bouge, et `verifierChaine` déclarerait les deux valides. La
   * FK composite l'interdit côté base ; le hachage le constate côté preuve.
   */
  coachingId: string;
  /** Séance signée. HACHÉE : c'est ce que la signature atteste. */
  compteRenduSeanceId: string;
  /** Rôle du signataire. HACHÉ : sinon un `UPDATE role` déplacerait une preuve. */
  role: RoleSignataireAfest;
  /** Jour civil `YYYY-MM-DD` (heure de Paris). */
  seanceDate: string;
  /** Horaires RÉELS `HH:MM` — exigence jurisprudentielle, pas un ornement. */
  heureDebut: string;
  heureFin: string;
  /** Intitulé et modules du parcours, figés : le catalogue peut changer après. */
  formationIntitule: string;
  modules: string[];
  /** Nom du formateur AFEST, figé (CAA Nantes 19NT01974). */
  formateurNom: string;
  /** Identité du signataire, figée : un UUID n'identifie personne devant un juge. */
  signataireNom: string;
  signataireEmail: string | null;
  /**
   * Modalité de recueil. HACHÉE : sans elle, un `UPDATE methode = 'trace'`
   * transformerait après coup une confirmation accessible en tracé manuscrit —
   * une falsification de la NATURE de la preuve, indétectable.
   */
  methode: MethodeSignatureAfest;
  /**
   * Version du texte affiché au signataire. HACHÉE.
   *
   * Point juridique central pour le TUTEUR : tiers non contractant, il doit
   * pouvoir opposer le texte exact qu'il a accepté. Sans cette version dans le
   * tuple, réécrire la mention aurait suffi à changer ce qu'il est réputé avoir
   * signé.
   */
  mentionVersion: string;
  /** SHA-256 de l'IMAGE. `null` pour `confirmation_accessible`, qui n'en a pas. */
  signatureSha256: string | null;
  /** Horodatage à la milliseconde, ISO-8601 UTC. */
  signeAtIso: string;
  /** `selfHash` de la signature précédente du MÊME rôle sur le MÊME parcours. */
  prevHash: string | null;
}

function versCanonicalSeanceV1(t: TupleSeanceSignatureV1): CanonicalValue {
  // L'ordre littéral n'a aucune importance : `canonicalJson` trie les clés.
  return {
    v: 1,
    contexteType: t.contexteType,
    coachingId: t.coachingId,
    compteRenduSeanceId: t.compteRenduSeanceId,
    role: t.role,
    seanceDate: t.seanceDate,
    heureDebut: t.heureDebut,
    heureFin: t.heureFin,
    formationIntitule: t.formationIntitule,
    modules: t.modules,
    formateurNom: t.formateurNom,
    signataireNom: t.signataireNom,
    signataireEmail: t.signataireEmail,
    methode: t.methode,
    mentionVersion: t.mentionVersion,
    signatureSha256: t.signatureSha256,
    signeAt: t.signeAtIso,
    prevHash: t.prevHash,
  };
}

/** Représentation canonique exacte qui sera hachée. Exposée pour l'audit et les tests. */
export function tupleSeanceCanonique(
  t: TupleSeanceSignatureV1,
  version = HASH_VERSION_SEANCE,
): string {
  const serialiseur = SERIALISEURS_SEANCE[version];
  if (serialiseur === undefined) {
    throw new Error(`[seance-signature-hash] Version de tuple inconnue : ${version}`);
  }
  return canonicalJson(serialiseur(t));
}

/** Empreinte SHA-256 hex (64 caractères) du tuple. */
export function calculerSelfHashSeance(
  t: TupleSeanceSignatureV1,
  version = HASH_VERSION_SEANCE,
): string {
  return createHash("sha256").update(tupleSeanceCanonique(t, version), "utf8").digest("hex");
}

/**
 * Miroir des colonnes scalaires de `coaching_seance_signatures`.
 *
 * Volontairement structurel, et écrit à la main. Le VERROU qui rend ce miroir
 * contraignant vit dans `seance-reconstruction.ts` (`verrouColonnesSeance`) :
 * ce module-ci reste pur, et c'est là-bas que la confrontation au type Prisma a
 * lieu. Sans ce verrou, retirer une colonne du schéma laisserait passer `tsc`,
 * et l'on découvrirait à l'audit que la chaîne n'est plus vérifiable.
 */
export interface LigneSeanceSignature {
  id: string;
  coachingId: string;
  compteRenduSeanceId: string;
  role: RoleSignataireAfest;
  /**
   * Colonne `@db.Date` : Prisma la rend TOUJOURS à minuit UTC.
   *
   * ⚠️ L'écriture doit respecter le même invariant
   * (`new Date(jourParis + "T00:00:00.000Z")`). Poser un `new Date()` brut
   * laisserait PostgreSQL décider du jour au cast timestamp→date selon le fuseau
   * de la session : une séance du 10 juin à 23 h 30 heure de Paris serait hachée
   * « 2026-06-10 » avant insertion et relue « 2026-06-11 ». Empreinte
   * définitivement fausse, sur une table append-only.
   */
  seanceDate: Date;
  heureDebut: string;
  heureFin: string;
  formationIntitule: string;
  /** `Json` en base : le type n'est PAS garanti côté application. */
  modulesSnapshot: unknown;
  formateurNom: string;
  signataireNom: string;
  signataireEmail: string | null;
  methode: MethodeSignatureAfest;
  mentionVersion: string;
  signatureSha256: string | null;
  signeAt: Date;
  prevHash: string | null;
  selfHash: string;
  hashVersion: number;
}

/**
 * Reconstruit le tuple, ou `null` s'il n'est pas recalculable.
 *
 * `null` n'est pas un échec silencieux : `verifierChaine` le transforme en
 * anomalie `tuple_irrecalculable`, visible dans le rapport. C'est la bonne
 * façon de traiter une ligne dont on ne peut plus rien dire — l'inverse d'une
 * vérification qui passerait en fermant les yeux.
 *
 * ⚠️ Refuse une `seanceDate` qui n'est pas à minuit UTC : une colonne `@db.Date`
 * est rendue ainsi par Prisma, et une date décalée signale que l'invariant
 * d'écriture a été rompu quelque part. Recalculer une empreinte dessus ne
 * produirait aucune information fiable.
 */
export function tupleSeanceDepuisLigne(ligne: LigneSeanceSignature): TupleSeanceSignatureV1 | null {
  if (!versionSeanceRecalculable(ligne.hashVersion)) return null;
  if (
    ligne.seanceDate.getUTCHours() !== 0 ||
    ligne.seanceDate.getUTCMinutes() !== 0 ||
    ligne.seanceDate.getUTCSeconds() !== 0 ||
    ligne.seanceDate.getUTCMilliseconds() !== 0
  ) {
    return null;
  }
  if (!Array.isArray(ligne.modulesSnapshot)) return null;
  const modules = ligne.modulesSnapshot as unknown[];
  if (!modules.every((m): m is string => typeof m === "string")) return null;

  return {
    contexteType: "afest_seance",
    coachingId: ligne.coachingId,
    compteRenduSeanceId: ligne.compteRenduSeanceId,
    role: ligne.role,
    // Prisma rend une colonne DATE à MINUIT UTC : l'extraction se fait donc en
    // UTC, jamais en heure locale. Un formatage local décalerait la date d'un
    // jour pour tout serveur à l'ouest de Greenwich — et un jour de décalage
    // dans un tuple haché est une empreinte définitivement fausse.
    seanceDate: ligne.seanceDate.toISOString().slice(0, 10),
    heureDebut: ligne.heureDebut,
    heureFin: ligne.heureFin,
    formationIntitule: ligne.formationIntitule,
    modules,
    formateurNom: ligne.formateurNom,
    signataireNom: ligne.signataireNom,
    signataireEmail: ligne.signataireEmail,
    methode: ligne.methode,
    mentionVersion: ligne.mentionVersion,
    signatureSha256: ligne.signatureSha256,
    signeAtIso: ligne.signeAt.toISOString(),
    prevHash: ligne.prevHash,
  };
}

/**
 * Maillon prêt pour `verifierChaine`, avec sa fonction de recalcul.
 *
 * La vérification elle-même est celle du chemin collectif, réutilisée TELLE
 * QUELLE : dupliquer une vérification d'intégrité est précisément l'endroit où
 * une divergence se cacherait — et personne ne la verrait avant un contrôle.
 * Seul le prédicat de version est propre à ce contexte.
 */
export function maillonSeanceDepuisLigne(ligne: LigneSeanceSignature): MaillonChaine {
  return {
    id: ligne.id,
    prevHash: ligne.prevHash,
    selfHash: ligne.selfHash,
    hashVersion: ligne.hashVersion,
    versionRecalculable: versionSeanceRecalculable,
    recalculer: () => {
      const tuple = tupleSeanceDepuisLigne(ligne);
      // On recalcule avec la version DE LA LIGNE, pas la courante : c'est tout
      // l'objet du registre de sérialiseurs.
      return tuple === null ? null : calculerSelfHashSeance(tuple, ligne.hashVersion);
    },
  };
}
