/**
 * Pièces jointes des e-mails écrits à la main : formats, limites, messages (lot I4, fiche F7).
 *
 * Module PUR (aucun import d'exécution) : utilisable par le navigateur comme par le serveur.
 * Le contrôle des octets (signature, macros, antivirus) est celui du formulaire de contact,
 * réutilisé tel quel côté serveur ; ici, seules les règles propres à l'envoi SORTANT.
 *
 * Aucune suppression nulle part : un fichier refusé reste à l'écart, jamais servi.
 */

import {
  EXTENSIONS_MACROS,
  assainirNomPieceJointe,
  extensionPieceJointe,
  formatDepuisExtension,
} from "@/lib/contact/pieces-jointes";

/** 5 fichiers au plus par e-mail. */
export const NOMBRE_MAX_PIECES_EMAIL = 5;
/** 10 Mo par fichier ET au total : au-delà, le relais d'envoi rejette le message. */
export const TAILLE_MAX_PIECE_EMAIL_OCTETS = 10 * 1024 * 1024;
export const TAILLE_MAX_TOTALE_EMAIL_OCTETS = 10 * 1024 * 1024;

/**
 * Formats sortants. Le `zip` et les formats Office anciens (`doc`, `xls`, `ppt`) sont exclus : souvent
 * bloqués chez le destinataire, porteurs possibles de macros.
 */
export const FORMATS_SORTANTS = [
  "pdf",
  "docx",
  "xlsx",
  "pptx",
  "odt",
  "txt",
  "csv",
  "png",
  "jpg",
] as const;
export type FormatSortant = (typeof FORMATS_SORTANTS)[number];

const FORMATS_PERMIS: ReadonlySet<string> = new Set(FORMATS_SORTANTS);

export function estFormatSortant(format: string | null): format is FormatSortant {
  return format !== null && FORMATS_PERMIS.has(format);
}

/** Le format sortant désigné par l'extension du nom, ou `null` (hors liste). */
export function formatSortantDepuisNom(nom: string): FormatSortant | null {
  const f = formatDepuisExtension(nom);
  return estFormatSortant(f) ? f : null;
}

/** Les messages, tels qu'ils s'affichent au fondateur. */
export const MESSAGES_PIECES_EMAIL = {
  nombre: `${NOMBRE_MAX_PIECES_EMAIL} fichiers au maximum par e-mail.`,
  vide: (nom: string) => `« ${nom} » est vide.`,
  taille: (nom: string) =>
    `« ${nom} » dépasse 10 Mo. Pour un fichier plus lourd, mettez un lien de partage dans le message.`,
  total: "Les pièces jointes dépassent 10 Mo au total. Pour plus lourd, mettez un lien de partage.",
  format: (nom: string) =>
    `« ${nom} » : format non accepté. Formats acceptés : PDF, DOCX, XLSX, PPTX, ODT, TXT, CSV, PNG, JPG.`,
  macros: (nom: string) =>
    `« ${nom} » peut contenir des macros : enregistrez-le sans macros (.docx, .xlsx, .pptx) puis réessayez.`,
  contenu: (nom: string) =>
    `« ${nom} » ne correspond pas à son extension : ce fichier ne peut pas être joint.`,
  infecte: (nom: string) => `« ${nom} » a été refusé par l'antivirus.`,
  antivirusIndisponible: (nom: string) => `« ${nom} » : antivirus indisponible, réessayez.`,
  nonRecue: (nom: string) => `« ${nom} » : fichier non reçu, réessayez de l'envoyer.`,
} as const;

export interface FichierAnnonceEmail {
  readonly nom: string;
  readonly taille: number;
}

export interface DejaPrisEmail {
  readonly nombre: number;
  readonly octets: number;
}

/**
 * Nombre, taille, format : sans lire un octet. Rend le PREMIER message d'erreur, ou `null`.
 * `dejaPris` compte les pièces déjà annoncées sur le même e-mail (ajouts successifs).
 */
export function controlerAnnonceEmail(
  fichiers: ReadonlyArray<FichierAnnonceEmail>,
  dejaPris: DejaPrisEmail = { nombre: 0, octets: 0 },
): string | null {
  if (dejaPris.nombre + fichiers.length > NOMBRE_MAX_PIECES_EMAIL)
    return MESSAGES_PIECES_EMAIL.nombre;
  let total = dejaPris.octets;
  for (const f of fichiers) {
    const ext = extensionPieceJointe(f.nom);
    if (ext && EXTENSIONS_MACROS.has(ext)) return MESSAGES_PIECES_EMAIL.macros(f.nom);
    if (!formatSortantDepuisNom(f.nom)) return MESSAGES_PIECES_EMAIL.format(f.nom);
    if (!Number.isSafeInteger(f.taille) || f.taille <= 0) return MESSAGES_PIECES_EMAIL.vide(f.nom);
    if (f.taille > TAILLE_MAX_PIECE_EMAIL_OCTETS) return MESSAGES_PIECES_EMAIL.taille(f.nom);
    total += f.taille;
  }
  if (total > TAILLE_MAX_TOTALE_EMAIL_OCTETS) return MESSAGES_PIECES_EMAIL.total;
  return null;
}

export { assainirNomPieceJointe as assainirNomPieceJointeEmail };
