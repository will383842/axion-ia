/**
 * AFEST 1-to-1 — Registre des signatures de séance, côté ORGANISME.
 *
 * ## Le trou que ce module ferme
 *
 * Les lignes `CoachingSeanceSignature` étaient ÉCRITES par `signerSeanceAfest`,
 * RÉVOCABLES par `revoquerSignatureSeance`… et LUES par personne. La seule
 * surface qui les consultait est l'espace formateur (`lireEtatSignaturesAfest`),
 * dont le propos est de faire signer — pas de contrôler. Résultat : un parcours
 * en régime `signature_reelle` portait en base des preuves que la console ne
 * savait ni montrer, ni vérifier, ni corriger.
 *
 * Trois conséquences concrètes, toutes constatables à un audit :
 *
 * 1. Une signature posée par erreur était DÉFINITIVE — `revoquerSignatureSeance`
 *    n'avait aucun appelant, donc l'index unique partiel `WHERE revoked_at IS
 *    NULL`, celui qui autorise précisément à re-signer, ne pouvait jamais servir.
 * 2. Une chaîne rompue restait invisible : `verifierChaine` n'était jamais
 *    appliqué aux maillons AFEST, alors que le module de recalcul
 *    (`maillonSeanceDepuisLigne`) existait et était testé.
 * 3. La console affichait la présence DÉCLARÉE (`presenceSigneeAt`) sans jamais
 *    montrer les signatures RÉELLES — soit exactement l'écart que le registre
 *    des documents expose côte à côte, et qu'il serait incohérent de masquer ici.
 *
 * ## Ce que ce module refuse de faire
 *
 * 🔴 Il ne RÉPARE rien et ne LÈVE jamais. Une chaîne corrompue est un RÉSULTAT à
 * présenter, pas une panne : la doctrine de `verifierChaine` est reprise telle
 * quelle, parce qu'échouer bruyamment empêcherait précisément d'afficher
 * l'anomalie à la personne qui doit la constater.
 *
 * 🔴 Il ne recalcule AUCUN nom, AUCUNE date. Tout ce qui est rendu vient de la
 * ligne de signature elle-même, figée à l'instant de la signature. Relire ces
 * valeurs depuis le parcours donnerait un écran qui suit les corrections
 * ultérieures — c'est-à-dire un écran qui ment sur ce qui a été signé.
 *
 * ## Portée de la chaîne
 *
 * Une chaîne AFEST est portée par le couple **(parcours × rôle)**, et non par la
 * séance : c'est ce que fait la garde de `revoquerSignatureSeance`, qui cherche
 * un successeur sur `{ coachingId, role, prevHash }`. Vérifier par séance
 * découperait chaque chaîne en tronçons d'un maillon et rendrait
 * `premier_maillon_chaine` sur toutes — un faux négatif rassurant.
 */

import { prisma } from "@/lib/prisma";
import { verifierChaine, type ResultatVerification } from "@/server/qualiopi/emargement/hash";
import {
  maillonSeanceDepuisLigne,
  type MethodeSignatureAfest,
  type RoleSignataireAfest,
} from "./seance-signature-hash";
import { verrouColonnesSeance } from "./seance-reconstruction";
import { LIBELLES_METHODE, LIBELLES_ROLE } from "./libelles-afest";

/** Ordre d'affichage : celui du déroulé réel d'un émargement AFEST. */
const ORDRE_ROLES: readonly RoleSignataireAfest[] = ["beneficiaire", "formateur", "tuteur"];

/**
 * Seuil au-delà duquel l'écart `signeAt` ↔ `createdAt` devient une information.
 *
 * En deçà, c'est le temps d'écriture de l'image sur R2. Au-delà, c'est une
 * signature insérée après coup — la SEULE trace qu'en garde le registre. Même
 * seuil que le registre des documents : deux seuils différents pour la même
 * question produiraient deux verdicts sur une pièce identique.
 */
const SEUIL_INSERTION_TARDIVE_MS = 60_000;

/** Une ligne de signature, telle qu'elle a été scellée. */
export interface LigneRegistreSeance {
  signatureId: string;
  compteRenduSeanceId: string;
  role: RoleSignataireAfest;
  roleLibelle: string;
  /** Nom FIGÉ dans la ligne. Jamais relu depuis le parcours. */
  signataireNom: string;
  signeAt: Date;
  createdAt: Date;
  methodeLibelle: string;
  /** Empreinte de la ligne — c'est elle qui la rend opposable. */
  empreinte: string;
  /**
   * Recueillie sur le poste du formateur : plafond probant à DIRE.
   *
   * Une signature recueillie par l'organisme sur son propre matériel ne vaut pas
   * une signature apposée par la partie depuis son appareil. Taire la
   * différence reviendrait à présenter les deux comme équivalentes.
   */
  recueilliSurPosteFormateur: boolean;
  /** Image purgée (RGPD art. 17) : la preuve reste, le tracé a disparu. */
  imagePurgee: boolean;
  revocation: { at: Date; motif: string | null } | null;
  /**
   * Dernier maillon non révoqué de sa chaîne (parcours × rôle).
   *
   * Dit AVANT le clic ce que le service refuserait APRÈS : révoquer un maillon
   * interne romprait le chaînage et ferait apparaître le registre comme
   * falsifié. Même doctrine que les motifs de non-signabilité de l'espace
   * formateur — l'écran empêche, le service tranche.
   */
  dernierMaillon: boolean;
  /** Écart notable entre la date déclarée et l'écriture en base. */
  insertionTardive: boolean;
}

/** Verdict d'intégrité d'une chaîne (parcours × rôle). */
export interface ChaineRoleAfest {
  role: RoleSignataireAfest;
  roleLibelle: string;
  resultat: ResultatVerification;
}

export interface RegistreSeancesAfest {
  coachingSessionId: string;
  /** Toutes les lignes, révoquées comprises, dans l'ordre rôle puis écriture. */
  lignes: LigneRegistreSeance[];
  /** Une entrée par rôle EFFECTIVEMENT signé. Vide si aucune signature. */
  chaines: ChaineRoleAfest[];
}

/**
 * Lit le registre des signatures d'un parcours AFEST.
 *
 * Rend `null` quand la base n'est pas joignable (build stub) — à distinguer
 * d'un registre VIDE, qui est un résultat légitime : un parcours en régime
 * déclaratif n'a aucune signature, et ce n'est pas une anomalie.
 *
 * ⚠️ Ne lève jamais.
 */
export async function listerRegistreSeancesAfest(
  coachingSessionId: string,
): Promise<RegistreSeancesAfest | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid") === true) return null;

  const brutes = await prisma.coachingSeanceSignature.findMany({
    where: { coachingId: coachingSessionId },
    // 🔴 `createdAt`, JAMAIS `signeAt`. Le chaînage suit l'ordre d'ÉCRITURE ;
    // `signeAt` est une date DÉCLARÉE, qu'une signature antidatée rendrait
    // incohérente avec les `prevHash` — et la chaîne apparaîtrait rompue sur des
    // lignes intactes.
    orderBy: [{ createdAt: "asc" }],
  });
  if (brutes.length === 0) {
    return { coachingSessionId, lignes: [], chaines: [] };
  }

  // Les maillons vivants, par rôle : la révocation les retire de la chaîne, et
  // la relecture du service filtre pareil (`WHERE revoked_at IS NULL`).
  const vivantsParRole = new Map<RoleSignataireAfest, typeof brutes>();
  for (const b of brutes) {
    if (b.revokedAt !== null) continue;
    const role = b.role as RoleSignataireAfest;
    const deja = vivantsParRole.get(role);
    if (deja === undefined) vivantsParRole.set(role, [b]);
    else deja.push(b);
  }

  // Un maillon est terminal si aucun maillon VIVANT du même rôle ne le désigne.
  const empreintesChainees = new Set<string>();
  for (const vivants of vivantsParRole.values()) {
    for (const v of vivants) {
      if (v.prevHash !== null) empreintesChainees.add(v.prevHash);
    }
  }

  const lignes: LigneRegistreSeance[] = brutes.map((b) => {
    const role = b.role as RoleSignataireAfest;
    const ecartMs = b.createdAt.getTime() - b.signeAt.getTime();
    return {
      signatureId: b.id,
      compteRenduSeanceId: b.compteRenduSeanceId,
      role,
      roleLibelle: LIBELLES_ROLE[role],
      signataireNom: b.signataireNom,
      signeAt: b.signeAt,
      createdAt: b.createdAt,
      methodeLibelle: LIBELLES_METHODE[b.methode as MethodeSignatureAfest],
      empreinte: b.selfHash,
      recueilliSurPosteFormateur: b.recueilliParTrainerId !== null,
      imagePurgee: b.imagePurgeeAt !== null,
      revocation: b.revokedAt === null ? null : { at: b.revokedAt, motif: b.revokedMotif },
      dernierMaillon: b.revokedAt === null && !empreintesChainees.has(b.selfHash),
      insertionTardive: Math.abs(ecartMs) > SEUIL_INSERTION_TARDIVE_MS,
    };
  });

  const chaines: ChaineRoleAfest[] = [];
  for (const role of ORDRE_ROLES) {
    const vivants = vivantsParRole.get(role);
    if (vivants === undefined || vivants.length === 0) continue;
    chaines.push({
      role,
      roleLibelle: LIBELLES_ROLE[role],
      // Le verrou de colonnes est TRAVERSÉ ici : sans lui, un renommage de
      // colonne dans le schéma passerait `tsc` et l'on découvrirait à l'audit
      // que la chaîne n'est plus recalculable.
      resultat: verifierChaine(
        vivants.map((v) => maillonSeanceDepuisLigne(verrouColonnesSeance(v))),
      ),
    });
  }

  return { coachingSessionId, lignes, chaines };
}
