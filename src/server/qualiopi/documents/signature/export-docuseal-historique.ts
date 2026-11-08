/**
 * Preuve du devis historique signé via DocuSeal (logique pure, dépendances injectées).
 *
 * DocuSeal est au statut HISTORIQUE (un seul devis signé avant le 30/07/2026). Avant que son
 * instance ne soit un jour arrêtée, on verse sa preuve dans NOTRE stockage : PDF signé + journal
 * d'audit de la soumission, déposés dans R2, et une ligne `document_signatures` provider='docuseal'
 * (via `signerDocument`, qui tient la chaîne d'empreintes).
 *
 * - DRY-RUN par défaut : rien n'est téléchargé-déposé ni écrit. `--apply` est explicite.
 * - IDEMPOTENT : une ligne `docuseal` déjà présente pour la pièce → rien n'est refait.
 * - AUCUNE suppression de donnée, de colonne ou de table. Aucune valeur d'accès en dur.
 *
 * Empreinte : SHA-256 des octets du PDF signé téléchargé, comparé au `checksum` de DocuSeal quand
 * il est fourni (écart = arrêt). Elle est posée en métadonnée de l'objet R2 et dans le rapport ;
 * la ligne `document_signatures` porte, elle, l'empreinte de la PIÈCE scellée (tuple haché).
 */

import { createHash } from "node:crypto";

export interface DevisHistorique {
  readonly id: string;
  readonly numero: string;
  readonly docusealSubmissionId: string;
  readonly documentGenereId: string | null;
  readonly clientNom: string;
  readonly clientEmail: string | null;
  readonly acceptedAt: Date | null;
  readonly createdAt: Date;
}

export interface SoumissionDocuSeal {
  readonly pdfSigneUrl: string;
  readonly journalAuditUrl: string | null;
  /** SHA-256 hexadécimal annoncé par DocuSeal pour le PDF signé, si disponible. */
  readonly checksumPdf: string | null;
  readonly signeAt: Date | null;
}

export interface DependancesExport {
  listerDevis(): Promise<DevisHistorique[]>;
  signatureDocusealExiste(documentGenereId: string): Promise<boolean>;
  lireSoumission(submissionId: string): Promise<SoumissionDocuSeal>;
  telecharger(url: string): Promise<Buffer>;
  deposerR2(key: string, buffer: Buffer, metadata: Record<string, string>): Promise<void>;
  /** Écrit la ligne de preuve. Retourne `true` si écrite, `false` si déjà présente. */
  enregistrerSignature(args: {
    devis: DevisHistorique;
    soumission: SoumissionDocuSeal;
  }): Promise<boolean>;
}

export type ResultatDevis =
  | { numero: string; etat: "deja_fait" }
  | { numero: string; etat: "a_faire"; cles: { pdf: string; journal: string | null } }
  | {
      numero: string;
      etat: "fait";
      cles: { pdf: string; journal: string | null };
      sha256Pdf: string;
      sha256Journal: string | null;
      ligneEcrite: boolean;
      sansPiece: boolean;
    }
  | { numero: string; etat: "erreur"; message: string };

const sha256 = (b: Buffer): string => createHash("sha256").update(b).digest("hex");

/** Clés `documents/…` : même racine que les pièces (`documents/{année}/devis/{numéro}.pdf`). */
export function clesDocuseal(numero: string, annee: number): { pdf: string; journal: string } {
  const base = `documents/${annee}/docuseal-historique/${numero}`;
  return { pdf: `${base}-signe.pdf`, journal: `${base}-journal-audit.pdf` };
}

export async function exporterDevisHistorique(
  deps: DependancesExport,
  options: { apply: boolean },
): Promise<ResultatDevis[]> {
  const resultats: ResultatDevis[] = [];
  for (const devis of await deps.listerDevis()) {
    try {
      resultats.push(await traiter(deps, devis, options.apply));
    } catch (e) {
      resultats.push({
        numero: devis.numero,
        etat: "erreur",
        message: e instanceof Error ? e.message : "inconnue",
      });
    }
  }
  return resultats;
}

async function traiter(
  deps: DependancesExport,
  devis: DevisHistorique,
  apply: boolean,
): Promise<ResultatDevis> {
  if (
    devis.documentGenereId !== null &&
    (await deps.signatureDocusealExiste(devis.documentGenereId))
  ) {
    return { numero: devis.numero, etat: "deja_fait" };
  }
  const annee = (devis.acceptedAt ?? devis.createdAt).getUTCFullYear();
  const cles = clesDocuseal(devis.numero, annee);
  const soumission = await deps.lireSoumission(devis.docusealSubmissionId);
  const clesUtiles = {
    pdf: cles.pdf,
    journal: soumission.journalAuditUrl !== null ? cles.journal : null,
  };
  if (!apply) return { numero: devis.numero, etat: "a_faire", cles: clesUtiles };

  const pdf = await deps.telecharger(soumission.pdfSigneUrl);
  const empreinte = sha256(pdf);
  if (soumission.checksumPdf !== null && soumission.checksumPdf.toLowerCase() !== empreinte) {
    throw new Error("empreinte du PDF téléchargé différente de celle annoncée par DocuSeal");
  }
  const journal =
    soumission.journalAuditUrl !== null ? await deps.telecharger(soumission.journalAuditUrl) : null;

  const meta = { source: "docuseal", devis: devis.numero, submission: devis.docusealSubmissionId };
  await deps.deposerR2(cles.pdf, pdf, { ...meta, sha256: empreinte });
  const sha256Journal = journal !== null ? sha256(journal) : null;
  if (journal !== null && sha256Journal !== null) {
    await deps.deposerR2(cles.journal, journal, { ...meta, sha256: sha256Journal });
  }

  let ligneEcrite = false;
  const sansPiece = devis.documentGenereId === null;
  if (!sansPiece) ligneEcrite = await deps.enregistrerSignature({ devis, soumission });
  return {
    numero: devis.numero,
    etat: "fait",
    cles: clesUtiles,
    sha256Pdf: empreinte,
    sha256Journal,
    ligneEcrite,
    sansPiece,
  };
}
