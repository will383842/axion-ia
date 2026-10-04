/**
 * Qualiopi — ZIP « dossier prêt à déposer » (chantier OPCO A6).
 *
 * Ce que l'organisme remet à l'ENTREPRISE pour qu'elle dépose sa demande sur
 * son espace OPCO : le kit OPCO vérifié + les pièces PRÉSENTES au registre
 * (convention signée, programme, devis, calendrier). Une pièce absente n'est
 * pas simulée : elle est nommée dans `LISEZMOI.txt`, comme dans le kit.
 *
 * 🔴 Pour une pièce qui exige la signature, on lit l'EXEMPLAIRE SIGNÉ
 * (`exemplaireSigneKey`, `…-signe.pdf`), jamais `documentPdfKey` — qui désigne
 * le PDF VIERGE. Exemplaire introuvable → pièce manquante, pas de repli.
 *
 * Le lecteur de stockage est injecté : la composition se teste sans R2.
 */

import JSZip from "jszip";
import { documentPdfKey, getObjectBufferR2 } from "@/lib/r2-storage";
import { nomFichierArchive, nomFichierDocument } from "@/server/qualiopi/documents/nom-fichier";
import type { DocumentType } from "../../../../prisma/generated/client";
import type { DossierPretADeposer } from "./dossier-pret-a-deposer-lecture";
import { EXEMPLAIRE_SIGNE_INTROUVABLE } from "./dossier-pret-a-deposer";

export interface PieceStockee {
  type: DocumentType;
  numero: string;
  createdAt: Date;
}

export type LecteurPdf = (cle: string) => Promise<Buffer | Uint8Array | null>;

export interface ZipPretADeposer {
  base64: string;
  filename: string;
  /** Numéros des pièces effectivement jointes (kit compris). */
  joints: string[];
  /** Libellés des pièces non jointes (manquantes au registre ou au stockage). */
  manquantes: string[];
}

export async function construireZipPretADeposer(
  input: { kit: PieceStockee; dossier: DossierPretADeposer },
  lire: LecteurPdf = getObjectBufferR2,
): Promise<ZipPretADeposer> {
  const { kit, dossier } = input;
  const contexte = dossier.raisonSociale ?? dossier.intituleFormation;
  const zip = new JSZip();

  const kitPdf = await lire(documentPdfKey(kit));
  if (kitPdf === null) {
    throw new Error("Le kit OPCO vient d'être émis mais son PDF est introuvable au stockage.");
  }
  zip.file(nomFichierDocument({ type: kit.type, numero: kit.numero, contexte }), kitPdf);
  const joints = [kit.numero];
  const manquantes: string[] = [];
  const lignes: string[] = [];

  for (const piece of dossier.pieces) {
    if (!piece.presente || piece.document === null) {
      manquantes.push(piece.libelle);
      lignes.push(`  [MANQUANTE] ${piece.libelle} — ${piece.detail}`);
      continue;
    }
    const cle = piece.exigeSignature
      ? piece.document.exemplaireSigneKey
      : documentPdfKey(piece.document);
    const pdf = cle === null ? null : await lire(cle);
    if (pdf === null) {
      manquantes.push(piece.libelle);
      lignes.push(
        `  [MANQUANTE] ${piece.libelle} — ${
          piece.exigeSignature ? EXEMPLAIRE_SIGNE_INTROUVABLE : "PDF introuvable"
        } au stockage`,
      );
      continue;
    }
    const nom = nomFichierDocument({
      type: piece.document.type,
      numero: piece.document.numero,
      contexte,
      // Même suffixe que `exemplaire-signe.ts` : le fichier dit qu'il est signé.
      ...(piece.exigeSignature ? { suffixe: "signee" } : {}),
    });
    zip.file(nom, pdf);
    joints.push(piece.document.numero);
    lignes.push(`  [JOINTE]    ${piece.libelle} — ${nom}`);
  }

  const e = dossier.encart;
  zip.file(
    "LISEZMOI.txt",
    [
      `Dossier de demande de prise en charge — session ${dossier.numeroSession}`,
      dossier.intituleFormation,
      "",
      e.titre,
      `  ${e.qui}`,
      `  Portail entreprise : ${e.portail}`,
      `  Délai de dépôt de l'OPCO : ${e.delai}`,
      `  Date limite de dépôt : ${e.dateLimite}`,
      `  Régime de paiement : ${e.regime}`,
      ...(e.etatFonds ? [`  État des fonds : ${e.etatFonds}`] : []),
      "",
      "Pièces :",
      ...lignes,
      "",
      manquantes.length > 0
        ? `Pièces manquantes : ${manquantes.join(", ")}`
        : "Toutes les pièces de la demande sont jointes.",
    ].join("\n"),
  );

  return {
    base64: await zip.generateAsync({ type: "base64", compression: "DEFLATE" }),
    filename: nomFichierArchive({
      libelle: "Dossier OPCO a deposer",
      contexte,
      numero: dossier.numeroSession,
    }),
    joints,
    manquantes,
  };
}
