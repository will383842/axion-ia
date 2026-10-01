/**
 * Les formats de fichier d'un document de projet (ADR 0063, D4) — LISTE FERMÉE.
 *
 * La base ne stocke que la valeur de `FormatFichierDocument` ; le type MIME,
 * les extensions acceptées et la signature attendue des premiers octets se
 * DÉRIVENT d'ici (RM-01 : aucune colonne MIME). Ajouter un format à l'enum sans
 * le décrire ici fait échouer la compilation (`Record` exhaustif).
 *
 * Module PUR (aucun import d'exécution) : lu par le serveur et par le
 * formulaire du navigateur (taille, liste `accept`).
 */

import type { FormatFichierDocument } from "../../../../prisma/generated/client";

/** 15 Mo — même borne que les CHECK `documents_projet_fichier_taille` et `…_contenus_taille`. */
export const TAILLE_MAX_FICHIER_OCTETS = 15 * 1024 * 1024;

export interface DescriptionFormat {
  /** Type réel du fichier (jamais servi à la console : D7 sert `application/octet-stream`). */
  readonly mime: string;
  /** Extensions acceptées, sans le point, en minuscules ; la première est la principale. */
  readonly extensions: ReadonlyArray<string>;
  /** Format texte : UTF-8 valide, aucun octet nul. */
  readonly texte: boolean;
  /** Libellé court, pour Will (« PDF », « Word »…). */
  readonly libelle: string;
}

const PK = [0x50, 0x4b, 0x03, 0x04] as const;

export const FORMATS: Readonly<Record<FormatFichierDocument, DescriptionFormat>> = {
  pdf: { mime: "application/pdf", extensions: ["pdf"], texte: false, libelle: "PDF" },
  html: { mime: "text/html", extensions: ["html", "htm"], texte: true, libelle: "page web" },
  eml: { mime: "message/rfc822", extensions: ["eml"], texte: true, libelle: "e-mail" },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extensions: ["docx"],
    texte: false,
    libelle: "Word",
  },
  xlsx: {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extensions: ["xlsx"],
    texte: false,
    libelle: "Excel",
  },
  pptx: {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    extensions: ["pptx"],
    texte: false,
    libelle: "PowerPoint",
  },
  png: { mime: "image/png", extensions: ["png"], texte: false, libelle: "image PNG" },
  jpg: { mime: "image/jpeg", extensions: ["jpg", "jpeg"], texte: false, libelle: "image JPG" },
  txt: { mime: "text/plain", extensions: ["txt"], texte: true, libelle: "texte" },
  md: { mime: "text/markdown", extensions: ["md"], texte: true, libelle: "texte" },
  csv: { mime: "text/csv", extensions: ["csv"], texte: true, libelle: "tableau CSV" },
};

/** Pour l'attribut `accept` du champ fichier (confort ; le serveur revérifie). */
export const ACCEPT_FICHIERS = Object.values(FORMATS)
  .flatMap((f) => f.extensions.map((e) => `.${e}`))
  .join(",");

/** L'extension d'un nom, avec son point, en minuscules (`.pdf`), ou `null`. */
export function extensionDe(nom: string): string | null {
  const m = /\.([A-Za-z0-9]{1,10})$/.exec(nom.trim());
  return m ? `.${m[1]!.toLowerCase()}` : null;
}

/** Le format désigné par l'extension du nom, ou `null` (hors liste, ou sans extension). */
export function formatDepuisNom(nom: string): FormatFichierDocument | null {
  const ext = extensionDe(nom)?.slice(1);
  if (!ext) return null;
  for (const [format, d] of Object.entries(FORMATS) as Array<
    [FormatFichierDocument, DescriptionFormat]
  >) {
    if (d.extensions.includes(ext)) return format;
  }
  return null;
}

function commencePar(octets: Uint8Array, entete: ReadonlyArray<number>): boolean {
  if (octets.length < entete.length) return false;
  return entete.every((b, i) => octets[i] === b);
}

function texteUtf8Propre(octets: Uint8Array): boolean {
  if (octets.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(octets);
    return true;
  } catch {
    return false;
  }
}

/** Les premiers octets correspondent-ils au format annoncé par l'extension ? */
export function signatureConforme(format: FormatFichierDocument, octets: Uint8Array): boolean {
  switch (format) {
    case "pdf":
      return commencePar(octets, [0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    case "docx":
    case "xlsx":
    case "pptx":
      return commencePar(octets, PK);
    case "png":
      return commencePar(octets, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "jpg":
      return commencePar(octets, [0xff, 0xd8, 0xff]);
    case "html":
    case "eml":
    case "txt":
    case "md":
    case "csv":
      return texteUtf8Propre(octets);
  }
}

/**
 * La valeur d'un `Content-Disposition: attachment` sûre : un nom ASCII de
 * repli SANS guillemet ni caractère de contrôle, puis le vrai nom encodé
 * (RFC 6266 / 5987). Un nom fourni par un navigateur ne casse jamais l'en-tête.
 */
export function dispositionPieceJointe(nom: string): string {
  const propre = nom.replace(/[\u0000-\u001f\u007f]/g, " ").trim() || "document";
  const ascii =
    propre
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9._ -]/g, "_")
      .slice(0, 150)
      .trim() || "document";
  const encode = encodeURIComponent(propre).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encode}`;
}

/** « 18 Ko », « 1,4 Mo » — pour la ligne d'un document. */
export function tailleLisible(octets: number): string {
  if (octets < 1024 * 1024) return `${Math.max(1, Math.round(octets / 1024))} Ko`;
  const mo = octets / (1024 * 1024);
  return `${mo.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}
