/**
 * Qualiopi — Nom de fichier de téléchargement d'une pièce.
 *
 * ## Le défaut que ce module ferme (2026-08-02)
 *
 * Une pièce téléchargée s'appelait « AXI-DOC-2026-012.pdf » : le numéro de
 * classement interne, muet pour quiconque range le fichier dans un dossier —
 * déclaration d'activité, auditeur, client. Le nom d'un fichier est la première
 * chose qu'un tiers lit ; il doit dire le TYPE et le CONTEXTE, le numéro
 * n'arrivant qu'en dernier pour l'unicité.
 *
 * ⚠️ Le nom part dans un en-tête HTTP `Content-Disposition: filename="…"` :
 * il doit rester ASCII (accents translittérés, caractères réservés retirés).
 * `filename*` UTF-8 existe mais l'ASCII propre marche partout, y compris dans
 * les clients mail où la pièce finit toujours par transiter.
 */

import type { DocumentType } from "../../../../prisma/generated/client";
import { LIBELLES_TYPE_DOCUMENT } from "./libelles-type-document";

/**
 * Libellés de NOM DE FICHIER — DÉRIVÉS du vocabulaire unique
 * `LIBELLES_TYPE_DOCUMENT`, jamais recopiés.
 *
 * 🔴 2026-09-02 (audit certificateur). Cette table était une COPIE mot pour mot
 * du vocabulaire d'écran. Une copie ne diverge pas le jour où on l'écrit, elle
 * diverge le jour où quelqu'un corrige l'une des deux — et ce dépôt a payé ce
 * motif neuf fois sur onze la nuit du 24 août. Elle est donc dérivée.
 *
 * ⚠️ Elle reste distincte de `DOC_LABELS` (DocumentsSection), qui porte des
 * références d'articles du Code du travail : utiles à l'écran, inutiles — et
 * illisibles — dans un nom de fichier.
 */
const LIBELLES_FICHIER: Record<DocumentType, string> = LIBELLES_TYPE_DOCUMENT;
/**
 * ASCII sûr pour `Content-Disposition: filename="…"` : accents translittérés
 * (NFD + retrait des diacritiques), caractères réservés remplacés par un
 * espace, espaces répétés repliés. Jamais de chaîne vide : un segment qui se
 * vide entièrement est simplement omis par l'appelant.
 */
function asciiSur(segment: string): string {
  return segment
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7e]/g, " ")
    .replace(/["\\/:*?<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface NomFichierInput {
  type: DocumentType;
  numero: string;
  /** Contexte lisible : raison sociale du client ou intitulé de session. */
  contexte?: string | null;
  /** Suffixe d'état, ex. « signee » pour l'exemplaire signé. */
  suffixe?: string;
}

/**
 * « Convention de formation signee - INVEST SUN - AXI-DOC-2026-009.pdf ».
 * Le contexte est tronqué à 60 caractères : un intitulé de session complet
 * produirait des noms que Windows refuse de décompresser en chemin profond.
 */
export function nomFichierDocument({ type, numero, contexte, suffixe }: NomFichierInput): string {
  const libelle = suffixe ? `${LIBELLES_FICHIER[type]} ${suffixe}` : LIBELLES_FICHIER[type];
  const ctx = contexte ? asciiSur(contexte).slice(0, 60).trim() : "";
  const segments = [asciiSur(libelle), ctx, asciiSur(numero)].filter(Boolean);
  return `${segments.join(" - ")}.pdf`;
}
