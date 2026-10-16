/**
 * Contrôle des OCTETS d'une pièce jointe du formulaire de contact (serveur).
 *
 * Sorti de `@/lib/contact/pieces-jointes` le 2026-10-16 : ce module est importé
 * par le formulaire (navigateur), et tout ce qui s'y trouve part dans le JS de
 * `/contact`. Signatures magiques, `VBA_OLE`, répertoire central ZIP et
 * `ScruteurPieceJointe` n'ont aucun usage côté navigateur : ils vivent ici.
 *
 * ⚠️ Pas de `import "server-only"` : le worker (`tsx`) importe la chaîne
 * `server/contact/pieces-jointes` et le paquet y lève à l'exécution. La
 * frontière est tenue par un test (`le-formulaire-nimporte-pas-lanalyse`).
 */

import {
  EXTENSIONS_MACROS,
  FORMATS_PIECE_JOINTE,
  MESSAGES_PIECES_JOINTES,
  extensionPieceJointe,
  formatDepuisExtension,
  type FormatPieceJointe,
} from "@/lib/contact/pieces-jointes";

// ---- Contrôle des octets -----------------------------------------------------
//
// Le serveur ne reçoit plus le fichier : il le LIT dans R2, par morceaux. Le
// contrôle se fait donc en trois lectures, chacune bornée :
//   1. le DÉBUT (`TAILLE_ENTETE_ANALYSEE`, par `Range`) — signature, balisage ;
//   2. pour un Office récent ou un ODT, la FIN puis le RÉPERTOIRE CENTRAL de
//      l'archive (par `Range`) — la liste des entrées, où se lisent les macros,
//      sans rien décompresser ni télécharger le reste ;
//   3. le flux complet, une fois, pour l'antivirus et l'empreinte — et, au
//      passage, les deux contrôles qui demandent tout le fichier (macros d'un
//      Office ancien, caractères de contrôle d'un texte) : `ScruteurPieceJointe`.

/** Octets lus au début du fichier (8 Ko au moins : balisage d'un texte). */
export const TAILLE_ENTETE_ANALYSEE = 8 * 1024;
/** Octets lus à la fin d'une archive : l'enregistrement de fin + son commentaire (64 Ko). */
export const TAILLE_FIN_ZIP_ANALYSEE = 22 + 0xffff;
/** Répertoire central lu au plus (au-delà : refusé, aucun document réel n'en a autant). */
export const TAILLE_MAX_REPERTOIRE_ZIP = 4 * 1024 * 1024;

export type MotifRefus = "format" | "macros" | "contenu";

export type ResultatAnalyse =
  | { readonly ok: true; readonly format: FormatPieceJointe; readonly mime: string }
  | { readonly ok: false; readonly motif: MotifRefus; readonly message: string };

function commencePar(o: Uint8Array, entete: ReadonlyArray<number>, decalage = 0): boolean {
  if (o.length < decalage + entete.length) return false;
  return entete.every((b, i) => o[decalage + i] === b);
}

function octetsAscii(texte: string): number[] {
  return Array.from(texte, (c) => c.charCodeAt(0));
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
/** `_VBA_PROJECT` en UTF-16 : le flux où un Office ancien range ses macros. */
const VBA_OLE = Array.from("_VBA_PROJECT").flatMap((c) => [c.charCodeAt(0), 0]);
const MIMETYPE_ODT = octetsAscii("mimetypeapplication/vnd.oasis.opendocument.text");

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

/**
 * Du balisage (HTML, SVG, XML) — refusé même sous `.txt` ou `.csv`. Le motif
 * n'est pas ancré : il se cherche dans les 8 premiers Ko, où qu'il soit.
 */
export function ressembleABalisage(o: Uint8Array): boolean {
  const debut = new TextDecoder("latin1").decode(o.subarray(0, TAILLE_ENTETE_ANALYSEE));
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

/** Les formats dont la conformité se lit dans le RÉPERTOIRE CENTRAL de l'archive. */
export function demandeRepertoireZip(format: FormatPieceJointe): boolean {
  return format === "docx" || format === "xlsx" || format === "pptx" || format === "odt";
}

function refus(motif: MotifRefus, nom: string): ResultatAnalyse {
  return { ok: false, motif, message: MESSAGES_PIECES_JOINTES[motif](nom) };
}

/**
 * Lecture 1 — le DÉBUT du fichier (les `TAILLE_ENTETE_ANALYSEE` premiers
 * octets) correspond-il au format annoncé par l'extension ?
 */
export function analyserEntetePieceJointe(nom: string, debut: Uint8Array): ResultatAnalyse {
  const ext = extensionPieceJointe(nom);
  if (ext && EXTENSIONS_MACROS.has(ext)) return refus("macros", nom);
  const format = formatDepuisExtension(nom);
  if (!format) return refus("format", nom);
  if (estExecutable(debut)) return refus("contenu", nom);

  let conforme: boolean;
  switch (format) {
    case "pdf":
      conforme = commencePar(debut, [0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
      break;
    case "png":
      conforme = commencePar(debut, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      break;
    case "jpg":
      conforme = commencePar(debut, [0xff, 0xd8, 0xff]);
      break;
    case "zip":
    case "docx":
    case "xlsx":
    case "pptx":
      conforme = commencePar(debut, ZIP);
      break;
    case "odt":
      // L'entrée `mimetype` est la première, stockée sans compression (norme ODF) :
      // son nom (30 octets d'en-tête) puis son contenu.
      conforme = commencePar(debut, ZIP) && commencePar(debut, MIMETYPE_ODT, 30);
      break;
    case "doc":
    case "xls":
    case "ppt":
      conforme = commencePar(debut, OLE);
      break;
    case "txt":
    case "csv":
      conforme = !ressembleABalisage(debut);
      break;
  }
  if (!conforme) return refus("contenu", nom);
  return { ok: true, format, mime: FORMATS_PIECE_JOINTE[format].mime };
}

// ---- Répertoire central d'une archive ZIP -----------------------------------

const u16 = (o: Uint8Array, i: number) => o[i]! | (o[i + 1]! << 8);
const u32 = (o: Uint8Array, i: number) => (u16(o, i) + u16(o, i + 2) * 0x10000) >>> 0;
const u64 = (o: Uint8Array, i: number) => u32(o, i) + u32(o, i + 4) * 0x1_0000_0000;

export interface PlageRepertoire {
  /** Position ABSOLUE du répertoire central dans le fichier. */
  readonly debut: number;
  readonly taille: number;
}

/**
 * Lecture 2a — où est le répertoire central ? `fin` = les derniers octets du
 * fichier (`TAILLE_FIN_ZIP_ANALYSEE` au plus), `tailleTotale` = sa taille
 * réelle. Rend `null` si l'archive est illisible (refusée). Gère ZIP64.
 */
export function localiserRepertoireZip(
  fin: Uint8Array,
  tailleTotale: number,
): PlageRepertoire | null {
  const decalageFin = tailleTotale - fin.length;
  let eocd = -1;
  for (let i = fin.length - 22; i >= 0; i--) {
    if (fin[i] === 0x50 && fin[i + 1] === 0x4b && fin[i + 2] === 0x05 && fin[i + 3] === 0x06) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  let taille = u32(fin, eocd + 12);
  let debut = u32(fin, eocd + 16);
  if (taille === 0xffffffff || debut === 0xffffffff || u16(fin, eocd + 10) === 0xffff) {
    // ZIP64 : le localisateur (20 octets) précède l'enregistrement de fin.
    const loc = eocd - 20;
    if (loc < 0 || u32(fin, loc) !== 0x07064b50) return null;
    const enreg = u64(fin, loc + 8) - decalageFin;
    if (enreg < 0 || enreg + 56 > fin.length || u32(fin, enreg) !== 0x06064b50) return null;
    taille = u64(fin, enreg + 40);
    debut = u64(fin, enreg + 48);
  }
  if (taille <= 0 || debut < 0 || debut + taille > tailleTotale) return null;
  return { debut, taille };
}

/**
 * Lecture 2b — les NOMS des entrées, lus dans le répertoire central. Rend
 * `null` s'il est mal formé. Aucune donnée n'est décompressée.
 */
export function nomsRepertoireZip(repertoire: Uint8Array): string[] | null {
  const noms: string[] = [];
  const decodeur = new TextDecoder("utf-8");
  let i = 0;
  while (i + 46 <= repertoire.length) {
    if (u32(repertoire, i) !== 0x02014b50) return null;
    const lNom = u16(repertoire, i + 28);
    const lExtra = u16(repertoire, i + 30);
    const lComm = u16(repertoire, i + 32);
    if (i + 46 + lNom > repertoire.length) return null;
    noms.push(decodeur.decode(repertoire.subarray(i + 46, i + 46 + lNom)));
    i += 46 + lNom + lExtra + lComm;
  }
  return noms.length > 0 ? noms : null;
}

/**
 * Lecture 2c — la liste des entrées dit-elle le format annoncé, et sans
 * macros ? `vbaProject.bin` / `vbaData.xml` (Office), `Basic/` / `Scripts/` (ODF).
 */
export function analyserRepertoirePieceJointe(
  nom: string,
  format: FormatPieceJointe,
  noms: ReadonlyArray<string> | null,
): ResultatAnalyse {
  if (!noms) return refus("contenu", nom);
  const bas = noms.map((n) => n.toLowerCase());
  if (format === "odt") {
    if (bas.some((n) => n.startsWith("basic/") || n.startsWith("scripts/"))) {
      return refus("macros", nom);
    }
  } else if (format === "docx" || format === "xlsx" || format === "pptx") {
    const dossier = format === "docx" ? "word/" : format === "xlsx" ? "xl/" : "ppt/";
    if (!bas.includes("[content_types].xml") || !bas.some((n) => n.startsWith(dossier))) {
      return refus("contenu", nom);
    }
    if (bas.some((n) => n.endsWith("vbaproject.bin") || n.endsWith("vbadata.xml"))) {
      return refus("macros", nom);
    }
  }
  return { ok: true, format, mime: FORMATS_PIECE_JOINTE[format].mime };
}

// ---- Lecture 3 : le flux complet --------------------------------------------

/**
 * Ce qui ne se voit qu'en lisant TOUT le fichier, morceau par morceau, sans le
 * garder : les macros d'un Office ancien (flux `_VBA_PROJECT`, n'importe où),
 * un caractère de contrôle au milieu d'un texte. Le recouvrement entre deux
 * morceaux garde un motif coupé en deux.
 */
export class ScruteurPieceJointe {
  private queue = new Uint8Array(0);
  private motif: MotifRefus | null = null;

  constructor(private readonly format: FormatPieceJointe) {}

  pousser(morceau: Uint8Array): void {
    if (this.motif) return;
    if (this.format === "txt" || this.format === "csv") {
      if (!texteSain(morceau)) this.motif = "contenu";
      return;
    }
    if (this.format === "doc" || this.format === "xls" || this.format === "ppt") {
      const vue = new Uint8Array(this.queue.length + morceau.length);
      vue.set(this.queue, 0);
      vue.set(morceau, this.queue.length);
      if (indexDe(vue, VBA_OLE) >= 0) this.motif = "macros";
      this.queue = vue.slice(Math.max(0, vue.length - (VBA_OLE.length - 1)));
    }
  }

  verdict(nom: string): ResultatAnalyse {
    if (this.motif) return refus(this.motif, nom);
    return { ok: true, format: this.format, mime: FORMATS_PIECE_JOINTE[this.format].mime };
  }
}

/**
 * Les trois lectures sur un fichier ENTIER en mémoire — pour les tests et pour
 * qui détient déjà les octets. Le serveur, lui, les fait par `Range` dans R2.
 */
export function analyserOctetsPieceJointe(nom: string, o: Uint8Array): ResultatAnalyse {
  const entete = analyserEntetePieceJointe(nom, o.subarray(0, TAILLE_ENTETE_ANALYSEE));
  if (!entete.ok) return entete;
  if (demandeRepertoireZip(entete.format)) {
    const fin = o.subarray(Math.max(0, o.length - TAILLE_FIN_ZIP_ANALYSEE));
    const plage = localiserRepertoireZip(fin, o.length);
    const noms = plage
      ? nomsRepertoireZip(o.subarray(plage.debut, plage.debut + plage.taille))
      : null;
    const r = analyserRepertoirePieceJointe(nom, entete.format, noms);
    if (!r.ok) return r;
  }
  const scruteur = new ScruteurPieceJointe(entete.format);
  scruteur.pousser(o);
  return scruteur.verdict(nom);
}
