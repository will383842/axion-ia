/**
 * Signature au grain document — verrou de schéma et liste des colonnes scellées.
 *
 * Ce module existe pour une seule raison : rendre CONTRAIGNANT le miroir écrit à
 * la main dans `document-signature-hash.ts`. Celui-ci reste pur (aucun import
 * Prisma) pour rester testable et réutilisable ; la confrontation au type
 * généré a donc lieu ici.
 *
 * Miroir de `coaching-afest/signature/seance-reconstruction.ts`, qui fait
 * autorité pour la forme.
 */

import type { DocumentSignature as PrismaDocumentSignature } from "../../../../../prisma/generated/client";
import type { LigneDocumentSignature } from "./document-signature-hash";

/**
 * Verrou de type — c'est LUI qui rend le miroir contraignant.
 *
 * `LigneDocumentSignature` est écrit à la main : sans ce verrou, retirer ou
 * renommer une colonne scellée dans `schema.prisma` laisserait passer `tsc`,
 * laisserait passer les tests de ce module, et l'on redécouvrirait à l'audit que
 * la chaîne n'est plus vérifiable. L'affectation ci-dessous ne compile que si
 * CHAQUE champ de `LigneDocumentSignature` existe, avec un type compatible, sur
 * la ligne Prisma.
 *
 * `prisma generate` tourne avant `tsc` en CI (Gate A) : l'incohérence est donc
 * détectée à la compilation, pas en production.
 *
 * ⚠️ Un verrou n'a de valeur que s'il est TRAVERSÉ. Tout code qui convertit une
 * ligne Prisma en `LigneDocumentSignature` doit passer par ici — un
 * `as unknown as LigneDocumentSignature` le contourne et rend cette garantie
 * décorative.
 */
export type VerrouColonnesDocument = (ligne: PrismaDocumentSignature) => LigneDocumentSignature;
export const verrouColonnesDocument: VerrouColonnesDocument = (ligne) => ligne;

/**
 * Colonnes qui entrent dans le tuple haché — donc INTOUCHABLES après coup.
 *
 * ## Pourquoi `ipHash` n'y est PAS
 *
 * Côté collectif, l'effacement RGPD mettait `signataireEmail`, `ipHash` et
 * `userAgentSha256` à `null`. Les trois étaient dans le tuple. Résultat : après
 * toute demande d'article 17, `verifierChaine` rendait `empreinte_invalide` sur
 * CHAQUE signature — c'est-à-dire, dans un dossier présenté à un contrôle, le
 * verdict « ces pièces ont été modifiées après coup », sur des pièces intactes.
 *
 * On ne reproduit pas le bug : `ipHash` et `userAgentSha256` sont HORS du tuple
 * document. Ils restent des colonnes de preuve utiles, mais effaçables sans
 * conséquence sur une seule empreinte.
 *
 * `signataireEmail` reste scellé — il identifie le signataire, c'est le cœur de
 * l'art. 1366. Il est donc acté NON EFFAÇABLE, et la mitigation offerte au
 * signataire est la purge de l'IMAGE seule (`imagePurgeeAt`).
 *
 * Toute écriture ultérieure sur l'une de ces colonnes est une falsification, y
 * compris quand elle est bien intentionnée.
 */
export const COLONNES_SCELLEES_DOCUMENT: ReadonlyArray<keyof LigneDocumentSignature> = [
  "documentGenereId",
  "provider",
  "providerSubmissionId",
  "partie",
  "signataireNom",
  "signataireEmail",
  "signataireQualite",
  "documentHashSha256",
  "methode",
  "signatureSha256",
  "mentionVersion",
  "consentementVersion",
  "signeAt",
  "prevHash",
];

/**
 * Colonnes explicitement NON probantes : de l'affichage, ou de la donnée
 * effaçable. Les énumérer évite le faux « figé » — une colonne qu'on croit
 * scellée et qui ne l'est pas est pire qu'une colonne qu'on sait mutable.
 */
export const COLONNES_NON_SCELLEES_DOCUMENT = [
  "ipHash",
  "userAgentSha256",
  "signatureKey",
  "mimeType",
  "sizeBytes",
  "imagePurgeeAt",
  // Provenance, pas contenu de l'engagement : qui a versé la preuve au dossier,
  // et qui l'a retirée. Les sceller interdirait de corriger une imputation
  // erronée sans invalider l'empreinte — pour un gain de preuve nul.
  "recueilliParAdminId",
  "revokedById",
] as const;

/**
 * 🔴 Colonnes scellées qui ne vivent PAS sur la ligne de signature.
 *
 * `documentNumero` et `documentType` sont hachés mais portés par
 * `DocumentGenere`. Conséquence directe et voulue : **renuméroter ou changer le
 * type d'une pièce déjà signée rend son empreinte invalide**, et c'est le bon
 * verdict — c'est une altération de ce qui a été signé.
 *
 * ⚠️ Ne jamais « réparer » cette anomalie en cherchant l'ancien numéro : il
 * n'est stocké nulle part, précisément pour que la pièce et sa preuve ne
 * puissent pas diverger en silence.
 */
export const COLONNES_SCELLEES_PORTEES_PAR_LA_PIECE = ["numero", "type"] as const;
