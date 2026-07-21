/**
 * Qualiopi T13 — Tuple canonique, empreinte et chaînage des signatures.
 *
 * Ce que le hash doit permettre de démontrer devant un contrôle :
 *   1. que CETTE personne a signé CE créneau, à CETTE heure ;
 *   2. que l'image de signature n'a pas été remplacée depuis ;
 *   3. qu'aucune ligne n'a été insérée ni supprimée après coup.
 *
 * (1) impose de figer l'identité et les horaires DANS le tuple — un UUID
 * n'identifie personne devant un juge, et un créneau peut être modifié après.
 * (2) impose de hacher l'IMAGE (`signatureSha256`) et non sa clé de stockage :
 * un objet R2 est remplaçable sans que la base bouge.
 * (3) est le rôle du chaînage : `prevHash` scelle le `selfHash` de la signature
 * précédente du MÊME stagiaire (décision D12 — par inscription, pas par session,
 * pour ne pas sérialiser 15 signatures simultanées derrière un verrou).
 *
 * `hashVersion` est stocké en base avec chaque ligne : sans lui, une évolution
 * du tuple rendrait toute la chaîne antérieure invérifiable, rétroactivement et
 * en silence.
 *
 * Logique pure — aucun import Prisma, aucun accès DB, aucune horloge.
 */

import { createHash } from "node:crypto";
import { canonicalJson, type CanonicalValue } from "./canonical";

/** Version courante du tuple canonique. À incrémenter à tout changement de forme. */
export const HASH_VERSION_COURANTE = 1;

/**
 * Données figées au moment de la signature.
 *
 * Tous les champs sont OBLIGATOIRES, `null` compris : un champ absent et un
 * champ nul doivent produire des hash différents, et la canonicalisation refuse
 * `undefined` pour cette raison.
 */
export interface TupleSignatureV1 {
  contexteType: "collectif" | "afest_1to1";
  /**
   * Inscription à laquelle appartient la chaîne (D12).
   *
   * 🔴 HACHÉ, et ce n'est pas facultatif. Sans lui, un simple
   * `UPDATE emargement_signatures SET enrollment_id = <autre>` réattribue la
   * chaîne complète d'un stagiaire assidu à un absent : aucun `selfHash` ne
   * bouge, et `verifierChaine` déclare les deux chaînes valides. Le tuple
   * contient bien `signataireNom`, mais rien ne le confronte à l'inscription.
   */
  enrollmentId: string | null;
  /** Créneau signé (collectif) ou séance de coaching (AFEST). Un seul est non nul. */
  creneauId: string | null;
  coachingId: string | null;
  /** Jour civil `YYYY-MM-DD` (heure de Paris). */
  date: string;
  demiJournee: "matin" | "apres_midi" | "journee";
  /** Horaires RÉELS `HH:MM` — exigence jurisprudentielle, pas un ornement. */
  heureDebut: string;
  heureFin: string;
  /** Intitulé et modules de la formation, figés : le programme peut changer après. */
  formationIntitule: string;
  modules: string[];
  formateurNom: string;
  /** Identité du signataire, figée : le stagiaire peut être anonymisé plus tard. */
  signataireNom: string;
  signataireEmail: string | null;
  methode: "canvas" | "confirmation_accessible" | "papier_scanne";
  /** SHA-256 de l'IMAGE. `null` pour `confirmation_accessible`, qui n'en a pas. */
  signatureSha256: string | null;
  /** Horodatage à la milliseconde, ISO-8601 UTC. */
  signeAtIso: string;
  /** Hashés : ne jamais figer une donnée personnelle en clair dans un hash immuable. */
  ipHash: string | null;
  userAgentSha256: string | null;
  /** Version du texte affiché au signataire — prouver ce qui a été signé. */
  mentionVersion: string;
  /** `selfHash` de la signature précédente du même inscrit. `null` = première. */
  prevHash: string | null;
}

/** Convertit le tuple en objet canonicalisable, en fixant l'ordre des champs. */
function versCanonical(t: TupleSignatureV1): CanonicalValue {
  // L'ordre littéral ci-dessous n'a aucune importance — `canonicalJson` trie les
  // clés. Il est écrit dans l'ordre de lecture humaine, pas machine.
  return {
    v: HASH_VERSION_COURANTE,
    contexteType: t.contexteType,
    enrollmentId: t.enrollmentId,
    creneauId: t.creneauId,
    coachingId: t.coachingId,
    date: t.date,
    demiJournee: t.demiJournee,
    heureDebut: t.heureDebut,
    heureFin: t.heureFin,
    formationIntitule: t.formationIntitule,
    modules: t.modules,
    formateurNom: t.formateurNom,
    signataireNom: t.signataireNom,
    signataireEmail: t.signataireEmail,
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
export function tupleCanonique(t: TupleSignatureV1): string {
  return canonicalJson(versCanonical(t));
}

/** Empreinte SHA-256 hex (64 caractères) du tuple. */
export function calculerSelfHash(t: TupleSignatureV1): string {
  return createHash("sha256").update(tupleCanonique(t), "utf8").digest("hex");
}

/**
 * Un maillon tel que relu depuis la base, dans l'ordre d'INSERTION.
 *
 * ⚠️ L'ordre est celui de `createdAt`, jamais de `signeAt` : ce dernier est figé
 * avant l'écriture de l'image sur R2, et deux signatures peuvent donc commiter
 * dans l'ordre inverse de leurs `signeAt`. Trier dessus produirait un verdict
 * « chaîne corrompue » faux et définitif.
 *
 * `recalculer` est une FONCTION plutôt qu'un tuple : c'est ce qui rend cette
 * vérification utilisable par les deux chaînes du domaine — celle des
 * stagiaires et celle des contresignatures formateur — sans dupliquer la
 * logique. Dupliquer une vérification d'intégrité est précisément l'endroit où
 * une divergence se cacherait.
 *
 * Retourne `null` quand le tuple n'est pas reconstructible.
 */
export interface MaillonChaine {
  id: string;
  prevHash: string | null;
  selfHash: string;
  hashVersion: number;
  recalculer: () => string | null;
  /** Version attendue par le code qui sait recalculer ce type de maillon. */
  versionAttendue?: number;
}

export type AnomalieChaine =
  | { type: "premier_maillon_chaine"; id: string; detail: string }
  | { type: "rupture_chainage"; id: string; detail: string }
  | { type: "empreinte_invalide"; id: string; detail: string }
  | { type: "version_inconnue"; id: string; detail: string }
  | { type: "tuple_irrecalculable"; id: string; detail: string }
  | { type: "maillon_illisible"; id: string; detail: string };

export interface ResultatVerification {
  valide: boolean;
  anomalies: AnomalieChaine[];
  nbVerifies: number;
}

/**
 * Vérifie une chaîne de signatures d'une même inscription, dans l'ordre.
 *
 * Détecte : une empreinte qui ne correspond plus à son contenu (donnée modifiée
 * a posteriori), un maillon dont le `prevHash` ne pointe pas sur le précédent
 * (insertion ou suppression), et une version de tuple qu'on ne sait plus
 * recalculer.
 *
 * ⚠️ Ne LÈVE jamais : une chaîne corrompue est un RÉSULTAT à présenter, pas une
 * panne. La faire échouer bruyamment empêcherait précisément d'afficher
 * l'anomalie à qui doit la constater.
 */
export function verifierChaine(maillons: MaillonChaine[]): ResultatVerification {
  const anomalies: AnomalieChaine[] = [];
  let precedent: MaillonChaine | null = null;

  // ⚠️ L'invariant « ne lève jamais » était documenté sans être implémenté :
  // un tableau non itérable, un maillon nul, un `selfHash` absent ou un tuple
  // partiel faisaient remonter une `TypeError` ou une `CanonicalisationError`
  // hors de la fonction — exactement devant la personne qui doit constater
  // l'anomalie. Il est désormais tenu, maillon par maillon.
  if (!Array.isArray(maillons)) {
    return {
      valide: false,
      anomalies: [{ type: "maillon_illisible", id: "?", detail: "chaîne absente ou non itérable" }],
      nbVerifies: 0,
    };
  }

  for (const m of maillons) {
    if (m === null || typeof m !== "object") {
      anomalies.push({
        type: "maillon_illisible",
        id: "?",
        detail: "entrée de chaîne nulle ou non exploitable",
      });
      continue;
    }
    try {
      if (precedent === null) {
        if (m.prevHash !== null) {
          anomalies.push({
            type: "premier_maillon_chaine",
            id: m.id,
            detail:
              "le premier maillon référence une signature antérieure — une ligne a été supprimée en tête de chaîne",
          });
        }
      } else if (typeof precedent.selfHash !== "string") {
        anomalies.push({
          type: "maillon_illisible",
          id: m.id,
          detail: "le maillon précédent n'a pas d'empreinte exploitable",
        });
      } else if (m.prevHash !== precedent.selfHash) {
        anomalies.push({
          type: "rupture_chainage",
          id: m.id,
          detail: `prevHash attendu ${precedent.selfHash.slice(0, 12)}…, trouvé ${
            m.prevHash === null ? "null" : `${m.prevHash.slice(0, 12)}…`
          }`,
        });
      }

      const attendue = m.versionAttendue ?? HASH_VERSION_COURANTE;
      if (m.hashVersion !== attendue) {
        anomalies.push({
          type: "version_inconnue",
          id: m.id,
          detail: `tuple en version ${m.hashVersion}, ce code ne sait recalculer que la version ${attendue}`,
        });
      } else {
        const attendu = m.recalculer();
        if (attendu === null) {
          anomalies.push({
            type: "tuple_irrecalculable",
            id: m.id,
            detail: "données insuffisantes en base pour reconstruire le tuple signé",
          });
        } else if (attendu !== m.selfHash) {
          anomalies.push({
            type: "empreinte_invalide",
            id: m.id,
            detail:
              "le contenu ne correspond plus à son empreinte — donnée modifiée après signature",
          });
        }
      }
    } catch (err) {
      anomalies.push({
        type: "maillon_illisible",
        id: typeof m.id === "string" ? m.id : "?",
        detail: `maillon inexploitable : ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    precedent = m;
  }

  return { valide: anomalies.length === 0, anomalies, nbVerifies: maillons.length };
}
