/**
 * Réseau d'apporteurs — les DOCUMENTS JOINTS aux e-mails de l'apporteur (2026-11-25).
 *
 * Trois envois portent une pièce :
 *   · l'accusé de signature (« dossier bien reçu ») : le contrat que l'apporteur vient de signer ;
 *   · l'e-mail « contrat signé » (contresignature) et son renvoi : le contrat des deux parties,
 *     plus les documents ANNEXES déclarés ici (fiche des commissions, livret).
 *
 * 🔑 Le worker d'e-mails REFUSE d'envoyer quand une pièce demandée est introuvable sur R2
 * (`resolveAttachments`, fail-hard, puis nouvelles tentatives). On ne lui demande donc QUE ce
 * qui existe : chaque objet est vérifié (`HEAD`) avant d'être mis dans la liste. Un document
 * absent, vide, trop lourd, ou un stockage en panne : la pièce n'est pas jointe, c'est
 * journalisé, et l'e-mail part quand même. Seul le contrat contresigné reste TOUJOURS demandé :
 * son e-mail dit « en pièce jointe », il ne part pas sans lui.
 *
 * Les fichiers des annexes ne sont PAS dans le dépôt : ils se déposent à leur clé fixe avec
 * `scripts/apporteurs/deposer-document-joint.ts`, après relecture par le dirigeant. Tant qu'ils
 * n'y sont pas, rien ne change : le contrat part seul.
 *
 * ⚠️ Aucun `server-only` ici : le script de dépôt (tsx, hors Next) lit ces déclarations.
 * ⚠️ Journaux sans donnée personnelle : jamais la clé d'un contrat (elle porte l'identifiant du
 * dossier), seulement l'identifiant d'un document annexe.
 */

import { enteteObjetR2, isR2Configured } from "@/lib/r2-storage";

import { signalerErreurReseau } from "./signaler";

/** Une pièce jointe telle que la file d'e-mails l'attend : jamais de binaire, la clé R2. */
export interface PieceJointe {
  filename: string;
  r2Key: string;
  contentType: string;
}

/** Un document annexe : le même fichier pour tous les apporteurs, à une clé R2 fixe. */
export interface DocumentAnnexe {
  /** Identifiant stable (script de dépôt, journaux). */
  id: string;
  /** Nom du fichier montré au destinataire. */
  nomFichier: string;
  /** Clé R2 fixe : déposer un nouveau fichier à cette clé remplace le document. */
  cleR2: string;
}

export const PREFIXE_DOCUMENTS_APPORTEURS = "documents-apporteurs/";

export const DOCUMENTS_ANNEXES = [
  {
    id: "fiche-commissions",
    nomFichier: "Fiche-des-commissions-Axion-IA.pdf",
    cleR2: `${PREFIXE_DOCUMENTS_APPORTEURS}fiche-des-commissions.pdf`,
  },
  {
    id: "livret",
    nomFichier: "Livret-apporteur-Axion-IA.pdf",
    cleR2: `${PREFIXE_DOCUMENTS_APPORTEURS}livret-apporteur.pdf`,
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
 * Taille de l'objet s'il est joignable, sinon `null`. Ne lève jamais. `libelle` est ce qui
 * s'écrit au journal : jamais une clé de contrat.
 */
async function tailleSiJoignable(cle: string, libelle: string): Promise<number | null> {
  try {
    if (!isR2Configured()) return null;
    const entete = await enteteObjetR2(cle);
    if (!entete) {
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
    const taille = await tailleSiJoignable(doc.cleR2, libelle);
    if (taille === null) continue;
    if (cumul + taille > TAILLE_MAX_PIECES_OCTETS) {
      console.warn(`[apporteurs-documents] ${libelle} : trop lourd pour cet e-mail, non joint`);
      continue;
    }
    cumul += taille;
    pieces.push({ filename: doc.nomFichier, r2Key: doc.cleR2, contentType: PDF });
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
 * sur R2. Sinon liste vide : l'accusé part sans pièce, comme avant.
 */
export async function pieceContratDeLAccuse(cleContrat: string): Promise<PieceJointe[]> {
  const taille = await tailleSiJoignable(cleContrat, "contrat signé par l'apporteur");
  if (taille === null || taille > TAILLE_MAX_PIECES_OCTETS) return [];
  return [{ filename: NOM_CONTRAT_APPORTEUR, r2Key: cleContrat, contentType: PDF }];
}
