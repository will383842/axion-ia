/**
 * Signature au grain DOCUMENT — tuple canonique, empreinte et chaînage.
 *
 * Famille de preuve sœur de l'émargement collectif (`emargement/hash.ts`).
 * (2026-08-10 : la troisième famille — séance AFEST 1-to-1 — a été supprimée
 * avec le module, décision Will.) Les familles partagent le MÊME cœur crypto —
 * `canonicalJson`, `verifierChaine`, `MaillonChaine` — réutilisé sans une ligne
 * de modification. Chacune a SON tuple, SA `hashVersion` et SA `mentionVersion`.
 *
 * **Le grain.** Une PIÈCE NUMÉROTÉE × une PARTIE. Le collectif signe un créneau ;
 * ici c'est un engagement sur un document — convention, contrat, relevé de
 * connexion — que N parties signent chacune une fois.
 *
 * **La portée de la chaîne.** Elle est le DOCUMENT, pas la partie. Les deux ou
 * trois signataires d'une même pièce s'enchaînent donc les uns derrière les
 * autres. Ce n'est
 * pas une incohérence : ici la chaîne doit détecter l'ajout APRÈS COUP d'une
 * partie sur une pièce déjà conclue — une signature de financeur glissée
 * tardivement dans un dossier. Une chaîne par partie ne le verrait pas. Les
 * chaînes sont courtes (2 à 3 maillons), la sérialisation est sans conséquence.
 *
 * **Ce qui n'est PAS haché, et pourquoi.**
 *
 * `ipHash` et `userAgentSha256` sont HORS du tuple. Le plan les listait parmi
 * les « champs à figer » ; le code a raison contre le plan, et il l'a déjà
 * démontré une fois. Côté collectif ces deux colonnes SONT scellées, si bien que
 * l'effacement RGPD qui les mettait à `null` faisait rendre `empreinte_invalide`
 * à `verifierChaine` sur chaque signature du stagiaire — soit, dans un dossier
 * de contrôle, « ces pièces ont été modifiées après coup », sur des pièces
 * intactes. L'AFEST a refusé de reproduire le bug ; ce module aussi. La
 * migration l'écrit noir sur blanc (« hors du tuple haché, donc effaçables sur
 * demande RGPD sans casser la preuve ») et c'est elle qui fait foi.
 *
 * `signatureKey` est hors tuple pour la même raison : la purge de l'image la met
 * à `null`. C'est `signatureSha256` qui est scellé, et lui SURVIT à la purge —
 * on garde donc la capacité de dire qu'une image a existé et laquelle, sans
 * empêcher de l'effacer.
 *
 * `mimeType` et `sizeBytes` sont hors tuple : redondants avec l'image dont
 * l'empreinte est déjà scellée, et sceller deux représentations d'une même chose
 * revient à figer une contradiction potentielle.
 *
 * Logique pure — aucun import Prisma, aucune horloge.
 */

import { createHash } from "node:crypto";
import { canonicalJson, type CanonicalValue } from "@/server/qualiopi/emargement/canonical";
import type { MaillonChaine } from "@/server/qualiopi/emargement/hash";

/** Version courante du tuple de signature au grain document. */
export const HASH_VERSION_DOCUMENT = 1;

/**
 * Versions encore recalculables — même doctrine que les deux autres familles :
 * quand la forme change, on INCRÉMENTE `HASH_VERSION_DOCUMENT`, on FIGE l'ancien
 * sérialiseur ici, et on n'y touche plus jamais. Une empreinte émise reste
 * vérifiable pour toujours, et le recalcul se fait avec la version DE LA LIGNE.
 */
const SERIALISEURS_DOCUMENT: Readonly<
  Record<number, (t: TupleDocumentSignatureV1) => CanonicalValue>
> = {
  1: versCanonicalDocumentV1,
};

/** Vrai si ce code sait recalculer une empreinte de document de cette version. */
export function versionDocumentRecalculable(version: number): boolean {
  return Object.prototype.hasOwnProperty.call(SERIALISEURS_DOCUMENT, version);
}

/** Partie signataire. Reprend l'enum DB `DocumentPartieSignataire`. */
export type PartieSignataire =
  | "client"
  | "financeur"
  | "formateur"
  | "beneficiaire"
  | "tuteur"
  | "sous_traitant"
  | "responsable_pedagogique"
  | "axionia";

/** Canal de recueil. Reprend l'enum DB `SignatureProvider`. */
export type ProviderSignature = "docuseal" | "manual_upload" | "physical_signed" | "interne";

/** Modalité de recueil. Reprend l'enum DB `DocumentSignatureMethode`. */
export type MethodeSignatureDocument = "trace" | "papier_scanne" | "confirmation_accessible";

/**
 * Données figées au moment de la signature d'une pièce.
 *
 * Tous les champs sont OBLIGATOIRES, `null` compris : un champ absent et un
 * champ nul doivent produire des empreintes différentes, et la canonicalisation
 * refuse `undefined` pour cette raison.
 */
export interface TupleDocumentSignatureV1 {
  /**
   * Discriminant de contexte. Distinct de `'collectif'` et de `'afest_seance'` :
   * deux tuples de forme différente ne doivent jamais pouvoir se confondre, même
   * par accident de copie.
   */
  contexteType: "document_engagement";
  /**
   * Portée de la chaîne.
   *
   * 🔴 HACHÉ. Sans lui, un `UPDATE document_signatures SET document_genere_id =
   * <autre>` réattribuerait la chaîne complète d'une convention signée à une
   * pièce vierge : aucun `selfHash` ne bougerait, et `verifierChaine`
   * déclarerait les deux valides.
   */
  documentGenereId: string;
  /**
   * Numéro IMMUABLE de la pièce, et son type.
   *
   * 🔴 HACHÉS tous les deux, et ce n'est pas de la dénormalisation de confort :
   * c'est ce qui permet de dire, sans la base, SUR QUOI portait la signature. Un
   * identifiant technique n'a jamais désigné une pièce devant un juge.
   */
  documentNumero: string;
  documentType: string;
  /**
   * 🔴 Empreinte du PDF EXACT qui a été signé.
   *
   * C'est la colonne qui distingue « une signature existe » de « cette
   * signature-ci porte sur CETTE pièce-là ». `generateDocument` sait régénérer
   * un PDF : sans cette empreinte, la régénération produirait un document que
   * plus rien ne relie à l'acte de signature — et personne ne s'en apercevrait.
   */
  documentHashSha256: string;
  /** Partie signataire. HACHÉE : sinon un `UPDATE partie` déplacerait une preuve. */
  partie: PartieSignataire;
  /**
   * Canal, et identifiant de submission côté fournisseur.
   *
   * 🔴 HACHÉS. Sans eux, un `UPDATE provider = 'docuseal', provider_submission_id
   * = '<inventé>'` transformerait une signature maison en signature certifiée par
   * un tiers — c'est-à-dire fabriquerait l'apparence d'un certificat opposable
   * qui n'existe pas. La contrainte de base interdit l'incohérence de forme ; le
   * hachage constate la substitution.
   */
  provider: ProviderSignature;
  providerSubmissionId: string | null;
  /**
   * Identité FIGÉE du signataire. Un UUID n'identifie personne, et le contact
   * peut être renommé, réaffecté ou anonymisé après coup.
   */
  signataireNom: string;
  signataireEmail: string | null;
  /** Qualité (« Directrice des ressources humaines »). Opposabilité du pouvoir de signer. */
  signataireQualite: string | null;
  /**
   * Modalité de recueil. HACHÉE : sans elle, un `UPDATE methode = 'trace'`
   * transformerait après coup une confirmation accessible en tracé manuscrit —
   * une falsification de la NATURE de la preuve, indétectable.
   */
  methode: MethodeSignatureDocument;
  /** SHA-256 de l'IMAGE. `null` pour `confirmation_accessible`, qui n'en a pas. */
  signatureSha256: string | null;
  /**
   * Versions des textes affichés au signataire. HACHÉES.
   *
   * Deux versions distinctes, et ce n'est pas du zèle : le texte de la mention
   * peut évoluer sans que le contenu du consentement change, et l'inverse.
   * Prouver qu'une personne a signé suppose de pouvoir dire CE QU'ELLE A SIGNÉ.
   */
  mentionVersion: string;
  consentementVersion: string;
  /** Horodatage à la milliseconde, ISO-8601 UTC. */
  signeAtIso: string;
  /** `selfHash` de la signature précédente SUR LA MÊME PIÈCE. */
  prevHash: string | null;
}

function versCanonicalDocumentV1(t: TupleDocumentSignatureV1): CanonicalValue {
  // L'ordre littéral n'a aucune importance : `canonicalJson` trie les clés.
  return {
    v: 1,
    contexteType: t.contexteType,
    documentGenereId: t.documentGenereId,
    documentNumero: t.documentNumero,
    documentType: t.documentType,
    documentHashSha256: t.documentHashSha256,
    partie: t.partie,
    provider: t.provider,
    providerSubmissionId: t.providerSubmissionId,
    signataireNom: t.signataireNom,
    signataireEmail: t.signataireEmail,
    signataireQualite: t.signataireQualite,
    methode: t.methode,
    signatureSha256: t.signatureSha256,
    mentionVersion: t.mentionVersion,
    consentementVersion: t.consentementVersion,
    signeAt: t.signeAtIso,
    prevHash: t.prevHash,
  };
}

/** Représentation canonique exacte qui sera hachée. Exposée pour l'audit et les tests. */
export function tupleDocumentCanonique(
  t: TupleDocumentSignatureV1,
  version = HASH_VERSION_DOCUMENT,
): string {
  const serialiseur = SERIALISEURS_DOCUMENT[version];
  if (serialiseur === undefined) {
    throw new Error(`[document-signature-hash] Version de tuple inconnue : ${version}`);
  }
  return canonicalJson(serialiseur(t));
}

/** Empreinte SHA-256 hex (64 caractères) du tuple. */
export function calculerSelfHashDocument(
  t: TupleDocumentSignatureV1,
  version = HASH_VERSION_DOCUMENT,
): string {
  return createHash("sha256").update(tupleDocumentCanonique(t, version), "utf8").digest("hex");
}

/**
 * Miroir des colonnes scalaires de `document_signatures`.
 *
 * Volontairement structurel, et écrit à la main. Le VERROU qui rend ce miroir
 * contraignant vit dans `document-reconstruction.ts` : ce module-ci reste pur, et
 * c'est là-bas que la confrontation au type Prisma a lieu. Sans ce verrou,
 * retirer une colonne du schéma laisserait passer `tsc`, et l'on découvrirait à
 * l'audit que la chaîne n'est plus vérifiable.
 */
export interface LigneDocumentSignature {
  id: string;
  documentGenereId: string;
  provider: ProviderSignature;
  providerSubmissionId: string | null;
  partie: PartieSignataire;
  signataireNom: string;
  signataireEmail: string | null;
  signataireQualite: string | null;
  documentHashSha256: string;
  methode: MethodeSignatureDocument;
  signatureSha256: string | null;
  mentionVersion: string;
  consentementVersion: string;
  signeAt: Date;
  prevHash: string | null;
  selfHash: string;
  hashVersion: number;
}

/**
 * Ce que la ligne de signature ne porte PAS et qu'il faut lui joindre.
 *
 * Le numéro et le type vivent sur `DocumentGenere`, pas sur la signature. Ils
 * sont pourtant SCELLÉS : le tuple doit donc les recevoir de l'appelant, qui les
 * a lus sur la pièce.
 *
 * ⚠️ Et c'est exactement là qu'un vérificateur peut se tromper sans le voir : si
 * la pièce a été RENUMÉROTÉE depuis, le recalcul rendra `empreinte_invalide` —
 * et ce sera le VERDICT JUSTE. Une renumérotation après signature est une
 * altération de ce qui a été signé. Ne pas « réparer » cette anomalie en
 * relisant l'ancien numéro quelque part : il n'existe nulle part, et c'est le
 * point.
 */
export interface PieceScellee {
  documentNumero: string;
  documentType: string;
}

/**
 * Reconstruit le tuple, ou `null` s'il n'est pas recalculable.
 *
 * `null` n'est pas un échec silencieux : `verifierChaine` le transforme en
 * anomalie `tuple_irrecalculable`, visible dans le rapport. C'est la bonne façon
 * de traiter une ligne dont on ne peut plus rien dire — l'inverse d'une
 * vérification qui passerait en fermant les yeux.
 */
export function tupleDocumentDepuisLigne(
  ligne: LigneDocumentSignature,
  piece: PieceScellee,
): TupleDocumentSignatureV1 | null {
  if (!versionDocumentRecalculable(ligne.hashVersion)) return null;

  return {
    contexteType: "document_engagement",
    documentGenereId: ligne.documentGenereId,
    documentNumero: piece.documentNumero,
    documentType: piece.documentType,
    documentHashSha256: ligne.documentHashSha256,
    partie: ligne.partie,
    provider: ligne.provider,
    providerSubmissionId: ligne.providerSubmissionId,
    signataireNom: ligne.signataireNom,
    signataireEmail: ligne.signataireEmail,
    signataireQualite: ligne.signataireQualite,
    methode: ligne.methode,
    signatureSha256: ligne.signatureSha256,
    mentionVersion: ligne.mentionVersion,
    consentementVersion: ligne.consentementVersion,
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
export function maillonDocumentDepuisLigne(
  ligne: LigneDocumentSignature,
  piece: PieceScellee,
): MaillonChaine {
  return {
    id: ligne.id,
    prevHash: ligne.prevHash,
    selfHash: ligne.selfHash,
    hashVersion: ligne.hashVersion,
    versionRecalculable: versionDocumentRecalculable,
    recalculer: () => {
      const tuple = tupleDocumentDepuisLigne(ligne, piece);
      // On recalcule avec la version DE LA LIGNE, pas la courante : c'est tout
      // l'objet du registre de sérialiseurs.
      return tuple === null ? null : calculerSelfHashDocument(tuple, ligne.hashVersion);
    },
  };
}
