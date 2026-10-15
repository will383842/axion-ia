/**
 * Pièces jointes du formulaire de contact unifié (décision de Will, 2026-10-15).
 *
 * Origine : le 29/09, un organisme public a écrit « avec le cahier des charges
 * en pièce jointe » — le formulaire n'acceptait aucun fichier, le document
 * n'est jamais arrivé.
 *
 * Module PUR (aucun import d'exécution) : le navigateur y lit les limites, la
 * liste `accept` et le contrôle rapide (nombre, taille, extension) ; le serveur
 * y ajoute le contrôle qui compte, sur les PREMIERS OCTETS. Le type MIME annoncé
 * par le navigateur n'est jamais lu : il se fabrique.
 */

/** 3 fichiers au plus. */
export const NOMBRE_MAX_PIECES = 3;
/** 10 Mo par fichier. */
export const TAILLE_MAX_PIECE_OCTETS = 10 * 1024 * 1024;
/** 20 Mo au total. ⚠️ `next.config.ts` (`bodySizeLimit`, `proxyClientMaxBodySize`) suit. */
export const TAILLE_MAX_TOTALE_OCTETS = 20 * 1024 * 1024;

/** Nom du champ dans le `FormData`. */
export const CHAMP_PIECES_JOINTES = "piecesJointes";

export type FormatPieceJointe =
  "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "odt" | "txt" | "csv" | "png" | "jpg";

interface DescriptionFormat {
  readonly mime: string;
  readonly extensions: ReadonlyArray<string>;
}

export const FORMATS_PIECE_JOINTE: Readonly<Record<FormatPieceJointe, DescriptionFormat>> = {
  pdf: { mime: "application/pdf", extensions: ["pdf"] },
  doc: { mime: "application/msword", extensions: ["doc"] },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extensions: ["docx"],
  },
  xls: { mime: "application/vnd.ms-excel", extensions: ["xls"] },
  xlsx: {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extensions: ["xlsx"],
  },
  ppt: { mime: "application/vnd.ms-powerpoint", extensions: ["ppt"] },
  pptx: {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    extensions: ["pptx"],
  },
  odt: { mime: "application/vnd.oasis.opendocument.text", extensions: ["odt"] },
  txt: { mime: "text/plain", extensions: ["txt"] },
  csv: { mime: "text/csv", extensions: ["csv"] },
  png: { mime: "image/png", extensions: ["png"] },
  jpg: { mime: "image/jpeg", extensions: ["jpg", "jpeg"] },
};

/** Pour l'attribut `accept` (confort : le serveur revérifie tout). */
export const ACCEPT_PIECES_JOINTES = Object.values(FORMATS_PIECE_JOINTE)
  .flatMap((f) => f.extensions.map((e) => `.${e}`))
  .join(",");

/** Les messages, au caractère près : ils s'affichent tels quels à la personne. */
export const MESSAGES_PIECES_JOINTES = {
  nombre: `${NOMBRE_MAX_PIECES} fichiers au maximum.`,
  vide: (nom: string) => `« ${nom} » est vide.`,
  taille: (nom: string) => `« ${nom} » dépasse 10 Mo.`,
  total: "Les pièces jointes dépassent 20 Mo au total.",
  format: (nom: string) =>
    `« ${nom} » : format non accepté. Formats acceptés : PDF, Word, Excel, PowerPoint, ODT, TXT, CSV, PNG, JPG.`,
  macros: (nom: string) =>
    `« ${nom} » contient des macros : enregistrez-le sans macros (.docx, .xlsx, .pptx) puis réessayez.`,
  contenu: (nom: string) =>
    `« ${nom} » ne correspond pas à son extension : ce fichier ne peut pas être accepté.`,
  infecte: (nom: string) => `« ${nom} » a été refusé par notre antivirus.`,
} as const;

/** Extensions refusées nommément : un message clair vaut mieux que « format non accepté ». */
const EXTENSIONS_MACROS = new Set(["docm", "dotm", "xlsm", "xltm", "xlsb", "pptm", "potm", "ppsm"]);

/** L'extension d'un nom, sans le point, en minuscules, ou `null`. */
export function extensionPieceJointe(nom: string): string | null {
  const m = /\.([A-Za-z0-9]{1,10})$/.exec(nom.trim());
  return m ? m[1]!.toLowerCase() : null;
}

/** Le format désigné par l'extension, ou `null` (hors liste). */
export function formatDepuisExtension(nom: string): FormatPieceJointe | null {
  const ext = extensionPieceJointe(nom);
  if (!ext) return null;
  for (const [format, d] of Object.entries(FORMATS_PIECE_JOINTE) as Array<
    [FormatPieceJointe, DescriptionFormat]
  >) {
    if (d.extensions.includes(ext)) return format;
  }
  return null;
}

/**
 * Nom de fichier assaini : jamais de chemin, de caractère de contrôle ni de
 * caractère réservé ; 120 caractères au plus, extension en minuscules gardée.
 * Le nom ne sert qu'à l'AFFICHAGE et au téléchargement : la clé de stockage,
 * elle, est tirée au hasard et n'en reprend rien.
 */
export function assainirNomPieceJointe(nom: string): string {
  const base = (nom.split(/[/\\]/).pop() ?? "").normalize("NFC");
  const ext = extensionPieceJointe(base);
  const sansExt = ext ? base.slice(0, -(ext.length + 1)) : base;
  const propre = sansExt
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .replace(/[^\p{L}\p{N} ._()'-]/gu, "_")
    .replace(/\s+/g, " ")
    .replace(/_+/g, "_")
    .replace(/^[.\s_-]+|[.\s_]+$/g, "")
    .slice(0, 110)
    .trim();
  const tronc = propre || "piece-jointe";
  return ext ? `${tronc}.${ext}` : tronc;
}

/** « 18 Ko », « 1,4 Mo ». */
export function tailleLisiblePieceJointe(octets: number): string {
  if (octets < 1024 * 1024) return `${Math.max(1, Math.round(octets / 1024))} Ko`;
  const mo = octets / (1024 * 1024);
  return `${mo.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}

// ---- Contrôle rapide (navigateur ET serveur) --------------------------------

export interface FichierAnnonce {
  readonly name: string;
  readonly size: number;
}

/**
 * Nombre, taille, extension — sans lire un octet. Rend le PREMIER message
 * d'erreur, ou `null`. Le navigateur s'en sert pour prévenir avant l'envoi ; le
 * serveur le rejoue, puis lit les octets (`analyserOctetsPieceJointe`).
 */
export function controlerListePiecesJointes(
  fichiers: ReadonlyArray<FichierAnnonce>,
): string | null {
  if (fichiers.length > NOMBRE_MAX_PIECES) return MESSAGES_PIECES_JOINTES.nombre;
  let total = 0;
  for (const f of fichiers) {
    const ext = extensionPieceJointe(f.name);
    if (ext && EXTENSIONS_MACROS.has(ext)) return MESSAGES_PIECES_JOINTES.macros(f.name);
    if (!formatDepuisExtension(f.name)) return MESSAGES_PIECES_JOINTES.format(f.name);
    if (f.size <= 0) return MESSAGES_PIECES_JOINTES.vide(f.name);
    if (f.size > TAILLE_MAX_PIECE_OCTETS) return MESSAGES_PIECES_JOINTES.taille(f.name);
    total += f.size;
  }
  if (total > TAILLE_MAX_TOTALE_OCTETS) return MESSAGES_PIECES_JOINTES.total;
  return null;
}

// ---- Contrôle des octets (serveur) -----------------------------------------

export type ResultatAnalyse =
  | { readonly ok: true; readonly format: FormatPieceJointe; readonly mime: string }
  | {
      readonly ok: false;
      readonly motif: "format" | "macros" | "contenu";
      readonly message: string;
    };

function commencePar(o: Uint8Array, entete: ReadonlyArray<number>, decalage = 0): boolean {
  if (o.length < decalage + entete.length) return false;
  return entete.every((b, i) => o[decalage + i] === b);
}

function contientAscii(o: Uint8Array, texte: string): boolean {
  const motif = Array.from(texte, (c) => c.charCodeAt(0));
  return indexDe(o, motif) >= 0;
}

function contientUtf16le(o: Uint8Array, texte: string): boolean {
  const motif = Array.from(texte).flatMap((c) => [c.charCodeAt(0), 0]);
  return indexDe(o, motif) >= 0;
}

function indexDe(o: Uint8Array, motif: ReadonlyArray<number>): number {
  const premier = motif[0]!;
  const fin = o.length - motif.length;
  for (let i = 0; i <= fin; i++) {
    if (o[i] !== premier) continue;
    let j = 1;
    while (j < motif.length && o[i + j] === motif[j]) j++;
    if (j === motif.length) return i;
  }
  return -1;
}

const ZIP = [0x50, 0x4b, 0x03, 0x04] as const;
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] as const;

/**
 * Un exécutable, quel que soit son nom : Windows (MZ), Linux (ELF), macOS
 * (Mach-O, binaire universel), script (`#!`).
 */
export function estExecutable(o: Uint8Array): boolean {
  return (
    commencePar(o, [0x4d, 0x5a]) ||
    commencePar(o, [0x7f, 0x45, 0x4c, 0x46]) ||
    commencePar(o, [0xfe, 0xed, 0xfa, 0xce]) ||
    commencePar(o, [0xfe, 0xed, 0xfa, 0xcf]) ||
    commencePar(o, [0xce, 0xfa, 0xed, 0xfe]) ||
    commencePar(o, [0xcf, 0xfa, 0xed, 0xfe]) ||
    commencePar(o, [0xca, 0xfe, 0xba, 0xbe]) ||
    commencePar(o, [0x23, 0x21])
  );
}

/** Du balisage (HTML, SVG, XML) — refusé même sous `.txt` ou `.csv`. */
function ressembleABalisage(o: Uint8Array): boolean {
  const debut = new TextDecoder("latin1").decode(o.subarray(0, 2048)).replace(/^﻿/, "");
  return /<\s*(!doctype|html|head|body|svg|script|iframe|object|embed|\?xml)\b/i.test(debut);
}

/** Texte : aucun octet nul, aucun caractère de contrôle hors tabulation et sauts de ligne. */
function texteSain(o: Uint8Array): boolean {
  for (const b of o) {
    if (b === 0x09 || b === 0x0a || b === 0x0d || b === 0x0c) continue;
    if (b < 0x20 || b === 0x7f) return false;
  }
  return true;
}

/**
 * Le contrôle qui compte : les premiers octets correspondent-ils au format
 * annoncé par l'extension, et le fichier est-il sans macros ?
 *
 * Les noms d'entrée d'une archive ZIP (Office récent, ODT) sont écrits EN
 * CLAIR dans l'archive, même compressée : un `vbaProject.bin` se lit sans
 * décompresser. Un Office ancien (OLE) range ses macros dans un flux
 * `_VBA_PROJECT`, nommé en UTF-16.
 */
export function analyserOctetsPieceJointe(nom: string, o: Uint8Array): ResultatAnalyse {
  const ext = extensionPieceJointe(nom);
  if (ext && EXTENSIONS_MACROS.has(ext)) {
    return { ok: false, motif: "macros", message: MESSAGES_PIECES_JOINTES.macros(nom) };
  }
  const format = formatDepuisExtension(nom);
  if (!format) return { ok: false, motif: "format", message: MESSAGES_PIECES_JOINTES.format(nom) };
  const refusContenu = {
    ok: false,
    motif: "contenu",
    message: MESSAGES_PIECES_JOINTES.contenu(nom),
  } as const;
  if (estExecutable(o)) return refusContenu;

  let conforme: boolean;
  switch (format) {
    case "pdf":
      conforme = commencePar(o, [0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
      break;
    case "png":
      conforme = commencePar(o, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      break;
    case "jpg":
      conforme = commencePar(o, [0xff, 0xd8, 0xff]);
      break;
    case "docx":
    case "xlsx":
    case "pptx": {
      const dossier = format === "docx" ? "word/" : format === "xlsx" ? "xl/" : "ppt/";
      conforme =
        commencePar(o, ZIP) && contientAscii(o, "[Content_Types].xml") && contientAscii(o, dossier);
      if (conforme && (contientAscii(o, "vbaProject.bin") || contientAscii(o, "vbaData.xml"))) {
        return { ok: false, motif: "macros", message: MESSAGES_PIECES_JOINTES.macros(nom) };
      }
      break;
    }
    case "odt":
      // L'entrée `mimetype` est la première, stockée sans compression (norme ODF).
      conforme =
        commencePar(o, ZIP) && contientAscii(o, "mimetypeapplication/vnd.oasis.opendocument.text");
      if (conforme && (contientAscii(o, "Basic/") || contientAscii(o, "Scripts/"))) {
        return { ok: false, motif: "macros", message: MESSAGES_PIECES_JOINTES.macros(nom) };
      }
      break;
    case "doc":
    case "xls":
    case "ppt":
      conforme = commencePar(o, OLE);
      if (conforme && contientUtf16le(o, "_VBA_PROJECT")) {
        return { ok: false, motif: "macros", message: MESSAGES_PIECES_JOINTES.macros(nom) };
      }
      break;
    case "txt":
    case "csv":
      conforme = texteSain(o) && !ressembleABalisage(o);
      break;
  }
  if (!conforme) return refusContenu;
  return { ok: true, format, mime: FORMATS_PIECE_JOINTE[format].mime };
}
