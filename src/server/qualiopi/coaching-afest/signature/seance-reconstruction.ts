/**
 * AFEST 1-to-1 — Verrou de colonnes et jour civil des signatures de séance.
 *
 * ## Pourquoi un fichier NEUF plutôt qu'une réutilisation de `reconstruction.ts`
 *
 * `emargement/reconstruction.ts` n'est PAS générique : `maillonDepuisLigne` et
 * `tupleDepuisLigne` y sont liés à `LigneSignature` et aux types Prisma du
 * chemin collectif. Le rendre générique aurait signifié le modifier — c'est-à-dire
 * toucher au module dont dépend la vérifiabilité de toutes les empreintes déjà
 * émises en production. La contresignature a tranché ce même arbitrage de la
 * même façon : miroir neuf, cœur de vérification partagé.
 *
 * Ce qui est réutilisé SANS modification : `canonicalJson`, `verifierChaine` et
 * le type `MaillonChaine`.
 *
 * Logique pure côté calcul ; le seul import Prisma est un import de TYPE, pour
 * le verrou.
 */

import type { CoachingSeanceSignature as PrismaCoachingSeanceSignature } from "../../../../../prisma/generated/client";
import type { LigneSeanceSignature } from "./seance-signature-hash";

/**
 * Verrou de type — c'est LUI qui rend le miroir contraignant.
 *
 * `LigneSeanceSignature` est écrit à la main : sans ce verrou, retirer ou
 * renommer une colonne de snapshot dans `schema.prisma` laisserait passer `tsc`,
 * laisserait passer les tests de ce module, et l'on redécouvrirait à l'audit que
 * la chaîne n'est plus vérifiable. L'affectation ci-dessous ne compile que si
 * CHAQUE champ de `LigneSeanceSignature` existe, avec un type compatible, sur la
 * ligne Prisma.
 *
 * `prisma generate` tourne avant `tsc` en CI (Gate A) : l'incohérence est donc
 * détectée à la compilation, pas en production.
 *
 * ⚠️ Un verrou n'a de valeur que s'il est TRAVERSÉ. Tout code qui convertit une
 * ligne Prisma en `LigneSeanceSignature` doit passer par ici — un
 * `as unknown as LigneSeanceSignature` le contourne et rend cette garantie
 * décorative.
 */
export type VerrouColonnesSeance = (ligne: PrismaCoachingSeanceSignature) => LigneSeanceSignature;
export const verrouColonnesSeance: VerrouColonnesSeance = (ligne) => ligne;

/**
 * Colonnes qui entrent dans le tuple haché — donc INTOUCHABLES après coup.
 *
 * ## Pourquoi cette liste existe, et pourquoi `ipHash` n'y est PAS
 *
 * Côté collectif, l'effacement RGPD mettait `signataireEmail`, `ipHash` et
 * `userAgentSha256` à `null`. Les trois étaient dans le tuple. Résultat :
 * après toute demande d'article 17, `verifierChaine` rendait
 * `empreinte_invalide` sur CHAQUE signature — c'est-à-dire, dans un dossier
 * présenté à un contrôle, le verdict « ces feuilles ont été modifiées après
 * coup », sur des pièces intactes.
 *
 * On ne reproduit pas le bug : `ipHash` et `userAgentSha256` sont HORS du tuple
 * AFEST. Ils restent des colonnes de preuve utiles, mais effaçables sans
 * conséquence sur une seule empreinte.
 *
 * `signataireEmail` reste scellé — il identifie le signataire, c'est le cœur de
 * l'art. 1366. Il est donc acté NON EFFAÇABLE, et la mitigation offerte au
 * signataire est la purge de l'IMAGE seule (`imagePurgeeAt`).
 *
 * Toute écriture ultérieure sur l'une de ces colonnes est une falsification, y
 * compris quand elle est bien intentionnée.
 */
export const COLONNES_SCELLEES_SEANCE: ReadonlyArray<keyof LigneSeanceSignature> = [
  "coachingId",
  "compteRenduSeanceId",
  "role",
  "seanceDate",
  "heureDebut",
  "heureFin",
  "formationIntitule",
  "modulesSnapshot",
  "formateurNom",
  "signataireNom",
  "signataireEmail",
  "methode",
  "mentionVersion",
  "signatureSha256",
  "signeAt",
  "prevHash",
];

/**
 * Colonnes explicitement NON probantes : de l'affichage, ou de la donnée
 * effaçable. Les énumérer évite le faux « figé » — une colonne qu'on croit
 * scellée et qui ne l'est pas est pire qu'une colonne qu'on sait mutable.
 */
export const COLONNES_NON_SCELLEES_SEANCE = [
  "dureeMinutes",
  "ipHash",
  "userAgentSha256",
  "signatureKey",
  "mimeType",
  "sizeBytes",
  "tokenId",
  "recueilliParTrainerId",
] as const;

/**
 * Jour civil `YYYY-MM-DD` d'une colonne `@db.Date`, en refusant tout ce qui
 * n'est pas à minuit UTC.
 *
 * Retourne `null` plutôt que de lever : l'appelant en fait une anomalie
 * affichable, pas une panne devant la personne qui doit la constater.
 */
export function jourCivilSeance(d: Date): string | null {
  if (
    d.getUTCHours() !== 0 ||
    d.getUTCMinutes() !== 0 ||
    d.getUTCSeconds() !== 0 ||
    d.getUTCMilliseconds() !== 0
  ) {
    return null;
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Convertit un jour civil de PARIS en `Date` conforme à l'invariant `@db.Date`.
 *
 * 🔴 SEUL chemin d'écriture autorisé pour `seanceDate`. Poser un `new Date()`
 * brut, ou une date locale, produirait une valeur que `tupleSeanceDepuisLigne`
 * refusera de recalculer — c'est-à-dire une preuve morte à l'écriture.
 */
export function dateSeanceDepuisJourParis(jourIso: string): Date {
  return new Date(`${jourIso}T00:00:00.000Z`);
}
