/**
 * Réseau d'apporteurs — les DOCUMENTS JOINTS aux e-mails de l'apporteur (2026-11-25).
 *
 * Trois envois portent une pièce :
 *   · l'accusé de signature (« dossier bien reçu ») : le contrat que l'apporteur vient de signer ;
 *   · l'e-mail « contrat signé » (contresignature) et son renvoi : le contrat des deux parties,
 *     plus les documents ANNEXES déclarés ici (fiche des commissions, livret).
 *
 * 🔑 Le worker d'e-mails REFUSE d'envoyer quand une pièce EXIGÉE est introuvable sur R2
 * (`resoudrePiecesJointes`, fail-hard, puis nouvelles tentatives). On ne lui demande donc QUE ce
 * qui existe : chaque objet est vérifié (`HEAD`) avant d'être mis dans la liste. Un document
 * absent, vide, trop lourd, ou un stockage en panne : la pièce n'est pas jointe, c'est
 * journalisé, et l'e-mail part quand même. Seul le contrat contresigné reste TOUJOURS exigé :
 * son e-mail dit « en pièce jointe », il ne part pas sans lui.
 *
 * 🔑 Relecture de la PR #2255 (I2) : entre ce `HEAD` et l'envoi il peut se passer des heures
 * (file en pause, e-mail à valider, job rejoué). Les annexes et le contrat de l'accusé sont donc
 * marqués `facultative` : si l'objet a disparu ou grossi entre-temps, le worker envoie sans lui,
 * le journalise et le signale. Un worker plus ancien ignore ce champ et garde son comportement
 * d'avant (il exige toutes les pièces) : rien ne casse dans la fenêtre app/worker.
 *
 * Les fichiers de la fiche et du livret ne sont PAS dans le dépôt : ils se déposent à leur clé
 * fixe avec `scripts/apporteurs/deposer-document-joint.ts`, après relecture par le dirigeant.
 * Tant qu'ils n'y sont pas, rien ne change : le contrat part seul.
 *
 * 🔑 Le GUIDE DE DÉMARRAGE (validé le 25/11/2026) fait exception : sa copie est dans l'image
 * (`private/apporteurs/`). S'il manque sur R2 (404 vrai, jamais une panne ni un délai), l'application
 * l'y dépose elle-même avant de le joindre : tout est automatique, rien à lancer à la main. Un objet
 * déjà présent n'est jamais écrasé. Pour REMPLACER le guide : nouveau PDF dans `private/`, puis
 * `deposer-document-joint.ts guide-demarrage … --appliquer` (sinon l'e-mail garde l'ancien).
 *
 * ⚠️ Aucun `server-only` ici : le script de dépôt (tsx, hors Next) lit ces déclarations.
 * ⚠️ Journaux sans donnée personnelle : jamais la clé d'un contrat (elle porte l'identifiant du
 * dossier), seulement l'identifiant d'un document annexe.
 */

import { createHash } from "node:crypto";

import { enteteObjetR2, isR2Configured, uploadToR2 } from "@/lib/r2-storage";

import { NOM_FICHIER_GUIDE, lireGuideDemarrage } from "./guide-demarrage";
import { signalerErreurReseau } from "./signaler";

/** Une pièce jointe telle que la file d'e-mails l'attend : jamais de binaire, la clé R2. */
export interface PieceJointe {
  filename: string;
  r2Key: string;
  contentType: string;
  /** Pièce que l'e-mail ne promet pas : introuvable à l'envoi, il part sans elle (worker). */
  facultative?: true;
}

/** Un document annexe : le même fichier pour tous les apporteurs, à une clé R2 fixe. */
export interface DocumentAnnexe {
  /** Identifiant stable (script de dépôt, journaux). */
  id: string;
  /** Nom du fichier montré au destinataire. */
  nomFichier: string;
  /** Clé R2 fixe : déposer un nouveau fichier à cette clé remplace le document. */
  cleR2: string;
  /** Nom du document dans les messages de la CONSOLE (jamais montré à l'apporteur). */
  libelleConsole: string;
  /** Copie embarquée dans l'image, déposée sur R2 si l'objet manque (404 vrai seulement). */
  lireCopieLocale?: () => Promise<Buffer | null>;
}

export const PREFIXE_DOCUMENTS_APPORTEURS = "documents-apporteurs/";

export const DOCUMENTS_ANNEXES = [
  {
    id: "fiche-commissions",
    nomFichier: "Fiche-des-commissions-Axion-IA.pdf",
    cleR2: `${PREFIXE_DOCUMENTS_APPORTEURS}fiche-des-commissions.pdf`,
    libelleConsole: "la fiche des commissions",
  },
  {
    id: "livret",
    nomFichier: "Livret-apporteur-Axion-IA.pdf",
    cleR2: `${PREFIXE_DOCUMENTS_APPORTEURS}livret-apporteur.pdf`,
    libelleConsole: "le livret",
  },
  {
    id: "guide-demarrage",
    nomFichier: NOM_FICHIER_GUIDE,
    cleR2: `${PREFIXE_DOCUMENTS_APPORTEURS}guide-demarrage-apporteur.pdf`,
    libelleConsole: "le guide de démarrage",
    lireCopieLocale: lireGuideDemarrage,
  },
] as const satisfies readonly DocumentAnnexe[];

/** Nom du contrat signé des deux parties (e-mail « contrat signé » et son renvoi). */
export const NOM_CONTRAT_SIGNE = "Contrat-apporteur-Axion-IA.pdf";

/** Nom du contrat signé par l'apporteur seul (accusé de signature), avant contresignature. */
export const NOM_CONTRAT_APPORTEUR = "Contrat-apporteur-Axion-IA-signe-par-vous.pdf";

/**
 * Poids cumulé maximal des pièces d'un e-mail, en octets bruts. Doit rester ≤ au plafond du
 * worker (`TAILLE_MAX_PJ_OCTETS`, 10 Mo), qui REFUSE tout l'e-mail au-delà : on garde 2 Mo de
 * marge. Verrouillé par `__tests__/documents-joints.spec.ts`.
 */
export const TAILLE_MAX_PIECES_OCTETS = 8 * 1_048_576;

const PDF = "application/pdf";

/**
 * Délai maximal d'un `HEAD` (relecture de la PR #2255) : le client S3 n'en a pas, et jusqu'à
 * trois `HEAD` précèdent une contresignature. Au-delà, la pièce est traitée comme illisible.
 */
export const DELAI_ENTETE_MS = 5_000;

async function enteteDansLeDelai(cle: string): ReturnType<typeof enteteObjetR2> {
  let minuterie: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      enteteObjetR2(cle),
      new Promise<never>((_, refuser) => {
        minuterie = setTimeout(() => refuser(new Error("délai dépassé")), DELAI_ENTETE_MS);
      }),
    ]);
  } finally {
    clearTimeout(minuterie);
  }
}

/** Dépose la copie embarquée sur R2 (objet absent) ; taille déposée, ou `null` sans rien lever. */
async function deposerCopieLocale(
  cle: string,
  libelle: string,
  lire: () => Promise<Buffer | null>,
): Promise<number | null> {
  try {
    const copie = await lire();
    if (!copie || copie.byteLength === 0) {
      console.warn(
        `[apporteurs-documents] ${libelle} : absent de R2 et copie embarquée illisible, non joint`,
      );
      return null;
    }
    const sha256 = createHash("sha256").update(copie).digest("hex");
    await uploadToR2(cle, copie, PDF, { sha256 });
    console.warn(`[apporteurs-documents] ${libelle} : absent de R2, déposé depuis l'image`);
    return copie.byteLength;
  } catch (err) {
    console.warn(`[apporteurs-documents] ${libelle} : dépôt sur R2 impossible, non joint`);
    signalerErreurReseau(`documents joints : dépôt de ${libelle} sur R2`, err);
    return null;
  }
}

/**
 * Taille de l'objet s'il est joignable, sinon `null`. Ne lève jamais. `libelle` est ce qui
 * s'écrit au journal : jamais une clé de contrat.
 */
async function tailleSiJoignable(
  cle: string,
  libelle: string,
  lireCopieLocale?: () => Promise<Buffer | null>,
): Promise<number | null> {
  try {
    if (!isR2Configured()) return null;
    const entete = await enteteDansLeDelai(cle);
    if (!entete) {
      if (lireCopieLocale) return await deposerCopieLocale(cle, libelle, lireCopieLocale);
      console.warn(`[apporteurs-documents] ${libelle} : absent de R2, non joint`);
      return null;
    }
    if (entete.taille <= 0) {
      console.warn(`[apporteurs-documents] ${libelle} : fichier vide sur R2, non joint`);
      return null;
    }
    return entete.taille;
  } catch (err) {
    console.warn(`[apporteurs-documents] ${libelle} : R2 indisponible, non joint`);
    signalerErreurReseau(`documents joints : ${libelle} illisible sur R2`, err);
    return null;
  }
}

/**
 * Les documents annexes à joindre : seulement ceux qui existent sur R2 et tiennent dans le
 * poids restant. Absence ou panne : liste plus courte (ou vide), jamais d'erreur.
 *
 * @param octetsDejaPris — poids des pièces déjà dans l'e-mail (le contrat).
 */
export async function documentsAnnexesAJoindre(octetsDejaPris = 0): Promise<PieceJointe[]> {
  const pieces: PieceJointe[] = [];
  let cumul = octetsDejaPris;
  for (const doc of DOCUMENTS_ANNEXES) {
    const libelle = `document « ${doc.id} »`;
    const taille = await tailleSiJoignable(
      doc.cleR2,
      libelle,
      "lireCopieLocale" in doc ? doc.lireCopieLocale : undefined,
    );
    if (taille === null) continue;
    if (cumul + taille > TAILLE_MAX_PIECES_OCTETS) {
      console.warn(`[apporteurs-documents] ${libelle} : trop lourd pour cet e-mail, non joint`);
      continue;
    }
    cumul += taille;
    pieces.push({
      filename: doc.nomFichier,
      r2Key: doc.cleR2,
      contentType: PDF,
      facultative: true,
    });
  }
  return pieces;
}

/**
 * Pièces de l'e-mail « contrat signé » (contresignature et renvoi) : le contrat des deux
 * parties, TOUJOURS, puis les annexes présentes sur R2. Si le contrat lui-même n'est pas
 * lisible à cet instant, il part seul dans la liste : le worker réessaiera, comme avant.
 */
export async function piecesDuContratSigne(cleContrat: string): Promise<PieceJointe[]> {
  const contrat: PieceJointe = { filename: NOM_CONTRAT_SIGNE, r2Key: cleContrat, contentType: PDF };
  const taille = await tailleSiJoignable(cleContrat, "contrat signé des deux parties");
  if (taille === null) return [contrat];
  return [contrat, ...(await documentsAnnexesAJoindre(taille))];
}

/**
 * Pièce de l'accusé de signature : le contrat que l'apporteur vient de signer, s'il est lisible
 * sur R2. Sinon liste vide : l'accusé part sans pièce, comme avant. Le texte de l'accusé ne
 * promet aucune pièce : elle est FACULTATIVE, une panne de R2 à l'envoi ne retient pas l'accusé.
 */
export async function pieceContratDeLAccuse(cleContrat: string): Promise<PieceJointe[]> {
  const taille = await tailleSiJoignable(cleContrat, "contrat signé par l'apporteur");
  if (taille === null || taille > TAILLE_MAX_PIECES_OCTETS) return [];
  return [
    { filename: NOM_CONTRAT_APPORTEUR, r2Key: cleContrat, contentType: PDF, facultative: true },
  ];
}

const enListe = (noms: readonly string[]): string =>
  noms.length <= 1 ? noms.join("") : `${noms.slice(0, -1).join(", ")} et ${noms.at(-1)}`;

/**
 * Ce que la CONSOLE dit des pièces de l'e-mail « contrat signé » au moment de la mise en file
 * (relecture de la PR #2255, I3) : quelles annexes y sont, lesquelles n'y sont pas. Sans cela,
 * « envoyé » se lisait « avec la fiche des commissions » même quand elle manquait. Ce qui est
 * réellement parti se relit ensuite dans « E-mails envoyés » (noms et empreintes des pièces).
 */
export function bilanDesPieces(pieces: readonly PieceJointe[]): string {
  const cles = new Set(pieces.map((p) => p.r2Key));
  const jointes = DOCUMENTS_ANNEXES.filter((d) => cles.has(d.cleR2)).map((d) => d.libelleConsole);
  const absentes = DOCUMENTS_ANNEXES.filter((d) => !cles.has(d.cleR2)).map((d) => d.libelleConsole);
  const debut =
    jointes.length === 0
      ? "Pièce jointe : le contrat seul."
      : `Pièces jointes : ${enListe(["le contrat", ...jointes])}.`;
  if (absentes.length === 0) return debut;
  const non =
    absentes.length === 1
      ? "Non joint (absent ou illisible sur le stockage)"
      : "Non joints (absents ou illisibles sur le stockage)";
  return `${debut} ${non} : ${enListe(absentes)}.`;
}
